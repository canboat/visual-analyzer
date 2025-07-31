#!/usr/bin/env node

const VisualAnalyzerServer = require('./server')
const path = require('path')
const fs = require('fs')

// Load configuration from file if it exists
const configPath = path.join(__dirname, 'config.json')
let fileConfig = {}
if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    console.log('Loaded configuration from config.json')
  } catch (error) {
    console.warn('Failed to load config.json:', error.message)
  }
}

// Configuration options (environment variables override config file)
const config = {
  port: process.env.PORT || fileConfig.server?.port || 8080,
  publicDir: process.env.PUBLIC_DIR || fileConfig.server?.publicDir || path.join(__dirname, '../public'),
  
  // NMEA 2000 data source options
  nmea: {
    // SignalK server connection
    signalkUrl: process.env.SIGNALK_URL || fileConfig.nmea?.signalkUrl,
    
    // Serial port configuration
    serialPort: process.env.SERIAL_PORT || fileConfig.nmea?.serialPort,
    baudRate: parseInt(process.env.BAUD_RATE) || fileConfig.nmea?.baudRate || 115200,
    
    // Network source (TCP/UDP)
    networkHost: process.env.NETWORK_HOST || fileConfig.nmea?.networkHost,
    networkPort: parseInt(process.env.NETWORK_PORT) || fileConfig.nmea?.networkPort || 2000,
    networkProtocol: process.env.NETWORK_PROTOCOL || fileConfig.nmea?.networkProtocol || 'tcp', // 'tcp' or 'udp'
  }
}

console.log('Starting Visual Analyzer Server with configuration:')
console.log(`  Port: ${config.port}`)
console.log(`  Public Directory: ${config.publicDir}`)
console.log(`  SignalK URL: ${config.nmea.signalkUrl || 'Not configured'}`)
console.log(`  Serial Port: ${config.nmea.serialPort || 'Not configured'}`)

// Create and start the server
const server = new VisualAnalyzerServer(config)

// Connect to NMEA 2000 data sources if configured
if (config.nmea.signalkUrl || config.nmea.serialPort || config.nmea.networkHost) {
  server.connectToNMEASource(config.nmea)
}

server.start()

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)
  server.stop()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  server.stop()
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  server.stop()
  process.exit(1)
})
