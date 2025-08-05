import React, { useState, useEffect } from 'react'
import { Card, CardBody } from 'reactstrap'
import { FromPgn } from '@canboat/canboatjs'

interface SendStatus {
  sending: boolean
  lastSent?: string
  error?: string
}

interface MessageHistory {
  message: string
  timestamp: string
  format: string
}

export const SendTab: React.FC = () => {
  const [sendStatus, setSendStatus] = useState<SendStatus>({
    sending: false,
  })
  const [isJsonInput, setIsJsonInput] = useState<boolean>(false)
  const [convertedJson, setConvertedJson] = useState<string>('')
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([])
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false)

  // Load message history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('nmea2000MessageHistory')
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
    localStorage.setItem('nmea2000MessageHistory', JSON.stringify(messageHistory))
  }, [messageHistory])

  // Function to detect message format
  const detectMessageFormat = (message: string): string => {
    const trimmed = message.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return 'JSON'
    } else if (trimmed.match(/^\d{2}:\d{2}:\d{2}\.\d{3}\s+[RT]\s+[0-9A-Fa-f]+/)) {
      return 'YDRAW'
    } else if (trimmed.includes(',')) {
      return 'Actisense'
    }
    return 'Unknown'
  }

  // Function to get a readable description for a message
  const getMessageDescription = (message: string, format: string): string => {
    if (format !== 'JSON') {
      return message
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
      return message
    }
  }

  // Function to add message to history
  const addToHistory = (message: string) => {
    const historyItem: MessageHistory = {
      message,
      timestamp: new Date().toISOString(),
      format: detectMessageFormat(message)
    }
    
    setMessageHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(item => item.message !== message)
      // Add new item at the beginning and limit to 20 items
      return [historyItem, ...filtered].slice(0, 20)
    })
  }

  // Function to select message from history
  const selectFromHistory = (message: string) => {
    const textarea = document.getElementById('nmea2000Message') as HTMLTextAreaElement
    if (textarea) {
      textarea.value = message
      checkJsonInput(message)
    }
    setShowHistoryDropdown(false)
  }

  // Function to clear history
  const clearHistory = () => {
    setMessageHistory([])
    setShowHistoryDropdown(false)
  }

  // Function to check if input is JSON and update state
  const checkJsonInput = (input: string) => {
    const trimmed = input.trim()
    const isJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
    setIsJsonInput(isJson && trimmed.length > 0)
    
    // If not JSON and has content, show converted JSON
    if (!isJson && trimmed.length > 0) {
      convertToCanboatJson(trimmed)
    } else {
      setConvertedJson('')
    }
  }

  // Function to convert non-JSON input to canboat JSON format
  const convertToCanboatJson = (input: string) => {
    const lines = input.split('\n').filter(line => line.trim())
    const jsonMessages: any[] = []

    // Create parser instance
    const parser = new FromPgn({
      returnNulls: true,
      checkForInvalidFields: true,
      useCamel: true,
      useCamelCompat: false,
      returnNonMatches: true,
      createPGNObjects: true,
      includeInputData: true,
    })

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        // Try to parse using canboatjs parseString method
        const parsed = parser.parseString(trimmed)
        if (parsed) {
          jsonMessages.push(parsed)
        }
      } catch (error) {
        // If parsing fails, skip this line
        console.warn('Failed to parse line:', trimmed, error)
        continue
      }
    }

    if (jsonMessages.length > 0) {
      const formatted = jsonMessages.length === 1 
        ? JSON.stringify(jsonMessages[0], null, 2)
        : JSON.stringify(jsonMessages, null, 2)
      setConvertedJson(formatted)
    } else {
      setConvertedJson('')
    }
  }

  // Function to beautify JSON
  const handleBeautifyJson = () => {
    const textarea = document.getElementById('nmea2000Message') as HTMLTextAreaElement
    if (!textarea) return

    try {
      const input = textarea.value.trim()
      if ((input.startsWith('{') && input.endsWith('}')) || (input.startsWith('[') && input.endsWith(']'))) {
        const parsed = JSON.parse(input)
        const beautified = JSON.stringify(parsed, null, 2)
        textarea.value = beautified
        // Update JSON detection after beautifying
        checkJsonInput(beautified)
      }
    } catch (error) {
      // If JSON parsing fails, don't modify the input
      console.warn('Could not beautify JSON:', error)
    }
  }

  // Function to handle sending NMEA 2000 messages
  const handleSendMessage = async () => {
    const textarea = document.getElementById('nmea2000Message') as HTMLTextAreaElement
    if (!textarea || !textarea.value.trim()) {
      setSendStatus({
        sending: false,
        error: 'Please enter a message to send'
      })
      return
    }

    setSendStatus({ sending: true, error: undefined })

    try {
      const input = textarea.value.trim()

      // Basic validation - just ensure there's content
      if (!input) {
        throw new Error('No message content provided')
      }

      // For JSON format, validate the structure
      if ((input.startsWith('{') && input.endsWith('}')) || (input.startsWith('[') && input.endsWith(']'))) {
        try {
          const parsedJson = JSON.parse(input)
          
          if (Array.isArray(parsedJson)) {
            // JSON array format - validate each message has required fields
            for (const message of parsedJson) {
              if (!message.pgn || !message.src) {
                throw new Error('Each JSON message in array must contain at least pgn and src fields')
              }
            }
          } else {
            // Single JSON object - validate required fields
            if (!parsedJson.pgn || !parsedJson.src) {
              throw new Error('JSON message must contain at least pgn and src fields')
            }
          }
        } catch (parseError) {
          throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
        }
      }
      // For other formats (Actisense, YDRAW, etc.), let canboatjs handle the parsing

      // Send the entire input to the endpoint
      const messageData = { value: input, sendToN2K: true }
      const response = await fetch('/skServer/inputTest', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Send failed (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(result.error)
      }

      setSendStatus({
        sending: false,
        lastSent: new Date().toLocaleTimeString(),
        error: undefined
      })

      // Add successful message to history
      addToHistory(input)

      console.log('Successfully sent message(s)')
    } catch (error) {
      console.error('Error sending message:', error)
      setSendStatus({
        sending: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while sending message'
      })
    }
  }

  return (
    <Card>
      <CardBody>
        <h4 className="text-sk-primary">Send NMEA 2000 Messages</h4>
        <p className="mb-3">Send NMEA 2000 messages to the network for testing and debugging purposes using any format supported by canboatjs.</p>

        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Send Raw NMEA 2000 Message</h6>
                <p className="card-text small mb-3">
                  Enter NMEA 2000 messages in any format supported by canboatjs (Actisense, YDRAW, Canboat JSON, etc.). Multiple messages can be entered on separate lines.
                </p>
                
                <div className="row mb-3">
                  <div className={convertedJson ? 'col-md-6' : 'col-12'}>
                    <div className="form-group">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label htmlFor="nmea2000Message" className="form-label mb-0">
                          <strong>NMEA 2000 Message:</strong>
                        </label>
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
                                    marginTop: '4px'
                                  }}
                                >
                                  <div className="p-2 border-bottom bg-light">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <small className="text-muted fw-bold">Message History</small>
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm text-danger p-0"
                                        onClick={clearHistory}
                                        title="Clear all history"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    </div>
                                  </div>
                                  {messageHistory.map((item, index) => (
                                    <div
                                      key={index}
                                      className="p-2 border-bottom cursor-pointer"
                                      style={{
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s'
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
                        id="nmea2000Message"
                        className="form-control font-monospace"
                        rows={12}
                        placeholder="Enter NMEA 2000 message here...&#10;&#10;Actisense format:&#10;2023-10-15T10:30:00.000Z,2,127251,1,255,8,ff,ff,ff,ff,ff,ff,ff,ff&#10;&#10;YDRAW format:&#10;21:53:15.000 R 0DF80503 FF FF FF FF FF FF FF FF&#10;&#10;Canboat JSON format:&#10;{&quot;timestamp&quot;:&quot;2023-10-15T10:30:00.000Z&quot;,&quot;prio&quot;:2,&quot;src&quot;:1,&quot;dst&quot;:255,&quot;pgn&quot;:127251,&quot;description&quot;:&quot;Rate of Turn&quot;,&quot;fields&quot;:{&quot;Rate&quot;:0}}&#10;&#10;JSON array (multiple messages):&#10;[{&quot;pgn&quot;:127251,&quot;src&quot;:1,&quot;fields&quot;:{&quot;Rate&quot;:0}},{&quot;pgn&quot;:127250,&quot;src&quot;:1,&quot;fields&quot;:{&quot;Heading&quot;:1.5708}}]&#10;&#10;Multiple messages (any format, one per line):&#10;2023-10-15T10:30:00.000Z,2,127251,1,255,8,ff,ff,ff,ff,ff,ff,ff,ff&#10;21:53:16.000 R 0DF80503 01 02 03 04 05 06 07 08"
                        onChange={(e) => checkJsonInput(e.target.value)}
                        style={{
                          fontSize: '14px',
                          lineHeight: '1.4'
                        }}
                      />
                    </div>
                  </div>
                  
                  {convertedJson && (
                    <div className="col-md-6">
                      <div className="form-group">
                        <label className="form-label">
                          <strong>Canboat JSON:</strong>
                        </label>
                        <textarea
                          className="form-control font-monospace"
                          rows={12}
                          value={convertedJson}
                          readOnly
                          style={{
                            fontSize: '14px',
                            lineHeight: '1.4',
                            backgroundColor: '#f8f9fa',
                            color: '#495057'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="d-flex mb-3">
                  <button 
                    type="button" 
                    className="btn btn-primary me-3"
                    disabled={sendStatus.sending}
                    onClick={handleSendMessage}
                  >
                    {sendStatus.sending ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        Sending...
                      </>
                    ) : (
                      'Send Message'
                    )}
                  </button>
                  {isJsonInput && (
                    <button 
                      type="button" 
                      className="btn btn-info me-3"
                      disabled={sendStatus.sending}
                      onClick={handleBeautifyJson}
                    >
                      Beautify JSON
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    disabled={sendStatus.sending}
                    onClick={() => {
                      const textarea = document.getElementById('nmea2000Message') as HTMLTextAreaElement
                      if (textarea) {
                        textarea.value = ''
                        checkJsonInput('')
                      }
                      setSendStatus({ sending: false })
                      setIsJsonInput(false)
                      setConvertedJson('')
                    }}
                  >
                    Clear
                  </button>
                </div>

                {/* Status feedback */}
                {sendStatus.error && (
                  <div className="alert alert-danger" role="alert">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong>Send Error:</strong> {sendStatus.error}
                  </div>
                )}
                
                {sendStatus.lastSent && !sendStatus.error && (
                  <div className="alert alert-success" role="alert">
                    <i className="fas fa-check-circle me-2"></i>
                    <strong>Success:</strong> Message(s) sent successfully at {sendStatus.lastSent}
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
