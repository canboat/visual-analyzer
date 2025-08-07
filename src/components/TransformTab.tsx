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

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardBody } from 'reactstrap'
import {
  FromPgn,
  pgnToActisenseSerialFormat,
  pgnToActisenseN2KAsciiFormat,
  pgnToiKonvertSerialFormat,
  pgnToYdgwRawFormat,
  pgnToYdgwFullRawFormat,
  pgnToPCDIN,
  pgnToMXPGN,
  pgnToCandump1,
  pgnToCandump2,
  pgnToCandump3,
} from '@canboat/canboatjs'
import { PGN } from '@canboat/ts-pgns'

interface TransformTabProps {
  // No longer accepting parser from parent
}

const TransformTab: React.FC<TransformTabProps> = () => {
  // Create our own parser instance with appropriate options
  const parser = useMemo(() => {
    const newParser = new FromPgn({
      returnNulls: true,
      checkForInvalidFields: true,
      useCamel: true,
      useCamelCompat: false,
      returnNonMatches: true,
      createPGNObjects: true,
      includeInputData: true,
    })

    newParser.on('error', (pgn: any, error: any) => {
      console.error(`TransformTab parser error for PGN ${pgn.pgn}:`, error)
    })

    newParser.on('warning', (pgn: any, warning: any) => {
      console.warn(`TransformTab parser warning for PGN ${pgn.pgn}:`, warning)
    })

    return newParser
  }, [])
  // Load initial values from localStorage
  const [inputValue, setInputValue] = useState<string>(() => {
    try {
      return localStorage.getItem('transformTab-inputValue') || ''
    } catch {
      return ''
    }
  })
  const [parsedResult, setParsedResult] = useState<PGN | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<string>(() => {
    try {
      return localStorage.getItem('transformTab-outputFormat') || 'canboat-json'
    } catch {
      return 'canboat-json'
    }
  })

  // Save inputValue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('transformTab-inputValue', inputValue)
    } catch (error) {
      console.warn('Failed to save input value to localStorage:', error)
    }
  }, [inputValue])

  // Save outputFormat to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('transformTab-outputFormat', outputFormat)
    } catch (error) {
      console.warn('Failed to save output format to localStorage:', error)
    }
  }, [outputFormat])

  // Auto-parse whenever input or parser changes
  useEffect(() => {
    if (!inputValue.trim()) {
      setParsedResult(null)
      setParseError(null)
      return
    }

    try {
      setParseError(null)

      // Try to parse as JSON first
      if (inputValue.trim().startsWith('{')) {
        const jsonData = JSON.parse(inputValue)
        // If it's already a valid PGN JSON object, use it directly
        if (jsonData.pgn && typeof jsonData.pgn === 'number') {
          setParsedResult(jsonData as PGN)
          console.log('JSON PGN loaded:', jsonData)
        } else {
          setParseError('Invalid PGN JSON format - missing required pgn field')
        }
        return
      }

      // Try to parse as string format using the parser if available
      if (parser) {
        const result = parser.parseString(inputValue.trim())
        if (result) {
          setParsedResult(result)
          console.log('Parsed PGN:', result)
        } else {
          setParseError('Failed to parse message - invalid format or unsupported PGN')
        }
      } else {
        setParseError('Parser not available')
      }
    } catch (error) {
      setParseError(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [inputValue, parser])

  const outputFormats = [
    { value: 'canboat-json', label: 'Canboat JSON' },
    { value: 'actisense', label: 'Actisense Serial Format' },
    { value: 'actisense-n2k-ascii', label: 'Actisense N2K ASCII' },
    { value: 'ikonvert', label: 'iKonvert Format' },
    { value: 'ydwg-full-raw', label: 'Yacht Devices RAW Format' },
    { value: 'ydwg-raw', label: 'Yacht Devices RAW Send Format' },
    { value: 'pcdin', label: 'PCDIN Format' },
    { value: 'mxpgn', label: 'MXPGN Format' },
    { value: 'candump1', label: 'Linux CAN utils (Angstrom)' },
    { value: 'candump2', label: 'Linux CAN utils (Debian)' },
    { value: 'candump3', label: 'Linux CAN utils (log format)' },
  ]

  const formatOutput = (pgn: PGN, format: string): string => {
    if (!pgn) return ''

    try {
      switch (format) {
        case 'canboat-json':
          return JSON.stringify(pgn, null, 2)

        case 'actisense':
          // Use canboatjs built-in function
          const actisenseResult = pgnToActisenseSerialFormat(pgn)
          return actisenseResult || 'Unable to format to Actisense format'

        case 'ikonvert':
          // Use canboatjs built-in function
          const ikonvertResult = pgnToiKonvertSerialFormat(pgn)
          return ikonvertResult || 'Unable to format to iKonvert format'

        case 'ydwg-raw':
          // Use canboatjs built-in function - this returns an array of strings
          const ydwgResult = pgnToYdgwRawFormat(pgn)
          if (Array.isArray(ydwgResult)) {
            return ydwgResult.join('\n')
          }
          return ydwgResult || 'Unable to format to YDWG Raw format'

        case 'ydwg-full-raw':
          // Use canboatjs built-in function - this returns an array of strings
          const ydwgFullResult = pgnToYdgwFullRawFormat(pgn)
          if (Array.isArray(ydwgFullResult)) {
            return ydwgFullResult.join('\n')
          }
          return ydwgFullResult || 'Unable to format to YDWG Full Raw format'

        case 'actisense-n2k-ascii':
          // Use canboatjs built-in function
          const n2kAsciiResult = pgnToActisenseN2KAsciiFormat(pgn)
          return n2kAsciiResult || 'Unable to format to Actisense N2K ASCII format'

        case 'pcdin':
          // Use canboatjs built-in function
          const pcdinResult = pgnToPCDIN(pgn)
          return pcdinResult || 'Unable to format to PCDIN format'

        case 'mxpgn':
          // Use canboatjs built-in function
          const mxpgnResult = pgnToMXPGN(pgn)
          return mxpgnResult || 'Unable to format to MXPGN format'

        case 'candump1':
          // Use canboatjs built-in function - this returns an array of strings
          const candump1Result = pgnToCandump1(pgn)
          if (Array.isArray(candump1Result)) {
            return candump1Result.join('\n')
          }
          return candump1Result || 'Unable to format to candump1 format'

        case 'candump2':
          // Use canboatjs built-in function - this returns an array of strings
          const candump2Result = pgnToCandump2(pgn)
          if (Array.isArray(candump2Result)) {
            return candump2Result.join('\n')
          }
          return candump2Result || 'Unable to format to candump2 format'

        case 'candump3':
          // Use canboatjs built-in function - this returns an array of strings
          const candump3Result = pgnToCandump3(pgn)
          if (Array.isArray(candump3Result)) {
            return candump3Result.join('\n')
          }
          return candump3Result || 'Unable to format to candump3 format'

        default:
          return JSON.stringify(pgn, null, 2)
      }
    } catch (error) {
      return `Error formatting output: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  const handleClear = () => {
    setInputValue('')
    setParsedResult(null)
    setParseError(null)
  }

  const handleCopyOutput = async () => {
    if (!parsedResult) return

    const outputText = formatOutput(parsedResult, outputFormat)
    try {
      await navigator.clipboard.writeText(outputText)
      // Optional: You could add a toast notification here
      console.log('Output copied to clipboard')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = outputText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  return (
    <Card>
      <CardBody>
        <h4 className="text-sk-primary">Data Transformation</h4>
        <p className="mb-3">Transform and convert NMEA 2000 data between different formats and protocols.</p>

        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">NMEA 2000 Message Input</h6>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label htmlFor="nmea2000Input" className="form-label">
                    Enter NMEA 2000 message (String or JSON format):
                  </label>
                  <textarea
                    id="nmea2000Input"
                    className="form-control mb-3"
                    rows={12}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder='Enter your NMEA 2000 message here (auto-parsed)...
Examples:
String format: 2023-10-15T10:30:45.123Z,2,127250,17,255,8,00,fc,69,97,00,00,00,00
Canboat JSON format: {"timestamp": "2023-10-15T10:30:45.123Z", "prio": 2, "src": 17, "dst": 255, "pgn": 127250, "description": "Vessel Heading", "fields": {"SID": 0, "Heading": 1.5708, "Deviation": null, "Variation": null, "Reference": "Magnetic"}}'
                    style={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'nowrap', 
                      overflowX: 'auto' 
                    }}
                    spellCheck={false}
                  />
                </div>
                <div className="d-flex gap-2 mb-3">
                  <button className="btn btn-secondary" type="button" onClick={handleClear}>
                    Clear
                  </button>
                </div>

                {parseError && (
                  <div className="alert alert-danger" role="alert">
                    <strong>Error:</strong> {parseError}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">Transformation Output</h6>
              </div>
              <div className="card-body">
                <div className="form-group mb-3">
                  <label htmlFor="outputFormat" className="form-label">
                    Output Format:
                  </label>
                  <select
                    id="outputFormat"
                    className="form-control"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                  >
                    {outputFormats.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label htmlFor="transformOutput" className="form-label mb-0">
                      Parsed Result:
                    </label>
                    {parsedResult && (
                      <button
                        className="btn btn-outline-primary btn-sm"
                        type="button"
                        onClick={handleCopyOutput}
                        title="Copy output to clipboard"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                  <textarea
                    id="transformOutput"
                    className="form-control"
                    rows={9}
                    value={parsedResult ? formatOutput(parsedResult, outputFormat) : ''}
                    readOnly
                    placeholder="Parsed message will appear here..."
                    style={{ fontFamily: 'monospace', backgroundColor: '#f8f9fa' }}
                  />
                </div>

                {parsedResult && (
                  <div className="mt-3">
                    <div className="row">
                      <div className="col-12">
                        <div className="card bg-light">
                          <div className="card-body p-2">
                            <small>
                              <strong>PGN:</strong> {parsedResult.pgn} |<strong> Source:</strong> {parsedResult.src} |
                              <strong> Priority:</strong> {parsedResult.prio}
                              <br />
                              <strong>Description:</strong> {parsedResult.description || 'N/A'}
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export default TransformTab
