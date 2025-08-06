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
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Alert,
  Badge,
  Row,
  Col,
  Input,
  FormGroup,
  Label,
  Table,
} from 'reactstrap'
import { useRecording } from '../contexts/RecordingContext'

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
    // Load last selected format from localStorage, default to 'canboat-json'
    return localStorage.getItem('visual-analyzer-recording-format') || 'canboat-json'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use recording context for real-time updates
  const { state: recordingContextState, dispatch } = useRecording()

  // Update local state when context state changes
  useEffect(() => {
    console.log('Recording context updated:', recordingContextState)
    if (recordingContextState.lastUpdate) {
      setRecordingStatus((prevStatus) => {
        const newStatus = recordingContextState.status
        console.log('Updating recording status from context:', newStatus)
        
        // Handle errors from WebSocket events
        if (newStatus.error) {
          setError(newStatus.error)
        } else {
          setError(null) // Clear error when no error in new status
        }
        
        // Refresh file list when recording starts/stops
        if (newStatus.isRecording !== prevStatus.isRecording) {
          console.log('Recording state changed, refreshing file list')
          setTimeout(() => loadRecordingFiles(), 100) // Small delay to ensure backend is ready
        }
        
        return newStatus
      })
    }
  }, [recordingContextState.lastUpdate])

    // Available recording formats based on Transform tab
  const recordingFormats = [
    { value: 'canboat-json', label: 'Canboat JSON' },
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
      const response = await fetch('/api/recording/status')
      if (response.ok) {
        const status = await response.json()
        console.log('Loaded initial recording status:', status)
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
      const response = await fetch('/api/recording/files')
      if (response.ok) {
        const files = await response.json()
        setRecordingFiles(files)
      }
    } catch (err) {
      console.error('Failed to load recording files:', err)
    }
  }

  const handleFormatChange = (newFormat: string) => {
    setRecordingFormat(newFormat)
    // Save to localStorage to remember for next session
    localStorage.setItem('visual-analyzer-recording-format', newFormat)
  }

  const startRecording = async () => {
    setLoading(true)
    setError(null)

    try {
      const fileName = autoGenerateFileName
        ? undefined
        : customFileName || `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.${getFileExtension(recordingFormat)}`

      const response = await fetch('/api/recording/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName, format: recordingFormat }),
      })

      if (response.ok) {
        const result = await response.json()
        // Don't set local state here - it will be updated via WebSocket events
        console.log('Recording started successfully:', result)
        // Refresh file list
        loadRecordingFiles()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start recording')
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
      const response = await fetch('/api/recording/stop', {
        method: 'POST',
      })

      if (response.ok) {
        // Don't set local state here - it will be updated via WebSocket events
        console.log('Recording stopped successfully')
        // Refresh file list to show the completed recording
        loadRecordingFiles()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to stop recording')
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
      const response = await fetch(`/api/recording/files/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
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

    if (!confirm(`Are you sure you want to delete all ${recordingFiles.length} recording files? This action cannot be undone.`)) {
      return
    }

    setLoading(true)
    try {
      // Delete all files in parallel
      const deletePromises = recordingFiles.map(file => 
        fetch(`/api/recording/files/${encodeURIComponent(file.name)}`, {
          method: 'DELETE',
        })
      )

      const results = await Promise.allSettled(deletePromises)
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected')
      if (failures.length > 0) {
        setError(`Failed to delete ${failures.length} file(s)`)
      } else {
        // Check for HTTP errors
        const responses = results
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<Response>).value)
        
        const httpErrors = responses.filter(response => !response.ok)
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
    window.open(`/api/recording/files/${encodeURIComponent(fileName)}/download`, '_blank')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const getFileExtension = (format: string): string => {
    switch (format) {
      case 'canboat-json':
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
        return 'log'
      default:
        return 'json'
    }
  }

  return (
    <div className="container-fluid mt-3">
      <Row>
        <Col md={6}>
          <Card>
            <CardHeader>
              <h5>Recording Control</h5>
            </CardHeader>
            <CardBody>
              {error && (
                <Alert color="danger" className="mb-3">
                  <strong>Error:</strong> {error}
                </Alert>
              )}

              <div className="mb-3">
                <Badge color={recordingStatus.isRecording ? 'success' : 'secondary'} className="me-2">
                  {recordingStatus.isRecording ? '● Recording' : '○ Not Recording'}
                </Badge>
                {recordingStatus.isRecording && recordingStatus.fileName && (
                  <small className="text-muted">
                    File: {recordingStatus.fileName}
                    {recordingStatus.format && (
                      <span className="ms-2">
                        Format: {recordingFormats.find(f => f.value === recordingStatus.format)?.label || recordingStatus.format}
                      </span>
                    )}
                  </small>
                )}
              </div>

              {recordingStatus.isRecording && (
                <div className="mb-3">
                  <Row>
                    <Col sm={6}>
                      <strong>Messages:</strong> {recordingStatus.messageCount.toLocaleString()}
                    </Col>
                    <Col sm={6}>
                      <strong>Size:</strong> {formatFileSize(recordingStatus.fileSize)}
                    </Col>
                  </Row>
                  {recordingStatus.startTime && (
                    <div className="mt-2">
                      <strong>Started:</strong> {formatDate(recordingStatus.startTime)}
                    </div>
                  )}
                </div>
              )}

              {!recordingStatus.isRecording && (
                <div className="mb-3">
                  <FormGroup>
                    <Label for="recordingFormat">Recording Format:</Label>
                    <Input
                      type="select"
                      id="recordingFormat"
                      value={recordingFormat}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormatChange(e.target.value)}
                    >
                      {recordingFormats.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </Input>
                  </FormGroup>
                  <FormGroup check>
                    <Label check>
                      <Input
                        type="checkbox"
                        checked={autoGenerateFileName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoGenerateFileName(e.target.checked)}
                      />
                      Auto-generate filename
                    </Label>
                  </FormGroup>
                  {!autoGenerateFileName && (
                    <FormGroup className="mt-2">
                      <Label for="fileName">Custom filename:</Label>
                      <Input
                        type="text"
                        id="fileName"
                        value={customFileName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFileName(e.target.value)}
                        placeholder={`recording_2025-01-01.${getFileExtension(recordingFormat)}`}
                      />
                    </FormGroup>
                  )}
                </div>
              )}

              <div className="d-grid gap-2">
                {!recordingStatus.isRecording ? (
                  <Button color="success" onClick={startRecording} disabled={loading}>
                    {loading ? 'Starting...' : 'Start Recording'}
                  </Button>
                ) : (
                  <Button color="danger" onClick={stopRecording} disabled={loading}>
                    {loading ? 'Stopping...' : 'Stop Recording'}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <CardHeader className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Recorded Files</h5>
              {recordingFiles.length > 0 && (
                <Button
                  size="sm"
                  color="outline-danger"
                  onClick={deleteAllFiles}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete All'}
                </Button>
              )}
            </CardHeader>
            <CardBody>
              {recordingFiles.length === 0 ? (
                <p className="text-muted">No recordings found.</p>
              ) : (
                <Table responsive size="sm">
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
                              ? recordingFormats.find(f => f.value === file.format)?.label || file.format
                              : 'Unknown'
                            }
                          </small>
                        </td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>{file.messageCount.toLocaleString()}</td>
                        <td>
                          <small>{formatDate(file.created)}</small>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            color="primary"
                            className="me-1"
                            onClick={() => downloadFile(file.name)}
                          >
                            Download
                          </Button>
                          <Button size="sm" color="danger" onClick={() => deleteFile(file.name)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RecordingTab
