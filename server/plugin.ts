/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ServerAPI,
  Plugin,
  //Delta,
  //Path
} from '@signalk/server-api'
import { ApiResponse } from './types'
import { FromPgn } from '@canboat/canboatjs'

const PLUGIN_ID = 'canboat-visual-analyzer'
const PLUGIN_NAME = 'Canboat Visual Analyzer'

module.exports = function (app: ServerAPI) {
  let onStop: any[] = []
  //let dbusSetValue: any
  let canboatParser: FromPgn

  const plugin: Plugin = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: 'Canboat Visual Analyzer',

    schema: () => {
      return {
        title: PLUGIN_NAME,
        type: 'object',
        properties: {
          installType: {
            type: 'string',
            title: 'How to connect to Venus D-Bus',
            enum: ['mqtt', 'mqtts', 'local', 'remote', 'vrm'],
            enumNames: [
              'Connect to remote Venus installation via MQTT (Plain text)',
              'Connect to remote Venus installation via MQTT (SSL)',
              'Connect to localhost via dbus (signalk-server is running on a Venus device)',
              'Connect to remote Venus installation via dbus',
              'Connect to remote Venus installation via VRM',
            ],
            default: 'mqtt',
          },
        },
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
    },
  }

  return plugin
}
