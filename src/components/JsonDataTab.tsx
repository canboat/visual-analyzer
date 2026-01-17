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

interface JsonDataTabProps {
  pgnData: PGN
  pgnHistory?: PGN[]
  onCopyData: () => Promise<void>
}

export const JsonDataTab = ({ pgnData, pgnHistory = [], onCopyData }: JsonDataTabProps) => {
  const pgnToJson = (pgn: PGN): string => {
    return JSON.stringify(
      pgn,
      (key, value) => (key === 'input' || key === 'rawData' || key === 'byteMapping' ? undefined : value),
      2,
    )
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
      <div className="card-header d-flex justify-content-between align-items-center">
        {tabHeader()}
        <button className="btn btn-sm btn-secondary" onClick={onCopyData} title="Copy PGN data to clipboard">
          Copy
        </button>
      </div>
      <div className="p-3">
        <pre>{pgnToJson(pgnData)}</pre>
      </div>
    </>
  )
}
