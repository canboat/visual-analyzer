/**
 * NMEA Data Provider for Visual Analyzer
 * 
 * This module provides connectivity to various NMEA 2000 data sources including:
 * - SignalK WebSocket connections
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
 * Features:
 * - Robust NMEA 2000 message handling and parsing
 * - Automatic reconnection for SocketCAN
 * - Device-specific optimizations
 * - Bidirectional communication support
 */

const EventEmitter = require('events')
const { canbus, serial: ActisenseStream, iKonvert: iKonvertStream, pgnToYdgwRawFormat, pgnToiKonvertSerialFormat, pgnToActisenseN2KAsciiFormat } = require('@canboat/canboatjs')
const net = require('net')
const dgram = require('dgram')
const WebSocket = require('ws')

class NMEADataProvider extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.isConnected = false
  }

  async connect() {
    try {
      if ( this.options.type === 'signalk' ) {
        await this.connectToSignalK()
      } else if (this.options.type === 'serial') {
        await this.connectToSerial()
      } else if (this.options.type === 'network') {
        await this.connectToNetwork()
      } else if (this.options.type === 'socketcan') {
        await this.connectToSocketCAN()
      }      
    } catch (error) {
      console.error('Failed to connect to NMEA source:', error)
      this.emit('error', error)
    }
  }

  async connectToSignalK() {
    const url = this.options.signalkUrl.replace('http', 'ws') + '/signalk/v1/stream?subscribe=none&events=canboatjs:rawoutput'
    
    console.log('Connecting to SignalK WebSocket:', url)

    this.signalKWs = new WebSocket(url, {
      rejectUnauthorized: false
    })

    this.signalKWs.on('open', () => {
      console.log('Connected to SignalK server')
      this.isConnected = true
      this.emit('connected')
    })
      
    this.signalKWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())

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
    })
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
      }
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
          app: this.getServerApp()
        })

        console.log('Actisense serial connection established using canboatjs ActisenseStream')
        this.isConnected = true
        this.emit('connected')

      } else if (deviceType === 'iKonvert') {
        // Use iKonvertStream from canboatjs for Digital Yacht iKonvert devices
        this.serialStream = new iKonvertStream({
          device: this.options.serialPort,
          baudrate: this.options.baudRate || 230400,
          app: this.getServerApp()
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
          baudRate: this.options.baudRate || 115200
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
      port: this.options.networkPort
    })

    this.tcpClient.on('connect', () => {
      console.log('TCP connection established')
      this.isConnected = true
      this.emit('connected')
    })

    this.tcpClient.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach(line => {
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

    this.udpSocket.on('message', (msg, rinfo) => {
      const lines = msg.toString().split('\n')
      lines.forEach(line => {
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
    
    this.emit('disconnected')
  }

  getDelimiterForDevice(deviceType) {
    switch (deviceType) {
      case 'Actisense':
        return '\n'  // Actisense uses newline
      case 'iKonvert':
        return '\r\n'  // iKonvert typically uses CRLF
      case 'Yacht Devices':
        return '\n'  // Yacht Devices uses newline
      default:
        return '\n'
    }
  }

  isConnectionActive() {
    return this.isConnected
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
      data: pgnData
    })

    // If we have a canbus connection (SocketCAN), send through it
    if (this.canbusStream ) {
      try {
        this.canbusStream.sendPGN(pgnData)
        console.log('Message sent via SocketCAN connection')
        return
      } catch (error) {
        console.error('Error sending message via SocketCAN:', error)
        throw error
      }
    } else if (this.serialStream ) {
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
    }/*else if (this.udpClient) {
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
