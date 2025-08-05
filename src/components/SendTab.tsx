import React, { useState } from 'react'
import { Card, CardBody } from 'reactstrap'

interface SendStatus {
  sending: boolean
  lastSent?: string
  error?: string
}

export const SendTab: React.FC = () => {
  const [sendStatus, setSendStatus] = useState<SendStatus>({
    sending: false,
  })

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
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.4'
                    }}
                  />
                </div>
                
                <div className="d-flex gap-2 mb-3">
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={sendStatus.sending}
                    onClick={handleSendMessage}
                  >
                    {sendStatus.sending ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane me-2"></i>
                        Send Message
                      </>
                    )}
                  </button>
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
                    }}
                  >
                    <i className="fas fa-eraser me-2"></i>
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

        <div className="row">
          <div className="col-md-6">
            <div className="card bg-sk-light">
              <div className="card-body">
                <h6 className="card-title">Quick Send</h6>
                <p className="card-text small">Send predefined PGNs with custom data fields.</p>
                <div className="alert alert-info small" role="alert">
                  <strong>Coming Soon:</strong> Quick send interface will be available in a future version.
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card bg-sk-light">
              <div className="card-body">
                <h6 className="card-title">Custom PGN</h6>
                <p className="card-text small">Compose and send custom PGN messages.</p>
                <div className="alert alert-info small" role="alert">
                  <strong>Coming Soon:</strong> PGN composer will be available in a future version.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
