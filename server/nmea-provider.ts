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
import WebSocket from 'ws'
import * as fs from 'fs'
import * as readline from 'readline'
import { SignalKMessage, SignalKLoginMessage, SignalKLoginResponse, INMEAProvider, ConnectionProfile, Config } from './types'
import CanDevice from './n2k-device'

class NMEADataProvider extends EventEmitter implements INMEAProvider {
  public options: ConnectionProfile
  private configPath: string
  private isConnected: boolean = false
  private authToken: string | null = null
  private authRequestId: number = 0
  private pendingAuthResolve: ((value: boolean) => void) | null = null

  // Connection objects
  private signalKWs: WebSocket | null = null
  private canDevice: CanDevice | null = null

  // File playback specific properties
  private fileStream: fs.ReadStream | null = null
  private playbackTimer: NodeJS.Timeout | null = null
  private readline: readline.Interface | null = null
  private lineQueue: string[] = []
  private isProcessingQueue: boolean = false

  constructor(options: ConnectionProfile, configPath: string) {
    super()
    this.options = options
    this.configPath = configPath
  }

  public async connect(): Promise<void> {
    try {
      if (this.options.type === 'signalk') {
        await this.connectToSignalK()
      } else if (this.options.type === 'file') {
        await this.connectToFile()
      } else {
        this.canDevice = new CanDevice(this.getServerApp(), this.options)
        await this.canDevice.start()
        this.isConnected = true
        this.emit('connected')
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

  public getServerApp(): any {
    return {
      config: { configPath: this.configPath },
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

    if (this.canDevice) {
      this.canDevice.end()
      this.canDevice = null
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
      case 'serial':
      case 'network':
      case 'socketcan':
        this.canDevice?.send(data)
        break
      case 'file':
      case 'signalk':
        break
      default:
        throw new Error(`Message transmission not supported for connection type: ${this.options.type}`)
    }
  }

  /*
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
  }*/
}

export default NMEADataProvider
