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

import express, { Express, Request, Response } from 'express'
import * as http from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import NMEADataProvider from './nmea-provider'
import { FromPgn } from '@canboat/canboatjs'
import { N2kMapper } from '@signalk/n2k-signalk'
import { RecordingService } from './recording-service'
import {
  Config,
  ConnectionState,
  WebSocketMessage,
  BroadcastMessage,
  NMEAProviderOptions,
  ApiResponse,
  ConfigurationResponse,
  ConnectionProfile,
  ConnectionsConfig,
  InputTestRequest,
  INMEAProvider,
} from './types'

class VisualAnalyzerServer {
  private port: number
  private publicDir: string
  private configFile: string
  private app: Express
  private server: http.Server
  private wss: WebSocketServer
  private nmeaProvider: INMEAProvider | null = null
  private currentConfig: Config
  private canboatParser: FromPgn
  private n2kMapper: N2kMapper
  private connectionState: ConnectionState
  private recordingService: RecordingService

  constructor(options: Partial<Config> = {}) {
    this.port = options.port || 8080
    this.publicDir = path.join(__dirname, '../public')

    // Platform-appropriate config file location
    let configDir: string
    if (process.platform === 'win32') {
      // On Windows, use %APPDATA%\visual-analyzer
      configDir = path.join(process.env.APPDATA || os.homedir(), 'visual-analyzer')
    } else {
      // On Unix-like systems, use ~/.visual-analyzer
      configDir = path.join(os.homedir(), '.visual-analyzer')
    }

    const defaultConfigPath = path.join(configDir, 'config.json')
    this.configFile = process.env.VISUAL_ANALYZER_CONFIG || defaultConfigPath
    this.app = express()
    this.server = http.createServer(this.app)
    this.wss = new WebSocketServer({ server: this.server })
    this.currentConfig = {
      port: this.port,
      connections: { activeConnection: null, profiles: {} },
    }

    // Initialize canboatjs parser for string input parsing
    this.canboatParser = new FromPgn()

    // Initialize N2kMapper for SignalK transformation
    this.n2kMapper = new N2kMapper({})

    // Initialize recording service
    this.recordingService = new RecordingService()

    // Set up recording service event listeners
    this.recordingService.on('started', (status) => {
      console.log('Recording started:', status)
      this.broadcast({
        event: 'recording:started',
        data: status,
        timestamp: new Date().toISOString(),
      })
    })

    this.recordingService.on('stopped', (status) => {
      console.log('Recording stopped:', status)
      this.broadcast({
        event: 'recording:stopped',
        data: status,
        timestamp: new Date().toISOString(),
      })
    })

    this.recordingService.on('error', (error) => {
      console.error('Recording error:', error)
      this.broadcast({
        event: 'recording:error',
        data: { error: error.message },
        timestamp: new Date().toISOString(),
      })
    })

    this.recordingService.on('progress', (status) => {
      this.broadcast({
        event: 'recording:progress',
        data: status,
        timestamp: new Date().toISOString(),
      })
    })

    // Track current connection state including errors
    this.connectionState = {
      isConnected: false,
      lastUpdate: new Date().toISOString(),
      error: null,
    }

    // Load configuration on startup
    this.loadConfiguration()

    this.setupRoutes()
    this.setupWebSocket()
  }

  // Load configuration when server starts
  private loadConfiguration(): void {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8')
        const config = JSON.parse(data)

        // Merge with defaults
        this.currentConfig = {
          port: this.port,
          connections: {
            activeConnection: null,
            profiles: {},
          },
          ...config,
        }

        // Update port if specified in config
        if (config.server && config.server.port) {
          this.port = config.server.port
        }

        console.log(`Configuration loaded from ${this.configFile}`)

        // Auto-connect to active connection if specified
        if (this.currentConfig.connections.activeConnection) {
          setTimeout(() => {
            this.connectToActiveProfile()
          }, 2000) // Wait 2 seconds after server startup
        }
      } else {
        console.log(`No configuration file found at ${this.configFile}`)
        console.log('Using default configuration. Settings will be saved to this location when modified.')

        // Create the config directory if it doesn't exist
        const configDir = path.dirname(this.configFile)
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true })
          console.log(`Created config directory: ${configDir}`)
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error)
    }
  }

  private connectToActiveProfile(): void {
    const activeProfile = this.getActiveConnectionProfile()
    if (activeProfile) {
      console.log(`Auto-connecting to active profile: ${activeProfile.name}`)
      this.connectToNMEASource(activeProfile)
    }
  }

  private setupRoutes(): void {
    // Add JSON parsing middleware
    this.app.use(express.json())

    // API routes for configuration
    this.app.get('/api/config', (req: Request, res: Response) => {
      res.json(this.getConfiguration())
    })

    this.app.post('/api/config', (req: Request, res: Response) => {
      try {
        this.updateConfiguration(req.body)
        res.json({ success: true, message: 'Configuration updated successfully' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.get('/api/connections', (req: Request, res: Response) => {
      res.json(this.getConnectionProfiles())
    })

    this.app.post('/api/connections', (req: Request, res: Response) => {
      try {
        this.saveConnectionProfile(req.body)
        res.json({ success: true, message: 'Connection profile saved successfully' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.delete('/api/connections/:profileId', (req: Request, res: Response) => {
      try {
        this.deleteConnectionProfile(req.params.profileId)
        res.json({ success: true, message: 'Connection profile deleted successfully' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.post('/api/connections/:profileId/activate', (req: Request, res: Response) => {
      try {
        this.activateConnectionProfile(req.params.profileId)
        res.json({ success: true, message: 'Connection profile activated successfully' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.post('/api/restart-connection', (req: Request, res: Response) => {
      try {
        this.restartNMEAConnection()
        res.json({ success: true, message: 'Connection restart initiated' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ success: false, error: errorMessage })
      }
    })

    // Recording API routes
    this.app.get('/api/recording/status', (req: Request, res: Response) => {
      try {
        const status = this.recordingService.getStatus()
        res.json(status)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ success: false, error: errorMessage })
      }
    })

    this.app.post('/api/recording/start', (req: Request, res: Response) => {
      try {
        const { fileName, format } = req.body
        const result = this.recordingService.startRecording({ fileName, format })
        res.json({ success: true, fileName: result.fileName, message: 'Recording started successfully' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.post('/api/recording/stop', (req: Request, res: Response) => {
      try {
        const result = this.recordingService.stopRecording()
        res.json({ success: true, message: 'Recording stopped successfully', finalStats: result })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.get('/api/recording/files', (req: Request, res: Response) => {
      try {
        const files = this.recordingService.getRecordedFiles()
        res.json(files)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ success: false, error: errorMessage })
      }
    })

    this.app.delete('/api/recording/files/:fileName', (req: Request, res: Response) => {
      try {
        this.recordingService.deleteRecordedFile(req.params.fileName)
        res.json({ success: true, message: 'File deleted successfully' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(400).json({ success: false, error: errorMessage })
      }
    })

    this.app.get('/api/recording/files/:fileName/download', (req: Request, res: Response) => {
      try {
        const filePath = this.recordingService.getRecordedFilePath(req.params.fileName)
        res.download(filePath, req.params.fileName, (err) => {
          if (err) {
            console.error('Download error:', err)
            if (!res.headersSent) {
              res.status(500).json({ success: false, error: 'Download failed' })
            }
          }
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(404).json({ success: false, error: errorMessage })
      }
    })

    // SignalK-compatible input test endpoint for sending NMEA 2000 messages
    this.app.post('/skServer/inputTest', (req: Request, res: Response) => {
      try {
        const { value, sendToN2K }: InputTestRequest = req.body

        if (!value) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: value',
          } as ApiResponse)
        }

        let pgnDataArray: any[] = []

        // Check if input is a string (NMEA 2000 format) or JSON
        if (typeof value === 'string') {
          // Try to parse as JSON first
          try {
            const jsonParsed = JSON.parse(value)
            pgnDataArray = [jsonParsed]
            //console.log('Parsed as JSON from string value')
          } catch (jsonParseError) {
            // If JSON parsing fails, try to parse as NMEA 2000 string(s) using canboatjs
            // Split by newlines to handle multiple lines
            const lines = value.split(/\r?\n/).filter((line) => line.trim())

            if (lines.length === 0) {
              return res.status(400).json({
                success: false,
                error: 'No valid lines found in input',
              } as ApiResponse)
            }

            try {
              for (const line of lines) {
                const trimmedLine = line.trim()
                if (trimmedLine) {
                  try {
                    const parsed = this.canboatParser.parseString(trimmedLine)
                    if (parsed) {
                      pgnDataArray.push(parsed)
                    } else {
                      console.warn(`Unable to parse line: ${trimmedLine}`)
                    }
                  } catch (lineParseError) {
                    const errorMessage = lineParseError instanceof Error ? lineParseError.message : 'Unknown error'
                    console.warn(`Error parsing line "${trimmedLine}": ${errorMessage}`)
                    // Continue processing other lines instead of failing
                  }
                }
              }

              if (pgnDataArray.length === 0) {
                return res.status(400).json({
                  success: false,
                  error: 'Unable to parse any NMEA 2000 strings from input',
                } as ApiResponse)
              }

              console.log(`Parsed ${pgnDataArray.length} NMEA 2000 messages from ${lines.length} lines using canboatjs`)
            } catch (canboatParseError) {
              const errorMessage = canboatParseError instanceof Error ? canboatParseError.message : 'Unknown error'
              return res.status(400).json({
                success: false,
                error: 'Error parsing NMEA 2000 strings: ' + errorMessage,
              } as ApiResponse)
            }
          }
        } else if (typeof value === 'object') {
          // Value is already a JSON object
          pgnDataArray = [value]
          console.log('Using direct JSON object value')
        } else {
          return res.status(400).json({
            success: false,
            error: 'Value must be a string (JSON or NMEA 2000 format) or object',
          } as ApiResponse)
        }

        // Process each parsed message
        const results: any[] = []
        for (const pgnData of pgnDataArray) {
          console.log('Processing NMEA 2000 message for transmission:', {
            pgn: pgnData.pgn,
            sendToN2K: sendToN2K,
            data: pgnData,
          })

          // If we have an active NMEA provider, attempt to send the message
          if (this.nmeaProvider && sendToN2K) {
            try {
              // Convert PGN object to raw NMEA 2000 format if the provider supports it
              if (typeof this.nmeaProvider.sendMessage === 'function') {
                this.nmeaProvider.sendMessage(pgnData)
                //console.log('Message sent to NMEA 2000 network')
                results.push({
                  pgn: pgnData.pgn,
                  transmitted: true,
                  parsedData: pgnData,
                })
              } else {
                console.log('NMEA provider does not support message transmission')
                results.push({
                  pgn: pgnData.pgn,
                  transmitted: false,
                  error: 'NMEA provider does not support message transmission',
                  parsedData: pgnData,
                })
              }
            } catch (sendError) {
              const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error'
              console.error('Error sending message to NMEA 2000 network:', sendError)
              results.push({
                pgn: pgnData.pgn,
                transmitted: false,
                error: 'Error sending message: ' + errorMessage,
                parsedData: pgnData,
              })
            }
          } else if (sendToN2K) {
            console.log('No active NMEA connection - message not transmitted')
            results.push({
              pgn: pgnData.pgn,
              transmitted: false,
              error: 'No active NMEA connection',
              parsedData: pgnData,
            })
          } else {
            results.push({
              pgn: pgnData.pgn,
              transmitted: false,
              parsedData: pgnData,
            })
          }
        }

        // Return success response in SignalK format
        res.json({
          success: true,
          message: `${pgnDataArray.length} message(s) processed successfully`,
          messagesProcessed: pgnDataArray.length,
          transmitted: sendToN2K && this.nmeaProvider ? results.filter((r) => r.transmitted).length : 0,
          results: results, // Include detailed results for each message
        } as ApiResponse)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error processing input test request:', error)
        res.status(500).json({
          success: false,
          error: errorMessage,
        } as ApiResponse)
      }
    })

    // SignalK transformation endpoint
    this.app.post('/api/transform/signalk', (req: Request, res: Response) => {
      try {
        const { data } = req.body

        if (!data) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: data',
          })
        }

        let nmea2000Data: any[]

        // Handle different input formats
        if (typeof data === 'string') {
          // Try to parse as JSON first
          try {
            const jsonParsed = JSON.parse(data)
            nmea2000Data = Array.isArray(jsonParsed) ? jsonParsed : [jsonParsed]
          } catch (jsonParseError) {
            // If JSON parsing fails, try to parse as NMEA 2000 string(s) using canboatjs
            const lines = data.split(/\r?\n/).filter((line: string) => line.trim())

            if (lines.length === 0) {
              return res.status(400).json({
                success: false,
                error: 'No valid lines found in input',
              })
            }

            nmea2000Data = []
            for (const line of lines) {
              const trimmedLine = line.trim()
              if (trimmedLine) {
                try {
                  const parsed = this.canboatParser.parseString(trimmedLine)
                  if (parsed) {
                    nmea2000Data.push(parsed)
                  } else {
                    console.warn(`Unable to parse line: ${trimmedLine}`)
                  }
                } catch (lineParseError) {
                  const errorMessage = lineParseError instanceof Error ? lineParseError.message : 'Unknown error'
                  console.warn(`Error parsing line "${trimmedLine}": ${errorMessage}`)
                  // Continue processing other lines instead of failing
                }
              }
            }

            if (nmea2000Data.length === 0) {
              return res.status(400).json({
                success: false,
                error: 'No valid NMEA 2000 messages could be parsed from input',
              })
            }
          }
        } else if (Array.isArray(data)) {
          nmea2000Data = data
        } else if (typeof data === 'object') {
          nmea2000Data = [data]
        } else {
          return res.status(400).json({
            success: false,
            error: 'Invalid data format. Expected string, object, or array.',
          })
        }

        // Transform each NMEA 2000 message to SignalK using N2kMapper
        const signalKDeltas: any[] = []
        const errors: Array<{ message: any; error: string }> = []

        for (const nmea2000Message of nmea2000Data) {
          try {
            const signalKDelta = this.n2kMapper.toDelta(nmea2000Message)
            if (signalKDelta && signalKDelta.updates && signalKDelta.updates.length > 0) {
              signalKDeltas.push(signalKDelta)
            } else {
              console.warn('N2kMapper returned empty or invalid delta for:', nmea2000Message)
            }
          } catch (transformError) {
            const errorMessage = transformError instanceof Error ? transformError.message : 'Unknown error'
            console.error('Error transforming NMEA 2000 to SignalK:', transformError)
            errors.push({
              message: nmea2000Message,
              error: errorMessage,
            })
          }
        }

        // Return success response with SignalK deltas
        res.json({
          success: true,
          message: `${nmea2000Data.length} message(s) processed, ${signalKDeltas.length} SignalK delta(s) generated`,
          messagesProcessed: nmea2000Data.length,
          signalKDeltas: signalKDeltas,
          errors: errors.length > 0 ? errors : undefined,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error processing SignalK transformation request:', error)
        res.status(500).json({
          success: false,
          error: errorMessage,
        })
      }
    })

    // Serve static files from public directory
    this.app.use(express.static(this.publicDir))

    // Serve the main HTML file for any route (SPA support)
    this.app.get('*', (req: Request, res: Response) => {
      const indexPath = path.resolve(this.publicDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
      } else {
        res.status(404).send('Visual Analyzer not built. Run npm run build first.')
      }
    })
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      console.log('WebSocket client connected from:', req.socket.remoteAddress)

      // Send initial connection message
      ws.send(
        JSON.stringify({
          event: 'connection',
          message: 'Connected to Visual Analyzer WebSocket server',
        }),
      )

      // Handle incoming messages
      ws.on('message', (message: WebSocket.Data) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString())
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
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error)
      })
    })
  }

  private handleWebSocketMessage(ws: WebSocket, data: WebSocketMessage): void {
    switch (data.type) {
      case 'subscribe':
        console.log('Client subscribing to:', data.subscription)

        // If subscribing to status, send current connection state immediately
        if (data.subscription === 'status') {
          console.log('Sending current connection state to new status subscriber')

          // Send current connection status
          if (this.connectionState.isConnected) {
            const statusData: any = {
              event: 'nmea:connected',
              timestamp: this.connectionState.lastUpdate,
            }

            // Add authentication status if this is a SignalK connection
            if (this.nmeaProvider && this.nmeaProvider.options.type === 'signalk') {
              statusData.auth = this.nmeaProvider.getAuthStatus?.()
            }

            ws.send(JSON.stringify(statusData))
          } else {
            ws.send(
              JSON.stringify({
                event: 'nmea:disconnected',
                timestamp: this.connectionState.lastUpdate,
              }),
            )
          }

          // Send current error if any
          if (this.connectionState.error) {
            console.log('Sending current error to new status subscriber:', this.connectionState.error)
            ws.send(
              JSON.stringify({
                event: 'error',
                error: this.connectionState.error,
                timestamp: this.connectionState.lastUpdate,
              }),
            )
          }
        }

        // Start sending data for the requested subscription
        //this.startDataStream(ws, data.subscription)
        break

      case 'unsubscribe':
        console.log('Client unsubscribing from:', data.subscription)
        // Stop sending data for the subscription
        //this.stopDataStream(ws, data.subscription)
        break

      default:
        console.log('Unknown message type:', data.type)
    }
  }

  private stopDataStream(ws: WebSocket): void {
    // Clean up intervals when unsubscribing
    if ((ws as any).intervals) {
      ;(ws as any).intervals.forEach((interval: NodeJS.Timeout) => clearInterval(interval))
      ;(ws as any).intervals = []
    }
  }

  private generateSampleNMEAData(): string {
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
  public connectToNMEASource(options: NMEAProviderOptions): void {
    console.log('Connecting to NMEA 2000 source with options:', options)

    this.nmeaProvider = new NMEADataProvider(options)

    // Set up event listeners for NMEA data
    this.nmeaProvider.on('nmea-data', (data: any) => {
      this.broadcast({
        event: 'canboatjs:parsed',
        data: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.nmeaProvider.on('raw-nmea', (rawData: any) => {
      // Record the message if recording is active
      if (this.recordingService.getStatus().isRecording) {
        if (this.recordingService.getStatus().format === 'passthrough') {
          this.recordingService.recordMessage(rawData, undefined)
        } else {
          try {
            if (typeof rawData === 'string') {
              const pgn = this.canboatParser.parseString(rawData)
              if (pgn) {
                this.recordingService.recordMessage(undefined, pgn)
              }
            }
          } catch (error) {
            console.debug('Failed to parse raw NMEA data:', error)
          }
        }
      }

      this.broadcast({
        event: 'canboatjs:rawoutput',
        data: rawData,
        timestamp: new Date().toISOString(),
      })
    })

    this.nmeaProvider.on('signalk-data', (data: any) => {
      this.broadcast({
        event: 'signalk:delta',
        data: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.nmeaProvider.on('synthetic-nmea', (data: any) => {
      this.broadcast({
        event: 'canboatjs:synthetic',
        data: data,
        timestamp: new Date().toISOString(),
      })
    })

    this.nmeaProvider.on('error', (error: any) => {
      console.error('NMEA Provider error:', error)
      // Handle different error types and extract meaningful error message
      let errorMessage = error.message || error.toString()
      if (error.code) {
        errorMessage = `${error.code}: ${errorMessage}`
      }
      if (error.errors && Array.isArray(error.errors)) {
        // Handle AggregateError with multiple underlying errors
        errorMessage = error.errors.map((e: any) => e.message || e.toString()).join(', ')
        if (error.code) {
          errorMessage = `${error.code}: ${errorMessage}`
        }
      }

      // Update persistent connection state
      this.connectionState = {
        isConnected: false,
        error: errorMessage || 'Unknown connection error',
        lastUpdate: new Date().toISOString(),
      }

      this.broadcast({
        event: 'error',
        error: errorMessage || 'Unknown connection error',
        timestamp: new Date().toISOString(),
      })
    })

    this.nmeaProvider.on('connected', () => {
      console.log('NMEA data source connected')

      // Update persistent connection state
      this.connectionState = {
        isConnected: true,
        error: null, // Clear any previous errors on successful connection
        lastUpdate: new Date().toISOString(),
      }

      const connectionData: any = {
        event: 'nmea:connected',
        timestamp: new Date().toISOString(),
      }

      // Add authentication status if this is a SignalK connection
      if (this.nmeaProvider && this.nmeaProvider.options.type === 'signalk') {
        connectionData.auth = this.nmeaProvider.getAuthStatus?.()
      }

      this.broadcast(connectionData)
    })

    this.nmeaProvider.on('disconnected', () => {
      console.log('NMEA data source disconnected')

      // Update persistent connection state
      this.connectionState = {
        isConnected: false,
        error: this.connectionState.error, // Keep existing error if any
        lastUpdate: new Date().toISOString(),
      }

      this.broadcast({
        event: 'nmea:disconnected',
        timestamp: new Date().toISOString(),
      })
    })

    // Connect to the NMEA source
    this.nmeaProvider.connect().catch((error: Error) => {
      console.error('Failed to connect to NMEA source:', error)
    })
  }

  private broadcast(message: BroadcastMessage): void {
    // Send message to all connected WebSocket clients
    //console.log('Broadcasting message:', JSON.stringify(message))
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        //console.log('Sending to WebSocket client')
        client.send(JSON.stringify(message))
      }
    })
  }

  public getConfiguration(): ConfigurationResponse {
    return {
      server: {
        port: this.port,
      },
      connections: this.currentConfig.connections || { activeConnection: null, profiles: {} },
      connection: {
        isConnected: this.connectionState.isConnected,
        error: this.connectionState.error,
        lastUpdate: this.connectionState.lastUpdate,
        activeProfile: this.getActiveConnectionProfile(),
      },
    }
  }

  public getConnectionProfiles(): ConnectionsConfig {
    return this.currentConfig.connections || { activeConnection: null, profiles: {} }
  }

  public getActiveConnectionProfile(): ConnectionProfile | null {
    const connections = this.currentConfig.connections
    if (!connections || !connections.activeConnection) return null

    const profile = connections.profiles[connections.activeConnection]
    return profile ? { id: connections.activeConnection, ...profile } : null
  }

  public saveConnectionProfile(profileData: ConnectionProfile): void {
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

  public deleteConnectionProfile(profileId: string): void {
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

  public activateConnectionProfile(profileId: string): void {
    if (!this.currentConfig.connections || !this.currentConfig.connections.profiles[profileId]) {
      throw new Error('Connection profile not found')
    }

    this.currentConfig.connections.activeConnection = profileId
    this.saveConfigToFile()
    this.restartNMEAConnection()
  }

  private validateConnectionProfile(profile: ConnectionProfile): void {
    switch (profile.type) {
      case 'serial':
        if (!profile.serialPort) throw new Error('Serial port is required for serial connection')
        if (!profile.baudRate) throw new Error('Baud rate is required for serial connection')
        if (!profile.deviceType) throw new Error('Device type is required for serial connection')
        break

      case 'network':
        if (!profile.networkHost) throw new Error('Network host is required for network connection')
        if (!profile.networkPort) throw new Error('Network port is required for network connection')
        if (!['tcp', 'udp'].includes(profile.networkProtocol!)) {
          throw new Error('Network protocol must be tcp or udp')
        }
        break

      case 'signalk':
        if (!profile.signalkUrl) throw new Error('SignalK URL is required for SignalK connection')
        break

      case 'socketcan':
        if (!profile.socketcanInterface) throw new Error('SocketCAN interface is required for SocketCAN connection')
        break

      case 'file':
        if (!profile.filePath) throw new Error('File path is required for file connection')
        if (profile.playbackSpeed !== undefined && (profile.playbackSpeed < 0 || profile.playbackSpeed > 10)) {
          throw new Error('Playback speed must be between 0 and 10')
        }
        break

      default:
        throw new Error('Connection type must be serial, network, signalk, socketcan, or file')
    }
  }

  public updateConfiguration(newConfig: Partial<Config>): void {
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

  private saveConfigToFile(): void {
    try {
      const configData = {
        server: {
          port: this.port,
        },
        connections: this.currentConfig.connections,
        logging: { level: 'info' },
      }

      // Ensure the config directory exists
      const configDir = path.dirname(this.configFile)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
        console.log(`Created config directory: ${configDir}`)
      }

      fs.writeFileSync(this.configFile, JSON.stringify(configData, null, 2))
      console.log(`Configuration saved to ${this.configFile}`)
    } catch (error) {
      console.error('Failed to save configuration:', error)
    }
  }

  public restartNMEAConnection(): void {
    console.log('Restarting NMEA connection...')

    // Reset connection state on manual restart
    this.connectionState = {
      isConnected: false,
      error: null, // Clear any previous errors on manual restart
      lastUpdate: new Date().toISOString(),
    }

    // Disconnect existing connection
    if (this.nmeaProvider) {
      this.nmeaProvider.disconnect()
      this.nmeaProvider = null
    }

    // Broadcast disconnection status
    this.broadcast({
      event: 'nmea:disconnected',
      timestamp: new Date().toISOString(),
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

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`Visual Analyzer server started on port ${this.port}`)
      console.log(`Access the application at: http://localhost:${this.port}`)
      console.log(`WebSocket endpoint available at: ws://localhost:${this.port}`)

      // Open browser if requested via environment variable
      if (process.env.VISUAL_ANALYZER_OPEN_BROWSER === 'true') {
        this.openBrowser(`http://localhost:${this.port}`)
      }
    })
  }

  private openBrowser(url: string): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawn } = require('child_process')

    console.log(`Opening browser at: ${url}`)

    let command: string
    let args: string[] = [url]

    // Determine the appropriate command for the platform
    if (process.platform === 'darwin') {
      // macOS
      command = 'open'
    } else if (process.platform === 'win32') {
      // Windows
      command = 'start'
      args = ['', url] // start command requires empty first argument
    } else {
      // Linux and others
      command = 'xdg-open'
    }

    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
      })

      // Allow the parent process to exit independently
      child.unref()

      setTimeout(() => {
        console.log('Browser should have opened. If not, please visit the URL manually.')
      }, 1000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`Failed to open browser automatically: ${errorMessage}`)
      console.log('Please open your browser manually and visit the URL above.')
    }
  }

  public stop(): void {
    // Stop any active recording
    try {
      if (this.recordingService.getStatus().isRecording) {
        this.recordingService.stopRecording()
        console.log('Stopped active recording on server shutdown')
      }
    } catch (error) {
      console.warn('Failed to stop recording on shutdown:', error)
    }

    // Disconnect NMEA provider
    if (this.nmeaProvider) {
      this.nmeaProvider.disconnect()
    }

    this.server.close(() => {
      console.log('Visual Analyzer server stopped')
    })
  }
}

export default VisualAnalyzerServer

// If this file is run directly, start the server
if (require.main === module) {
  const server = new VisualAnalyzerServer({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  })

  server.start()

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...')
    server.stop()
    process.exit(0)
  })
}
