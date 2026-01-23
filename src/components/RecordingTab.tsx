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

import React, { useState, useEffect } from 'react'
import { useRecording } from '../contexts/RecordingContext'
import { recordingStorage } from '../utils/localStorage'
import { server } from '../services'

const isEmbedded = typeof window !== 'undefined' && window.location.href.includes('/admin/')
const prefix = isEmbedded ? '/plugins/canboat-visual-analyzer' : ''

interface RecordingStatus {
  isRecording: boolean
  fileName?: string
  startTime?: string
  messageCount: number
  fileSize: number
  format?: string
  error?: string
}

interface RecordingFile {
  name: string
  size: number
  created: string
  messageCount: number
  format?: string
}

const RecordingTab: React.FC = () => {
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>({
    isRecording: false,
    messageCount: 0,
    fileSize: 0,
  })
  const [recordingFiles, setRecordingFiles] = useState<RecordingFile[]>([])
  const [customFileName, setCustomFileName] = useState('')
  const [autoGenerateFileName, setAutoGenerateFileName] = useState(true)
  const [recordingFormat, setRecordingFormat] = useState(() => {
    // Load last selected format from localStorage, default to 'passthrough'
    return recordingStorage.getFormat()
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use recording context for real-time updates
  const { state: recordingContextState, dispatch } = useRecording()

  // Update local state when context state changes
  useEffect(() => {
    if (recordingContextState.lastUpdate) {
      setRecordingStatus((prevStatus) => {
        const newStatus = recordingContextState.status

        // Handle errors from WebSocket events
        if (newStatus.error) {
          setError(newStatus.error)
        } else {
          setError(null) // Clear error when no error in new status
        }

        // Refresh file list when recording starts/stops
        if (newStatus.isRecording !== prevStatus.isRecording) {
          setTimeout(() => loadRecordingFiles(), 100) // Small delay to ensure backend is ready
        }

        return newStatus
      })
    }
  }, [recordingContextState.lastUpdate])

  // Available recording formats based on Transform tab
  const recordingFormats = [
    { value: 'passthrough', label: 'Source Format' },
    { value: 'canboat-json', label: 'Canboat JSON' },
    { value: 'canboat-json-pretty', label: 'Canboat JSON (Pretty)' },
    { value: 'actisense', label: 'Actisense Serial Format' },
    { value: 'actisense-n2k-ascii', label: 'Actisense N2K ASCII' },
    { value: 'ikonvert', label: 'iKonvert Format' },
    { value: 'ydwg-full-raw', label: 'Yacht Devices RAW Format' },
    { value: 'ydwg-raw', label: 'Yacht Devices RAW Send Format' },
    { value: 'pcdin', label: 'PCDIN Format' },
    { value: 'mxpgn', label: 'MXPGN Format' },
    { value: 'candump1', label: 'Linux CAN utils (Angstrom)' },
    { value: 'candump2', label: 'Linux CAN utils (Debian)' },
    { value: 'candump3', label: 'Linux CAN utils (log format)' },
  ]

  // Load initial recording status and files on component mount
  useEffect(() => {
    loadRecordingStatus()
    loadRecordingFiles()

    // Set up periodic refresh for file list (less frequent since status updates come via WebSocket)
    const interval = setInterval(() => {
      loadRecordingFiles()
    }, 10000) // Refresh file list every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const loadRecordingStatus = async () => {
    try {
      const response = await server.get({ type: 'recording' }, '/status')
      if (response.success) {
        const status = response.result
        // Update both local state and context
        setRecordingStatus(status)
        dispatch({ type: 'SET_STATUS', payload: status })
      }
    } catch (err) {
      console.error('Failed to load recording status:', err)
    }
  }

  const loadRecordingFiles = async () => {
    try {
      const response = await server.get({ type: 'recording' }, '/files')
      if (response.success) {
        const files = response.results as RecordingFile[]
        setRecordingFiles(files)
      }
    } catch (err) {
      console.error('Failed to load recording files:', err)
    }
  }

  const handleFormatChange = (newFormat: string) => {
    setRecordingFormat(newFormat)
    // Save to localStorage to remember for next session
    recordingStorage.setFormat(newFormat)
  }

  const startRecording = async () => {
    setLoading(true)
    setError(null)

    try {
      const fileName = autoGenerateFileName
        ? undefined
        : customFileName ||
          `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.${getFileExtension(recordingFormat)}`

      console.log('Starting recording with fileName:', fileName, 'format:', recordingFormat)
      const response = await server.post({ type: 'recording', value: { fileName, format: recordingFormat } }, '/start')
      console.log('Recording response:', response)

      if (response.success) {
        const result = response.result
        // Don't set local state here - it will be updated via WebSocket events
        // Refresh file list
        loadRecordingFiles()
      } else {
        const errorData = response.error
        throw new Error(errorData || 'Failed to start recording')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording'
      setError(errorMessage)
      setRecordingStatus((prev) => ({ ...prev, error: errorMessage }))
    } finally {
      setLoading(false)
    }
  }

  const stopRecording = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await server.post({ type: 'recording' }, '/stop')

      if (response.success) {
        // Don't set local state here - it will be updated via WebSocket events
        // Refresh file list to show the completed recording
        loadRecordingFiles()
      } else {
        const errorData = response.error
        throw new Error(errorData || 'Failed to stop recording')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const deleteFile = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
      return
    }

    try {
      const response = await server.delete({ type: 'recording' }, `/files/${encodeURIComponent(fileName)}`)

      if (response.success) {
        loadRecordingFiles()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete file')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const deleteAllFiles = async () => {
    if (recordingFiles.length === 0) {
      return
    }

    if (
      !confirm(
        `Are you sure you want to delete all ${recordingFiles.length} recording files? This action cannot be undone.`,
      )
    ) {
      return
    }

    setLoading(true)
    try {
      // Delete all files in parallel
      const deletePromises = recordingFiles.map((file) =>
        server.delete({ type: 'recording' }, `/files/${encodeURIComponent(file.name)}`),
      )

      const results = await Promise.allSettled(deletePromises)

      // Check for any failures
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length > 0) {
        setError(`Failed to delete ${failures.length} file(s)`)
      } else {
        // Check for HTTP errors
        const responses = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)

        const httpErrors = responses.filter((response) => !response.success)
        if (httpErrors.length > 0) {
          setError(`Failed to delete ${httpErrors.length} file(s)`)
        }
      }

      // Refresh file list regardless of partial failures
      loadRecordingFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete files')
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = (fileName: string) => {
    window.open(`${prefix}/api/recording/files/${encodeURIComponent(fileName)}/download`, '_blank')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return dateString ? new Date(dateString).toLocaleString() : ''
  }

  const getFileExtension = (format: string): string => {
    switch (format) {
      case 'canboat-json':
      case 'canboat-json-pretty':
        return 'json'
      case 'actisense':
      case 'actisense-n2k-ascii':
        return 'n2k'
      case 'ikonvert':
        return 'iko'
      case 'ydwg-full-raw':
      case 'ydwg-raw':
        return 'ydwg'
      case 'pcdin':
        return 'pcd'
      case 'mxpgn':
        return 'mxp'
      case 'candump1':
      case 'candump2':
      case 'candump3':
      case 'passthrough':
        return 'log'
      default:
        return 'json'
    }
  }

  return (
    <div className="container-fluid mt-3">
      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5>Recording Control</h5>
            </div>
            <div className="card-body">
              {error && (
                <div className="alert alert-danger mb-3">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="mb-3">
                <span className={`badge ${recordingStatus.isRecording ? 'bg-success' : 'bg-secondary'} me-2`}>
                  {recordingStatus.isRecording ? '● Recording' : '○ Not Recording'}
                </span>
                {recordingStatus.isRecording && recordingStatus.fileName && (
                  <small className="text-muted">
                    File: {recordingStatus.fileName}
                    {recordingStatus.format && (
                      <span className="ms-2">
                        Format:{' '}
                        {recordingFormats.find((f) => f.value === recordingStatus.format)?.label ||
                          recordingStatus.format}
                      </span>
                    )}
                  </small>
                )}
              </div>

              {recordingStatus.isRecording && (
                <div className="mb-3">
                  <div className="row">
                    <div className="col-sm-6">
                      <strong>Messages:</strong> {recordingStatus.messageCount}
                    </div>
                    <div className="col-sm-6">
                      <strong>Size:</strong> {formatFileSize(recordingStatus.fileSize)}
                    </div>
                  </div>
                  {recordingStatus.startTime && (
                    <div className="mt-2">
                      <strong>Started:</strong> {formatDate(recordingStatus.startTime)}
                    </div>
                  )}
                </div>
              )}

              {!recordingStatus.isRecording && (
                <div className="mb-3">
                  <div className="mb-3">
                    <label htmlFor="recordingFormat" className="form-label">
                      Recording Format:
                    </label>
                    <select
                      id="recordingFormat"
                      className="form-select"
                      value={recordingFormat}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFormatChange(e.target.value)}
                    >
                      {recordingFormats.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="autoGenerateFileName"
                      checked={autoGenerateFileName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoGenerateFileName(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="autoGenerateFileName">
                      Auto-generate filename
                    </label>
                  </div>
                  {!autoGenerateFileName && (
                    <div className="mb-3 mt-2">
                      <label htmlFor="fileName" className="form-label">
                        Custom filename:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="fileName"
                        value={customFileName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFileName(e.target.value)}
                        placeholder={`recording_2025-01-01.${getFileExtension(recordingFormat)}`}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="d-grid gap-2">
                {!recordingStatus.isRecording ? (
                  <button type="button" className="btn btn-success" onClick={startRecording} disabled={loading}>
                    {loading ? 'Starting...' : 'Start Recording'}
                  </button>
                ) : (
                  <button type="button" className="btn btn-danger" onClick={stopRecording} disabled={loading}>
                    {loading ? 'Stopping...' : 'Stop Recording'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Recorded Files</h5>
              {recordingFiles.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={deleteAllFiles}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete All'}
                </button>
              )}
            </div>
            <div className="card-body">
              {recordingFiles.length === 0 ? (
                <p className="text-muted">No recordings found.</p>
              ) : (
                <table className="table table-responsive table-sm">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Format</th>
                      <th>Size</th>
                      <th>Messages</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordingFiles.map((file) => (
                      <tr key={file.name}>
                        <td>
                          <small>{file.name}</small>
                        </td>
                        <td>
                          <small>
                            {file.format
                              ? recordingFormats.find((f) => f.value === file.format)?.label || file.format
                              : 'Unknown'}
                          </small>
                        </td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>{file.messageCount.toLocaleString()}</td>
                        <td>
                          <small>{formatDate(file.created)}</small>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary me-1"
                            onClick={() => downloadFile(file.name)}
                          >
                            Download
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteFile(file.name)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecordingTab
