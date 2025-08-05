/**
 * NMEA Data Provider for Visual Analyzer
 *
 * This module provides connectivity to various NMEA 2000 data sources including:
 * - SignalK WebSocket connections (with authentication support)
 * - Serial devices (Actisense NGT-1, iKonvert, Yacht Devices)
 * - Network sources (TCP/UDP)
 * - SocketCAN interfaces (Linux only)
 *
 * Updated to use specialized canboatjs streams:
 * - ActisenseStream for Actisense NGT-1 serial devices
 * - iKonvertStream for Digital Yacht iKonvert serial devices
 * - canbus for SocketCAN connections
 * - Proper message formatting with pgnToActisenseSerialFormat and pgnToiKonvertSerialFormat
 *
 * SignalK Authentication Features:
 * - WebSocket-based authentication using login/logout messages
 * - Authenticated message sending with token inclusion
 * - Graceful handling of servers without authentication
 *
 * Features:
 * - Robust NMEA 2000 message handling and parsing
 * - Automatic reconnection for SocketCAN
 * - Device-specific optimizations
 * - Bidirectional communication support
 * - SignalK security specification compliance
 */

const EventEmitter = require('events')
const {
  canbus,
  serial: ActisenseStream,
  iKonvert: iKonvertStream,
  pgnToYdgwRawFormat,
  pgnToiKonvertSerialFormat,
  pgnToActisenseN2KAsciiFormat,
} = require('@canboat/canboatjs')
const net = require('net')
const dgram = require('dgram')
const WebSocket = require('ws')
const fs = require('fs')
const readline = require('readline')

class NMEADataProvider extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.isConnected = false
    this.authToken = null
    this.authRequestId = 0
    this.pendingAuthResolve = null
    
    // File playback specific properties
    this.fileStream = null
    this.playbackTimer = null
    this.readline = null
    this.lineQueue = []
    this.isProcessingQueue = false
  }

  async connect() {
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

  async connectToSignalK() {
    const url =
      this.options.signalkUrl.replace('http', 'ws') + '/signalk/v1/stream?subscribe=none&events=canboatjs:rawoutput'

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

    this.signalKWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())

        // Handle authentication responses
        if (message.requestId && message.requestId.startsWith('auth-')) {
          this.handleAuthenticationResponse(message)
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

    this.signalKWs.on('error', (error) => {
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

  authenticateViaWebSocket() {
    if (!this.options.signalkUsername || !this.options.signalkPassword) {
      return Promise.resolve(false)
    }

    return new Promise((resolve) => {
      const requestId = `auth-${++this.authRequestId}`
      this.pendingAuthResolve = resolve

      const loginMessage = {
        requestId: requestId,
        login: {
          username: this.options.signalkUsername,
          password: this.options.signalkPassword,
        },
      }

      console.log('Sending WebSocket authentication message')
      this.signalKWs.send(JSON.stringify(loginMessage))

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

  handleAuthenticationResponse(message) {
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

  handleLogoutResponse(message) {
    if (message.statusCode === 200) {
      console.log('SignalK logout successful')
    } else {
      console.error('SignalK logout failed:', message.statusCode)
    }
    // Clear token regardless of result
    this.authToken = null
  }

  getServerApp() {
    return {
      setProviderError: (providerId, msg) => {
        console.error(`NMEADataProvider error: ${msg}`)
        this.emit('error', new Error(msg))
      },
      setProviderStatus: (providerId, msg) => {
        console.log(`NMEADataProvider status: ${msg}`)
      },
      on: (event, callback) => {
        this.on(event, callback)
      },
      removeListener: (event, callback) => {
        this.removeListener(event, callback)
      },
      emit: (event, data) => {
        if (event === 'canboatjs:rawoutput') {
          this.emit('raw-nmea', data)
        }
      },
      listenerCount: (event) => {
        return this.listenerCount(event === 'canboatjs:rawoutput' ? 'raw-nmea' : event)
      },
    }
  }

  async connectToSerial() {
    try {
      const deviceType = this.options.deviceType || 'Actisense'
      console.log(`Connecting to serial port: ${this.options.serialPort} (${deviceType})`)

      if (deviceType === 'Actisense') {
        // Use ActisenseStream from canboatjs for Actisense NGT-1 devices
        this.serialStream = new ActisenseStream({
          device: this.options.serialPort,
          baudrate: this.options.baudRate,
          reconnect: false,
          app: this.getServerApp(),
        })

        console.log('Actisense serial connection established using canboatjs ActisenseStream')
        this.isConnected = true
        this.emit('connected')
      } else if (deviceType === 'iKonvert') {
        // Use iKonvertStream from canboatjs for Digital Yacht iKonvert devices
        this.serialStream = new iKonvertStream({
          device: this.options.serialPort,
          baudrate: this.options.baudRate || 230400,
          app: this.getServerApp(),
        })

        console.log('iKonvert serial connection established using canboatjs iKonvertStream')
        this.isConnected = true
        this.emit('connected')
      } else {
        // Fall back to generic serial port handling for other devices
        const SerialPort = require('serialport')
        const { ReadlineParser } = require('@serialport/parser-readline')

        this.serialPort = new SerialPort({
          path: this.options.serialPort,
          baudRate: this.options.baudRate || 115200,
        })

        // Configure parser based on device type
        const delimiter = this.getDelimiterForDevice(deviceType)
        const parser = this.serialPort.pipe(new ReadlineParser({ delimiter }))

        parser.on('data', (line) => {
          const trimmed = line.trim()
          if (trimmed) {
            this.emit('raw-nmea', trimmed)
          }
        })

        this.serialPort.on('error', (error) => {
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

  async connectToNetwork() {
    if (this.options.networkProtocol === 'udp') {
      await this.connectToUDP()
    } else {
      await this.connectToTCP()
    }
  }

  async connectToTCP() {
    console.log(`Connecting to TCP source: ${this.options.networkHost}:${this.options.networkPort}`)

    this.tcpClient = net.createConnection({
      host: this.options.networkHost,
      port: this.options.networkPort,
    })

    this.tcpClient.on('connect', () => {
      console.log('TCP connection established')
      this.isConnected = true
      this.emit('connected')
    })

    this.tcpClient.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach((line) => {
        const trimmed = line.trim()
        if (trimmed) {
          this.emit('raw-nmea', trimmed)
        }
      })
    })

    this.tcpClient.on('error', (error) => {
      console.error('TCP connection error:', error)
      this.emit('error', error)
    })

    this.tcpClient.on('close', () => {
      console.log('TCP connection closed')
      this.isConnected = false
      this.emit('disconnected')
    })
  }

  async connectToUDP() {
    console.log(`Listening for UDP data on port: ${this.options.networkPort}`)

    this.udpSocket = dgram.createSocket('udp4')

    this.udpSocket.on('message', (msg) => {
      const lines = msg.toString().split('\n')
      lines.forEach((line) => {
        const trimmed = line.trim()
        if (trimmed) {
          this.emit('raw-nmea', trimmed)
        }
      })
    })

    this.udpSocket.on('error', (error) => {
      console.error('UDP socket error:', error)
      this.emit('error', error)
    })

    this.udpSocket.bind(this.options.networkPort)
    this.isConnected = true
    this.emit('connected')
  }

  async connectToSocketCAN() {
    try {
      console.log(`Connecting to SocketCAN interface: ${this.options.socketcanInterface}`)

      // Create canbus stream with SocketCAN interface using canboatjs
      // This replaces the direct socketcan implementation with the more robust
      // canboatjs canbus class which handles:
      // - Automatic reconnection on failures
      // - Proper NMEA 2000 message parsing
      // - CAN ID encoding/decoding
      // - Multi-frame message assembly
      // - Device address claiming
      const canbusOptions = {
        canDevice: this.options.socketcanInterface || 'can0',
        app: this.getServerApp(),
      }

      this.canbusStream = new canbus(canbusOptions)

      // Start the canbus stream
      this.canbusStream.start()
      console.log('SocketCAN connection established using canboatjs canbus')
      this.isConnected = true
      this.emit('connected')
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.error('SocketCAN support requires the "socketcan" npm package. Install with: npm install socketcan')
        throw new Error('SocketCAN package not installed. Run: npm install socketcan')
      } else {
        console.error('Failed to connect to SocketCAN:', error)
        throw error
      }
    }
  }

  async connectToFile() {
    try {
      const filePath = this.options.filePath
      if (!filePath) {
        throw new Error('File path is required for file connections')
      }

      console.log(`Connecting to file: ${filePath}`)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      // Read file stats
      const stats = fs.statSync(filePath)
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`)
      }

      console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`)

      // Set up streaming file reader
      this.setupFileStream(filePath)
      
      this.isConnected = true
      this.emit('connected')
      
      // Start playback
      this.startFilePlayback()

    } catch (error) {
      console.error('Failed to connect to file:', error)
      throw error
    }
  }

  setupFileStream(filePath) {
    this.fileStream = fs.createReadStream(filePath)
    this.readline = readline.createInterface({
      input: this.fileStream,
      crlfDelay: Infinity // Handle Windows line endings
    })

    // Handle each line as it's read
    this.readline.on('line', (line) => {
      if (!this.isConnected) {
        return // Stop processing if disconnected
      }

      line = line.trim()
      if (line && !line.startsWith('#')) { // Skip empty lines and comments

        if (line.length > 15 && line.charAt(13) === ';' && line.charAt(15) === ';') {
          // SignalK Multiplexed format
          if (line.charAt(14) === 'A') {
            line = line.substring(16)
          } else {
            return // Skip unsupported SignalK formats
          }
        }

        // Add line to queue for processing
        this.lineQueue.push(line)
        
        // Start processing queue if not already processing
        if (!this.isProcessingQueue) {
          this.processQueue()
        }
      }
    })

    // Handle end of file
    this.readline.on('close', () => {
      if (!this.isConnected) {
        return
      }

      // Wait for queue to finish processing before handling end of file
      const checkQueue = () => {
        if (this.lineQueue.length === 0 && !this.isProcessingQueue) {
          if (this.options.loopPlayback) {
            console.log('End of file reached, looping back to start')
            // Restart the file stream for looping
            setTimeout(() => {
              if (this.isConnected) {
                this.setupFileStream(filePath)
              }
            }, 100)
          } else {
            console.log('End of file reached, playback complete')
            this.disconnect()
          }
        } else {
          // Check again after a short delay
          setTimeout(checkQueue, 100)
        }
      }
      
      checkQueue()
    })

    this.readline.on('error', (error) => {
      console.error('Error reading file:', error)
      this.emit('error', error)
    })
  }

  processQueue() {
    if (!this.isConnected || this.lineQueue.length === 0) {
      this.isProcessingQueue = false
      return
    }

    this.isProcessingQueue = true
    const line = this.lineQueue.shift()
    
    // Simply emit each line as raw NMEA data
    this.emit('raw-nmea', line)

    // Schedule next line based on playback speed
    const playbackSpeed = this.options.playbackSpeed || 1.0
    let delay = 0
    
    if (playbackSpeed === 0) {
      // Maximum speed - no delay
      delay = 0
    } else {
      // Calculate delay based on speed (base 100ms interval)
      delay = 100 / playbackSpeed
    }

    if (delay === 0) {
      // No delay - process immediately
      setImmediate(() => this.processQueue())
    } else {
      // Schedule next line with delay
      this.playbackTimer = setTimeout(() => this.processQueue(), delay)
    }
  }

  startFilePlayback() {
    const playbackSpeed = this.options.playbackSpeed || 1.0
    console.log(`Starting file playback at ${playbackSpeed}x speed`)
    
    // Processing will start automatically when lines are added to queue
    // No need to do anything special here
  }

  processSignalKUpdate(update) {
    // Convert SignalK update back to NMEA 2000 format if possible
    // This is a simplified conversion - in practice, you might want more sophisticated handling
    if (update.source && update.source.pgn) {
      const pgn = update.source.pgn
      const timestamp = new Date(update.timestamp || Date.now()).toISOString()

      // Create a synthetic NMEA 2000 message for visualization
      const syntheticMessage = `${timestamp},2,${pgn},1,255,8,00,00,00,00,00,00,00,00`
      this.emit('synthetic-nmea', syntheticMessage)
    }
  }

  disconnect() {
    this.isConnected = false

    // Logout from SignalK if we have a token
    if (this.signalKWs && this.authToken && this.signalKWs.readyState === WebSocket.OPEN) {
      this.logoutFromSignalK()
    }

    if (this.signalKWs) {
      this.signalKWs.close()
    }

    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close()
    }

    if (this.serialStream) {
      this.serialStream.end()
    }

    if (this.tcpClient) {
      this.tcpClient.destroy()
    }

    if (this.udpSocket) {
      this.udpSocket.close()
    }

    if (this.canbusStream) {
      this.canbusStream.end()
    }

    // Clean up file playback resources
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

    // Clear file playback state
    this.lineQueue = []
    this.isProcessingQueue = false

    // Clear authentication data
    this.authToken = null

    this.emit('disconnected')
  }

  logoutFromSignalK() {
    if (!this.authToken || !this.signalKWs || this.signalKWs.readyState !== WebSocket.OPEN) {
      return
    }

    const requestId = `logout-${++this.authRequestId}`
    const logoutMessage = {
      requestId: requestId,
      logout: {
        token: this.authToken,
      },
    }

    console.log('Sending SignalK logout message')
    this.signalKWs.send(JSON.stringify(logoutMessage))
  }

  getDelimiterForDevice(deviceType) {
    switch (deviceType) {
      case 'Actisense':
        return '\n' // Actisense uses newline
      case 'iKonvert':
        return '\r\n' // iKonvert typically uses CRLF
      case 'Yacht Devices':
        return '\n' // Yacht Devices uses newline
      default:
        return '\n'
    }
  }

  isConnectionActive() {
    return this.isConnected
  }

  isAuthenticated() {
    return !!this.authToken
  }

  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated(),
      hasToken: !!this.authToken,
    }
  }

  // Send NMEA 2000 message to the network
  sendMessage(pgnData) {
    if (!this.isConnected) {
      throw new Error('No active connection to send message')
    }

    console.log('Sending NMEA 2000 message:', {
      pgn: pgnData.pgn,
      src: pgnData.src,
      dest: pgnData.dest,
      data: pgnData,
    })

    // If we have a SignalK WebSocket connection, send through it with authentication
    if (this.signalKWs && this.signalKWs.readyState === WebSocket.OPEN) {
      try {
        // Create the message payload with authentication token if available
        const messagePayload = {
          context: '*',
          ...pgnData,
        }

        this.signalKWs.send(JSON.stringify(messagePayload))
        console.log('Message sent via SignalK WebSocket connection')
        return
      } catch (error) {
        console.error('Error sending message via SignalK WebSocket:', error)
        throw error
      }
    }
    // If we have a canbus connection (SocketCAN), send through it
    else if (this.canbusStream) {
      try {
        this.canbusStream.sendPGN(pgnData)
        console.log('Message sent via SocketCAN connection')
        return
      } catch (error) {
        console.error('Error sending message via SocketCAN:', error)
        throw error
      }
    } else if (this.serialStream) {
      this.emit('nmea2000JsonOut', pgnData)
    } else if (this.tcpClient && this.tcpClient.readyState === 'open') {
      try {
        // Convert PGN to the format expected by the device
        const message = this.formatMessageForDevice(pgnData)
        if (message) {
          this.tcpClient.write(message + '\r\n')
          console.log('Message sent via TCP connection')
        }
      } catch (error) {
        console.error('Error sending message via TCP:', error)
        throw error
      }
    } /*else if (this.udpClient) {
      try {
        const message = this.formatMessageForDevice(pgnData)
        if (message) {
          this.udpClient.send(message, this.options.networkPort, this.options.networkHost)
          console.log('Message sent via UDP connection')
        }
      } catch (error) {
        console.error('Error sending message via UDP:', error)
        throw error
      }
    }*/ else {
      // No physical connection available - message will only be broadcast to WebSocket clients
      console.log('No physical network connection - message broadcast only')
    }
  }

  formatMessageForDevice(pgnData) {
    const deviceType = this.options.deviceType || 'Actisense'
    if (deviceType === 'iKonvert') {
      return pgnToiKonvertSerialFormat(pgnData)
    } else if (deviceType === 'Actisense ASCII') {
      return pgnToActisenseN2KAsciiFormat(pgnData)
    } else if (deviceType === 'Yacht Devices RAW') {
      return pgnToYdgwRawFormat(pgnData)
    }
  }
}

module.exports = NMEADataProvider
