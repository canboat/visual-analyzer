const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')
const NMEADataProvider = require('./nmea-provider')

class VisualAnalyzerServer {
  constructor(options = {}) {
    this.port = options.port || 8080
    this.publicDir = options.publicDir || path.join(__dirname, '../public')
    this.app = express()
    this.server = http.createServer(this.app)
    this.wss = new WebSocket.Server({ server: this.server })
    this.nmeaProvider = null
    
    this.setupRoutes()
    this.setupWebSocket()
  }

  setupRoutes() {
    // Serve static files from public directory
    this.app.use(express.static(this.publicDir))
    
    // Serve the main HTML file for any route (SPA support)
    this.app.get('*', (req, res) => {
      const indexPath = path.resolve(this.publicDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
      } else {
        res.status(404).send('Visual Analyzer not built. Run npm run build first.')
      }
    })
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected from:', req.socket.remoteAddress)
      
      // Send initial connection message
      ws.send(JSON.stringify({
        event: 'connection',
        message: 'Connected to Visual Analyzer WebSocket server'
      }))

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          console.log('Received WebSocket message:', data)
          
          // Echo back for now - can be extended for specific message handling
          this.handleWebSocketMessage(ws, data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      })

      // Handle client disconnect
      ws.on('close', () => {
        console.log('WebSocket client disconnected')
      })

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
      })
    })
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        console.log('Client subscribing to:', data.subscription)
        // Start sending data for the requested subscription
        this.startDataStream(ws, data.subscription)
        break
      
      case 'unsubscribe':
        console.log('Client unsubscribing from:', data.subscription)
        // Stop sending data for the subscription
        this.stopDataStream(ws, data.subscription)
        break
      
      default:
        console.log('Unknown message type:', data.type)
    }
  }

  startDataStream(ws, subscription) {
    // If we have a real NMEA provider, the data will come through events
    // For fallback, we'll still provide sample data if no real source is connected
    if (!this.nmeaProvider || !this.nmeaProvider.isConnectionActive()) {
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const sampleData = this.generateSampleNMEAData()
          ws.send(JSON.stringify({
            event: 'canboatjs:rawoutput',
            data: sampleData,
            timestamp: new Date().toISOString()
          }))
        } else {
          clearInterval(interval)
        }
      }, 1000)

      // Store interval reference on the WebSocket for cleanup
      if (!ws.intervals) ws.intervals = []
      ws.intervals.push(interval)
    }
  }

  stopDataStream(ws, subscription) {
    // Clean up intervals when unsubscribing
    if (ws.intervals) {
      ws.intervals.forEach(interval => clearInterval(interval))
      ws.intervals = []
    }
  }

  generateSampleNMEAData() {
    // Generate sample NMEA 2000 data in the format expected by canboatjs
    const timestamp = new Date().toISOString()
    const pgns = [
      '127251,1,255,8,ff,ff,ff,ff,7f,ff,ff,ff', // Rate of Turn
      '127250,1,255,8,00,fc,ff,ff,ff,ff,ff,ff', // Vessel Heading
      '129026,1,255,8,ff,ff,00,00,ff,7f,ff,ff', // COG & SOG
      '127258,1,255,8,ff,7f,ff,ff,ff,ff,ff,ff', // Magnetic Variation
    ]
    
    const randomPgn = pgns[Math.floor(Math.random() * pgns.length)]
    return `${timestamp},2,${randomPgn}`
  }

  // Method to integrate with actual NMEA 2000 data sources
  connectToNMEASource(options) {
    console.log('Connecting to NMEA 2000 source with options:', options)
    
    this.nmeaProvider = new NMEADataProvider(options)
    
    // Set up event listeners for NMEA data
    this.nmeaProvider.on('nmea-data', (data) => {
      this.broadcast({
        event: 'canboatjs:parsed',
        data: data,
        timestamp: new Date().toISOString()
      })
    })

    this.nmeaProvider.on('raw-nmea', (rawData) => {
      this.broadcast({
        event: 'canboatjs:rawoutput',
        data: rawData,
        timestamp: new Date().toISOString()
      })
    })

    this.nmeaProvider.on('signalk-data', (data) => {
      this.broadcast({
        event: 'signalk:delta',
        data: data,
        timestamp: new Date().toISOString()
      })
    })

    this.nmeaProvider.on('synthetic-nmea', (data) => {
      this.broadcast({
        event: 'canboatjs:synthetic',
        data: data,
        timestamp: new Date().toISOString()
      })
    })

    this.nmeaProvider.on('error', (error) => {
      console.error('NMEA Provider error:', error)
      this.broadcast({
        event: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    })

    this.nmeaProvider.on('connected', () => {
      console.log('NMEA data source connected')
      this.broadcast({
        event: 'nmea:connected',
        timestamp: new Date().toISOString()
      })
    })

    this.nmeaProvider.on('disconnected', () => {
      console.log('NMEA data source disconnected')
      this.broadcast({
        event: 'nmea:disconnected',
        timestamp: new Date().toISOString()
      })
    })

    // Connect to the NMEA source
    this.nmeaProvider.connect().catch(error => {
      console.error('Failed to connect to NMEA source:', error)
    })
  }

  broadcast(message) {
    // Send message to all connected WebSocket clients
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message))
      }
    })
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Visual Analyzer server started on port ${this.port}`)
      console.log(`Access the application at: http://localhost:${this.port}`)
      console.log(`WebSocket endpoint available at: ws://localhost:${this.port}`)
    })
  }

  stop() {
    // Disconnect NMEA provider
    if (this.nmeaProvider) {
      this.nmeaProvider.disconnect()
    }
    
    this.server.close(() => {
      console.log('Visual Analyzer server stopped')
    })
  }
}

module.exports = VisualAnalyzerServer

// If this file is run directly, start the server
if (require.main === module) {
  const server = new VisualAnalyzerServer({
    port: process.env.PORT || 8080
  })
  
  // Example: Connect to NMEA 2000 data sources
  // server.connectToNMEASource({
  //   signalkUrl: 'http://localhost:3000', // Connect to local SignalK
  //   // serialPort: '/dev/ttyUSB0',        // Connect to serial gateway
  // })
  
  server.start()

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...')
    server.stop()
    process.exit(0)
  })
}
