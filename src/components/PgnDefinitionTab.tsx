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
import { Definition, Field } from '@canboat/ts-pgns'
import { Table, Badge, Row, Col, Button, Input, FormGroup, Label, FormText } from 'reactstrap'

interface PgnDefinitionTabProps {
  definition: Definition
  pgnNumber: number
  onSave?: (updatedDefinition: Definition) => void
}

export const PgnDefinitionTab = ({ definition, pgnNumber, onSave }: PgnDefinitionTabProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedDefinition, setEditedDefinition] = useState<Definition>({ ...definition })

  // Update editedDefinition when the definition prop changes (when user selects different PGN)
  useEffect(() => {
    setEditedDefinition({ ...definition })
    // Reset editing mode when definition changes
    setIsEditing(false)
  }, [definition, pgnNumber]) // Also depend on pgnNumber to ensure updates

  // Helper function to format field types
  const formatFieldType = (fieldType?: string) => {
    if (!fieldType) return 'Unknown'
    return fieldType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase())
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

  // Update the definition state
  const updateDefinition = useCallback((updates: Partial<Definition>) => {
    setEditedDefinition(prev => ({ ...prev, ...updates }))
  }, [])

  // Update a specific field
  const updateField = useCallback((index: number, updates: Partial<Field>) => {
    setEditedDefinition(prev => ({
      ...prev,
      Fields: prev.Fields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    }))
  }, [])

  // Add a new field
  const addField = useCallback(() => {
    const newField: Field = {
      Id: `new_field_${editedDefinition.Fields.length + 1}`,
      Name: 'New Field',
      Description: '',
      BitOffset: 0,
      BitStart: 0,
      FieldType: 'NUMBER' as any,
      LookupFieldTypeEnumeration: ''
    }
    setEditedDefinition(prev => ({
      ...prev,
      Fields: [...prev.Fields, newField]
    }))
  }, [editedDefinition.Fields.length])

  // Remove a field
  const removeField = useCallback((index: number) => {
    setEditedDefinition(prev => ({
      ...prev,
      Fields: prev.Fields.filter((_, i) => i !== index)
    }))
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
    setEditedDefinition({ ...definition })
    setIsEditing(false)
  }, [definition])

  return (
    <div className="p-3">
      {/* Edit/Save/Cancel buttons */}
      <Row className="mb-3">
        <Col className="d-flex justify-content-end">
          {!isEditing ? (
            <Button color="primary" size="sm" onClick={() => setIsEditing(true)}>
              <i className="fa fa-edit me-2" />
              Edit Definition
            </Button>
          ) : (
            <div className="d-flex gap-2">
              <Button color="success" size="sm" onClick={handleSave}>
                <i className="fa fa-save me-2" />
                Save Changes
              </Button>
              <Button color="secondary" size="sm" onClick={handleCancel}>
                <i className="fa fa-times me-2" />
                Cancel
              </Button>
            </div>
          )}
        </Col>
      </Row>

      <Row>
        <Col md={8}>
          <h6>PGN Details</h6>
          <dl className="row" style={{ marginBottom: '0.5rem', lineHeight: '1.2' }}>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              ID:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <Input
                  type="text"
                  size="sm"
                  value={editedDefinition.Id}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Id: e.target.value })}
                />
              ) : (
                <code>{editedDefinition.Id}</code>
              )}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              PGN:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <Input
                  type="number"
                  size="sm"
                  value={editedDefinition.PGN}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ PGN: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <code>{editedDefinition.PGN}</code>
              )}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Description:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {isEditing ? (
                <Input
                  type="textarea"
                  size="sm"
                  rows="2"
                  value={editedDefinition.Description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Description: e.target.value })}
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
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Priority: parseInt(e.target.value) || 0 })}
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
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Length: e.target.value ? parseInt(e.target.value) : undefined })}
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
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ TransmissionInterval: e.target.value ? parseInt(e.target.value) : undefined })}
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
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ URL: e.target.value || undefined })}
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
                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ Fallback: e.target.checked })}
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

      {editedDefinition.Fields && editedDefinition.Fields.length > 0 && (
        <div className="mt-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6>Fields ({editedDefinition.Fields.length})</h6>
            {isEditing && (
              <Button color="success" size="sm" onClick={addField}>
                <i className="fa fa-plus me-2" />
                Add Field
              </Button>
            )}
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table size="sm" bordered>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Unit</th>
                  <th>Resolution</th>
                  <th>Description</th>
                  {isEditing && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {editedDefinition.Fields.map((field, index) => (
                  <tr key={index}>
                    <td>
                      {isEditing ? (
                        <Input
                          type="text"
                          size="sm"
                          value={field.Name}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(index, { Name: e.target.value })}
                        />
                      ) : (
                        <code style={{ fontSize: '0.8em' }}>{field.Name}</code>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <Input
                          type="select"
                          size="sm"
                          value={field.FieldType}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(index, { FieldType: e.target.value as any })}
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
                        <Badge
                          color="light"
                          className="text-dark"
                          style={{
                            fontSize: '0.7em',
                          }}
                        >
                          {formatFieldType(field.FieldType)}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <Input
                          type="number"
                          size="sm"
                          value={field.BitLength || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(index, { BitLength: e.target.value ? parseInt(e.target.value) : undefined })}
                        />
                      ) : (
                        <span style={{ fontSize: '0.8em' }}>{getFieldSize(field)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <Input
                          type="text"
                          size="sm"
                          value={field.Unit || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(index, { Unit: e.target.value || undefined })}
                        />
                      ) : field.Unit ? (
                        <code className="small" style={{ fontSize: '0.7em' }}>
                          {field.Unit}
                        </code>
                      ) : null}
                    </td>
                    <td>
                      {isEditing ? (
                        <Input
                          type="number"
                          size="sm"
                          step="any"
                          value={field.Resolution || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(index, { Resolution: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                      ) : field.Resolution && field.Resolution !== 1 ? (
                        <code className="small" style={{ fontSize: '0.7em' }}>
                          {field.Resolution}
                        </code>
                      ) : null}
                    </td>
                    <td>
                      {isEditing ? (
                        <Input
                          type="textarea"
                          size="sm"
                          rows="2"
                          value={field.Description || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(index, { Description: e.target.value })}
                        />
                      ) : (
                        <small style={{ fontSize: '0.75em', lineHeight: '1.3' }}>{field.Description}</small>
                      )}
                    </td>
                    {isEditing && (
                      <td>
                        <Button
                          color="danger"
                          size="sm"
                          onClick={() => removeField(index)}
                          title="Remove field"
                        >
                          <i className="fa fa-trash" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}

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
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ RepeatingFieldSet1Size: e.target.value ? parseInt(e.target.value) : undefined })}
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
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ RepeatingFieldSet1StartField: e.target.value ? parseInt(e.target.value) : undefined })}
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
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateDefinition({ RepeatingFieldSet1CountField: e.target.value ? parseInt(e.target.value) : undefined })}
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
    </div>
  )
}
