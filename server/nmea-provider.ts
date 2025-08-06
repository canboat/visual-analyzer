/**
 * Copyright 2025 Scott Bender (scott@scottbender.net)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { EventEmitter } from 'events'
import {
  canbus,
  serial as ActisenseStream,
  iKonvert as iKonvertStream,
  pgnToYdgwRawFormat,
  pgnToiKonvertSerialFormat,
  pgnToActisenseN2KAsciiFormat,
} from '@canboat/canboatjs'
import * as net from 'net'
import * as dgram from 'dgram'
import WebSocket from 'ws'
import * as fs from 'fs'
import * as readline from 'readline'
import { NMEAProviderOptions, SignalKMessage, SignalKLoginMessage, SignalKLoginResponse, INMEAProvider } from './types'
import SerialPortStream from './streams/serialport'
import TcpStream from './streams/tcp'

interface SerialPortLike {
  pipe(parser: any): any
  on(event: string, callback: (...args: any[]) => void): void
}

interface ReadlineParserLike {
  on(event: string, callback: (data: string) => void): void
}

class NMEADataProvider extends EventEmitter implements INMEAProvider {
  public options: NMEAProviderOptions
  public isConnected: boolean = false
  public authToken: string | null = null
  private authRequestId: number = 0
  private pendingAuthResolve: ((value: boolean) => void) | null = null

  // Connection objects
  private signalKWs: WebSocket | null = null
  private serialStream: any = null
  private serialPort: SerialPortLike | null = null
  private tcpClient: net.Socket | null = null
  private udpSocket: dgram.Socket | null = null
  private canbusStream: any = null
  private iKonvertStream: any | null = null
  private tcpStream: TcpStream | null = null

  // File playback specific properties
  private fileStream: fs.ReadStream | null = null
  private playbackTimer: NodeJS.Timeout | null = null
  private readline: readline.Interface | null = null
  private lineQueue: string[] = []
  private isProcessingQueue: boolean = false

  constructor(options: NMEAProviderOptions = {} as NMEAProviderOptions) {
    super()
    this.options = options
  }

  public async connect(): Promise<void> {
    try {
      if (this.options.type === 'signalk') {
        await this.connectToSignalK()
      } else if (this.options.type === 'serial') {
        await this.connectToSerial()
      } else if (this.options.type === 'network') {
        await this.connectToNetwork()
      } else if (this.options.type === 'socketcan') {
        await this.connectToSocketCAN()
      } else if (this.options.type === 'file') {
        await this.connectToFile()
      }
    } catch (error) {
      console.error('Failed to connect to NMEA source:', error)
      this.emit('error', error)
    }
  }

  private async connectToSignalK(): Promise<void> {
    const url =
      this.options.signalkUrl!.replace('http', 'ws') + '/signalk/v1/stream?subscribe=none&events=canboatjs:rawoutput'

    console.log('Connecting to SignalK WebSocket:', url)

    this.signalKWs = new WebSocket(url, {
      rejectUnauthorized: false,
    })

    this.signalKWs.on('open', () => {
      console.log('Connected to SignalK server')
      this.isConnected = true
      this.emit('connected')

      // Authenticate if credentials are provided
      if (this.options.signalkUsername && this.options.signalkPassword) {
        this.authenticateViaWebSocket()
      }
    })

    this.signalKWs.on('message', (data: WebSocket.Data) => {
      try {
        const message: SignalKMessage = JSON.parse(data.toString())

        // Handle authentication responses
        if (message.requestId && message.requestId.startsWith('auth-')) {
          this.handleAuthenticationResponse(message as SignalKLoginResponse)
          return
        }

        // Handle logout responses
        if (message.requestId && message.requestId.startsWith('logout-')) {
          this.handleLogoutResponse(message)
          return
        }

        // Handle regular messages
        if (message.event === 'canboatjs:rawoutput') {
          this.emit('raw-nmea', message.data)
        }
      } catch (error) {
        console.error('Error processing SignalK message:', error)
      }
    })

    this.signalKWs.on('error', (error: Error) => {
      console.error('SignalK WebSocket error:', error)
      this.emit('error', error)
    })

    this.signalKWs.on('close', () => {
      console.log('SignalK WebSocket connection closed')
      this.isConnected = false
      this.emit('disconnected')

      // Reject any pending authentication promise
      if (this.pendingAuthResolve) {
        this.pendingAuthResolve(false)
        this.pendingAuthResolve = null
      }
    })
  }

  private authenticateViaWebSocket(): Promise<boolean> {
    if (!this.options.signalkUsername || !this.options.signalkPassword) {
      return Promise.resolve(false)
    }

    return new Promise((resolve) => {
      const requestId = `auth-${++this.authRequestId}`
      this.pendingAuthResolve = resolve

      const loginMessage: SignalKLoginMessage = {
        requestId: requestId,
        login: {
          username: this.options.signalkUsername!,
          password: this.options.signalkPassword!,
        },
      }

      console.log('Sending WebSocket authentication message')
      this.signalKWs!.send(JSON.stringify(loginMessage))

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingAuthResolve === resolve) {
          console.error('SignalK authentication timeout')
          this.pendingAuthResolve = null
          resolve(false)
        }
      }, 10000)
    })
  }

  private handleAuthenticationResponse(message: SignalKLoginResponse): void {
    if (message.statusCode === 200 && message.login && message.login.token) {
      this.authToken = message.login.token
      console.log('SignalK WebSocket authentication successful.')

      if (this.pendingAuthResolve) {
        this.pendingAuthResolve(true)
        this.pendingAuthResolve = null
      }
    } else {
      console.error(`SignalK WebSocket authentication failed with status ${message.statusCode}`)
      this.emit('error', new Error(`SignalK WebSocket authentication failed with status ${message.statusCode}`))
      if (this.pendingAuthResolve) {
        this.pendingAuthResolve(false)
        this.pendingAuthResolve = null
      }
    }
  }

  private handleLogoutResponse(message: SignalKMessage): void {
    if (message.statusCode === 200) {
      console.log('SignalK logout successful')
    } else {
      console.error('SignalK logout failed:', message.statusCode)
    }
    // Clear token regardless of result
    this.authToken = null
  }

  private getServerApp(): any {
    return {
      setProviderError: (providerId: string, msg: string) => {
        console.error(`NMEADataProvider error: ${msg}`)
        this.emit('error', new Error(msg))
      },
      setProviderStatus: (providerId: string, msg: string) => {
        console.log(`NMEADataProvider status: ${msg}`)
      },
      on: (event: string, callback: (...args: any[]) => void) => {
        this.on(event, callback)
      },
      removeListener: (event: string, callback: (...args: any[]) => void) => {
        this.removeListener(event, callback)
      },
      emit: (event: string, data: any) => {
        if (event === 'canboatjs:rawoutput') {
          this.emit('raw-nmea', data)
        } else {
          this.emit(event, data)
        }
      },
      listenerCount: (event: string) => {
        return this.listenerCount(event === 'canboatjs:rawoutput' ? 'raw-nmea' : event)
      },
    }
  }

  private async connectToSerial(): Promise<void> {
    try {
      const deviceType = this.options.deviceType || 'Actisense'
      console.log(`Connecting to serial port: ${this.options.serialPort} (${deviceType})`)

      if (deviceType === 'Actisense' || deviceType === 'Actisense ASCII') {
        // Use ActisenseStream from canboatjs for Actisense NGT-1 devices
        this.serialStream = new (ActisenseStream as any)({
          device: this.options.serialPort!,
          baudrate: this.options.baudRate!,
          reconnect: false,
          app: this.getServerApp(),
        })

        console.log('Actisense serial connection established using canboatjs ActisenseStream')
        this.isConnected = true
        this.emit('connected')
      } else if (deviceType === 'iKonvert') {
        // Use iKonvertStream from canboatjs for Digital Yacht iKonvert devices

        this.serialStream = new SerialPortStream({
          app: this.getServerApp(),
          device: this.options.serialPort!,
          baudrate: this.options.baudRate || 230400,
          toStdout: 'ikonvertOut',
        })

        this.iKonvertStream = new (iKonvertStream as any)({
          app: this.getServerApp(),
          tcp: false,
        })

        this.serialStream.pipe(this.iKonvertStream)

        console.log('iKonvert serial connection established using canboatjs iKonvertStream')
        this.isConnected = true
        this.emit('connected')
      } else {
        // Fall back to generic serial port handling for other devices
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SerialPort = require('serialport')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ReadlineParser } = require('@serialport/parser-readline')

        this.serialPort = new SerialPort({
          path: this.options.serialPort!,
          baudRate: this.options.baudRate || 115200,
        })

        // Configure parser based on device type
        const delimiter = this.getDelimiterForDevice(deviceType)
        const parser: ReadlineParserLike = this.serialPort!.pipe(new ReadlineParser({ delimiter }))

        parser.on('data', (line: string) => {
          const trimmed = line.trim()
          if (trimmed) {
            this.emit('raw-nmea', trimmed)
          }
        })

        this.serialPort!.on('error', (error: Error) => {
          console.error('Serial port error:', error)
          this.emit('error', error)
        })

        console.log(`Generic serial port connected successfully for ${deviceType}`)
      }
    } catch (error) {
      console.error('Failed to connect to serial port:', error)
      throw error
    }
  }

  private async connectToNetwork(): Promise<void> {
    if (this.options.deviceType === 'NavLink2') {
      await this.connectToNavLink2()
    } else {
      if (this.options.networkProtocol === 'udp') {
        await this.connectToUDP()
      } else {
        await this.connectToTCP()
      }
    }
  }

  private async connectToNavLink2(): Promise<void> {
    return new Promise((resolve) => {
      this.tcpStream = new TcpStream({
        app: this.getServerApp(),
        port: this.options.networkPort!,
        host: this.options.networkHost!,
        toStdout: 'navlink2-out',
      })

      this.iKonvertStream = new (iKonvertStream as any)({
        app: this.getServerApp(),
        tcp: true,
      })
      this.tcpStream.pipe(this.iKonvertStream)
      resolve()
    })
  }

  private async connectToTCP(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tcpClient = new net.Socket()

      this.tcpClient.connect(this.options.networkPort!, this.options.networkHost!, () => {
        console.log(`Connected to TCP server: ${this.options.networkHost}:${this.options.networkPort}`)
        this.isConnected = true
        this.emit('connected')
        resolve()
      })

      this.tcpClient.on('data', (data: Buffer) => {
        const lines = data.toString().split(/\r?\n/)
        lines.forEach((line) => {
          const trimmed = line.trim()
          if (trimmed) {
            this.emit('raw-nmea', trimmed)
          }
        })
      })

      this.tcpClient.on('error', (error: Error) => {
        console.error('TCP connection error:', error)
        this.emit('error', error)
        reject(error)
      })

      this.tcpClient.on('close', () => {
        console.log('TCP connection closed')
        this.isConnected = false
        this.emit('disconnected')
      })
    })
  }

  private async connectToUDP(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.udpSocket = dgram.createSocket('udp4')

      this.udpSocket.on('message', (message: Buffer, _remote: dgram.RemoteInfo) => {
        const lines = message.toString().split(/\r?\n/)
        lines.forEach((line) => {
          const trimmed = line.trim()
          if (trimmed) {
            this.emit('raw-nmea', trimmed)
          }
        })
      })

      this.udpSocket.on('error', (error: Error) => {
        console.error('UDP socket error:', error)
        this.emit('error', error)
        reject(error)
      })

      this.udpSocket.bind(this.options.networkPort!, this.options.networkHost!, () => {
        console.log(`UDP socket bound to ${this.options.networkHost}:${this.options.networkPort}`)
        this.isConnected = true
        this.emit('connected')
        resolve()
      })
    })
  }

  private async connectToSocketCAN(): Promise<void> {
    try {
      console.log(`Connecting to SocketCAN interface: ${this.options.socketcanInterface}`)

      this.canbusStream = canbus({
        canDevice: this.options.socketcanInterface!,
        preferredAddress: 0,
        transmitPGNs: [],
        app: this.getServerApp(),
      })

      console.log('SocketCAN connection established using canboatjs canbus')
      this.isConnected = true
      this.emit('connected')
    } catch (error) {
      console.error('Failed to connect to SocketCAN:', error)
      throw error
    }
  }

  private async connectToFile(): Promise<void> {
    try {
      console.log(`Opening file for playback: ${this.options.filePath}`)

      if (!fs.existsSync(this.options.filePath!)) {
        throw new Error(`File not found: ${this.options.filePath}`)
      }

      this.setupFileStream(this.options.filePath!)
      this.isConnected = true
      this.emit('connected')
    } catch (error) {
      console.error('Failed to connect to file:', error)
      throw error
    }
  }

  private setupFileStream(filePath: string): void {
    this.fileStream = fs.createReadStream(filePath)
    this.readline = readline.createInterface({
      input: this.fileStream,
      crlfDelay: Infinity,
    })

    // Read all lines into queue first
    this.readline.on('line', (line: string) => {
      let trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        if (trimmed.length > 15 && trimmed.charAt(13) === ';' && trimmed.charAt(15) === ';') {
          // SignalK Multiplexed format
          if (trimmed.charAt(14) === 'A') {
            trimmed = trimmed.substring(16)
          } else {
            return // Skip unsupported SignalK formats
          }
        }

        this.lineQueue.push(trimmed)
      }
    })

    this.readline.on('close', () => {
      console.log(`File loaded: ${this.lineQueue.length} lines queued for playback`)
      this.startFilePlayback()
    })

    this.readline.on('error', (error: Error) => {
      console.error('File reading error:', error)
      this.emit('error', error)
    })
  }

  private processQueue(): void {
    if (this.isProcessingQueue || this.lineQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    const line = this.lineQueue.shift()!

    // Emit the line
    this.emit('raw-nmea', line)

    // Calculate delay for next line
    const playbackSpeed = this.options.playbackSpeed || 1
    const baseDelay = 1000 // 1 second base delay
    const delay = baseDelay / playbackSpeed

    // Schedule next line
    if (this.lineQueue.length > 0) {
      this.playbackTimer = setTimeout(() => {
        this.isProcessingQueue = false
        this.processQueue()
      }, delay)
    } else {
      console.log('File playback completed')
      this.isProcessingQueue = false
      this.emit('disconnected')
    }
  }

  private startFilePlayback(): void {
    console.log('Starting file playback...')
    this.processQueue()
  }

  private processSignalKUpdate(update: any): void {
    // Process SignalK delta updates and emit them
    this.emit('signalk-data', update)
  }

  public disconnect(): void {
    console.log('Disconnecting from NMEA source...')

    // Clear any pending authentication
    if (this.pendingAuthResolve) {
      this.pendingAuthResolve(false)
      this.pendingAuthResolve = null
    }

    // Logout from SignalK if authenticated
    if (this.authToken && this.signalKWs) {
      this.logoutFromSignalK()
    }

    // Close connections
    if (this.signalKWs) {
      this.signalKWs.close()
      this.signalKWs = null
    }

    if (this.serialStream) {
      if (typeof this.serialStream.end === 'function') {
        this.serialStream.end()
      }

      if (typeof this.serialStream.close === 'function') {
        this.serialStream.close()
      } else if (typeof this.serialStream.destroy === 'function') {
        this.serialStream.destroy()
      }
      this.serialStream = null
    }

    if (this.serialPort && typeof (this.serialPort as any).close === 'function') {
      ;(this.serialPort as any).close()
      this.serialPort = null
    }

    if (this.tcpClient) {
      this.tcpClient.destroy()
      this.tcpClient = null
    }

    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }

    if (this.canbusStream) {
      // SocketCAN stream cleanup
      if (typeof this.canbusStream.close === 'function') {
        this.canbusStream.close()
      }
      this.canbusStream = null
    }

    // File playback cleanup
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer)
      this.playbackTimer = null
    }

    if (this.readline) {
      this.readline.close()
      this.readline = null
    }

    if (this.fileStream) {
      this.fileStream.destroy()
      this.fileStream = null
    }

    if (this.tcpStream) {
      this.tcpStream.end()
      this.tcpStream = null
    }

    this.lineQueue = []
    this.isProcessingQueue = false
    this.isConnected = false

    console.log('Disconnected from NMEA source')
    this.emit('disconnected')
  }

  private logoutFromSignalK(): void {
    if (!this.signalKWs || !this.authToken) {
      return
    }

    const requestId = `logout-${++this.authRequestId}`
    const logoutMessage = {
      requestId: requestId,
      logout: {},
    }

    console.log('Sending SignalK logout message')
    this.signalKWs.send(JSON.stringify(logoutMessage))
  }

  private getDelimiterForDevice(deviceType: string): string | RegExp {
    switch (deviceType) {
      case 'Yacht Devices':
      case 'Yacht Devices RAW':
      case 'NavLink2':
        return '\r\n'
      case 'Actisense':
      case 'Actisense ASCII':
        return '\r\n'
      case 'iKonvert':
        return '\n'
      default:
        return /\r?\n/
    }
  }

  public isConnectionActive(): boolean {
    return this.isConnected
  }

  public getAuthStatus(): any {
    if (this.options.type === 'signalk') {
      return {
        isAuthenticated: !!this.authToken,
        token: this.authToken,
        username: this.options.signalkUsername,
      }
    }
    return null
  }

  public sendMessage(data: any): void {
    if (!this.isConnected) {
      throw new Error('No active connection for message transmission')
    }

    // Implement message sending based on connection type
    switch (this.options.type) {
      case 'signalk':
        this.sendToSignalK(data)
        break
      case 'serial':
        this.sendToSerial(data)
        break
      case 'network':
        this.sendToNetwork(data)
        break
      case 'socketcan':
        this.sendToSocketCAN(data)
        break
      case 'file':
        break
      default:
        throw new Error(`Message transmission not supported for connection type: ${this.options.type}`)
    }
  }

  private sendToSignalK(data: any): void {
    if (!this.signalKWs || this.signalKWs.readyState !== WebSocket.OPEN) {
      throw new Error('SignalK WebSocket not connected')
    }

    // Send as SignalK delta update
    const message = {
      context: 'vessels.self',
      updates: [
        {
          source: {
            label: 'visual-analyzer',
          },
          timestamp: new Date().toISOString(),
          values: data,
        },
      ],
    }

    this.signalKWs.send(JSON.stringify(message))
  }

  private sendToSerial(data: any): void {
    if (!this.serialStream && !this.serialPort) {
      throw new Error('Serial connection not available')
    }
    this.emit('nmea2000JsonOut', data)
  }

  private sendToNetwork(data: any): void {
    // Format data based on device type, similar to serial formatting
    let formattedData: string
    if (typeof data === 'string') {
      formattedData = data
    } else {
      // Use canboatjs formatting functions based on device type
      const deviceType = this.options.deviceType
      const supportedDeviceTypes = [
        'Actisense',
        'Actisense ASCII',
        'iKonvert',
        'Yacht Devices',
        'Yacht Devices RAW',
        'NavLink2',
      ]

      if (deviceType && !supportedDeviceTypes.includes(deviceType)) {
        throw new Error(
          `Unsupported device type for network transmission: ${deviceType}. Supported types: ${supportedDeviceTypes.join(', ')}`,
        )
      }

      switch (deviceType) {
        case 'Actisense ASCII':
          formattedData = pgnToActisenseN2KAsciiFormat(data) || ''
          break
        case 'iKonvert':
        case 'NavLink2':
          formattedData = pgnToiKonvertSerialFormat(data) || ''
          break
        case 'Yacht Devices':
        case 'Yacht Devices RAW': {
          const ydgwResult = pgnToYdgwRawFormat(data)
          formattedData = Array.isArray(ydgwResult) ? ydgwResult.join('\n') : ydgwResult || ''
          break
        }
        default:
          // Default to JSON format if no device type specified
          formattedData = JSON.stringify(data) + '\n'
      }
    }

    // Ensure message ends with newline if not already present
    if (!formattedData.endsWith('\n')) {
      formattedData += '\n'
    }

    if (this.options.networkProtocol === 'tcp') {
      if (!this.tcpClient || this.tcpClient.destroyed) {
        throw new Error('TCP connection not available')
      }
      this.tcpClient.write(formattedData)
    } else if (this.options.networkProtocol === 'udp') {
      if (!this.udpSocket) {
        throw new Error('UDP socket not available')
      }
      const buffer = Buffer.from(formattedData)
      this.udpSocket.send(buffer, this.options.networkPort!, this.options.networkHost!, (error) => {
        if (error) {
          console.error('Error sending UDP message:', error)
          throw error
        }
      })
    } else {
      throw new Error(`Unsupported network protocol: ${this.options.networkProtocol}`)
    }
  }

  private sendToSocketCAN(data: any): void {
    if (!this.canbusStream) {
      throw new Error('SocketCAN connection not available')
    }

    this.canbusStream.sendPGN(data)
  }
}

export default NMEADataProvider
