const EventEmitter = require('events')
const { CanboatJS } = require('@canboat/canboatjs')

class NMEADataProvider extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.canboat = new CanboatJS()
    this.isConnected = false
    
    // Configure canboatjs
    this.canboat.on('data', (data) => {
      this.emit('nmea-data', data)
    })

    this.canboat.on('error', (error) => {
      console.error('CanboatJS error:', error)
      this.emit('error', error)
    })
  }

  async connect() {
    try {
      if (this.options.signalkUrl) {
        await this.connectToSignalK()
      }
      
      if (this.options.serialPort) {
        await this.connectToSerial()
      }
      
      if (this.options.networkHost) {
        await this.connectToNetwork()
      }
      
      this.isConnected = true
      this.emit('connected')
    } catch (error) {
      console.error('Failed to connect to NMEA source:', error)
      this.emit('error', error)
    }
  }

  async connectToSignalK() {
    const WebSocket = require('ws')
    const url = this.options.signalkUrl.replace('http', 'ws') + '/signalk/v1/stream'
    
    console.log('Connecting to SignalK WebSocket:', url)
    
    this.signalKWs = new WebSocket(url)
    
    this.signalKWs.on('open', () => {
      console.log('Connected to SignalK server')
      
      // Subscribe to NMEA 2000 data
      this.signalKWs.send(JSON.stringify({
        context: 'vessels.self',
        subscribe: [{
          path: '*',
          period: 100,
          format: 'delta',
          policy: 'ideal',
          minPeriod: 50
        }]
      }))
    })

    this.signalKWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        
        // Convert SignalK delta to NMEA 2000 format for visualization
        if (message.updates && message.updates.length > 0) {
          this.emit('signalk-data', message)
          
          // If we have raw NMEA data, process it with canboatjs
          message.updates.forEach(update => {
            if (update.source && update.source.label && update.source.label.includes('NMEA2000')) {
              // Extract PGN and raw data if available
              this.processSignalKUpdate(update)
            }
          })
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

  async connectToSerial() {
    try {
      const SerialPort = require('serialport')
      const { ReadlineParser } = require('@serialport/parser-readline')
      
      console.log(`Connecting to serial port: ${this.options.serialPort}`)
      
      this.serialPort = new SerialPort({
        path: this.options.serialPort,
        baudRate: this.options.baudRate || 115200
      })

      const parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }))
      
      parser.on('data', (line) => {
        const trimmed = line.trim()
        if (trimmed) {
          // Process NMEA 2000 data with canboatjs
          this.canboat.parseString(trimmed)
          this.emit('raw-nmea', trimmed)
        }
      })

      this.serialPort.on('error', (error) => {
        console.error('Serial port error:', error)
        this.emit('error', error)
      })

      console.log('Serial port connected successfully')
    } catch (error) {
      console.error('Failed to connect to serial port:', error)
      throw error
    }
  }

  async connectToNetwork() {
    const net = require('net')
    const dgram = require('dgram')
    
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
    })

    this.tcpClient.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach(line => {
        const trimmed = line.trim()
        if (trimmed) {
          this.canboat.parseString(trimmed)
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
          this.canboat.parseString(trimmed)
          this.emit('raw-nmea', trimmed)
        }
      })
    })

    this.udpSocket.on('error', (error) => {
      console.error('UDP socket error:', error)
      this.emit('error', error)
    })

    this.udpSocket.bind(this.options.networkPort)
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
    
    if (this.tcpClient) {
      this.tcpClient.destroy()
    }
    
    if (this.udpSocket) {
      this.udpSocket.close()
    }
    
    this.emit('disconnected')
  }

  isConnectionActive() {
    return this.isConnected
  }
}

module.exports = NMEADataProvider
