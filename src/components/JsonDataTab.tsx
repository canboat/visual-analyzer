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

interface JsonDataTabProps {
  pgnData: PGN
  pgnHistory?: PGN[]
  onCopyData: () => Promise<void>
}

// Calculate PGN rate per second from history
const calculatePgnRate = (current: PGN, history: PGN[]): number | null => {
  if (!history || history.length === 0) {
    return null
  }

  // Get the timestamps from current and most recent history entry
  const currentTime = new Date(current.timestamp!).getTime()
  const oldestTime = new Date(history[history.length - 1].timestamp!).getTime()
  
  // Calculate time difference in seconds
  const timeDiffSeconds = (currentTime - oldestTime) / 1000
  
  if (timeDiffSeconds <= 0) {
    return null
  }
  
  // Rate = number of entries / time difference
  // We have (history.length + 1) total entries (including current)
  const totalEntries = history.length + 1
  const rate = totalEntries / timeDiffSeconds
  
  return parseFloat(rate.toFixed(2))
}

export const JsonDataTab = ({ pgnData, pgnHistory = [], onCopyData }: JsonDataTabProps) => {
  const rate = calculatePgnRate(pgnData, pgnHistory)
  
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
        {rate !== null && (
          <>
            <br />
            <strong>Rate:</strong> {rate} PGNs/sec <span className="text-muted">({pgnHistory.length + 1} samples)</span>
          </>
        )}
      </small>
    )
  }

  return (
    <>
      <CardHeader className="d-flex justify-content-between align-items-center">
        {tabHeader()}
        <Button size="sm" color="secondary" onClick={onCopyData} title="Copy PGN data to clipboard">
          Copy
        </Button>
      </CardHeader>
      <div className="p-3">
        <pre>{pgnToJson(pgnData)}</pre>
      </div>
    </>
  )
}
