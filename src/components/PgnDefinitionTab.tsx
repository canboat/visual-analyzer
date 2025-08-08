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
import { Definition } from '@canboat/ts-pgns'
import { Table, Badge, Row, Col } from 'reactstrap'

interface PgnDefinitionTabProps {
  definition: Definition
}

export const PgnDefinitionTab = ({ definition }: PgnDefinitionTabProps) => {
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

  return (
    <div className="p-3">
      <Row>
        <Col md={8}>
          <h6>PGN Details</h6>
          <dl className="row" style={{ marginBottom: '0.5rem', lineHeight: '1.2' }}>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              ID:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              <code>{definition.Id}</code>
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              PGN:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              <code>{definition.PGN}</code>
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Description:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {definition.Description}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Type:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {definition.Type}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Priority:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              {definition.Priority}
            </dd>
            <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
              Complete:
            </dt>
            <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
              <Badge color={definition.Complete ? 'success' : 'warning'}>
                {definition.Complete ? 'Complete' : 'Incomplete'}
              </Badge>
            </dd>
            {definition.Length && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Length:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  {definition.Length} bytes
                </dd>
              </>
            )}
            {definition.TransmissionInterval && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Interval:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  {definition.TransmissionInterval}ms
                </dd>
              </>
            )}
            {definition.URL && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Reference:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  <a href={definition.URL} target="_blank" rel="noopener noreferrer">
                    Documentation
                  </a>
                </dd>
              </>
            )}
            {definition.Fallback && (
              <>
                <dt className="col-sm-4" style={{ marginBottom: '0.25rem' }}>
                  Fallback:
                </dt>
                <dd className="col-sm-8" style={{ marginBottom: '0.25rem' }}>
                  <Badge color="info" size="sm">
                    Yes
                  </Badge>
                </dd>
              </>
            )}
          </dl>
        </Col>
      </Row>

      {definition.Fields && definition.Fields.length > 0 && (
        <div className="mt-3">
          <h6>Fields ({definition.Fields.length})</h6>
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
                </tr>
              </thead>
              <tbody>
                {definition.Fields.map((field, index) => (
                  <tr key={index}>
                    <td>
                      <code style={{ fontSize: '0.8em' }}>{field.Name}</code>
                    </td>
                    <td>
                      <Badge
                        color="light"
                        className="text-dark"
                        style={{
                          fontSize: '0.7em',
                        }}
                      >
                        {formatFieldType(field.FieldType)}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.8em' }}>{getFieldSize(field)}</td>
                    <td>
                      {field.Unit && (
                        <code className="small" style={{ fontSize: '0.7em' }}>
                          {field.Unit}
                        </code>
                      )}
                    </td>
                    <td>
                      {field.Resolution && field.Resolution !== 1 && (
                        <code className="small" style={{ fontSize: '0.7em' }}>
                          {field.Resolution}
                        </code>
                      )}
                    </td>
                    <td>
                      <small style={{ fontSize: '0.75em', lineHeight: '1.3' }}>{field.Description}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {/* Repeating Fields Info */}
      {definition.RepeatingFieldSet1Size && definition.RepeatingFieldSet1Size > 0 && (
        <div className="mt-3">
          <h6>Repeating Fields Configuration</h6>
          <dl className="row">
            <dt className="col-sm-4">Repeating Size:</dt>
            <dd className="col-sm-8">{definition.RepeatingFieldSet1Size} fields</dd>
            {definition.RepeatingFieldSet1StartField && (
              <>
                <dt className="col-sm-4">Start Field:</dt>
                <dd className="col-sm-8">Field #{definition.RepeatingFieldSet1StartField}</dd>
              </>
            )}
            {definition.RepeatingFieldSet1CountField && (
              <>
                <dt className="col-sm-4">Count Field:</dt>
                <dd className="col-sm-8">Field #{definition.RepeatingFieldSet1CountField}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
