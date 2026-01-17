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

import React from 'react'
import { PGN, Definition } from '@canboat/ts-pgns'
import { DeviceMap } from '../types'

interface DeviceInfoTabProps {
  pgnData: PGN
  info: DeviceMap
}

export const DeviceInfoTab = ({ pgnData, info }: DeviceInfoTabProps) => {
  // Helper function to get field name from PGN definition
  const getFieldDisplayName = (pgnInfo: PGN, fieldId: string) => {
    try {
      // Get the definition from the current pgnData
      const definition = pgnInfo.getDefinition()
      if (definition && definition.Fields) {
        // Look for a field with matching ID or Name
        const fieldDef = definition.Fields.find((f) => f.Id === fieldId || f.Name === fieldId)
        if (fieldDef && fieldDef.Name) {
          return fieldDef.Name
        }
      }
    } catch (error) {
      // If anything fails, fall back to formatting the field ID
      console.error('Error getting field display name:', error)
    }

    // Fallback: format the field ID nicely
    return 'unknon' /*fieldId
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()*/
  }

  const tabHeader = () => {
    return (
      <small>
        <strong>PGN:</strong> {pgnData.pgn} |<strong> Source:</strong> {pgnData.src} |<strong> Destination:</strong>{' '}
        {pgnData.dst}
        <br />
        <strong>Description:</strong> {pgnData.description || 'N/A'}
      </small>
    )
  }

  return (
    <>
      <div className="card-header">{tabHeader()}</div>
      <div className="p-3">
        {info[pgnData.src!]?.info ? (
          <div>
            {Object.entries(info[pgnData.src!].info).map(([pgnNumber, pgnInfo]: [string, any]) => (
              <div key={pgnNumber} className="card mb-3" style={{ border: '1px solid #e0e0e0' }}>
                <div className="card-header" style={{ backgroundColor: '#f8f9fa', padding: '10px 15px' }}>
                  <h6 className="mb-0" style={{ color: '#495057' }}>
                    PGN {pgnNumber}: {pgnInfo.description || 'Unknown'}
                  </h6>
                </div>
                <div className="card-body" style={{ padding: '15px' }}>
                  <div className="row">
                    {Object.entries(pgnInfo.fields)
                      .filter(([key]) => key !== 'description')
                      .map(([key, value]: [string, any]) => (
                        <div key={key} className="col-12 mb-2">
                          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            <strong
                              style={{
                                minWidth: '200px',
                                marginRight: '15px',
                                color: '#6c757d',
                                textTransform: 'capitalize',
                                flexShrink: 0,
                              }}
                            >
                              {getFieldDisplayName(pgnInfo, key)}:
                            </strong>
                            <span
                              style={{
                                wordBreak: 'break-word',
                                color: '#212529',
                                flex: 1,
                              }}
                            >
                              {value}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
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
      </div>
    </>
  )
}
