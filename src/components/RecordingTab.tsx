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
import { useWebSocket } from '../hooks/useWebSocket'

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
  const [recordingFormat, setRecordingFormat] = useState('canboat-json')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // WebSocket connection for real-time updates
  useWebSocket({
    onMessage: (message) => {
      // Handle recording-specific WebSocket events
      switch (message.event) {
        case 'recording:started':
          if (message.data) {
            setRecordingStatus({
              isRecording: true,
              fileName: message.data.fileName,
              startTime: message.data.startTime,
              messageCount: 0,
              fileSize: 0,
              format: message.data.format,
            })
            // Refresh file list to show new recording
            loadRecordingFiles()
          }
          break

        case 'recording:stopped':
          if (message.data) {
            setRecordingStatus({
              isRecording: false,
              messageCount: message.data.messageCount || 0,
              fileSize: message.data.fileSize || 0,
            })
            // Refresh file list to show completed recording
            loadRecordingFiles()
          }
          break

        case 'recording:progress':
          if (message.data) {
            setRecordingStatus((prev) => ({
              ...prev,
              messageCount: message.data.messageCount || prev.messageCount,
              fileSize: message.data.fileSize || prev.fileSize,
            }))
          }
          break

        case 'recording:error':
          if (message.data?.error) {
            setError(message.data.error)
            setRecordingStatus((prev) => ({
              ...prev,
              error: message.data.error,
            }))
          }
          break

        default:
          // Ignore other events
          break
      }
    },
    onConnect: () => {
      console.log('Recording tab WebSocket connected')
    },
    onDisconnect: () => {
      console.log('Recording tab WebSocket disconnected')
    }
  })

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
        setRecordingStatus(status)
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
        setRecordingStatus({
          isRecording: true,
          fileName: result.fileName,
          startTime: new Date().toISOString(),
          messageCount: 0,
          fileSize: 0,
          format: recordingFormat,
        })
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
        setRecordingStatus({
          isRecording: false,
          messageCount: 0,
          fileSize: 0,
        })
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecordingFormat(e.target.value)}
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
            <CardHeader>
              <h5>Recorded Files</h5>
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
