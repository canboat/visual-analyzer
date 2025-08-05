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
    const exampleMessage = '2023-10-15T10:30:45.123Z,2,127250,17,255,8,00,fc,69,97,00,00,00,00'
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
          <div className="col-12">
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
                    rows={6}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter your NMEA 2000 message here...
Examples:
String format: 2023-10-15T10:30:45.123Z,2,127250,17,255,8,00,fc,69,97,00,00,00,00
JSON format: {&quot;timestamp&quot;: &quot;2023-10-15T10:30:45.123Z&quot;, &quot;prio&quot;: 2, &quot;pgn&quot;: 127250, &quot;src&quot;: 17, &quot;dst&quot;: 255, &quot;len&quot;: 8, &quot;data&quot;: [0,252,105,151,0,0,0,0]}"
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

                {parsedResult && (
                  <div className="card mt-3">
                    <div className="card-header">
                      <h6 className="mb-0">Parsed Result</h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <strong>PGN:</strong> {parsedResult.pgn}<br />
                          <strong>Source:</strong> {parsedResult.src}<br />
                          <strong>Destination:</strong> {parsedResult.dst}<br />
                          <strong>Priority:</strong> {parsedResult.prio}<br />
                          <strong>Description:</strong> {parsedResult.description || 'N/A'}
                        </div>
                        <div className="col-md-6">
                          <strong>Fields:</strong>
                          <pre className="mt-2 p-2 bg-light" style={{ fontSize: '0.85em' }}>
                            {JSON.stringify(parsedResult.fields, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="alert alert-info" role="alert">
          <strong>Coming Soon:</strong> Data transformation tools and protocol converters will be available in a
          future version.
        </div>

        <div className="row">
          <div className="col-md-4">
            <div className="card bg-sk-light">
              <div className="card-body">
                <h6 className="card-title">Actisense → YDRAW</h6>
                <p className="card-text small">Convert Actisense messages to YDRAW format.</p>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card bg-sk-light">
              <div className="card-body">
                <h6 className="card-title">N2K → Signal K</h6>
                <p className="card-text small">Transform to Signal K JSON format.</p>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card bg-sk-light">
              <div className="card-body">
                <h6 className="card-title">Custom Format</h6>
                <p className="card-text small">Export to custom data formats.</p>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export default TransformTab
