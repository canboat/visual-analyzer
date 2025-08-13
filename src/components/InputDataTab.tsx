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

import React, { useState, useCallback } from 'react'
import { PGN } from '@canboat/ts-pgns'
import { Button, CardHeader, Input } from 'reactstrap'

interface InputDataTabProps {
  pgnData: PGN
  onCopyInput: () => Promise<void>
  isEditing?: boolean
  onInputChange?: (newInput: string[]) => void
}

export const InputDataTab = ({ pgnData, onCopyInput, isEditing = false, onInputChange }: InputDataTabProps) => {
  const [editingText, setEditingText] = useState<string>(() => (pgnData.input || []).join('\n'))
  const [hasChanges, setHasChanges] = useState(false)

  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newText = event.target.value
    setEditingText(newText)
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(() => {
    if (onInputChange) {
      const newInputLines = editingText.split('\n').filter(line => line.trim() !== '')
      onInputChange(newInputLines)
      setHasChanges(false)
    }
  }, [editingText, onInputChange])

  const handleCancel = useCallback(() => {
    setEditingText((pgnData.input || []).join('\n'))
    setHasChanges(false)
  }, [pgnData.input])
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
        <div>
          {isEditing && hasChanges && (
            <>
              <Button size="sm" color="success" onClick={handleSave} title="Save changes" className="me-2">
                Save
              </Button>
              <Button size="sm" color="secondary" onClick={handleCancel} title="Cancel changes" className="me-2">
                Cancel
              </Button>
            </>
          )}
          <Button size="sm" color="secondary" onClick={onCopyInput} title="Copy input data to clipboard">
            Copy
          </Button>
        </div>
      </CardHeader>
      <div className="p-3">
        {isEditing ? (
          <Input
            type="textarea"
            value={editingText}
            onChange={handleTextChange}
            style={{ 
              fontFamily: 'monospace', 
              minHeight: '300px',
              whiteSpace: 'pre',
              wordBreak: 'break-all'
            }}
            placeholder="Enter input data, one line per entry..."
          />
        ) : (
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {(pgnData.input || []).map((input, index) => (
              <div key={index} style={{ marginBottom: '1px' }}>
                {input}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
