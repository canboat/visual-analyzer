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

interface HumanReadableTabProps {
  pgnData: PGN
  definition: Definition | undefined
  pgnHistory?: PGN[]
}

// Calculate PGN rate per second using moving average from history
const calculatePgnRate = (current: PGN, history: PGN[]): number | null => {
  if (!history || history.length < 2) {
    return null
  }

  // Build array of all messages including current, sorted by timestamp (newest first)
  const allMessages = [current, ...history].sort(
    (a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime(),
  )

  // Calculate intervals between consecutive messages (in seconds)
  const intervals: number[] = []
  for (let i = 0; i < allMessages.length - 1; i++) {
    const currentTime = new Date(allMessages[i].timestamp!).getTime()
    const nextTime = new Date(allMessages[i + 1].timestamp!).getTime()
    const intervalSeconds = (currentTime - nextTime) / 1000

    if (intervalSeconds > 0) {
      intervals.push(intervalSeconds)
    }
  }

  if (intervals.length === 0) {
    return null
  }

  // Calculate moving average of the intervals
  // Use exponential moving average for smoother results
  const alpha = 0.3 // Smoothing factor (0.1 = more smoothing, 0.9 = less smoothing)
  let movingAvgInterval = intervals[0]

  for (let i = 1; i < intervals.length; i++) {
    movingAvgInterval = alpha * intervals[i] + (1 - alpha) * movingAvgInterval
  }

  // Rate = 1 / average interval (messages per second)
  const rate = 1 / movingAvgInterval

  return parseFloat(rate.toFixed(1))
}

export const HumanReadableTab = ({ pgnData, definition, pgnHistory = [] }: HumanReadableTabProps) => {
  const rate = calculatePgnRate(pgnData, pgnHistory)
  if (!pgnData.fields) {
    return <div>No field data available</div>
  }

  // Helper function to format field values in a human-readable way
  const formatFieldValue = (value: any, field?: any): string => {
    if (value === null || value === undefined) {
      return 'N/A'
    }

    // Handle special value formatting
    if (typeof value === 'number') {
      // Check if it's a special "not available" value
      if (value === 0xffff || value === 0xff || value === 0xffffffff) {
        return 'Not Available'
      }

      // Format numbers with appropriate precision
      if (field?.Unit) {
        if (value % 1 === 0) {
          return `${value} ${field.Unit}`
        } else {
          return `${value.toFixed(3)} ${field.Unit}`
        }
      }

      return value.toString()
    }

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }

    if (Array.isArray(value)) {
      return value.join(', ')
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  // Helper function to get field definition by ID
  const getFieldDefinition = (fieldId: string) => {
    if (!definition?.Fields) return undefined
    return definition.Fields.find((f) => f.Id === fieldId || f.Name === fieldId)
  }

  // Helper function to get a human-readable field name
  const getFieldDisplayName = (fieldId: string, fieldDef?: any) => {
    if (fieldDef?.Name) {
      return fieldDef.Name
    }

    return fieldId
  }

  // Render regular fields
  const renderFields = () => {
    const fieldEntries = Object.entries(pgnData.fields)
    if (fieldEntries.length === 0) {
      return <div>No field data available</div>
    }

    return (
      <div>
        {fieldEntries.map(([fieldId, value]) => {
          // Skip special fields that are not actual data fields
          if (fieldId === 'list' || fieldId === 'timestamp' || fieldId === 'prio') {
            return null
          }

          const fieldDef = getFieldDefinition(fieldId)
          const displayName = getFieldDisplayName(fieldId, fieldDef)
          const formattedValue = formatFieldValue(value, fieldDef)

          return (
            <div
              key={fieldId}
              style={{
                marginBottom: '6px',
                padding: '6px 8px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '3px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 200px', marginRight: '8px' }}>
                  <strong style={{ color: '#495057', fontSize: '12px' }}>{displayName}</strong>
                  {fieldDef?.Description && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#6c757d',
                        marginTop: '1px',
                        fontStyle: 'italic',
                        lineHeight: '1.2',
                      }}
                    >
                      {fieldDef.Description}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#212529',
                    flex: '0 0 auto',
                  }}
                >
                  {formattedValue}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Render repeating/list fields
  const renderListFields = () => {
    const listData = (pgnData.fields as any).list
    if (!listData || !Array.isArray(listData) || listData.length === 0) {
      return null
    }

    return (
      <div style={{ marginTop: '15px' }}>
        <h6 style={{ marginBottom: '10px', color: '#495057', fontSize: '13px' }}>
          Repeating Data ({listData.length} entries)
        </h6>
        {listData.map((item: any, index: number) => (
          <div
            key={index}
            style={{
              marginBottom: '10px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                backgroundColor: '#e9ecef',
                padding: '5px 8px',
                borderBottom: '1px solid #dee2e6',
                fontWeight: 'bold',
                fontSize: '11px',
                color: '#495057',
              }}
            >
              Entry #{index + 1}
            </div>
            <div style={{ padding: '6px' }}>
              {Object.entries(item).map(([fieldId, value]) => {
                const fieldDef = getFieldDefinition(fieldId)
                const displayName = getFieldDisplayName(fieldId, fieldDef)
                const formattedValue = formatFieldValue(value, fieldDef)

                return (
                  <div
                    key={`${index}-${fieldId}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '3px 0',
                      borderBottom: '1px solid #f8f9fa',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ fontWeight: '500', color: '#495057' }}>{displayName}:</span>
                    <span style={{ color: '#212529' }}>{formattedValue}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '6px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h5 style={{ color: '#495057', marginBottom: '8px', fontSize: '14px' }}>
          {pgnData.description || `PGN ${pgnData.pgn}`}
        </h5>
        <div
          style={{
            fontSize: '11px',
            color: '#6c757d',
            backgroundColor: '#e9ecef',
            padding: '5px 8px',
            borderRadius: '3px',
            marginBottom: '12px',
            lineHeight: '1.3',
          }}
        >
          <strong>Source:</strong> {pgnData.src} | <strong>Destination:</strong> {pgnData.dst || 'N/A'} |{' '}
          <strong>Priority:</strong> {(pgnData.fields as any)?.prio || 'N/A'}
          {(pgnData.fields as any)?.timestamp && (
            <span>
              {' '}
              | <strong>Timestamp:</strong> {new Date((pgnData.fields as any).timestamp).toLocaleString()}
            </span>
          )}
          {rate !== null && (
            <span>
              {' '}
              | <strong>Rate:</strong> {rate} PGNs/sec{' '}
            </span>
          )}
        </div>
      </div>

      {renderFields()}
      {renderListFields()}

      {/* Add PGN Explanation if available */}
      {definition?.Explanation && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#f1f8ff',
            border: '1px solid #c1d7f0',
            borderRadius: '4px',
          }}
        >
          <h6
            style={{
              color: '#495057',
              fontSize: '12px',
              marginBottom: '6px',
              fontWeight: 'bold',
            }}
          >
            PGN Explanation
          </h6>
          <div
            style={{
              fontSize: '11px',
              color: '#495057',
              lineHeight: '1.4',
              textAlign: 'justify',
            }}
          >
            {definition.Explanation}
          </div>
        </div>
      )}
    </div>
  )
}
