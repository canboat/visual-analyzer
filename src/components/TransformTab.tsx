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
import { BehaviorSubject } from 'rxjs'
import { SentencePanel } from './SentencePanel'
import { DeviceMap } from '../types'

interface MessageHistory {
  message: string
  timestamp: string
  format: string
}

interface TransformTabProps {
  // No longer accepting parser from parent
}

const TransformTab: React.FC<TransformTabProps> = () => {
  // Create BehaviorSubject instances for SentencePanel (replays last value to new subscribers)
  const selectedPgnSubject = useMemo(() => new BehaviorSubject<PGN | null>(null), [])
  const deviceInfoSubject = useMemo(() => new BehaviorSubject<DeviceMap>({}), [])

  // Create filtered subject that only emits valid PGN values (no nulls)
  const validPgnSubject = useMemo(() => new BehaviorSubject<PGN | undefined>(undefined), [])

  // Create our own parser instance with appropriate options
  const parser = useMemo(() => {
    const newParser = new FromPgn({
      returnNulls: true,
      checkForInvalidFields: true,
      useCamel: true,
      useCamelCompat: false,
      returnNonMatches: true,
      createPGNObjects: true,
      includeInputData: false,
      includeRawData: true,
      includeByteMapping: true,
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
  const [signalKResult, setSignalKResult] = useState<string | null>(null)
  const [signalKLoading, setSignalKLoading] = useState<boolean>(false)
  const [outputFormat, setOutputFormat] = useState<string>(() => {
    try {
      return localStorage.getItem('transformTab-outputFormat') || 'canboat-json'
    } catch {
      return 'canboat-json'
    }
  })
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([])
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false)

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

  // Load message history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('transformTab-messageHistory')
    if (savedHistory) {
      try {
        setMessageHistory(JSON.parse(savedHistory))
      } catch (error) {
        console.warn('Failed to parse message history from localStorage:', error)
      }
    }
  }, [])

  // Save message history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('transformTab-messageHistory', JSON.stringify(messageHistory))
  }, [messageHistory])

  // Function to detect message format
  const detectMessageFormat = (message: string): string => {
    const trimmed = message.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return 'JSON'
    } else {
      return 'String'
    }
  }

  // Function to get a readable description for a message
  const getMessageDescription = (message: string, format: string): string => {
    // For multi-line messages, only show the first line
    const firstLine = message.split('\n')[0]

    if (format !== 'JSON') {
      return firstLine
    }

    try {
      const parsed = JSON.parse(message)
      if (Array.isArray(parsed)) {
        // For arrays, show count and first PGN info
        if (parsed.length > 0 && parsed[0].pgn) {
          const firstPgn = parsed[0]
          const desc = firstPgn.description || `PGN ${firstPgn.pgn}`
          return `${parsed.length} messages: ${desc}${parsed.length > 1 ? ', ...' : ''}`
        }
        return `${parsed.length} messages`
      } else {
        // For single objects, show PGN description
        if (parsed.pgn) {
          return parsed.description || `PGN ${parsed.pgn}`
        }
        return 'JSON message'
      }
    } catch (error) {
      return firstLine
    }
  }

  // Function to add message to history
  const addToHistory = (message: string) => {
    if (!message.trim()) return

    const historyItem: MessageHistory = {
      message,
      timestamp: new Date().toISOString(),
      format: detectMessageFormat(message),
    }

    setMessageHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((item) => item.message !== message)
      // Add new item at the beginning and limit to 20 items
      return [historyItem, ...filtered].slice(0, 20)
    })
  }

  // Function to select message from history
  const selectFromHistory = (message: string) => {
    setInputValue(message)
    setShowHistoryDropdown(false)
  }

  // Reset history navigation when input changes manually
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value)
  }

  // Function to clear history
  const clearHistory = () => {
    if (messageHistory.length > 0 && !confirm('Are you sure you want to clear all message history?')) {
      return
    }
    setMessageHistory([])
    setShowHistoryDropdown(false)
  }

  // Function to delete a specific history item
  const deleteHistoryItem = (index: number, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent selecting the item when deleting
    setMessageHistory((prev) => prev.filter((_, i) => i !== index))
  }

  // Function to transform to SignalK using the API endpoint
  const transformToSignalK = async (pgn: PGN): Promise<string> => {
    try {
      setSignalKLoading(true)
      const response = await fetch('/api/transform/signalk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: pgn }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'SignalK transformation failed')
      }

      // Format the SignalK deltas for display
      if (result.signalKDeltas && result.signalKDeltas.length > 0) {
        return JSON.stringify(result.signalKDeltas, null, 2)
      } else {
        return 'No SignalK deltas generated'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return `Error transforming to SignalK: ${errorMessage}`
    } finally {
      setSignalKLoading(false)
    }
  }

  // Auto-parse whenever input, parser, or output format changes
  useEffect(() => {
    if (!inputValue.trim()) {
      setParsedResult(null)
      setParseError(null)
      selectedPgnSubject.next(null)
      validPgnSubject.next(undefined)
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
          selectedPgnSubject.next(jsonData as PGN)
          validPgnSubject.next(jsonData as PGN)
          // Add successful parse to history
          addToHistory(inputValue)
        } else {
          setParseError('Invalid PGN JSON format - missing required pgn field')
          selectedPgnSubject.next(null)
          validPgnSubject.next(undefined)
        }
        return
      }

      // Try to parse as string format using the parser if available
      if (parser) {
        const lines = inputValue.split('\n').filter((line) => line.trim())

        let result: PGN | undefined = undefined
        parser.options.useCamel = outputFormat === 'canboat-json-camel' || outputFormat === 'signalk'
        for (const line of lines) {
          result = parser.parseString(line)
          if (result) {
            setParsedResult(result)
            selectedPgnSubject.next(result)
            validPgnSubject.next(result)
            // Add successful parse to history
            addToHistory(inputValue)
            break
          }
        }
        if (!result) {
          setParseError('Failed to parse message - invalid format or unsupported PGN')
          selectedPgnSubject.next(null)
          validPgnSubject.next(undefined)
        }
      } else {
        setParseError('Parser not available')
        selectedPgnSubject.next(null)
        validPgnSubject.next(undefined)
      }
    } catch (error) {
      console.error('Error parsing input value:', error)
      setParseError(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      selectedPgnSubject.next(null)
      validPgnSubject.next(undefined)
    }
  }, [inputValue, parser, outputFormat])

  // Handle SignalK transformation when format changes to signalk
  useEffect(() => {
    if (outputFormat === 'signalk' && parsedResult) {
      transformToSignalK(parsedResult).then((result) => {
        setSignalKResult(result)
      })
    } else {
      setSignalKResult(null)
    }
  }, [outputFormat, parsedResult])

  const outputFormats = [
    { value: 'canboat-json', label: 'Canboat JSON' },
    { value: 'canboat-json-camel', label: 'Canboat JSON (Camel Case)' },
    { value: 'actisense', label: 'Actisense Serial' },
    { value: 'actisense-n2k-ascii', label: 'Actisense N2K ASCII' },
    { value: 'ikonvert', label: 'iKonvert' },
    { value: 'ydwg-full-raw', label: 'Yacht Devices RAW' },
    { value: 'ydwg-raw', label: 'Yacht Devices RAW Send' },
    { value: 'pcdin', label: 'PCDIN' },
    { value: 'mxpgn', label: 'MXPGN' },
    { value: 'candump1', label: 'Linux CAN utils (Angstrom)' },
    { value: 'candump2', label: 'Linux CAN utils (Debian)' },
    { value: 'candump3', label: 'Linux CAN utils (log format)' },
    { value: 'signalk', label: 'Signal K' },
  ]

  const formatOutput = (pgn: PGN, format: string): string => {
    if (!pgn) return ''

    try {
      switch (format) {
        case 'canboat-json':
        case 'canboat-json-camel':
          delete pgn.input
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

        case 'signalk':
          // Return the cached SignalK result or loading message
          if (signalKLoading) {
            return 'Loading SignalK transformation...'
          }
          return signalKResult || 'SignalK transformation not available'

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
    setSignalKResult(null)
    // Clear the subjects as well
    selectedPgnSubject.next(null)
    validPgnSubject.next(undefined)
  }

  const handleCopyOutput = async () => {
    if (!parsedResult) return

    let outputText: string
    if (outputFormat === 'signalk') {
      outputText = signalKResult || 'SignalK transformation not available'
    } else {
      outputText = formatOutput(parsedResult, outputFormat)
    }

    try {
      await navigator.clipboard.writeText(outputText)
      // Optional: You could add a toast notification here
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
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <label htmlFor="nmea2000Input" className="form-label mb-0">
                        Enter NMEA 2000 message (String or JSON format):
                      </label>
                    </div>
                    {messageHistory.length > 0 && (
                      <div className="position-relative">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        >
                          <i className="fas fa-history me-1"></i>
                          History ({messageHistory.length})
                        </button>
                        {showHistoryDropdown && (
                          <>
                            <div
                              className="position-fixed top-0 start-0 w-100 h-100"
                              style={{ zIndex: 1040 }}
                              onClick={() => setShowHistoryDropdown(false)}
                            />
                            <div
                              className="position-absolute bg-white border rounded shadow-lg"
                              style={{
                                top: '100%',
                                right: 0,
                                minWidth: '400px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                zIndex: 1050,
                                marginTop: '4px',
                              }}
                            >
                              <div className="p-2 border-bottom bg-light">
                                <div className="d-flex justify-content-between align-items-center">
                                  <small className="text-muted fw-bold">Message History</small>
                                  <div className="d-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={clearHistory}
                                      title="Clear all history"
                                      style={{ fontSize: '0.75em', padding: '2px 8px' }}
                                    >
                                      <i className="fas fa-trash me-1"></i>
                                      Clear All
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {messageHistory.map((item, index) => (
                                <div
                                  key={index}
                                  className="p-2 border-bottom cursor-pointer"
                                  style={{
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                  }}
                                  onClick={() => selectFromHistory(item.message)}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                >
                                  <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                      <div className="d-flex align-items-center mb-1">
                                        <span className="badge bg-secondary me-2" style={{ fontSize: '0.7em' }}>
                                          {item.format}
                                        </span>
                                        <small className="text-muted">
                                          {new Date(item.timestamp).toLocaleString()}
                                        </small>
                                      </div>
                                      <div
                                        className="font-monospace small text-truncate"
                                        style={{ fontSize: '0.75em' }}
                                        title={item.message}
                                      >
                                        {getMessageDescription(item.message, item.format)}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-sm text-danger p-1"
                                      onClick={(e) => deleteHistoryItem(index, e)}
                                      title="Delete this item"
                                      style={{
                                        fontSize: '14px',
                                        lineHeight: 1,
                                        minWidth: '22px',
                                        height: '22px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid #dc3545',
                                        borderRadius: '3px',
                                        backgroundColor: 'white',
                                        fontWeight: 'bold',
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <textarea
                    id="nmea2000Input"
                    className="form-control mb-3"
                    rows={12}
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder='Enter your NMEA 2000 message here (auto-parsed)...
Examples:
String format: 2023-10-15T10:30:45.123Z,2,127250,17,255,8,00,fc,69,97,00,00,00,00
Canboat JSON format: {"timestamp": "2023-10-15T10:30:45.123Z", "prio": 2, "src": 17, "dst": 255, "pgn": 127250, "description": "Vessel Heading", "fields": {"SID": 0, "Heading": 1.5708, "Deviation": null, "Variation": null, "Reference": "Magnetic"}}'
                    style={{
                      fontFamily: 'monospace',
                      whiteSpace: 'pre',
                      overflowX: 'auto',
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
                    {parsedResult &&
                      (!(parsedResult instanceof PGN) ||
                        (outputFormat !== 'canboat-json' && outputFormat !== 'canboat-json-camel')) && (
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
                  {parsedResult instanceof PGN &&
                  (outputFormat === 'canboat-json' || outputFormat === 'canboat-json-camel') ? (
                    <div style={{ border: '1px solid #ced4da', borderRadius: '0.25rem', backgroundColor: '#f8f9fa' }}>
                      <SentencePanel selectedPgn={validPgnSubject as any} info={deviceInfoSubject} />
                    </div>
                  ) : (
                    <textarea
                      id="transformOutput"
                      className="form-control"
                      rows={9}
                      value={parsedResult ? formatOutput(parsedResult, outputFormat) : ''}
                      readOnly
                      placeholder="Parsed message will appear here..."
                      style={{ fontFamily: 'monospace', backgroundColor: '#f8f9fa' }}
                    />
                  )}
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
