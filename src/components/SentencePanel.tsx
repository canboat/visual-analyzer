import React, { useState } from 'react'

import { PGN } from '@canboat/ts-pgns'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
import { DeviceInformation, DeviceMap } from '../types'
import { Definition, findMatchingDefinition } from '@canboat/ts-pgns'
import { parseN2kString } from '@canboat/canboatjs'
import { Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap'

interface ByteMappingProps {
  pgnData: PGN
  definition: Definition | undefined
}

const ByteMapping = ({ pgnData, definition }: ByteMappingProps) => {
  if (!definition || !pgnData.input || pgnData.input.length === 0) {
    return <div>No input data or definition available for byte mapping</div>
  }

  // Parse the input data to get raw bytes using canboatjs utilities
  const getRawBytes = (): number[] => {
    // pgnData.input is an array of NMEA sentences like:
    // ["2024-08-02T07:30:45.123Z,6,126992,0,255,8,01,02,03,04,05,06,07,08"]
    if (!pgnData.input || pgnData.input.length === 0) return []
    
    const inputLine = pgnData.input[0]
    if (!inputLine) return []
    
    try {
      // Use canboatjs parseN2kString to parse different input formats
      // This handles multiple formats: Actisense, N2K ASCII, YDGW Raw, etc.
      const parseResult = parseN2kString(inputLine, {})
      
      if (parseResult && parseResult.data && !parseResult.error) {
        // parseResult.data is a Buffer containing the raw bytes
        return Array.from(parseResult.data)
      }
    } catch (error) {
      console.warn('Failed to parse input with parseN2kString, falling back to simple parsing:', error)
    }
    
    // Fallback to simple parsing for manual input
    try {
      // Split by comma and get the hex bytes (starting from index 6)
      const parts = inputLine.split(',')
      if (parts.length < 7) return []
      
      const hexBytes = parts.slice(6).filter(part => part.length === 2)
      return hexBytes.map(hex => parseInt(hex, 16))
    } catch (error) {
      console.warn('Failed to parse input data:', error)
      return []
    }
  }

  const rawBytes = getRawBytes()
  
  const renderByteMapping = () => {
    if (rawBytes.length === 0) {
      return <div>No raw byte data available</div>
    }

    return (
      <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
        <h6>Raw Bytes ({rawBytes.length} bytes)</h6>
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
          {rawBytes.map((byte: number, index: number) => (
            <span key={index} style={{ marginRight: '8px', padding: '2px 4px', backgroundColor: '#e9ecef' }}>
              {index.toString().padStart(2, '0')}: {byte.toString(16).padStart(2, '0').toUpperCase()}
            </span>
          ))}
        </div>

        <h6>Field Mapping</h6>
        <div style={{ border: '1px solid #dee2e6' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Field</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Bit Range</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Byte Range</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Raw Value</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Parsed Value</th>
              </tr>
            </thead>
            <tbody>
              {definition.Fields.map((field, index) => {
                const bitStart = field.BitOffset
                const bitLength = field.BitLength || 0
                const bitEnd = bitStart + bitLength - 1
                const byteStart = Math.floor(bitStart / 8)
                const byteEnd = Math.floor(bitEnd / 8)
                
                // Extract raw value from bytes
                let rawValue = 'N/A'
                if (byteStart < rawBytes.length && byteEnd < rawBytes.length) {
                  if (byteStart === byteEnd) {
                    // Field is within a single byte
                    const bitInByteStart = bitStart % 8
                    const mask = ((1 << bitLength) - 1) << bitInByteStart
                    rawValue = `0x${((rawBytes[byteStart] & mask) >> bitInByteStart).toString(16).toUpperCase()}`
                  } else {
                    // Field spans multiple bytes
                    const bytes = rawBytes.slice(byteStart, byteEnd + 1)
                    rawValue = bytes.map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
                  }
                }

                // Get parsed value from PGN data
                const parsedValue = (pgnData.fields as any)[field.Id] !== undefined 
                  ? JSON.stringify((pgnData.fields as any)[field.Id]) 
                  : 'N/A'

                return (
                  <tr key={index}>
                    <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                      <strong>{field.Name}</strong>
                      {field.Unit && <span style={{ color: '#6c757d' }}> ({field.Unit})</span>}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                      {bitStart} - {bitEnd} ({bitLength} bits)
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                      {byteStart}{byteStart !== byteEnd ? ` - ${byteEnd}` : ''}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #dee2e6', fontFamily: 'monospace' }}>
                      {rawValue}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                      {parsedValue}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return renderByteMapping()
}

interface SentencePanelProps {
  selectedPgn: Subject<PGN>
  info: Subject<DeviceMap>
}

const DATA_TAB_ID = 'data'
const PGNDEF_TAB_ID = 'pgndef'
const DEVICE_TAB_ID = 'device'
const INPUT_TAB_ID = 'input'
const MAPPING_TAB_ID = 'mapping'

export const SentencePanel = (props: SentencePanelProps) => {
  const [activeTab, setActiveTab] = useState(DATA_TAB_ID)
  const pgnData = useObservableState<PGN>(props.selectedPgn)
  const info = useObservableState<DeviceMap>(props.info, {})

  if (pgnData === undefined || pgnData === null) {
    return <div>Select a PGN to view its data</div>
  }
  let definition: Definition = pgnData.getDefinition()
  //console.log('pgnData', pgnData)
  return (
    <div
      style={{
        width: '100%',
        height: '600px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Nav tabs>
        <NavItem>
          <NavLink className={activeTab === DATA_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(DATA_TAB_ID)}>
            Data
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink className={activeTab === INPUT_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(INPUT_TAB_ID)}>
            Input
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink className={activeTab === DEVICE_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(DEVICE_TAB_ID)}>
            Device Information
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink className={activeTab === PGNDEF_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(PGNDEF_TAB_ID)}>
            PGN Definition
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink className={activeTab === MAPPING_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(MAPPING_TAB_ID)}>
            Byte Mapping
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={activeTab} style={{ flex: 1, overflow: 'auto' }}>
        <TabPane tabId={DATA_TAB_ID}>
          <h5>{definition?.Description}</h5>
          <pre>{JSON.stringify(pgnData, (key, value) => (key === 'input' ? undefined : value), 2)}</pre>
        </TabPane>
        {definition !== undefined && (
          <TabPane tabId={PGNDEF_TAB_ID}>
            <pre>{JSON.stringify(definition, null, 2)}</pre>
          </TabPane>
        )}
        <TabPane tabId={DEVICE_TAB_ID}>
          <pre>{JSON.stringify(info[pgnData.src!]?.info, null, 2)}</pre>
        </TabPane>
        <TabPane tabId={INPUT_TAB_ID}>
          <pre>
            {(pgnData.input || []).map((input) => {
              return `${input}\n`
            })}
          </pre>
        </TabPane>
        <TabPane tabId={MAPPING_TAB_ID}>
          <ByteMapping pgnData={pgnData} definition={definition} />
        </TabPane>
      </TabContent>
    </div>
  )
}
