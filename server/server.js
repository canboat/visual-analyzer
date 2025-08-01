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
    this.configFile = path.join(__dirname, 'config.json')
    this.app = express()
    this.server = http.createServer(this.app)
    this.wss = new WebSocket.Server({ server: this.server })
    this.nmeaProvider = null
    this.currentConfig = { connections: { activeConnection: null, profiles: {} } }
    
    // Load configuration on startup
    this.loadConfiguration()
    
    this.setupRoutes()
    this.setupWebSocket()
  }

  // Load configuration when server starts
  loadConfiguration() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8')
        const config = JSON.parse(data)
        
        // Merge with defaults
        this.currentConfig = {
          connections: {
            activeConnection: null,
            profiles: {}
          },
          ...config
        }
        
        console.log('Configuration loaded from', this.configFile)
        
        // Auto-connect to active connection if specified
        if (this.currentConfig.connections.activeConnection) {
          setTimeout(() => {
            this.connectToActiveProfile()
          }, 2000) // Wait 2 seconds after server startup
        }
      } else {
        console.log('No configuration file found, using defaults')
      }
    } catch (error) {
      console.error('Error loading configuration:', error)
    }
  }

  connectToActiveProfile() {
    const activeProfile = this.getActiveConnectionProfile()
    if (activeProfile) {
      console.log(`Auto-connecting to active profile: ${activeProfile.name}`)
      this.connectToNMEASource(activeProfile)
    }
  }

  setupRoutes() {
    // Add JSON parsing middleware
    this.app.use(express.json())
    
    // API routes for configuration
    this.app.get('/api/config', (req, res) => {
      res.json(this.getConfiguration())
    })
    
    this.app.post('/api/config', (req, res) => {
      try {
        this.updateConfiguration(req.body)
        res.json({ success: true, message: 'Configuration updated successfully' })
      } catch (error) {
        res.status(400).json({ success: false, error: error.message })
      }
    })
    
    this.app.get('/api/connections', (req, res) => {
      res.json(this.getConnectionProfiles())
    })
    
    this.app.post('/api/connections', (req, res) => {
      try {
        this.saveConnectionProfile(req.body)
        res.json({ success: true, message: 'Connection profile saved successfully' })
      } catch (error) {
        res.status(400).json({ success: false, error: error.message })
      }
    })
    
    this.app.delete('/api/connections/:profileId', (req, res) => {
      try {
        this.deleteConnectionProfile(req.params.profileId)
        res.json({ success: true, message: 'Connection profile deleted successfully' })
      } catch (error) {
        res.status(400).json({ success: false, error: error.message })
      }
    })
    
    this.app.post('/api/connections/:profileId/activate', (req, res) => {
      try {
        this.activateConnectionProfile(req.params.profileId)
        res.json({ success: true, message: 'Connection profile activated successfully' })
      } catch (error) {
        res.status(400).json({ success: false, error: error.message })
      }
    })
    
    this.app.post('/api/restart-connection', (req, res) => {
      try {
        this.restartNMEAConnection()
        res.json({ success: true, message: 'Connection restart initiated' })
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // SignalK-compatible input test endpoint for sending NMEA 2000 messages
    this.app.post('/skServer/inputTest', (req, res) => {
      try {
        const { value, sendToN2K } = req.body
        
        if (!value) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required field: value' 
          })
        }

        // Parse the PGN data from the value field
        let pgnData
        try {
          pgnData = JSON.parse(value)
        } catch (parseError) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid JSON in value field: ' + parseError.message 
          })
        }

        console.log('Received NMEA 2000 message for transmission:', {
          pgn: pgnData.pgn,
          sendToN2K: sendToN2K,
          data: pgnData
        })

        // If we have an active NMEA provider, attempt to send the message
        if (this.nmeaProvider && sendToN2K) {
          try {
            // Convert PGN object to raw NMEA 2000 format if the provider supports it
            if (typeof this.nmeaProvider.sendMessage === 'function') {
              this.nmeaProvider.sendMessage(pgnData)
              console.log('Message sent to NMEA 2000 network')
            } else {
              console.log('NMEA provider does not support message transmission')
            }
          } catch (sendError) {
            console.error('Error sending message to NMEA 2000 network:', sendError)
            // Don't fail the request - just log the error
          }
        } else if (sendToN2K) {
          console.log('No active NMEA connection - message not transmitted')
        }

        // Return success response in SignalK format
        res.json({ 
          success: true,
          message: 'Message processed successfully',
          transmitted: sendToN2K && this.nmeaProvider ? true : false
        })

      } catch (error) {
        console.error('Error processing input test request:', error)
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
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

  getConfiguration() {
    return {
      server: {
        port: this.port,
        publicDir: this.publicDir
      },
      connections: this.currentConfig.connections || { activeConnection: null, profiles: {} },
      connection: {
        isConnected: this.nmeaProvider ? this.nmeaProvider.isConnectionActive() : false,
        activeProfile: this.getActiveConnectionProfile()
      }
    }
  }

  getConnectionProfiles() {
    return this.currentConfig.connections || { activeConnection: null, profiles: {} }
  }

  getActiveConnectionProfile() {
    const connections = this.currentConfig.connections
    if (!connections || !connections.activeConnection) return null
    
    const profile = connections.profiles[connections.activeConnection]
    return profile ? { id: connections.activeConnection, ...profile } : null
  }

  saveConnectionProfile(profileData) {
    if (!profileData.id || !profileData.name || !profileData.type) {
      throw new Error('Profile ID, name, and type are required')
    }

    // Validate profile data
    this.validateConnectionProfile(profileData)

    // Initialize connections if not exists
    if (!this.currentConfig.connections) {
      this.currentConfig.connections = { activeConnection: null, profiles: {} }
    }

    // Save the profile
    const { id, ...profile } = profileData
    this.currentConfig.connections.profiles[id] = profile

    // Save to config file
    this.saveConfigToFile()
  }

  deleteConnectionProfile(profileId) {
    if (!this.currentConfig.connections || !this.currentConfig.connections.profiles[profileId]) {
      throw new Error('Connection profile not found')
    }

    // Don't delete if it's the active connection
    if (this.currentConfig.connections.activeConnection === profileId) {
      throw new Error('Cannot delete the active connection profile')
    }

    delete this.currentConfig.connections.profiles[profileId]
    this.saveConfigToFile()
  }

  activateConnectionProfile(profileId) {
    if (!this.currentConfig.connections || !this.currentConfig.connections.profiles[profileId]) {
      throw new Error('Connection profile not found')
    }

    this.currentConfig.connections.activeConnection = profileId
    this.saveConfigToFile()
    this.restartNMEAConnection()
  }

  validateConnectionProfile(profile) {
    switch (profile.type) {
      case 'serial':
        if (!profile.serialPort) throw new Error('Serial port is required for serial connection')
        if (!profile.baudRate) throw new Error('Baud rate is required for serial connection')
        if (!profile.deviceType) throw new Error('Device type is required for serial connection')
        break
      
      case 'network':
        if (!profile.networkHost) throw new Error('Network host is required for network connection')
        if (!profile.networkPort) throw new Error('Network port is required for network connection')
        if (!['tcp', 'udp'].includes(profile.networkProtocol)) {
          throw new Error('Network protocol must be tcp or udp')
        }
        break
      
      case 'signalk':
        if (!profile.signalkUrl) throw new Error('SignalK URL is required for SignalK connection')
        break
      
      case 'socketcan':
        if (!profile.socketcanInterface) throw new Error('SocketCAN interface is required for SocketCAN connection')
        break
      
      default:
        throw new Error('Connection type must be serial, network, signalk, or socketcan')
    }
  }

  updateConfiguration(newConfig) {
    if (newConfig.server) {
      if (newConfig.server.port && newConfig.server.port !== this.port) {
        throw new Error('Port changes require a server restart')
      }
    }

    if (newConfig.connections) {
      this.currentConfig.connections = { ...this.currentConfig.connections, ...newConfig.connections }
      this.saveConfigToFile()
    }
  }

  saveConfigToFile() {
    try {
      const configPath = path.join(__dirname, 'config.json')
      const configData = {
        server: {
          port: this.port,
          publicDir: this.publicDir
        },
        connections: this.currentConfig.connections,
        logging: { level: 'info' }
      }
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2))
      console.log('Configuration saved to config.json')
    } catch (error) {
      console.error('Failed to save configuration:', error)
    }
  }

  restartNMEAConnection() {
    console.log('Restarting NMEA connection...')
    
    // Disconnect existing connection
    if (this.nmeaProvider) {
      this.nmeaProvider.disconnect()
      this.nmeaProvider = null
    }
    
    // Broadcast disconnection status
    this.broadcast({
      event: 'nmea:disconnected',
      timestamp: new Date().toISOString()
    })
    
    // Connect to active profile
    const activeProfile = this.getActiveConnectionProfile()
    if (activeProfile) {
      setTimeout(() => {
        console.log(`Connecting to: ${activeProfile.name}`)
        this.connectToNMEASource(activeProfile)
      }, 1000) // Wait 1 second before reconnecting
    }
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
  
  server.start()

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...')
    server.stop()
    process.exit(0)
  })
}
