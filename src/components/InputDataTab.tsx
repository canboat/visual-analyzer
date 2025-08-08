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
import { PGN } from '@canboat/ts-pgns'
import { Button, CardHeader } from 'reactstrap'

interface InputDataTabProps {
  pgnData: PGN
  onCopyInput: () => Promise<void>
}

export const InputDataTab = ({ pgnData, onCopyInput }: InputDataTabProps) => {
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
      <CardHeader className="d-flex justify-content-between align-items-center">
        {tabHeader()}
        <Button size="sm" color="secondary" onClick={onCopyInput} title="Copy input data to clipboard">
          Copy
        </Button>
      </CardHeader>
      <div className="p-3">
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {(pgnData.input || []).map((input, index) => (
            <div key={index} style={{ marginBottom: '1px' }}>
              {input}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
