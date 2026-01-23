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
  const [showOnlyChanged, setShowOnlyChanged] = useState(true)

  // Get lookups based on filter setting
  const allLookups = useMemo(() => {
    let lookups: Enumeration[]

    if (showOnlyChanged) {
      // Get only changed lookups from the tracker
      lookups = Object.values(changedLookups)
    } else {
      // Get all available lookups from ts-pgns
      lookups = getEnumerations()
    }

    // Apply search filter
    return lookups.filter((lookup) => {
      if (searchTerm) {
        return lookup.Name.toLowerCase().includes(searchTerm.toLowerCase())
      }
      return true
    })
  }, [searchTerm, changedLookups, showOnlyChanged])

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
      // Only allow deletion if the lookup is in the changed lookups
      if (!changedLookups[enumName]) {
        return // Do nothing if it's not a changed lookup
      }

      if (window.confirm(`Are you sure you want to delete the lookup "${enumName}"?`)) {
        const enumeration: Enumeration = changedLookups[enumName]
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
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">Lookups Management</h5>
              <small className="text-muted">
                {showOnlyChanged ? 'Showing only lookups that have been modified' : 'Showing all available lookups'}
              </small>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onLookupEdit && onLookupEdit('', 'lookup', [])}
                disabled={!onLookupEdit}
              >
                New Lookup
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClearAll}
                disabled={Object.keys(changedLookups).length === 0}
              >
                Clear All Changes
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="row mb-3">
            <div className="col-md-8">
              <div className="input-group input-group-sm">
                <span className="input-group-text">🔍</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search lookups by name..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="showOnlyChanged"
                  checked={showOnlyChanged}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowOnlyChanged(e.target.checked)}
                />
                <label className="form-check-label text-muted" htmlFor="showOnlyChanged">
                  Show only changed lookups
                </label>
              </div>
            </div>
          </div>

          {/* Lookups Table */}
          <div style={{ height: '500px', overflow: 'auto' }}>
            {allLookups.length === 0 ? (
              <div className="text-center text-muted p-4">
                <p>No lookups found</p>
                {searchTerm ? (
                  <small>Try adjusting your search term</small>
                ) : showOnlyChanged ? (
                  <small>No modified lookups yet</small>
                ) : (
                  <small>No lookups available</small>
                )}
              </div>
            ) : (
              <table className="table table-responsive table-bordered table-sm" style={{ marginBottom: 0 }}>
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
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {lookup.Name}
                          {!showOnlyChanged && changedLookups[lookup.Name] && (
                            <span className="badge bg-warning ms-2" title="Modified">
                              ●
                            </span>
                          )}
                        </td>
                        <td>{lookup.MaxValue}</td>
                        <td>{lookup.EnumValues.length}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => editLookup(lookup)}
                              title="Edit lookup"
                            >
                              ✏️
                            </button>
                            {changedLookups[lookup.Name] && (
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => deleteLookup(lookup.Name)}
                                title="Remove changes"
                              >
                                ✗
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {(showOnlyChanged ? Object.keys(changedLookups).length > 0 : true) && (
            <div className="alert alert-info mt-3 mb-0">
              {showOnlyChanged ? (
                <>
                  <strong>{Object.keys(changedLookups).length}</strong> lookup(s) have been modified and will be saved
                  with your PGN definitions.
                </>
              ) : (
                <>
                  Showing <strong>{allLookups.length}</strong> lookup(s).{' '}
                  {Object.keys(changedLookups).length > 0 && (
                    <>
                      <strong>{Object.keys(changedLookups).length}</strong> have been modified.
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default LookupEditor
