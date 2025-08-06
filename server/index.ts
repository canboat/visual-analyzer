#!/usr/bin/env node

import VisualAnalyzerServer from './server'
import * as path from 'path'
import * as fs from 'fs'
import { Config, ConnectionsConfig, ServerConfig } from './types'

// Define types for configuration
interface FileConfig {
  server?: ServerConfig
  connections?: ConnectionsConfig
}

// Load configuration from file if it exists
const configPath = process.env.VISUAL_ANALYZER_CONFIG || path.join(__dirname, 'config.json')
let fileConfig: FileConfig = {}

if (fs.existsSync(configPath)) {
  try {
    const fileContent = fs.readFileSync(configPath, 'utf8')
    fileConfig = JSON.parse(fileContent) as FileConfig
    console.log(`Loaded configuration from ${configPath}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`Failed to load ${configPath}:`, errorMessage)
  }
}

// Configuration options (environment variables override config file)
const config: Partial<Config> = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : fileConfig.server?.port || 8080,

  // Connection profiles system
  connections: fileConfig.connections || {
    activeConnection: null,
    profiles: {},
  },
}

console.log('Starting Visual Analyzer Server with configuration:')
console.log(`  Port: ${config.port}`)
console.log(`  Active Connection: ${config.connections?.activeConnection || 'None configured'}`)

// Create and start the server
const server = new VisualAnalyzerServer(config)

/*
// Connect to active connection profile if configured
const activeProfile = config.connections.activeConnection 
  ? config.connections.profiles[config.connections.activeConnection] 
  : null

if (activeProfile) {
  console.log(`Connecting to: ${activeProfile.name}`)
  server.connectToNMEASource(activeProfile)
} else {
  console.log('No active connection configured')
}
*/

server.start()

// Graceful shutdown handling
const shutdown = (signal: string): void => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)
  server.stop()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error)
  server.stop()
  process.exit(1)
})

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  server.stop()
  process.exit(1)
})
