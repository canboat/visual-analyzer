/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ServerAPI,
  Plugin,
  //Delta,
  //Path
} from '@signalk/server-api'
import { ApiResponse } from './types'
import { FromPgn } from '@canboat/canboatjs'
import { N2kMapper } from '@signalk/n2k-signalk'
import { translateToSignalK } from './server'
import { RecordingService } from './recording-service'

const PLUGIN_ID = 'canboat-visual-analyzer'
const PLUGIN_NAME = 'Canboat Visual Analyzer'

module.exports = function (app: ServerAPI) {
  let onStop: any[] = []
  //let dbusSetValue: any
  let canboatParser: FromPgn
  let n2kMapper: N2kMapper
  let recordingService: RecordingService

  const plugin: Plugin = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: 'Canboat Visual Analyzer',

    schema: () => {
      return {
        title: PLUGIN_NAME,
        type: 'object',
        properties: {},
      }
    },

    stop: () => {
      onStop.forEach((f) => f())
      onStop = []
    },

    start: (_options: any) => {
      canboatParser = new FromPgn({
        checkForInvalidFields: true,
        useCamel: true, // Default value
        useCamelCompat: false,
        returnNonMatches: true,
        createPGNObjects: true,
        includeInputData: true,
        includeRawData: true,
        includeByteMapping: true,
      })

      n2kMapper = new N2kMapper({})

      recordingService = new RecordingService(`${(app as any).config.configPath}/visual-analyzer`)

      const anyapp = app as any
      recordingService.on('started', (status) => {
        console.log('Recording started:', status)
        anyapp.emit('recording:started', status)
      })

      recordingService.on('stopped', (status) => {
        console.log('Recording stopped:', status)
        anyapp.emit('recording:stopped', status)
      })

      recordingService.on('error', (error) => {
        console.error('Recording error:', error)
        anyapp.emit('recording:error', {
          error: error.message,
        })
      })

      recordingService.on('progress', (status) => {
        anyapp.emit('recording:progress', status)
      })

      recordingService.on('error', (error) => {
        console.error('Recording error:', error)
        anyapp.emit('recording:error', {
          error: error.message,
        })
      })

      anyapp.on('canboatjs:rawoutput', (output: any) => {
        if (recordingService.getStatus().isRecording) {
          if (recordingService.getStatus().format === 'passthrough') {
            recordingService.recordMessage(output, undefined)
          } else {
            try {
              if (typeof output === 'string') {
                const pgn = canboatParser.parseString(output)
                if (pgn) {
                  recordingService.recordMessage(undefined, pgn)
                }
              }
            } catch (error) {
              console.debug('Failed to parse raw NMEA data:', error)
            }
          }
        }
      })
    },

    registerWithRouter: (router: any) => {
      router.post('/api/send-n2k', (req: any, res: any) => {
        try {
          const values = req.body.values

          if (!values) {
            return res.status(400).json({
              success: false,
              error: 'Missing required field: values',
            } as ApiResponse)
          }

          const pgnDataArray: any[] = []

          for (const value of values) {
            // Check if input is a string (NMEA 2000 format) or JSON
            if (typeof value === 'string') {
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
                      const parsed = canboatParser.parseString(trimmedLine)
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

                console.log(
                  `Parsed ${pgnDataArray.length} NMEA 2000 messages from ${lines.length} lines using canboatjs`,
                )
              } catch (canboatParseError) {
                const errorMessage = canboatParseError instanceof Error ? canboatParseError.message : 'Unknown error'
                return res.status(400).json({
                  success: false,
                  error: 'Error parsing NMEA 2000 strings: ' + errorMessage,
                } as ApiResponse)
              }
            } else if (typeof value === 'object') {
              // Value is already a JSON object
              pgnDataArray.push(value)
            } else {
              return res.status(400).json({
                success: false,
                error: 'Value must be a string (JSON or NMEA 2000 format) or object',
              } as ApiResponse)
            }
          }

          // Process each parsed message
          const results: any[] = []
          for (const pgnData of pgnDataArray) {
            console.log('Processing NMEA 2000 message for transmission:', {
              pgn: pgnData.pgn,
              data: pgnData,
            })
            ;(app as any).emit('nmea2000JsonOut', pgnData)
          }

          // Return success response in SignalK format
          res.json({
            success: true,
            message: `${pgnDataArray.length} message(s) processed successfully`,
            messagesProcessed: pgnDataArray.length,
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
      router.post('/api/transform/signalk', (req: any, res: any) => {
        translateToSignalK(req, res, canboatParser, n2kMapper)
      })

      // Recording API routes
      router.get('/api/recording/status', (req: any, res: any) => {
        try {
          const status = recordingService.getStatus()
          res.json({ success: true, result: status } as ApiResponse)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          res.status(500).json({ success: false, error: errorMessage })
        }
      })

      router.post('/api/recording/start', (req: any, res: any) => {
        try {
          const { fileName, format } = req.body
          const result = recordingService.startRecording({ fileName, format })
          res.json({
            success: true,
            fileName: result.fileName,
            message: 'Recording started successfully',
          } as ApiResponse)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          res.status(400).json({ success: false, error: errorMessage } as ApiResponse)
        }
      })

      router.post('/api/recording/stop', (req: any, res: any) => {
        try {
          const result = recordingService.stopRecording()
          res.json({ success: true, message: 'Recording stopped successfully', finalStats: result })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          res.status(400).json({ success: false, error: errorMessage })
        }
      })

      router.get('/api/recording/files', (req: any, res: any) => {
        try {
          const files = recordingService.getRecordedFiles()
          res.json({
            success: true,
            results: files, // Include detailed results for each message
          } as ApiResponse)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          res.status(500).json({ success: false, error: errorMessage } as ApiResponse)
        }
      })

      router.delete('/api/recording/files/:fileName', (req: any, res: any) => {
        try {
          recordingService.deleteRecordedFile(req.params.fileName)
          res.json({ success: true, message: 'File deleted successfully' })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          res.status(400).json({ success: false, error: errorMessage })
        }
      })

      router.get('/api/recording/files/:fileName/download', (req: any, res: any) => {
        try {
          const filePath = recordingService.getRecordedFilePath(req.params.fileName)
          res.download(filePath, req.params.fileName, (err: any) => {
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
    },
  }

  return plugin
}
