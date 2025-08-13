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

import React, { useState, useCallback, useEffect, ChangeEvent } from 'react'
import {
  PGN,
  Definition,
  Field,
  getBitEnumeration,
  getEnumeration,
  generatePgnHeaderEntry,
  generateBitLookupHeaderEntry,
  generateLookupHeaderEntry,
  ManufacturerCodeValues,
  IndustryCodeValues,
  getPGNWithId,
} from '@canboat/ts-pgns'
import { Table, Badge, Row, Col, Button, Input, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'

interface PgnDefinitionTabProps {
  definition: Definition
  pgnData: PGN
  onSave?: (updatedDefinition: Definition) => void
  onLookupSave?: (
    enumName: string,
    lookupType: 'lookup' | 'bitlookup',
    lookupValues: { key: string; value: string }[],
  ) => void
  hasBeenChanged?: boolean
  onExport?: (definition: Definition) => void
  changedLookups?: { lookups: Set<string>; bitLookups: Set<string> }
}

export const PgnDefinitionTab = ({
  definition,
  pgnData,
  onSave,
  onLookupSave,
  hasBeenChanged,
  onExport,
  changedLookups,
}: PgnDefinitionTabProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedDefinition, setEditedDefinition] = useState<Definition>({ ...definition })
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [editingLookup, setEditingLookup] = useState<{ fieldIndex: number; type: 'lookup' | 'bitlookup' } | null>(null)
  const [lookupValues, setLookupValues] = useState<{ key: string; value: string }[]>([])
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportedJson, setExportedJson] = useState('')

  // Update editedDefinition when the definition prop changes (when user selects different PGN)
  // Don't update if currently editing unless the PGN number changed (different PGN selected)
  useEffect(() => {
    const currentPgn = editedDefinition.Id
    const newPgn = pgnData.getDefinition().Id

    if (!isEditing ) {
      /*
      const newDef = {
        ...JSON.parse(JSON.stringify(definition)),
        PGN: pgnData.pgn,
        //Fallback: false,
      }*/

      setEditedDefinition(definition)
    }
  }, [definition, pgnData, isEditing, editedDefinition.PGN])

  useEffect(() => {
    if (onSave && isEditing ) { 
      //console.log('Definition changed:', editedDefinition.Id)
      onSave(editedDefinition)
    }
  }, [editedDefinition])

  // Helper function to format field types
  const formatFieldType = (fieldType?: string) => {
    if (!fieldType) return 'Unknown'
    return fieldType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Helper function to convert text to camelCase
  const toCamelCase = (text: string) => {
    return text
      .trim()
      .replace(/[^\w\s]/g, '') // Remove non-word characters except spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .split(' ')
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase()
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join('')
  }

  // Helper function to get field size
  const getFieldSize = (field: any) => {
    if (field.BitLength) {
      if (typeof field.BitLength === 'number') {
        return field.BitLength % 8 === 0 ? `${field.BitLength / 8} bytes` : `${field.BitLength} bits`
      }
    }
    return ''
  }

  // Helper function to check if a field is part of a repeating set
  const isRepeatingField = (fieldIndex: number): { isRepeating: boolean; setNumber: number; fieldInSet: number } => {
    // Check first repeating set
    if (editedDefinition.RepeatingFieldSet1Size && editedDefinition.RepeatingFieldSet1StartField) {
      const startIndex = editedDefinition.RepeatingFieldSet1StartField - 1 // Convert to 0-based
      const endIndex = startIndex + editedDefinition.RepeatingFieldSet1Size
      if (fieldIndex >= startIndex && fieldIndex < endIndex) {
        return {
          isRepeating: true,
          setNumber: 1,
          fieldInSet: fieldIndex - startIndex + 1,
        }
      }
    }

    // Check second repeating set
    if (editedDefinition.RepeatingFieldSet2Size && editedDefinition.RepeatingFieldSet2StartField) {
      const startIndex = editedDefinition.RepeatingFieldSet2StartField - 1 // Convert to 0-based
      const endIndex = startIndex + editedDefinition.RepeatingFieldSet2Size
      if (fieldIndex >= startIndex && fieldIndex < endIndex) {
        return {
          isRepeating: true,
          setNumber: 2,
          fieldInSet: fieldIndex - startIndex + 1,
        }
      }
    }

    return { isRepeating: false, setNumber: 0, fieldInSet: 0 }
  }

  // Helper function to calculate BitOffsets for all fields
  const calculateBitOffsets = useCallback((fields: Field[]): Field[] => {
    let currentBitOffset = 0

    return fields.map((field, index) => {
      const updatedField = { ...field, BitOffset: currentBitOffset }
      currentBitOffset += field.BitLength || 0
      return updatedField
    })
  }, [])

  // Update the definition state
  const updateDefinition = useCallback((updates: Partial<Definition>) => {
    setEditedDefinition((prev) => ({ ...prev, ...updates }))
  }, [])

  // Special handler for description changes that also updates the ID
  const handleDescriptionChange = useCallback((description: string) => {
    const camelCaseId = toCamelCase(description)
    setEditedDefinition((prev) => ({
      ...prev,
      Description: description,
      Id: camelCaseId,
    }))
  }, [])

  // Update a specific field
  const updateField = useCallback(
    (index: number, updates: Partial<Field>) => {
      setEditedDefinition((prev) => {
        const updatedFields = (prev.Fields || []).map((field, i) => (i === index ? { ...field, ...updates } : field))

        // Recalculate BitOffsets if BitLength was updated
        if ('BitLength' in updates) {
          const fieldsWithCalculatedOffsets = calculateBitOffsets(updatedFields)
          return {
            ...prev,
            Fields: fieldsWithCalculatedOffsets,
          }
        }

        return {
          ...prev,
          Fields: updatedFields,
        }
      })
    },
    [calculateBitOffsets],
  )

  // Add a new field
  const addField = useCallback(() => {
    const currentFields = editedDefinition.Fields || []
    const newField: Field = {
      Id: `new_field_${currentFields.length + 1}`,
      Name: 'New Field',
      Description: '',
      BitOffset: 0,
      BitStart: 0,
      FieldType: 'NUMBER' as any,
      LookupFieldTypeEnumeration: '',
      BitLength: 8, // Default to 8 bits
    }
    const updatedFields = [...currentFields, newField]
    const fieldsWithCalculatedOffsets = calculateBitOffsets(updatedFields)

    setEditedDefinition((prev) => ({
      ...prev,
      Fields: fieldsWithCalculatedOffsets,
    }))
  }, [editedDefinition.Fields, calculateBitOffsets])

  // Remove a field
  const removeField = useCallback(
    (index: number) => {
      const updatedFields = (editedDefinition.Fields || []).filter((_, i) => i !== index)
      const fieldsWithCalculatedOffsets = calculateBitOffsets(updatedFields)

      setEditedDefinition((prev) => ({
        ...prev,
        Fields: fieldsWithCalculatedOffsets,
      }))
    },
    [editedDefinition.Fields, calculateBitOffsets],
  )

  // Move field to new position
  const moveField = useCallback(
    (fromIndex: number, toIndex: number) => {
      setEditedDefinition((prev) => {
        const currentFields = prev.Fields || []
        const newFields = [...currentFields]
        const [movedField] = newFields.splice(fromIndex, 1)
        newFields.splice(toIndex, 0, movedField)
        const fieldsWithCalculatedOffsets = calculateBitOffsets(newFields)

        return {
          ...prev,
          Fields: fieldsWithCalculatedOffsets,
        }
      })
    },
    [calculateBitOffsets],
  )

  // Lookup editing functions
  const openLookupEditor = useCallback(
    (fieldIndex: number, type: 'lookup' | 'bitlookup') => {
      if (!editedDefinition.Fields || fieldIndex >= editedDefinition.Fields.length) return
      const field = editedDefinition.Fields[fieldIndex]
      const enumName = type === 'lookup' ? field.LookupEnumeration : field.LookupBitEnumeration

      let existingValues: { key: string; value: string }[] = []

      // Load existing lookup values if enumName exists
      if (enumName) {
        try {
          const enumeration = type === 'lookup' ? getEnumeration(enumName) : getBitEnumeration(enumName)
          if (enumeration) {
            if (type === 'lookup' && 'EnumValues' in enumeration) {
              // Regular enumeration: EnumValues has { Name, Value }
              existingValues = enumeration.EnumValues.map((ev) => ({
                key: ev.Value.toString(),
                value: ev.Name,
              }))
            } else if (type === 'bitlookup' && 'EnumBitValues' in enumeration) {
              // Bit enumeration: EnumBitValues has { Name, Bit }
              existingValues = enumeration.EnumBitValues.map((ebv) => ({
                key: ebv.Bit.toString(),
                value: ebv.Name,
              }))
            }
          }
        } catch (error) {
          console.warn(`Failed to load enumeration "${enumName}":`, error)
        }
      }

      // Initialize with existing values or default empty values for new lookup
      if (existingValues.length > 0) {
        setLookupValues(existingValues)
      } else {
        setLookupValues([
          { key: '0', value: 'Unknown' },
          { key: '1', value: 'Value1' },
          { key: '2', value: 'Value2' },
        ])
      }

      setEditingLookup({ fieldIndex, type })
    },
    [editedDefinition.Fields],
  )

  const closeLookupEditor = useCallback(() => {
    setEditingLookup(null)
    setLookupValues([])
  }, [])

  const addLookupValue = useCallback(() => {
    setLookupValues((prev) => [...prev, { key: prev.length.toString(), value: `Value${prev.length}` }])
  }, [])

  const removeLookupValue = useCallback((index: number) => {
    setLookupValues((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateLookupValue = useCallback((index: number, key: string, value: string) => {
    setLookupValues((prev) => prev.map((item, i) => (i === index ? { key, value } : item)))
  }, [])

  const saveLookupValues = useCallback(() => {
    if (!editingLookup || !onLookupSave) return
    if (!editedDefinition.Fields || editingLookup.fieldIndex >= editedDefinition.Fields.length) return

    const field = editedDefinition.Fields[editingLookup.fieldIndex]
    const enumName = editingLookup.type === 'lookup' ? field.LookupEnumeration : field.LookupBitEnumeration

    if (!enumName) {
      console.warn('No enumeration name found for field')
      closeLookupEditor()
      return
    }

    // Call the parent's lookup save handler
    onLookupSave(enumName, editingLookup.type, lookupValues)

    closeLookupEditor()
  }, [editingLookup, lookupValues, onLookupSave, closeLookupEditor, editedDefinition.Fields])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '') // Required for Firefox
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        moveField(draggedIndex, dropIndex)
      }
      setDraggedIndex(null)
      setDragOverIndex(null)
    },
    [draggedIndex, moveField],
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  // Handle save
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editedDefinition)
    }
    setIsEditing(false)
  }, [editedDefinition, onSave])

  // Handle cancel
  const handleCancel = useCallback(() => {
    //setEditedDefinition({ ...definition })
    setIsEditing(false)
  }, [definition])

  const handleEdit = useCallback(() => {
    const newDef = {
      ...JSON.parse(JSON.stringify(definition)),
      PGN: pgnData.pgn,
      Fallback: false,
    }

    if (definition.Fallback) {
      newDef.Description = `My ${pgnData.pgn}`
      newDef.Id = `my${pgnData.pgn}`
      newDef.Explanation = undefined

      if (newDef.Fields.length > 0 && newDef.Fields[0].Id === 'manufacturerCode') {
        newDef.Fields[0].Match = ManufacturerCodeValues[(pgnData.fields as any).manufacturerCode] || undefined
      }
      if (newDef.Fields.length > 2 && newDef.Fields[2].Id === 'industryCode') {
        newDef.Fields[2].Match = IndustryCodeValues[(pgnData.fields as any).industryCode] || undefined
      }

      const partialMatch = (pgnData as any).partialMatch as string
      if ( partialMatch ) {
        const partial = getPGNWithId(partialMatch)!
        const hasDataField = definition.Fields[definition.Fields.length-1].Id === 'data' 
        const start = hasDataField ? definition.Fields.length - 1 : definition.Fields.length 

        if ( hasDataField ) {
          newDef.Fields = newDef.Fields.slice(0, start)
        }

        for ( let i = start; i < partial.Fields.length; i++) {
          const field = partial.Fields[i]
          
          const val = (pgnData.fields as any)[field.Id]
          
          if (val !== undefined) {
            const newField = {...field}
            if ( field.Match !== undefined ) {
               newField.Match = typeof val === 'string' ? field.Match : val
            }
            newDef.Fields.push(newField)
          }
        }
      }
    }

    // Ensure BitOffsets are calculated for existing fields
    if (newDef.Fields && newDef.Fields.length > 0) {
      newDef.Fields = calculateBitOffsets(newDef.Fields)
    }

    setEditedDefinition(newDef)
    setIsEditing(true)
  }, [definition, calculateBitOffsets])

  // Handle export
  const handleExport = useCallback(() => {
    try {
      // Collect all lookup enumerations referenced by fields
      const referencedLookups = new Set<string>()
      const referencedBitLookups = new Set<string>()

      editedDefinition.Fields?.forEach((field) => {
        if (field.LookupEnumeration) {
          referencedLookups.add(field.LookupEnumeration)
        }
        if (field.LookupBitEnumeration) {
          referencedBitLookups.add(field.LookupBitEnumeration)
        }
      })

      // Generate PGN header entry using the new function
      const pgnHeaderEntry = generatePgnHeaderEntry(editedDefinition)

      // Build export text starting with PGN header
      let exportText = `// PGN ${editedDefinition.PGN} - ${editedDefinition.Id}\n${pgnHeaderEntry}`

      // Include modified lookups that are referenced by this definition
      const modifiedLookupHeaders: string[] = []
      const modifiedBitLookupHeaders: string[] = []

      if (changedLookups) {
        // Check for modified regular lookups and generate their headers
        referencedLookups.forEach((lookupName) => {
          if (changedLookups.lookups.has(lookupName)) {
            try {
              const enumeration = getEnumeration(lookupName)
              if (enumeration) {
                const headerEntry = generateLookupHeaderEntry(enumeration)
                modifiedLookupHeaders.push(`// Lookup: ${lookupName}\n${headerEntry}`)
              }
            } catch (error) {
              console.warn(`Failed to get enumeration "${lookupName}":`, error)
            }
          }
        })

        // Check for modified bit lookups and generate their headers
        referencedBitLookups.forEach((bitLookupName) => {
          if (changedLookups.bitLookups.has(bitLookupName)) {
            try {
              const bitEnumeration = getBitEnumeration(bitLookupName)
              if (bitEnumeration) {
                const headerEntry = generateBitLookupHeaderEntry(bitEnumeration)
                modifiedBitLookupHeaders.push(`// Bit Lookup: ${bitLookupName}\n${headerEntry}`)
              }
            } catch (error) {
              console.warn(`Failed to get bit enumeration "${bitLookupName}":`, error)
            }
          }
        })
      }

      // Add lookup headers to export text if any were found
      if (modifiedLookupHeaders.length > 0) {
        exportText += '\n\n' + modifiedLookupHeaders.join('\n\n')
      }
      if (modifiedBitLookupHeaders.length > 0) {
        exportText += '\n\n' + modifiedBitLookupHeaders.join('\n\n')
      }

      setExportedJson(exportText)
      setShowExportModal(true)
    } catch (err) {
      console.error('Failed to prepare export:', err)
      alert('Failed to prepare export. Please try again.')
    }
  }, [editedDefinition, changedLookups])

  // Handle copy to clipboard from export modal
  const handleCopyExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportedJson)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      alert('Failed to copy to clipboard. Please try again.')
    }
  }, [exportedJson, editedDefinition.Id])

  // Close export modal
  const closeExportModal = useCallback(() => {
    setShowExportModal(false)
    setExportedJson('')
  }, [])

  return (
    <div className="p-3" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
      <style>
        {`
          .field-card.field-row-dragging {
            opacity: 0.5;
            transform: rotate(1deg);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          .field-card.field-row-drag-over {
            background-color: #e3f2fd !important;
            border: 2px solid #2196f3;
            transform: scale(1.02);
          }
          .drag-handle {
            cursor: move;
            color: #9e9e9e;
            transition: color 0.2s ease;
            font-size: 1.1em;
          }
          .drag-handle:hover {
            color: #424242;
          }
          .field-card[draggable="true"]:hover {
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            border-color: #dee2e6;
          }
          .field-card {
            border: 1px solid #dee2e6;
            transition: all 0.2s ease;
          }
          .form-label.small.fw-bold {
            color: #495057;
            margin-bottom: 0.25rem;
          }
        `}
      </style>
      {/* Edit/Save/Cancel/Export buttons */}
      <Row className="mb-3">
        <Col className="d-flex justify-content-end">
          {!isEditing ? (
            <div className="d-flex gap-2 align-items-center">
              {hasBeenChanged && (
                <div className="d-flex align-items-center me-3">
                  <Badge color="info" className="me-2">
                    <i className="fa fa-edit me-1" />
                    Modified
                  </Badge>
                  <Button color="outline-primary" size="sm" onClick={handleExport}>
                    <i className="fa fa-download me-2" />
                    Export Definition
                  </Button>
                </div>
              )}
              <Button color="primary" size="sm" onClick={handleEdit}>
                <i className="fa fa-edit me-2" />
                Edit Definition
              </Button>
            </div>
          ) : (
            <div className="d-flex gap-2">
              <Button color="secondary" size="sm" onClick={handleCancel}>
                <i className="fa fa-times me-2" />
                Done
              </Button>
            </div>
          )}
        </Col>
      </Row>

      <Row>
        <Col>
          <h6>PGN Details</h6>
          <dl className="row" style={{ marginBottom: '0.5rem', lineHeight: '1.2' }}>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              ID:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {editedDefinition.Id}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              PGN:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                {editedDefinition.PGN}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Description:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <Input
                  type="textarea"
                  size="sm"
                  rows="1"
                  value={editedDefinition.Description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleDescriptionChange(e.target.value)}
                />
              ) : (
                editedDefinition.Description
              )}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Type:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <Input
                  type="select"
                  size="sm"
                  value={editedDefinition.Type}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Type: e.target.value as any })}
                >
                  <option value="Single">Single</option>
                  <option value="Fast">Fast</option>
                </Input>
              ) : (
                editedDefinition.Type
              )}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Priority:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <Input
                  type="number"
                  size="sm"
                  value={editedDefinition.Priority}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateDefinition({ Priority: parseInt(e.target.value) || 0 })
                  }
                />
              ) : (
                editedDefinition.Priority
              )}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Complete:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <div className="form-check form-switch">
                  <Input
                    className="form-check-input"
                    type="checkbox"
                    checked={editedDefinition.Complete}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Complete: e.target.checked })}
                  />
                </div>
              ) : (
                <Badge color={editedDefinition.Complete ? 'success' : 'warning'}>
                  {editedDefinition.Complete ? 'Complete' : 'Incomplete'}
                </Badge>
              )}
            </dd>
            {(editedDefinition.Length || isEditing) && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Length:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  {isEditing ? (
                    <Input
                      type="number"
                      size="sm"
                      value={editedDefinition.Length || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateDefinition({ Length: e.target.value ? parseInt(e.target.value) : undefined })
                      }
                    />
                  ) : (
                    `${editedDefinition.Length} bytes`
                  )}
                </dd>
              </>
            )}
            {(editedDefinition.TransmissionInterval || isEditing) && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Interval:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  {isEditing ? (
                    <Input
                      type="number"
                      size="sm"
                      value={editedDefinition.TransmissionInterval || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateDefinition({
                          TransmissionInterval: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                    />
                  ) : (
                    `${editedDefinition.TransmissionInterval}ms`
                  )}
                </dd>
              </>
            )}
            {(editedDefinition.URL || isEditing) && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Reference:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  {isEditing ? (
                    <Input
                      type="url"
                      size="sm"
                      value={editedDefinition.URL || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateDefinition({ URL: e.target.value || undefined })
                      }
                    />
                  ) : editedDefinition.URL ? (
                    <a href={editedDefinition.URL} target="_blank" rel="noopener noreferrer">
                      Documentation
                    </a>
                  ) : null}
                </dd>
              </>
            )}
            {editedDefinition.Fallback && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Fallback:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  {isEditing ? (
                    <div className="form-check form-switch">
                      <Input
                        className="form-check-input"
                        type="checkbox"
                        checked={editedDefinition.Fallback}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateDefinition({ Fallback: e.target.checked })
                        }
                      />
                    </div>
                  ) : (
                    <Badge color="info" size="sm">
                      Yes
                    </Badge>
                  )}
                </dd>
              </>
            )}
          </dl>
        </Col>
      </Row>

      {(editedDefinition.Fields && editedDefinition.Fields.length > 0) || isEditing ? (
        <div className="mt-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6>Fields ({editedDefinition.Fields?.length || 0})</h6>
            <div className="d-flex align-items-center gap-2">
              {isEditing && editedDefinition.Fields && editedDefinition.Fields.length > 0 && (
                <small className="text-muted">
                  <i className="fa fa-info-circle me-1" />
                  Drag cards by the grip icon to reorder fields
                </small>
              )}
            </div>
          </div>
          {!isEditing ? (
            // Table view for read-only mode
            editedDefinition.Fields && editedDefinition.Fields.length > 0 ? (
              <div>
                {/* Legend for repeating fields */}
                {(editedDefinition.RepeatingFieldSet1Size || editedDefinition.RepeatingFieldSet2Size) && (
                  <div className="mb-3 p-2 bg-light rounded">
                    <div className="small fw-semibold mb-1">Repeating Fields:</div>
                    <div className="d-flex gap-3 align-items-center small">
                      {editedDefinition.RepeatingFieldSet1Size && (
                        <div className="d-flex align-items-center gap-1">
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              backgroundColor: '#e3f2fd',
                              border: '1px solid #1976d2',
                              borderRadius: '2px',
                            }}
                          />
                          <Badge bg="primary" style={{ fontSize: '0.65em' }}>
                            R1
                          </Badge>
                          <span>Set 1 ({editedDefinition.RepeatingFieldSet1Size} fields)</span>
                        </div>
                      )}
                      {editedDefinition.RepeatingFieldSet2Size && (
                        <div className="d-flex align-items-center gap-1">
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              backgroundColor: '#f3e5f5',
                              border: '1px solid #7b1fa2',
                              borderRadius: '2px',
                            }}
                          />
                          <Badge bg="secondary" style={{ fontSize: '0.65em' }}>
                            R2
                          </Badge>
                          <span>Set 2 ({editedDefinition.RepeatingFieldSet2Size} fields)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Offset</th>
                        <th>Unit</th>
                        <th>Resolution</th>
                        <th>Key</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editedDefinition.Fields.map((field, index) => {
                        const repeatingInfo = isRepeatingField(index)
                        const isRepeating = repeatingInfo.isRepeating
                        const setNumber = repeatingInfo.setNumber
                        const fieldInSet = repeatingInfo.fieldInSet

                        return (
                          <tr
                            key={index}
                            className={isRepeating ? `table-info` : ''}
                            style={{
                              backgroundColor: isRepeating ? (setNumber === 1 ? '#e3f2fd' : '#f3e5f5') : undefined,
                            }}
                          >
                            <td>
                              <div className="d-flex align-items-center">
                                <span className="fw-bold">{field.Name}</span>
                                {isRepeating && (
                                  <Badge
                                    bg={setNumber === 1 ? 'primary' : 'secondary'}
                                    className="ms-2"
                                    style={{ fontSize: '0.7em' }}
                                  >
                                    R{setNumber}.{fieldInSet}
                                  </Badge>
                                )}
                              </div>
                              {field.Description && <div className="small text-muted">{field.Description}</div>}
                            </td>
                            <td>{field.FieldType || ''}</td>
                            <td>{field.BitLength || ''}</td>
                            <td>
                              <span title={`Bit offset: ${field.BitOffset} bits`} style={{ fontSize: '0.9em' }}>
                                {field.BitOffset}
                              </span>
                            </td>
                            <td>{field.Unit || ''}</td>
                            <td>{field.Resolution || ''}</td>
                            <td>{field.PartOfPrimaryKey ? 'Yes' : ''}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-muted text-center py-3">
                <i className="fa fa-inbox fa-2x mb-2" />
                <div>No fields defined yet.</div>
              </div>
            )
          ) : (
            // Card view for editing mode
            <div>
              {editedDefinition.Fields && editedDefinition.Fields.length > 0 ? (
                editedDefinition.Fields.map((field, index) => (
                  <div
                    key={index}
                    draggable={isEditing}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                  card mb-3 field-card
                  ${draggedIndex === index ? 'field-row-dragging' : ''}
                  ${dragOverIndex === index ? 'field-row-drag-over' : ''}
                `}
                    style={{
                      cursor: isEditing ? 'move' : 'default',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center gap-2">
                          {isEditing && <i className="fa fa-grip-vertical drag-handle" title="Drag to reorder" />}
                          <div>
                            <h6 className="card-title mb-1">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  size="sm"
                                  value={field.Name}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateField(index, { Name: e.target.value })
                                  }
                                  style={{ display: 'inline-block', width: 'auto', minWidth: '200px' }}
                                />
                              ) : (
                                <code style={{ fontSize: '1em' }}>{field.Name}</code>
                              )}
                            </h6>
                            {!isEditing && field.Description && (
                              <p className="text-muted mb-0" style={{ fontSize: '0.85em' }}>
                                {field.Description}
                              </p>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <Button
                            color="danger"
                            size="sm"
                            onClick={() => removeField(index)}
                            title="Remove field"
                            style={{ minWidth: '32px' }}
                          >
                            <i className="fa fa-trash" />
                          </Button>
                        )}
                      </div>

                      <div className="row g-3">
                        <div className="col-md-2">
                          <label className="form-label small fw-bold">Type</label>
                          <div>
                            {isEditing ? (
                              <Input
                                type="select"
                                size="sm"
                                value={field.FieldType}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  updateField(index, { FieldType: e.target.value as any })
                                }
                              >
                                <option value="NUMBER">Number</option>
                                <option value="DECIMAL">Decimal</option>
                                <option value="BINARY">Binary</option>
                                <option value="LOOKUP">Lookup</option>
                                <option value="BITLOOKUP">Bit Lookup</option>
                                <option value="STRING_FIX">String Fix</option>
                                <option value="STRING_LZ">String LZ</option>
                                <option value="STRING_LAU">String LAU</option>
                                <option value="TIME">Time</option>
                                <option value="DATE">Date</option>
                                <option value="DURATION">Duration</option>
                                <option value="PGN">PGN</option>
                                <option value="ISO_NAME">ISO Name</option>
                                <option value="RESERVED">Reserved</option>
                                <option value="SPARE">Spare</option>
                              </Input>
                            ) : (
                              <Badge color="light" className="text-dark" style={{ fontSize: '0.8em' }}>
                                {formatFieldType(field.FieldType)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="col-md-2">
                          <label className="form-label small fw-bold">Size</label>
                          <div>
                            {isEditing ? (
                              <Input
                                type="number"
                                size="sm"
                                value={field.BitLength || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  updateField(index, {
                                    BitLength: e.target.value ? parseInt(e.target.value) : undefined,
                                  })
                                }
                                placeholder="bits"
                              />
                            ) : (
                              <span style={{ fontSize: '0.9em' }}>{getFieldSize(field)}</span>
                            )}
                          </div>
                        </div>

                        <div className="col-md-2">
                          <label className="form-label small fw-bold">Offset</label>
                          <div>
                            <span
                              style={{ fontSize: '0.9em' }}
                              className={isEditing ? 'text-muted' : ''}
                              title={`Bit offset: ${field.BitOffset} bits`}
                            >
                              {field.BitOffset}
                            </span>
                            {isEditing && (
                              <small className="d-block text-muted" style={{ fontSize: '0.7em' }}>
                                Auto-calculated
                              </small>
                            )}
                          </div>
                        </div>

                        <div className="col-md-2">
                          <label className="form-label small fw-bold">Unit</label>
                          <div>
                            {isEditing ? (
                              <Input
                                type="text"
                                size="sm"
                                value={field.Unit || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  updateField(index, { Unit: e.target.value || undefined })
                                }
                                placeholder="e.g. m/s"
                              />
                            ) : field.Unit ? (
                              <code className="small" style={{ fontSize: '0.8em' }}>
                                {field.Unit}
                              </code>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </div>
                        </div>

                        <div className="col-md-2">
                          <label className="form-label small fw-bold">Resolution</label>
                          <div>
                            {isEditing ? (
                              <Input
                                type="number"
                                size="sm"
                                step="any"
                                value={field.Resolution || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  updateField(index, {
                                    Resolution: e.target.value ? parseFloat(e.target.value) : undefined,
                                  })
                                }
                                placeholder="1.0"
                              />
                            ) : field.Resolution ? (
                              <code className="small" style={{ fontSize: '0.8em' }}>
                                {field.Resolution}
                              </code>
                            ) : (
                              <span className="text-muted small">1</span>
                            )}
                          </div>
                        </div>

                        <div className="col-md-2">
                          <label className="form-label small fw-bold">PK</label>
                          <div>
                            {isEditing ? (
                              <div className="form-check">
                                <Input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={field.PartOfPrimaryKey || false}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateField(index, { PartOfPrimaryKey: e.target.checked })
                                  }
                                />
                                <label className="form-check-label small">PK</label>
                              </div>
                            ) : field.PartOfPrimaryKey ? (
                              <Badge color="primary" className="small">
                                Key Field
                              </Badge>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Second row for lookup enumeration when type is LOOKUP or BITLOOKUP */}
                      {isEditing && field.FieldType === 'LOOKUP' && (
                        <div className="row g-3 mt-2">
                          <div className="col-md-6">
                            <label className="form-label small fw-bold">Lookup Enumeration</label>
                            <div className="d-flex gap-2">
                              <Input
                                type="text"
                                size="sm"
                                value={field.LookupEnumeration || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  updateField(index, { LookupEnumeration: e.target.value || undefined })
                                }
                                placeholder="e.g. ENGINE_INSTANCE, OFF_ON"
                              />
                              <Button
                                color="secondary"
                                size="sm"
                                onClick={() => openLookupEditor(index, 'lookup')}
                                title="Edit lookup values"
                              >
                                <i className="fa fa-edit" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small fw-bold">Match</label>
                            <Input
                              type="number"
                              size="sm"
                              value={field.Match || ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateField(index, { Match: e.target.value ? parseInt(e.target.value) : undefined })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {isEditing && field.FieldType === 'BITLOOKUP' && (
                        <div className="row g-3 mt-2">
                          <div className="col-md-6">
                            <label className="form-label small fw-bold">Bit Lookup Enumeration</label>
                            <div className="d-flex gap-2">
                              <Input
                                type="text"
                                size="sm"
                                value={field.LookupBitEnumeration || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  updateField(index, { LookupBitEnumeration: e.target.value || undefined })
                                }
                                placeholder="e.g. ENGINE_STATUS_1"
                              />
                              <Button
                                color="secondary"
                                size="sm"
                                onClick={() => openLookupEditor(index, 'bitlookup')}
                                title="Edit lookup values"
                              >
                                <i className="fa fa-edit" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small fw-bold">Match</label>
                            <Input
                              type="number"
                              size="sm"
                              value={field.Match || ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateField(index, { Match: e.target.value ? parseInt(e.target.value) : undefined })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Second row for Match field when not using LOOKUP or BITLOOKUP */}
                      {isEditing && field.FieldType !== 'LOOKUP' && field.FieldType !== 'BITLOOKUP' && (
                        <div className="row g-3 mt-2">
                          <div className="col-md-3">
                            <label className="form-label small fw-bold">Match</label>
                            <Input
                              type="number"
                              size="sm"
                              value={field.Match || ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateField(index, { Match: e.target.value ? parseInt(e.target.value) : undefined })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Show lookup info in read-only mode */}
                      {!isEditing && (field.LookupEnumeration || field.LookupBitEnumeration) && (
                        <div className="row g-3 mt-2">
                          <div className="col-12">
                            <small className="text-muted">
                              <strong>Lookup:</strong>
                              {field.LookupEnumeration && (
                                <code className="ms-1" style={{ fontSize: '0.8em' }}>
                                  {field.LookupEnumeration}
                                </code>
                              )}
                              {field.LookupBitEnumeration && (
                                <code className="ms-1" style={{ fontSize: '0.8em' }}>
                                  {field.LookupBitEnumeration}
                                </code>
                              )}
                            </small>
                          </div>
                        </div>
                      )}

                      {/* Show Match info in read-only mode */}
                      {!isEditing && field.Match !== undefined && (
                        <div className="row g-3 mt-2">
                          <div className="col-12">
                            <small className="text-muted">
                              <strong>Match:</strong>
                              <code className="ms-1" style={{ fontSize: '0.8em' }}>
                                {field.Match}
                              </code>
                            </small>
                          </div>
                        </div>
                      )}

                      {isEditing && (
                        <div className="row g-3 mt-2">
                          <div className="col-12">
                            <label className="form-label small fw-bold">Description</label>
                            <Input
                              type="textarea"
                              size="sm"
                              rows="2"
                              value={field.Description || ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateField(index, { Description: e.target.value })
                              }
                              placeholder="Field description..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted text-center py-3">
                  <i className="fa fa-inbox fa-2x mb-2" />
                  <div>No fields defined yet. Click "Add Field" to get started.</div>
                </div>
              )}
              {isEditing && (
                <div className="d-flex justify-content-center mt-3">
                  <Button color="success" size="sm" onClick={addField}>
                    <i className="fa fa-plus me-2" />
                    Add Field
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Repeating Fields Info */}
      {(editedDefinition.RepeatingFieldSet1Size || isEditing) && editedDefinition.RepeatingFieldSet1Size! > 0 && (
        <div className="mt-3">
          <h6>Repeating Fields Configuration</h6>
          <dl className="row">
            <dt className="col-sm-4">Repeating Size:</dt>
            <dd className="col-sm-8">
              {isEditing ? (
                <Input
                  type="number"
                  size="sm"
                  value={editedDefinition.RepeatingFieldSet1Size || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateDefinition({ RepeatingFieldSet1Size: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                />
              ) : (
                `${editedDefinition.RepeatingFieldSet1Size} fields`
              )}
            </dd>
            {(editedDefinition.RepeatingFieldSet1StartField || isEditing) && (
              <>
                <dt className="col-sm-4">Start Field:</dt>
                <dd className="col-sm-8">
                  {isEditing ? (
                    <Input
                      type="number"
                      size="sm"
                      value={editedDefinition.RepeatingFieldSet1StartField || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateDefinition({
                          RepeatingFieldSet1StartField: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                    />
                  ) : (
                    `Field #${editedDefinition.RepeatingFieldSet1StartField}`
                  )}
                </dd>
              </>
            )}
            {(editedDefinition.RepeatingFieldSet1CountField || isEditing) && (
              <>
                <dt className="col-sm-4">Count Field:</dt>
                <dd className="col-sm-8">
                  {isEditing ? (
                    <Input
                      type="number"
                      size="sm"
                      value={editedDefinition.RepeatingFieldSet1CountField || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateDefinition({
                          RepeatingFieldSet1CountField: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                    />
                  ) : (
                    `Field #${editedDefinition.RepeatingFieldSet1CountField}`
                  )}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Lookup Editor Modal */}
      <Modal isOpen={!!editingLookup} toggle={closeLookupEditor} size="lg">
        <ModalHeader toggle={closeLookupEditor}>
          Edit {editingLookup?.type === 'lookup' ? 'Lookup' : 'Bit Lookup'} Enumeration
          {editingLookup && (
            <div className="small text-muted">Field: {editedDefinition.Fields[editingLookup.fieldIndex]?.Name}</div>
          )}
        </ModalHeader>
        <ModalBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6>Lookup Values</h6>
            <Button color="success" size="sm" onClick={addLookupValue}>
              <i className="fa fa-plus me-2" />
              Add Value
            </Button>
          </div>

          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table size="sm" bordered>
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Key/Value</th>
                  <th>Name/Description</th>
                  <th style={{ width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lookupValues.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <Input
                        type={editingLookup?.type === 'bitlookup' ? 'text' : 'number'}
                        size="sm"
                        value={item.key}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateLookupValue(index, e.target.value, item.value)
                        }
                        placeholder={editingLookup?.type === 'bitlookup' ? '0x01' : '0'}
                      />
                    </td>
                    <td>
                      <Input
                        type="text"
                        size="sm"
                        value={item.value}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateLookupValue(index, item.key, e.target.value)
                        }
                        placeholder="Value name"
                      />
                    </td>
                    <td className="text-center">
                      <Button color="danger" size="sm" onClick={() => removeLookupValue(index)} title="Remove value">
                        <i className="fa fa-trash" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {lookupValues.length === 0 && (
            <div className="text-center text-muted p-4">
              <i className="fa fa-info-circle me-2" />
              No lookup values defined. Click "Add Value" to start.
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={saveLookupValues}>
            <i className="fa fa-save me-2" />
            Save Lookup
          </Button>
          <Button color="secondary" onClick={closeLookupEditor}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Export Modal */}
      <Modal isOpen={showExportModal} toggle={closeExportModal} size="lg">
        <ModalHeader>
          Export Generated Headers
          <div className="small text-muted">
            PGN {editedDefinition.PGN} - {editedDefinition.Id}
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6>Generated Header Text</h6>
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <pre
              className="bg-light p-3 rounded"
              style={{
                fontSize: '0.85em',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
              }}
            >
              <code>{exportedJson}</code>
            </pre>
          </div>

          {exportedJson &&
            (() => {
              // Parse the text to count sections
              const sections = exportedJson.split('\n\n')
              const hasLookupSections = sections.length > 1
              const lookupCount = sections.length - 1 // Subtract 1 for the PGN header section

              return (
                <div className="mt-3 text-muted small">
                  <i className="fa fa-info-circle me-1" />
                  This export contains the generated header text ready for integration into pgn.h and lookup.h
                </div>
              )
            })()}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleCopyExport}>
            <i className="fa fa-copy me-2" />
            Copy to Clipboard
          </Button>
          <Button color="secondary" onClick={closeExportModal}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
