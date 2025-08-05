import React, { useState } from 'react'
import { Card, CardBody } from 'reactstrap'
import { FromPgn } from '@canboat/canboatjs'

interface SendStatus {
  sending: boolean
  lastSent?: string
  error?: string
}

export const SendTab: React.FC = () => {
  const [sendStatus, setSendStatus] = useState<SendStatus>({
    sending: false,
  })
  const [isJsonInput, setIsJsonInput] = useState<boolean>(false)
  const [convertedJson, setConvertedJson] = useState<string>('')

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
                
                <div className="form-group mb-3">
                  <label htmlFor="nmea2000Message" className="form-label">
                    <strong>NMEA 2000 Message:</strong>
                  </label>
                  <textarea
                    id="nmea2000Message"
                    className="form-control font-monospace"
                    rows={10}
                    placeholder="Enter NMEA 2000 message here...&#10;&#10;Actisense format:&#10;2023-10-15T10:30:00.000Z,2,127251,1,255,8,ff,ff,ff,ff,ff,ff,ff,ff&#10;&#10;YDRAW format:&#10;21:53:15.000 R 0DF80503 FF FF FF FF FF FF FF FF&#10;&#10;Canboat JSON format:&#10;{&quot;timestamp&quot;:&quot;2023-10-15T10:30:00.000Z&quot;,&quot;prio&quot;:2,&quot;src&quot;:1,&quot;dst&quot;:255,&quot;pgn&quot;:127251,&quot;description&quot;:&quot;Rate of Turn&quot;,&quot;fields&quot;:{&quot;Rate&quot;:0}}&#10;&#10;JSON array (multiple messages):&#10;[{&quot;pgn&quot;:127251,&quot;src&quot;:1,&quot;fields&quot;:{&quot;Rate&quot;:0}},{&quot;pgn&quot;:127250,&quot;src&quot;:1,&quot;fields&quot;:{&quot;Heading&quot;:1.5708}}]&#10;&#10;Multiple messages (any format, one per line):&#10;2023-10-15T10:30:00.000Z,2,127251,1,255,8,ff,ff,ff,ff,ff,ff,ff,ff&#10;21:53:16.000 R 0DF80503 01 02 03 04 05 06 07 08"
                    onChange={(e) => checkJsonInput(e.target.value)}
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.4'
                    }}
                  />
                  
                  {convertedJson && (
                    <div className="mt-3">
                      <label className="form-label">
                        <strong>Converted to Canboat JSON:</strong>
                      </label>
                      <textarea
                        className="form-control font-monospace"
                        rows={8}
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
                      }
                      setSendStatus({ sending: false })
                      setIsJsonInput(false)
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
