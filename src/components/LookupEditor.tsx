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

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardBody, Button, Table, Row, Col, Alert, InputGroup, InputGroupText, Input } from 'reactstrap'
import { Enumeration, getEnumerations, removeLookup } from '@canboat/ts-pgns'

interface LookupEditorProps {
  changedLookups: { [key: string]: Enumeration }
  onLookupChange: (enumeration: Enumeration) => void
  onLookupRemove: (enumName: string) => void
  onClearAll: () => void
  onLookupEdit?: (
    enumName: string,
    type: 'lookup' | 'bitlookup',
    lookupValues: { key: string; value: string }[],
  ) => void
}

const LookupEditor: React.FC<LookupEditorProps> = ({
  changedLookups,
  onLookupChange,
  onLookupRemove,
  onClearAll,
  onLookupEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  // Get only changed lookups from the tracker
  const allLookups = useMemo(() => {
    // Get only changed lookups from the tracker
    const changedEnumerations = Object.values(changedLookups)

    // Apply search filter
    return changedEnumerations.filter((lookup) => {
      if (searchTerm) {
        return lookup.Name.toLowerCase().includes(searchTerm.toLowerCase())
      }
      return true
    })
  }, [searchTerm, changedLookups])

  const editLookup = useCallback(
    (enumeration: Enumeration) => {
      if (!onLookupEdit) return

      // Convert Enumeration to the lookup values format expected by PgnDefinitionTab
      const lookupValues = enumeration.EnumValues.map((ev) => ({
        key: ev.Value.toString(),
        value: ev.Name,
      }))

      // Call parent's lookup edit function
      onLookupEdit(enumeration.Name, 'lookup', lookupValues)
    },
    [onLookupEdit],
  )

  const deleteLookup = useCallback(
    (enumName: string) => {
      if (window.confirm(`Are you sure you want to delete the lookup "${enumName}"?`)) {
        // First try to find it in the changed lookups
        let enumeration: Enumeration | undefined = changedLookups[enumName]
        if (!enumeration) {
          // If not found in changed lookups, find it in the original enumerations
          enumeration = getEnumerations().find((e) => e.Name === enumName)
        }
        if (enumeration) {
          removeLookup(enumeration)
        }
        onLookupRemove(enumName)
      }
    },
    [onLookupRemove, changedLookups],
  )

  return (
    <>
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">Changed Lookups Management</h5>
              <small className="text-muted">Showing only lookups that have been modified</small>
            </div>
            <div className="d-flex gap-2">
              <Button
                color="primary"
                size="sm"
                onClick={() => onLookupEdit && onLookupEdit('', 'lookup', [])}
                disabled={!onLookupEdit}
              >
                New Lookup
              </Button>
              <Button
                color="secondary"
                size="sm"
                onClick={onClearAll}
                disabled={Object.keys(changedLookups).length === 0}
              >
                Clear All Changes
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Row className="mb-3">
            <Col md="12">
              <InputGroup size="sm">
                <InputGroupText>🔍</InputGroupText>
                <Input
                  type="text"
                  placeholder="Search changed lookups by name..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
          </Row>

          {/* Lookups Table */}
          <div style={{ height: '500px', overflow: 'auto' }}>
            {allLookups.length === 0 ? (
              <div className="text-center text-muted p-4">
                <p>No changed lookups found</p>
                {searchTerm ? (
                  <small>Try adjusting your search term</small>
                ) : (
                  <small>Modified lookups will appear here</small>
                )}
              </div>
            ) : (
              <Table responsive bordered size="sm" style={{ marginBottom: 0 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                  <tr>
                    <th>Name</th>
                    <th>Max Value</th>
                    <th>Values Count</th>
                    <th style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allLookups.map((lookup, index) => {
                    const isEvenRow = index % 2 === 0
                    return (
                      <tr
                        key={lookup.Name}
                        style={{
                          backgroundColor: isEvenRow ? '#ffffff' : 'rgba(0,0,0,.05)',
                        }}
                      >
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lookup.Name}</td>
                        <td>{lookup.MaxValue}</td>
                        <td>{lookup.EnumValues.length}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              color="primary"
                              size="sm"
                              outline
                              onClick={() => editLookup(lookup)}
                              title="Edit lookup"
                            >
                              ✏️
                            </Button>
                            <Button
                              color="danger"
                              size="sm"
                              outline
                              onClick={() => deleteLookup(lookup.Name)}
                              title="Remove changes"
                            >
                              ✗
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </div>

          {Object.keys(changedLookups).length > 0 && (
            <Alert color="info" className="mt-3 mb-0">
              <strong>{Object.keys(changedLookups).length}</strong> lookup(s) have been modified and will be saved with
              your PGN definitions.
            </Alert>
          )}
        </CardBody>
      </Card>
    </>
  )
}

export default LookupEditor
