import React, { useState } from 'react'

import { PGN } from '@canboat/ts-pgns'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
import { DeviceInformation, DeviceMap } from '../types'
import { Definition, findMatchingDefinition } from '@canboat/ts-pgns'
import { parseN2kString } from '@canboat/canboatjs'
import { Nav, NavItem, NavLink, TabContent, TabPane, Card, CardHeader, CardBody, Button } from 'reactstrap'

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
    // pgnData.input is an array of NMEA sentences that may contain multiple lines
    // for fast-packet PGNs that span multiple CAN frames
    if (!pgnData.input || pgnData.input.length === 0) return []

    let allBytes: number[] = []

    // Process each input line
    for (const inputLine of pgnData.input) {
      if (!inputLine) continue

      try {
        // Use canboatjs parseN2kString to parse different input formats
        // This handles multiple formats: Actisense, N2K ASCII, YDGW Raw, etc.
        const parseResult = parseN2kString(inputLine, {})

        if (parseResult && parseResult.data && !parseResult.error) {
          // parseResult.data is a Buffer containing the raw bytes
          const lineBytes = Array.from(parseResult.data) as number[]
          allBytes = allBytes.concat(lineBytes)
          continue // Successfully parsed with canboatjs
        }
      } catch (error) {
        console.warn('Failed to parse input line with parseN2kString:', inputLine, error)
      }

      // Fallback to simple parsing for manual input
      try {
        // Split by comma and get the hex bytes (starting from index 6)
        const parts = inputLine.split(',')
        if (parts.length >= 7) {
          const hexBytes = parts.slice(6).filter((part) => part.length === 2)
          const lineBytes = hexBytes.map((hex) => parseInt(hex, 16))
          allBytes = allBytes.concat(lineBytes)
        }
      } catch (error) {
        console.warn('Failed to parse input line:', inputLine, error)
      }
    }

    return allBytes
  }

  const rawBytes = getRawBytes()

  const renderByteMapping = () => {
    if (rawBytes.length === 0) {
      return <div>No raw byte data available</div>
    }

    // Helper function to calculate the total bit size of a set of fields
    const calculateFieldSetBitSize = (fields: any[], startIndex: number, count: number) => {
      let totalBits = 0
      for (let i = startIndex; i < startIndex + count && i < fields.length; i++) {
        totalBits += fields[i].BitLength || 0
      }
      return totalBits
    }

    // Helper function to render a single field row
    const renderFieldRow = (
      field: any,
      fieldIndex: number,
      absoluteBitOffset: number,
      repetitionIndex?: number,
      repetitionCount?: number,
    ) => {
      const bitStart = absoluteBitOffset
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
          rawValue = bytes.map((b: number) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')

          // Field spans multiple bytes - extract bits across multiple bytes
          /*
          let combinedValue = 0
          let bitsRemaining = bitLength
          let currentBitPos = bitStart

          while (bitsRemaining > 0) {
            const currentByte = Math.floor(currentBitPos / 8)
            const bitPosInByte = currentBitPos % 8
            const bitsToReadFromThisByte = Math.min(8 - bitPosInByte, bitsRemaining)

            if (currentByte < rawBytes.length) {
              const mask = ((1 << bitsToReadFromThisByte) - 1) << bitPosInByte
              const extractedBits = (rawBytes[currentByte] & mask) >> bitPosInByte
              combinedValue |= extractedBits << (bitLength - bitsRemaining)
            }

            bitsRemaining -= bitsToReadFromThisByte
            currentBitPos += bitsToReadFromThisByte
          }

          rawValue = `0x${combinedValue.toString(16).toUpperCase()}`
          */
        }
      }

      // Get parsed value from PGN data - handle repeating fields
      let parsedValue = 'N/A'
      if (repetitionIndex !== undefined) {
        // For repeating fields, look in the list array
        const listData = (pgnData.fields as any).list
        if (listData && listData[repetitionIndex] && listData[repetitionIndex][field.Id] !== undefined) {
          parsedValue = JSON.stringify(listData[repetitionIndex][field.Id])
        }
      } else {
        // For non-repeating fields, look directly in fields
        if ((pgnData.fields as any)[field.Id] !== undefined) {
          parsedValue = JSON.stringify((pgnData.fields as any)[field.Id])
        }
      }

      const baseFieldIndex =
        repetitionIndex !== undefined ? fieldIndex - ((definition.RepeatingFieldSet1StartField || 1) - 1) : undefined

      const fieldName =
        repetitionIndex !== undefined ? `${field.Name} [Group ${repetitionIndex + 1}/${repetitionCount}]` : field.Name

      return (
        <tr key={`${fieldIndex}-${repetitionIndex || 0}`}>
          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
            <strong>{fieldName}</strong>
            {field.Unit && <span style={{ color: '#6c757d' }}> ({field.Unit})</span>}
            {repetitionIndex !== undefined && baseFieldIndex !== undefined && (
              <div style={{ fontSize: '11px', color: '#6c757d' }}>
                {baseFieldIndex === 0 ? '├─ ' : '└─ '}Field #{baseFieldIndex + 1} of repetition
              </div>
            )}
          </td>
          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
            {bitStart} - {bitEnd} ({bitLength} bits)
          </td>
          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
            {byteStart}
            {byteStart !== byteEnd ? ` - ${byteEnd}` : ''}
          </td>
          <td style={{ padding: '8px', border: '1px solid #dee2e6', fontFamily: 'monospace' }}>{rawValue}</td>
          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{parsedValue}</td>
        </tr>
      )
    }

    // Check if this PGN has repeating fields
    const hasRepeatingFields = definition.RepeatingFieldSet1Size && definition.RepeatingFieldSet1Size > 0
    let repetitionCount = 0

    if (hasRepeatingFields) {
      // Get the count from the count field
      const countFieldIndex = definition.RepeatingFieldSet1CountField
      console.log('Count field index:', countFieldIndex, 'Total fields:', definition.Fields.length)

      if (countFieldIndex !== undefined && countFieldIndex > 0 && countFieldIndex <= definition.Fields.length) {
        // Field indices in the definition are 1-based, so subtract 1 to get 0-based array index
        const countField = definition.Fields[countFieldIndex - 1]
        console.log('Count field:', countField.Name, countField.Id)

        let countValue = (pgnData.fields as any)[countField.Id]
        console.log('Count value from field:', countValue, 'Type:', typeof countValue)

        // If the defined count field doesn't have a value, try common alternatives
        if (countValue === undefined || countValue === null) {
          // Try common alternative field names for count
          const alternativeNames = ['numberOfParameters', 'parameterCount', 'count', 'number']
          for (const altName of alternativeNames) {
            if ((pgnData.fields as any)[altName] !== undefined) {
              countValue = (pgnData.fields as any)[altName]
              console.log(`Found count in alternative field '${altName}':`, countValue)
              break
            }
          }
        }

        if (typeof countValue === 'number') {
          repetitionCount = countValue
        }
      }
    }

    // Debug information
    console.log('Debug repeating fields:', {
      hasRepeatingFields,
      RepeatingFieldSet1Size: definition.RepeatingFieldSet1Size,
      RepeatingFieldSet1StartField: definition.RepeatingFieldSet1StartField,
      RepeatingFieldSet1CountField: definition.RepeatingFieldSet1CountField,
      repetitionCount,
      fieldsData: pgnData.fields,
      listData: (pgnData.fields as any).list,
      allFieldKeys: Object.keys(pgnData.fields),
      allFieldValues: pgnData.fields,
    })

    // Calculate bit offsets for all fields (sequential reading)
    let currentBitOffset = 0
    const fieldBitOffsets: number[] = []

    for (let i = 0; i < definition.Fields.length; i++) {
      const isRepeatingField =
        hasRepeatingFields &&
        definition.RepeatingFieldSet1StartField !== undefined &&
        i >= definition.RepeatingFieldSet1StartField - 1 &&
        i < definition.RepeatingFieldSet1StartField - 1 + (definition.RepeatingFieldSet1Size || 0)

      if (!isRepeatingField) {
        fieldBitOffsets[i] = currentBitOffset
        currentBitOffset += definition.Fields[i].BitLength || 0
      } else if (i === (definition.RepeatingFieldSet1StartField || 1) - 1) {
        // At the start of repeating fields, calculate the size of all repetitions
        const repetitionBitSize = calculateFieldSetBitSize(
          definition.Fields,
          (definition.RepeatingFieldSet1StartField || 1) - 1,
          definition.RepeatingFieldSet1Size || 0,
        )
        // Skip past all repetitions for the sequential bit offset calculation
        currentBitOffset += repetitionBitSize * repetitionCount
      }
    }

    return (
      <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
        <h6>Input Lines: {pgnData.input?.length || 0}</h6>
        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#6c757d' }}>
          {pgnData.input && pgnData.input.length > 1 && (
            <div>Multi-frame PGN detected - combining {pgnData.input.length} input lines</div>
          )}
          {hasRepeatingFields && (
            <div>
              Repeating fields detected: {definition.RepeatingFieldSet1Size} fields repeat {repetitionCount} times
              (Starting at field {definition.RepeatingFieldSet1StartField || 1})
            </div>
          )}
        </div>

        <h6>Raw Bytes ({rawBytes.length} bytes total)</h6>
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
          {rawBytes.map((byte: number, index: number) => (
            <span key={index} style={{ marginRight: '8px', padding: '2px 4px', backgroundColor: '#e9ecef' }}>
              {/* {index.toString().padStart(2, '0')}:  */}
              {byte.toString(16).padStart(2, '0').toUpperCase()}
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
              {(() => {
                const rows: JSX.Element[] = []
                let repeatingFieldsProcessed = false

                for (let fieldIndex = 0; fieldIndex < definition.Fields.length; fieldIndex++) {
                  const field = definition.Fields[fieldIndex]

                  // Check if this field is part of a repeating set
                  const isRepeatingField =
                    hasRepeatingFields &&
                    definition.RepeatingFieldSet1StartField !== undefined &&
                    fieldIndex >= definition.RepeatingFieldSet1StartField - 1 &&
                    fieldIndex < definition.RepeatingFieldSet1StartField - 1 + (definition.RepeatingFieldSet1Size || 0)

                  console.log(
                    `Field ${fieldIndex} (${field.Name}): isRepeatingField=${isRepeatingField}, repetitionCount=${repetitionCount}, startField=${definition.RepeatingFieldSet1StartField}, fieldSetSize=${definition.RepeatingFieldSet1Size}`,
                  )

                  if (isRepeatingField && repetitionCount > 0 && !repeatingFieldsProcessed) {
                    // Process all repetitions for all repeating fields at once
                    repeatingFieldsProcessed = true

                    // Calculate the bit size of one complete repetition
                    const repetitionBitSize = calculateFieldSetBitSize(
                      definition.Fields,
                      (definition.RepeatingFieldSet1StartField || 1) - 1,
                      definition.RepeatingFieldSet1Size || 0,
                    )

                    // Calculate bit offset to start of repeating section
                    let repeatSectionStartBit = 0
                    for (let i = 0; i < (definition.RepeatingFieldSet1StartField || 1) - 1; i++) {
                      repeatSectionStartBit += definition.Fields[i].BitLength || 0
                    }

                    // Render each repetition completely (all fields in the repetition)
                    for (let repIndex = 0; repIndex < repetitionCount; repIndex++) {
                      // Add separator before each repetition (except the first)
                      if (repIndex > 0) {
                        rows.push(
                          <tr key={`separator-${repIndex}`} style={{ height: '8px' }}>
                            <td
                              colSpan={5}
                              style={{
                                padding: '4px',
                                border: 'none',
                                backgroundColor: '#f8f9fa',
                                borderTop: '2px solid #dee2e6',
                              }}
                            ></td>
                          </tr>,
                        )
                      }

                      // Render all fields in this repetition
                      for (let fieldOffset = 0; fieldOffset < (definition.RepeatingFieldSet1Size || 0); fieldOffset++) {
                        const currentFieldIndex = (definition.RepeatingFieldSet1StartField || 1) - 1 + fieldOffset
                        const currentField = definition.Fields[currentFieldIndex]

                        if (currentField) {
                          // Calculate field's bit offset within this repetition
                          let fieldBitOffsetInRepetition = 0
                          for (let i = (definition.RepeatingFieldSet1StartField || 1) - 1; i < currentFieldIndex; i++) {
                            fieldBitOffsetInRepetition += definition.Fields[i].BitLength || 0
                          }

                          const absoluteBitOffset =
                            repeatSectionStartBit + repIndex * repetitionBitSize + fieldBitOffsetInRepetition

                          const fieldRow = renderFieldRow(
                            currentField,
                            currentFieldIndex,
                            absoluteBitOffset,
                            repIndex,
                            repetitionCount,
                          )
                          rows.push(fieldRow)
                        }
                      }
                    }

                    // Skip ahead past all the repeating fields since we've processed them
                    fieldIndex =
                      (definition.RepeatingFieldSet1StartField || 1) - 1 + (definition.RepeatingFieldSet1Size || 0) - 1
                  } else if (!isRepeatingField) {
                    // Render non-repeating field normally
                    const fieldRow = renderFieldRow(field, fieldIndex, fieldBitOffsets[fieldIndex])
                    rows.push(fieldRow)
                  }
                }

                return rows
              })()}
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

  const copyPgnData = async () => {
    if (pgnData) {
      try {
        const dataToSave = JSON.stringify(pgnData, (key, value) => (key === 'input' ? undefined : value), 2)
        await navigator.clipboard.writeText(dataToSave)
        // You could add a toast notification here if desired
      } catch (err) {
        console.error('Failed to copy PGN data:', err)
      }
    }
  }

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
          <NavLink
            className={activeTab === MAPPING_TAB_ID ? 'active ' : ''}
            onClick={() => setActiveTab(MAPPING_TAB_ID)}
          >
            Byte Mapping
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={activeTab} style={{ flex: 1, overflow: 'auto' }}>
        <TabPane tabId={DATA_TAB_ID}>
          <Card className="mt-3">
            <CardHeader className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                {pgnData.pgn}: {definition?.Description || 'PGN Data'}
              </h5>
              <Button size="sm" color="secondary" onClick={copyPgnData} title="Copy PGN data to clipboard">
                Copy
              </Button>
            </CardHeader>
            <CardBody>
              <pre>{JSON.stringify(pgnData, (key, value) => (key === 'input' ? undefined : value), 2)}</pre>
            </CardBody>
          </Card>
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
