import React, { useState } from 'react'
import { Card, CardBody } from 'reactstrap'
import { FromPgn } from '@canboat/canboatjs'
import { PGN } from '@canboat/ts-pgns'

interface TransformTabProps {
  parser?: FromPgn
}

const TransformTab: React.FC<TransformTabProps> = ({ parser }) => {
  const [inputValue, setInputValue] = useState<string>('')
  const [parsedResult, setParsedResult] = useState<PGN | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleParseMessage = () => {
    if (!inputValue.trim()) {
      setParseError('Please enter a message to parse')
      return
    }

    try {
      setParseError(null)
      
      // Try to parse as JSON first
      if (inputValue.trim().startsWith('{')) {
        const jsonData = JSON.parse(inputValue)
        // TODO: Handle JSON format parsing
        console.log('JSON format detected:', jsonData)
        setParseError('JSON format parsing not yet implemented')
        return
      }
      
      // Try to parse as string format using the parser if available
      if (parser) {
        const result = parser.parse(inputValue.trim())
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
  }

  const handleClear = () => {
    setInputValue('')
    setParsedResult(null)
    setParseError(null)
  }

  const handleLoadExample = () => {
    const exampleMessage = `{
  "timestamp": "2023-10-15T10:30:45.123Z",
  "prio": 2,
  "src": 17,
  "dst": 255,
  "pgn": 127250,
  "description": "Vessel Heading",
  "fields": {
    "SID": 0,
    "Heading": 1.5708,
    "Deviation": null,
    "Variation": null,
    "Reference": "Magnetic"
  }
}`
    setInputValue(exampleMessage)
    setParsedResult(null)
    setParseError(null)
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
                    className="form-control"
                    rows={12}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter your NMEA 2000 message here...
Examples:
String format: 2023-10-15T10:30:45.123Z,2,127250,17,255,8,00,fc,69,97,00,00,00,00
Canboat JSON format: {&quot;timestamp&quot;: &quot;2023-10-15T10:30:45.123Z&quot;, &quot;prio&quot;: 2, &quot;src&quot;: 17, &quot;dst&quot;: 255, &quot;pgn&quot;: 127250, &quot;description&quot;: &quot;Vessel Heading&quot;, &quot;fields&quot;: {&quot;SID&quot;: 0, &quot;Heading&quot;: 1.5708, &quot;Deviation&quot;: null, &quot;Variation&quot;: null, &quot;Reference&quot;: &quot;Magnetic&quot;}}"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div className="d-flex gap-2 mb-3">
                  <button className="btn btn-primary" type="button" onClick={handleParseMessage}>
                    Parse Message
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={handleClear}>
                    Clear
                  </button>
                  <button className="btn btn-outline-secondary" type="button" onClick={handleLoadExample}>
                    Load Example
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
                <div className="form-group">
                  <label htmlFor="transformOutput" className="form-label">
                    Parsed Result:
                  </label>
                  <textarea
                    id="transformOutput"
                    className="form-control"
                    rows={12}
                    value={parsedResult ? JSON.stringify(parsedResult, null, 2) : ''}
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
                              <strong>PGN:</strong> {parsedResult.pgn} | 
                              <strong> Source:</strong> {parsedResult.src} | 
                              <strong> Priority:</strong> {parsedResult.prio}<br />
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
