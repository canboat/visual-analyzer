const EventEmitter = require('events')
const { CanboatJS } = require('@canboat/canboatjs')
const net = require('net')
const dgram = require('dgram')
const WebSocket = require('ws')

class NMEADataProvider extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    //this.canboat = new CanboatJS()
    this.isConnected = false
    
    // Configure canboatjs
    /*
    this.canboat.on('data', (data) => {
      this.emit('nmea-data', data)
    })

    this.canboat.on('error', (error) => {
      console.error('CanboatJS error:', error)
      this.emit('error', error)
    })
      **/
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
      
      const deviceType = this.options.deviceType || 'Actisense'
      console.log(`Connecting to serial port: ${this.options.serialPort} (${deviceType})`)
      
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
          // Process data based on device type
          const processedData = this.processSerialData(trimmed, deviceType)
          if (processedData) {
            // Process NMEA 2000 data with canboatjs (when enabled)
            // this.canboat.parseString(processedData)
            this.emit('raw-nmea', processedData)
          }
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
          //this.canboat.parseString(trimmed)
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
          // this.canboat.parseString(trimmed)
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

  processSerialData(data, deviceType) {
    switch (deviceType) {
      case 'Actisense':
        return this.processActisenseData(data)
      case 'iKonvert':
        return this.processIKonvertData(data)
      case 'Yacht Devices':
        return this.processYachtDevicesData(data)
      default:
        return data
    }
  }

  processActisenseData(data) {
    // Actisense NGT-1 formats:
    // - ASCII format: timestamp,priority,pgn,src,dst,len,data
    // - Some variations may include additional fields
    if (data.includes(',')) {
      return data  // Already in canboat format
    }
    return null  // Skip invalid data
  }

  processIKonvertData(data) {
    // iKonvert format processing
    // Typically outputs in standard NMEA 2000 format
    if (data.includes(',')) {
      return data
    }
    return null
  }

  processYachtDevicesData(data) {
    // Yacht Devices format processing
    // YDWG-02 and similar devices
    if (data.includes(',')) {
      return data
    }
    return null
  }

  isConnectionActive() {
    return this.isConnected
  }

  // Send NMEA 2000 message to the network
  sendMessage(pgnData) {
    if (!this.isConnected) {
      throw new Error('No active connection to send message')
    }
    /*
    // For now, we'll log the message and potentially broadcast it
    // In a real implementation, this would send the message through the appropriate interface
    console.log('Sending NMEA 2000 message:', {
      pgn: pgnData.pgn,
      src: pgnData.src,
      dest: pgnData.dest,
      data: pgnData
    })

    // If we have an active TCP connection (like Yacht Devices), we could send it there
    if (this.tcpClient && this.tcpClient.readyState === 'open') {
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
    } else if (this.udpClient) {
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
    } else {
      // No physical connection available - message will only be broadcast to WebSocket clients
      console.log('No physical network connection - message broadcast only')
    }
      */
  }

  // Format PGN message for transmission to the device
  formatMessageForDevice(pgnData) {
    // This is a simplified implementation
    // In practice, different devices expect different formats
    
    if (this.options.deviceType === 'Actisense') {
      // Actisense NGT-1 format
      // Would need proper implementation for each device type
      return null // Not implemented yet
    } else if (this.options.deviceType === 'iKonvert') {
      // iKonvert format
      return null // Not implemented yet
    } else if (this.options.deviceType === 'Yacht Devices') {
      // Yacht Devices format - typically accepts canboat format
      const timestamp = new Date().toISOString()
      const priority = pgnData.priority || 6
      const src = pgnData.src || 1
      const dest = pgnData.dest || 255
      const pgn = pgnData.pgn
      
      // Simple placeholder data - would need proper PGN encoding
      const dataBytes = 'ff,ff,ff,ff,ff,ff,ff,ff'
      const len = 8
      
      return `${timestamp},${priority},${src},${dest},${pgn},${len},${dataBytes}`
    }
    
    return null
  }
}

module.exports = NMEADataProvider
