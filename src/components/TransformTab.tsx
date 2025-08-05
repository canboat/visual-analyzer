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
  const [outputFormat, setOutputFormat] = useState<string>('canboat-json')

  const outputFormats = [
    { value: 'canboat-json', label: 'Canboat JSON' },
    { value: 'actisense', label: 'Actisense Serial Format' },
    { value: 'actisense-n2k-ascii', label: 'Actisense N2K ASCII' },
    { value: 'ikonvert', label: 'iKonvert Format' },
    { value: 'ydwg-raw', label: 'YDWG Raw Format' },
    { value: 'pcdin', label: 'PCDIN Format' },
    { value: 'mxpgn', label: 'MiniPlex-3 MXPGN Format' },
    { value: 'candump1', label: 'Linux CAN utils (Angstrom)' },
    { value: 'candump2', label: 'Linux CAN utils (Debian)' },
    { value: 'candump3', label: 'Linux CAN utils (log format)' }
  ]

  const formatOutput = (pgn: PGN, format: string): string => {
    if (!pgn) return ''
    
    try {
      switch (format) {
        case 'canboat-json':
          return JSON.stringify(pgn, null, 2)
        
        case 'actisense':
          // Standard Actisense Serial Format: timestamp,prio,pgn,src,dst,len,data
          const timestamp = pgn.timestamp || new Date().toISOString()
          const inputData = (pgn as any).inputData
          if (inputData) {
            const dataHex = Array.from(inputData as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join(',')
            return `${timestamp},${pgn.prio || 0},${pgn.pgn},${pgn.src || 0},${pgn.dst || 255},${inputData.length},${dataHex}`
          }
          return `${timestamp},${pgn.prio || 0},${pgn.pgn},${pgn.src || 0},${pgn.dst || 255},0,`
        
        case 'actisense-n2k-ascii':
          // Actisense N2K ASCII format: A764027.880 CCF52 1F10D FC10FF7FFF7FFFFF
          const nmeaInputData = (pgn as any).inputData
          if (nmeaInputData) {
            const canId = ((pgn.prio || 0) << 26) | (pgn.pgn << 8) | (pgn.src || 0)
            const dataStr = Array.from(nmeaInputData as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
            return `A${Date.now().toString().slice(-9)} ${canId.toString(16).toUpperCase()} ${pgn.pgn.toString(16).toUpperCase()} ${dataStr}`
          }
          return ''
        
        case 'ikonvert':
          // iKonvert format: !PDGY,127245,255,/Pj/f/9///8=
          const ikonvertData = (pgn as any).inputData
          if (ikonvertData) {
            const base64Data = Buffer.from(ikonvertData).toString('base64')
            return `!PDGY,${pgn.pgn},${pgn.dst || 255},${base64Data}`
          }
          return `!PDGY,${pgn.pgn},${pgn.dst || 255},`
        
        case 'ydwg-raw':
          // YDWG Raw format: 16:29:27.082 R 09F8017F 50 C3 B8 13 47 D8 2B C6
          const ydwgData = (pgn as any).inputData
          if (ydwgData) {
            const time = new Date().toTimeString().split(' ')[0] + '.000'
            const canId = ((pgn.prio || 0) << 26) | (pgn.pgn << 8) | (pgn.src || 0)
            const dataHex = Array.from(ydwgData as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
            return `${time} R ${canId.toString(16).padStart(8, '0').toUpperCase()} ${dataHex}`
          }
          return ''
        
        case 'pcdin':
          // PCDIN format: $PCDIN,01F119,00000000,0F,2AAF00D1067414FF*59
          const pcdinData = (pgn as any).inputData
          if (pcdinData) {
            const pgnHex = pgn.pgn.toString(16).padStart(6, '0').toUpperCase()
            const dataHex = Array.from(pcdinData as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
            return `$PCDIN,${pgnHex},00000000,${(pgn.src || 0).toString(16).padStart(2, '0').toUpperCase()},${dataHex}*00`
          }
          return ''
        
        case 'mxpgn':
          // MiniPlex-3 MXPGN format: $MXPGN,01F801,2801,C1308AC40C5DE343*19
          const mxpgnData = (pgn as any).inputData
          if (mxpgnData) {
            const pgnHex = pgn.pgn.toString(16).padStart(6, '0').toUpperCase()
            const srcDst = ((pgn.src || 0) << 8) | (pgn.dst || 255)
            const dataHex = Array.from(mxpgnData as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
            return `$MXPGN,${pgnHex},${srcDst.toString(16).padStart(4, '0').toUpperCase()},${dataHex}*00`
          }
          return ''
        
        case 'candump1':
          // Linux CAN utils format (Angstrom): <0x18eeff01> [8] 05 a0 be 1c 00 a0 a0 c0
          const candump1Data = (pgn as any).inputData
          if (candump1Data) {
            const canId = ((pgn.prio || 0) << 26) | (pgn.pgn << 8) | (pgn.src || 0)
            const dataHex = Array.from(candump1Data as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join(' ')
            return `<0x${canId.toString(16).padStart(8, '0')}> [${candump1Data.length}] ${dataHex}`
          }
          return ''
        
        case 'candump2':
          // Linux CAN utils format (Debian): can0 09F8027F [8] 00 FC FF FF 00 00 FF FF
          const candump2Data = (pgn as any).inputData
          if (candump2Data) {
            const canId = ((pgn.prio || 0) << 26) | (pgn.pgn << 8) | (pgn.src || 0)
            const dataHex = Array.from(candump2Data as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
            return `can0 ${canId.toString(16).padStart(8, '0').toUpperCase()} [${candump2Data.length}] ${dataHex}`
          }
          return ''
        
        case 'candump3':
          // Linux CAN utils format (log): (1502979132.106111) slcan0 09F50374#000A00FFFF00FFFF
          const candump3Data = (pgn as any).inputData
          if (candump3Data) {
            const canId = ((pgn.prio || 0) << 26) | (pgn.pgn << 8) | (pgn.src || 0)
            const dataHex = Array.from(candump3Data as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
            const timestamp = (Date.now() / 1000).toFixed(6)
            return `(${timestamp}) slcan0 ${canId.toString(16).padStart(8, '0').toUpperCase()}#${dataHex}`
          }
          return ''
        
        default:
          return JSON.stringify(pgn, null, 2)
      }
    } catch (error) {
      return `Error formatting output: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

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
                  <label htmlFor="transformOutput" className="form-label">
                    Parsed Result:
                  </label>
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
