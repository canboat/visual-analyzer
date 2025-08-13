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
import { Card, CardBody, Button, Table, Row, Col, Alert, Input, FormGroup, Label } from 'reactstrap'
import { BitEnumeration, getBitEnumerations, removeBitLookup } from '@canboat/ts-pgns'

interface BitLookupEditorProps {
  changedBitLookups: { [key: string]: BitEnumeration }
  onBitLookupChange: (enumeration: BitEnumeration) => void
  onBitLookupRemove: (enumName: string) => void
  onClearAll: () => void
  onBitLookupEdit?: (
    enumName: string,
    type: 'lookup' | 'bitlookup',
    lookupValues: { key: string; value: string }[],
  ) => void
}

const BitLookupEditor: React.FC<BitLookupEditorProps> = ({
  changedBitLookups,
  onBitLookupChange,
  onBitLookupRemove,
  onClearAll,
  onBitLookupEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyChanged, setShowOnlyChanged] = useState(true)

  // Get bit lookups based on filter setting
  const allBitLookups = useMemo(() => {
    let bitLookups: BitEnumeration[]

    if (showOnlyChanged) {
      // Get only changed bit lookups from the tracker
      bitLookups = Object.values(changedBitLookups)
    } else {
      // Get all available bit lookups from ts-pgns
      bitLookups = getBitEnumerations()
    }

    // Apply search filter
    return bitLookups.filter((lookup) => {
      if (searchTerm) {
        return lookup.Name.toLowerCase().includes(searchTerm.toLowerCase())
      }
      return true
    })
  }, [searchTerm, changedBitLookups, showOnlyChanged])

  const editBitLookup = useCallback(
    (enumeration: BitEnumeration) => {
      if (!onBitLookupEdit) return

      // Convert BitEnumeration to the lookup values format expected by EditorTab
      const lookupValues = enumeration.EnumBitValues.map((ebv) => ({
        key: ebv.Bit.toString(),
        value: ebv.Name,
      }))

      // Call parent's bit lookup edit function
      onBitLookupEdit(enumeration.Name, 'bitlookup', lookupValues)
    },
    [onBitLookupEdit],
  )

  const deleteBitLookup = useCallback(
    (enumName: string) => {
      // Only allow deletion if the bit lookup is in the changed bit lookups
      if (!changedBitLookups[enumName]) {
        return // Do nothing if it's not a changed bit lookup
      }

      if (window.confirm(`Are you sure you want to delete the bit lookup "${enumName}"?`)) {
        const enumeration: BitEnumeration = changedBitLookups[enumName]
        if (enumeration) {
          removeBitLookup(enumeration)
        }
        onBitLookupRemove(enumName)
      }
    },
    [onBitLookupRemove, changedBitLookups],
  )

  return (
    <>
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">Bit Lookups Management</h5>
              <small className="text-muted">
                {showOnlyChanged
                  ? 'Showing only bit lookups that have been modified'
                  : 'Showing all available bit lookups'}
              </small>
            </div>
            <div className="d-flex gap-2">
              <Button
                color="primary"
                size="sm"
                onClick={() => onBitLookupEdit?.('', 'bitlookup', [])}
                disabled={!onBitLookupEdit}
              >
                New Bit Lookup
              </Button>
              <Button
                color="secondary"
                size="sm"
                onClick={onClearAll}
                disabled={Object.keys(changedBitLookups).length === 0}
              >
                Clear All Changes
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Row className="mb-3">
            <Col md="8">
              <Input
                size="sm"
                type="text"
                placeholder="🔍 Search bit lookups by name..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </Col>
            <Col md="4">
              <FormGroup check size="sm">
                <Input
                  type="checkbox"
                  id="showOnlyChangedBit"
                  checked={showOnlyChanged}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowOnlyChanged(e.target.checked)}
                />
                <Label check for="showOnlyChangedBit" className="text-muted">
                  Show only changed bit lookups
                </Label>
              </FormGroup>
            </Col>
          </Row>

          {/* Bit Lookups Table */}
          <div style={{ height: '500px', overflow: 'auto' }}>
            {allBitLookups.length === 0 ? (
              <div className="text-center text-muted p-4">
                <p>No bit lookups found</p>
                {searchTerm ? (
                  <small>Try adjusting your search term</small>
                ) : showOnlyChanged ? (
                  <small>No modified bit lookups yet</small>
                ) : (
                  <small>No bit lookups available</small>
                )}
              </div>
            ) : (
              <Table responsive bordered size="sm" style={{ marginBottom: 0 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                  <tr>
                    <th>Name</th>
                    <th>Bit Values Count</th>
                    <th style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allBitLookups.map((lookup, index) => {
                    const isEvenRow = index % 2 === 0
                    return (
                      <tr
                        key={lookup.Name}
                        style={{
                          backgroundColor: isEvenRow ? '#ffffff' : 'rgba(0,0,0,.05)',
                        }}
                      >
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {lookup.Name}
                          {!showOnlyChanged && changedBitLookups[lookup.Name] && (
                            <span className="badge badge-warning ms-2" title="Modified">
                              ●
                            </span>
                          )}
                        </td>
                        <td>{lookup.EnumBitValues.length}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              color="primary"
                              size="sm"
                              outline
                              onClick={() => editBitLookup(lookup)}
                              title="Edit bit lookup"
                            >
                              ✏️
                            </Button>
                            {changedBitLookups[lookup.Name] && (
                              <Button
                                color="danger"
                                size="sm"
                                outline
                                onClick={() => deleteBitLookup(lookup.Name)}
                                title="Remove changes"
                              >
                                ✗
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </div>

          {(showOnlyChanged ? Object.keys(changedBitLookups).length > 0 : true) && (
            <Alert color="info" className="mt-3 mb-0">
              {showOnlyChanged ? (
                <>
                  <strong>{Object.keys(changedBitLookups).length}</strong> bit lookup(s) have been modified and will be
                  saved with your PGN definitions.
                </>
              ) : (
                <>
                  Showing <strong>{allBitLookups.length}</strong> bit lookup(s).{' '}
                  {Object.keys(changedBitLookups).length > 0 && (
                    <>
                      <strong>{Object.keys(changedBitLookups).length}</strong> have been modified.
                    </>
                  )}
                </>
              )}
            </Alert>
          )}
        </CardBody>
      </Card>
    </>
  )
}

export default BitLookupEditor
