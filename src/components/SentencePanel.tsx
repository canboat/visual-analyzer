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

import React, { useState } from 'react'

import { PGN, Definition } from '@canboat/ts-pgns'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
import { DeviceInformation, DeviceMap } from '../types'
import { ByteMap, ByteMapping, RepeatingByteMapping } from '@canboat/canboatjs'
import { Nav, NavItem, NavLink, TabContent, TabPane, Card, CardHeader, CardBody, Button } from 'reactstrap'
import { raw } from 'express'

interface ByteMappingProps {
  pgnData: PGN
  definition: Definition | undefined
}

const ByteMappingComp = ({ pgnData, definition }: ByteMappingProps) => {
  if (!definition || !pgnData.input || pgnData.input.length === 0) {
    return <div>No input data or definition available for byte mapping</div>
  }

  // Parse the input data to get raw bytes using canboatjs utilities
  const getRawBytes = (): number[] => {
    return (pgnData as any).rawData || []
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

      let mapping: ByteMapping | undefined = undefined

      if (repetitionIndex !== undefined) {
        const listData: RepeatingByteMapping[] = (pgnData as any).byteMapping?.list
        mapping = listData[repetitionIndex][field.Id]
      } else {
        mapping = (pgnData as any).byteMapping?.[field.Id]
      }

      let parsedValue = 'N/A'
      let rawValue = 'N/A'

      if (mapping) {
        parsedValue = typeof mapping.value !== 'string' ? JSON.stringify(mapping.value) : mapping.value
        rawValue = mapping.bytes.map((b: number) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')
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
            {bitStart}-{bitEnd} ({bitLength})
          </td>
          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
            {byteStart}
            {byteStart !== byteEnd ? `-${byteEnd}` : ''}
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
      //console.debug('Count field index:', countFieldIndex, 'Total fields:', definition.Fields.length)

      if (countFieldIndex !== undefined && countFieldIndex > 0 && countFieldIndex <= definition.Fields.length) {
        // Field indices in the definition are 1-based, so subtract 1 to get 0-based array index
        const countField = definition.Fields[countFieldIndex - 1]
        //console.debug('Count field:', countField.Name, countField.Id)

        let countValue = (pgnData.fields as any)[countField.Id]
        //console.debug('Count value from field:', countValue, 'Type:', typeof countValue)

        // If the defined count field doesn't have a value, try common alternatives
        if (countValue === undefined || countValue === null) {
          // Try common alternative field names for count
          const alternativeNames = ['numberOfParameters', 'parameterCount', 'count', 'number']
          for (const altName of alternativeNames) {
            if ((pgnData.fields as any)[altName] !== undefined) {
              countValue = (pgnData.fields as any)[altName]
              //console.debug(`Found count in alternative field '${altName}':`, countValue)
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
    /*console.debug('Debug repeating fields:', {
      hasRepeatingFields,
      RepeatingFieldSet1Size: definition.RepeatingFieldSet1Size,
      RepeatingFieldSet1StartField: definition.RepeatingFieldSet1StartField,
      RepeatingFieldSet1CountField: definition.RepeatingFieldSet1CountField,
      repetitionCount,
      fieldsData: pgnData.fields,
      listData: (pgnData.fields as any).list,
      allFieldKeys: Object.keys(pgnData.fields),
      allFieldValues: pgnData.fields,
    })*/

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
        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#6c757d' }}>
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
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Bytes</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Value</th>
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

                  /*console.debug(
                    `Field ${fieldIndex} (${field.Name}): isRepeatingField=${isRepeatingField}, repetitionCount=${repetitionCount}, startField=${definition.RepeatingFieldSet1StartField}, fieldSetSize=${definition.RepeatingFieldSet1Size}`,
                  )*/

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

  const pgnToJson = (pgn: PGN): string => {
    return JSON.stringify(
      pgn,
      (key, value) => (key === 'input' || key === 'rawData' || key === 'byteMapping' ? undefined : value),
      2,
    )
  }

  const copyPgnData = async () => {
    if (pgnData) {
      try {
        const dataToSave = pgnToJson(pgnData)
        await navigator.clipboard.writeText(dataToSave)
        // You could add a toast notification here if desired
      } catch (err) {
        console.error('Failed to copy PGN data:', err)
      }
    }
  }

  const copyInputData = async () => {
    if (pgnData?.input) {
      try {
        const inputDataToSave = pgnData.input.join('\n')
        await navigator.clipboard.writeText(inputDataToSave)
        // You could add a toast notification here if desired
      } catch (err) {
        console.error('Failed to copy input data:', err)
      }
    }
  }

  if (pgnData === undefined || pgnData === null) {
    return <div>Select a PGN to view its data</div>
  }
  let definition: Definition = pgnData.getDefinition()
  //console.debug('pgnData', pgnData)
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
              <pre>{pgnToJson(pgnData)}</pre>
            </CardBody>
          </Card>
        </TabPane>
        {definition !== undefined && (
          <TabPane tabId={PGNDEF_TAB_ID}>
            <Card className="mt-3">
              <CardHeader>
                <h5 className="mb-0">PGN Definition</h5>
              </CardHeader>
              <CardBody>
                <pre>{JSON.stringify(definition, null, 2)}</pre>
              </CardBody>
            </Card>
          </TabPane>
        )}
        <TabPane tabId={DEVICE_TAB_ID}>
          <Card className="mt-3">
            <CardHeader>
              <h5 className="mb-0">Device Information</h5>
            </CardHeader>
            <CardBody>
              {info[pgnData.src!]?.info ? (
                <div>
                  {Object.entries(info[pgnData.src!].info).map(([pgnNumber, pgnInfo]: [string, any]) => (
                    <Card key={pgnNumber} className="mb-3" style={{ border: '1px solid #e0e0e0' }}>
                      <CardHeader style={{ backgroundColor: '#f8f9fa', padding: '10px 15px' }}>
                        <h6 className="mb-0" style={{ color: '#495057' }}>
                          PGN {pgnNumber}: {pgnInfo.description || 'Unknown'}
                        </h6>
                      </CardHeader>
                      <CardBody style={{ padding: '15px' }}>
                        <div className="row">
                          {Object.entries(pgnInfo)
                            .filter(([key]) => key !== 'description')
                            .map(([key, value]: [string, any]) => (
                              <div key={key} className="col-md-6 mb-2">
                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                  <strong
                                    style={{
                                      minWidth: '150px',
                                      marginRight: '10px',
                                      color: '#6c757d',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}:
                                  </strong>
                                  <span
                                    style={{
                                      wordBreak: 'break-word',
                                      color: '#212529',
                                    }}
                                  >
                                    {value}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#6c757d',
                    padding: '40px',
                    fontStyle: 'italic',
                  }}
                >
                  No device information available for this source
                </div>
              )}
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={INPUT_TAB_ID}>
          <Card className="mt-3">
            <CardHeader className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Input Data</h5>
              <Button size="sm" color="secondary" onClick={copyInputData} title="Copy input data to clipboard">
                Copy
              </Button>
            </CardHeader>
            <CardBody>
              <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {(pgnData.input || []).map((input, index) => (
                  <div key={index} style={{ marginBottom: '5px' }}>
                    {input}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={MAPPING_TAB_ID}>
          <Card className="mt-3">
            <CardHeader>
              <h5 className="mb-0">Byte Mapping</h5>
            </CardHeader>
            <CardBody>
              <ByteMappingComp pgnData={pgnData} definition={definition} />
            </CardBody>
          </Card>
        </TabPane>
      </TabContent>
    </div>
  )
}
