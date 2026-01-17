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
import { RepeatingByteMapping, ByteMapping } from '@canboat/canboatjs'

interface ByteMappingTabProps {
  pgnData: PGN
  definition: Definition | undefined
}

interface SelectedField {
  bitStart: number
  bitEnd: number
  byteStart: number
  byteEnd: number
}

export const ByteMappingTab = ({ pgnData, definition }: ByteMappingTabProps) => {
  const [selectedField, setSelectedField] = useState<SelectedField | null>(null)
  if (!definition || !(pgnData as any).rawData || !(pgnData as any).byteMapping) {
    return <div>No byte mapping available</div>
  }

  // Parse the input data to get raw bytes using canboatjs utilities
  const getRawBytes = (): number[] => {
    return (pgnData as any).rawData || []
  }

  const rawBytes = getRawBytes()

  // Helper function to calculate the total bit size of a set of fields
  const calculateFieldSetBitSize = (fields: any[], startIndex: number, count: number) => {
    let totalBits = 0
    for (let i = startIndex; i < startIndex + count && i < fields.length; i++) {
      totalBits += fields[i].BitLength || 0
    }
    return totalBits
  }

  // Helper function to find which field contains a specific byte index
  const findFieldForByte = (byteIndex: number): SelectedField | null => {
    // Check if this PGN has repeating fields
    const hasRepeatingFields = definition.RepeatingFieldSet1Size && definition.RepeatingFieldSet1Size > 0
    let repetitionCount = 0

    if (hasRepeatingFields) {
      // Get the count from the count field
      const countFieldIndex = definition.RepeatingFieldSet1CountField

      if (countFieldIndex !== undefined && countFieldIndex > 0 && countFieldIndex <= definition.Fields.length) {
        const countField = definition.Fields[countFieldIndex - 1]
        let countValue = (pgnData.fields as any)[countField.Id]

        if (countValue === undefined || countValue === null) {
          const alternativeNames = ['numberOfParameters', 'parameterCount', 'count', 'number']
          for (const altName of alternativeNames) {
            if ((pgnData.fields as any)[altName] !== undefined) {
              countValue = (pgnData.fields as any)[altName]
              break
            }
          }
        }

        if (typeof countValue === 'number') {
          repetitionCount = countValue
        }
      }
    }

    // Calculate bit offsets for all fields to find which one contains the byte
    let currentBitOffset = 0

    for (let i = 0; i < definition.Fields.length; i++) {
      const field = definition.Fields[i]
      const isRepeatingField =
        hasRepeatingFields &&
        definition.RepeatingFieldSet1StartField !== undefined &&
        i >= definition.RepeatingFieldSet1StartField - 1 &&
        i < definition.RepeatingFieldSet1StartField - 1 + (definition.RepeatingFieldSet1Size || 0)

      if (!isRepeatingField) {
        const bitStart = currentBitOffset
        const bitLength = field.BitLength || 0
        const bitEnd = bitStart + bitLength - 1
        const byteStart = Math.floor(bitStart / 8)
        const byteEnd = Math.floor(bitEnd / 8)

        if (byteIndex >= byteStart && byteIndex <= byteEnd) {
          return { bitStart, bitEnd, byteStart, byteEnd }
        }

        currentBitOffset += bitLength
      } else if (i === (definition.RepeatingFieldSet1StartField || 1) - 1) {
        // Handle repeating fields
        const repetitionBitSize = calculateFieldSetBitSize(
          definition.Fields,
          (definition.RepeatingFieldSet1StartField || 1) - 1,
          definition.RepeatingFieldSet1Size || 0,
        )

        const repeatSectionStartBit = currentBitOffset

        // Check each repetition
        for (let repIndex = 0; repIndex < repetitionCount; repIndex++) {
          for (let fieldOffset = 0; fieldOffset < (definition.RepeatingFieldSet1Size || 0); fieldOffset++) {
            const currentFieldIndex = (definition.RepeatingFieldSet1StartField || 1) - 1 + fieldOffset
            const currentField = definition.Fields[currentFieldIndex]

            if (currentField) {
              let fieldBitOffsetInRepetition = 0
              for (let j = (definition.RepeatingFieldSet1StartField || 1) - 1; j < currentFieldIndex; j++) {
                fieldBitOffsetInRepetition += definition.Fields[j].BitLength || 0
              }

              const absoluteBitOffset =
                repeatSectionStartBit + repIndex * repetitionBitSize + fieldBitOffsetInRepetition
              const bitStart = absoluteBitOffset
              const bitLength = currentField.BitLength || 0
              const bitEnd = bitStart + bitLength - 1
              const byteStart = Math.floor(bitStart / 8)
              const byteEnd = Math.floor(bitEnd / 8)

              if (byteIndex >= byteStart && byteIndex <= byteEnd) {
                return { bitStart, bitEnd, byteStart, byteEnd }
              }
            }
          }
        }

        currentBitOffset += repetitionBitSize * repetitionCount
        i = (definition.RepeatingFieldSet1StartField || 1) - 1 + (definition.RepeatingFieldSet1Size || 0) - 1
      }
    }

    return null
  }

  const renderByteMapping = () => {
    if (rawBytes.length === 0) {
      return <div>No raw byte data available</div>
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
      let fieldParsedValue = 'N/A'

      if (mapping) {
        parsedValue = typeof mapping.value !== 'string' ? JSON.stringify(mapping.value) : mapping.value
        rawValue = mapping.bytes.map((b: number) => `${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')
      }

      // Get the parsed value from pgnData.fields
      if (repetitionIndex !== undefined) {
        // For repeating fields, get value from the list array
        const listData = (pgnData.fields as any).list
        if (listData && listData[repetitionIndex] && listData[repetitionIndex][field.Id] !== undefined) {
          const value = listData[repetitionIndex][field.Id]
          fieldParsedValue = typeof value !== 'string' ? JSON.stringify(value) : value
        }
      } else {
        // For non-repeating fields, get value directly from fields
        if ((pgnData.fields as any)[field.Id] !== undefined) {
          const value = (pgnData.fields as any)[field.Id]
          fieldParsedValue = typeof value !== 'string' ? JSON.stringify(value) : value
        }
      }

      const baseFieldIndex =
        repetitionIndex !== undefined ? fieldIndex - ((definition.RepeatingFieldSet1StartField || 1) - 1) : undefined

      const fieldName =
        repetitionIndex !== undefined ? `${field.Name} [Group ${repetitionIndex + 1}/${repetitionCount}]` : field.Name

      const isSelected =
        selectedField &&
        selectedField.bitStart === bitStart &&
        selectedField.bitEnd === bitEnd &&
        selectedField.byteStart === byteStart &&
        selectedField.byteEnd === byteEnd

      const handleRowClick = () => {
        if (isSelected) {
          setSelectedField(null) // Deselect if already selected
        } else {
          setSelectedField({ bitStart, bitEnd, byteStart, byteEnd })
        }
      }

      return (
        <tr
          key={`${fieldIndex}-${repetitionIndex || 0}`}
          onClick={handleRowClick}
          style={{
            cursor: 'pointer',
            backgroundColor: isSelected ? '#e3f2fd' : undefined,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isSelected ? '#e3f2fd' : '#f5f5f5')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? '#e3f2fd' : 'transparent')}
        >
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
          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{fieldParsedValue}</td>
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
      <div style={{ fontSize: '12px' }}>
        <div style={{ marginBottom: '10px', fontSize: '11px', color: '#6c757d' }}>
          {hasRepeatingFields && (
            <div>
              Repeating fields detected: {definition.RepeatingFieldSet1Size} fields repeat {repetitionCount} times
              (Starting at field {definition.RepeatingFieldSet1StartField || 1})
            </div>
          )}
        </div>

        <h6>
          Raw Bytes ({rawBytes.length} bytes total)
          {selectedField && (
            <span style={{ fontSize: '11px', color: '#666', marginLeft: '10px' }}>
              - Highlighting bytes {selectedField.byteStart}-{selectedField.byteEnd} (bits {selectedField.bitStart}-
              {selectedField.bitEnd})
            </span>
          )}
        </h6>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
          Click on any byte below to highlight its corresponding field in the mapping table
        </div>
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
          {rawBytes.map((byte: number, index: number) => {
            const isHighlighted = selectedField && index >= selectedField.byteStart && index <= selectedField.byteEnd

            const handleByteClick = () => {
              const fieldForByte = findFieldForByte(index)
              if (fieldForByte) {
                // Check if this field is already selected
                const isSameField =
                  selectedField &&
                  selectedField.bitStart === fieldForByte.bitStart &&
                  selectedField.bitEnd === fieldForByte.bitEnd &&
                  selectedField.byteStart === fieldForByte.byteStart &&
                  selectedField.byteEnd === fieldForByte.byteEnd

                if (isSameField) {
                  setSelectedField(null) // Deselect if already selected
                } else {
                  setSelectedField(fieldForByte) // Select the field containing this byte
                }
              }
            }

            return (
              <span
                key={index}
                onClick={handleByteClick}
                style={{
                  marginRight: '8px',
                  padding: '2px 4px',
                  backgroundColor: isHighlighted ? '#ffeb3b' : '#e9ecef',
                  fontFamily: 'monospace',
                  border: isHighlighted ? '2px solid #ff9800' : 'none',
                  fontWeight: isHighlighted ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isHighlighted ? '#ffeb3b' : '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isHighlighted ? '#ffeb3b' : '#e9ecef')}
              >
                {/* {index.toString().padStart(2, '0')}:  */}
                {byte.toString(16).padStart(2, '0').toUpperCase()}
              </span>
            )
          })}
        </div>

        <h6>Field Mapping</h6>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
          Click on any field row below to highlight the corresponding bytes above, or click on any byte to highlight its
          field
        </div>
        <div style={{ border: '1px solid #dee2e6' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Field</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Bit Range</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Byte Range</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Bytes</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Value</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Parsed</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.ReactElement[] = []
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
                              colSpan={6}
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
