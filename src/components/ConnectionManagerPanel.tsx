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

interface ConnectionProfile {
  id: string
  name: string
  type: 'serial' | 'network' | 'signalk' | 'socketcan' | 'file'
  signalkUrl?: string
  signalkUsername?: string
  signalkPassword?: string
  serialPort?: string
  baudRate?: number
  deviceType?:
    | 'Actisense'
    | 'iKonvert'
    //| 'Yacht Devices'
    | 'Yacht Devices RAW'
    | 'NavLink2'
    | 'Actisense ASCII'
    | 'SocketCAN'
  networkHost?: string
  networkPort?: number
  networkProtocol?: 'tcp' | 'udp'
  socketcanInterface?: string
  filePath?: string
  playbackSpeed?: number
  loopPlayback?: boolean
}

interface ServerConfig {
  server: {
    port: number
  }
  connections: {
    activeConnection: string | null
    profiles: { [key: string]: Omit<ConnectionProfile, 'id'> }
  }
  connection: {
    isConnected: boolean
    activeProfile: ConnectionProfile | null
  }
}

interface ConnectionStatus {
  isConnected: boolean
  lastUpdate: string
  error?: string
}

interface ConnectionManagerPanelProps {
  connectionStatus?: ConnectionStatus
  onStatusUpdate?: (status: ConnectionStatus) => void
}

export const ConnectionManagerPanel: React.FC<ConnectionManagerPanelProps> = ({ connectionStatus, onStatusUpdate }) => {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null)
  const [formData, setFormData] = useState<Omit<ConnectionProfile, 'id'>>({
    name: '',
    type: 'network',
    signalkUrl: '',
    signalkUsername: '',
    signalkPassword: '',
    serialPort: '',
    baudRate: 115200,
    deviceType: 'Yacht Devices RAW',
    networkHost: '',
    networkPort: 2000,
    networkProtocol: 'tcp',
    socketcanInterface: 'can0',
    filePath: '',
    playbackSpeed: 1.0,
    loopPlayback: false,
  })

  // Helper function to get current connection status, prioritizing real-time data
  const getCurrentConnectionStatus = () => {
    if (connectionStatus) {
      return connectionStatus.isConnected
    }
    return config?.connection.isConnected || false
  }

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      } else {
        throw new Error('Failed to load configuration')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to load configuration: ${error?.message || 'Unknown error'}` })
    } finally {
      setLoading(false)
    }
  }

  const restartConnection = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/restart-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Connection restart initiated successfully' })

        // Clear any existing error state immediately since we're restarting
        if (onStatusUpdate) {
          onStatusUpdate({
            isConnected: false,
            error: undefined, // Clear error on manual restart
            lastUpdate: new Date().toISOString(),
          })
        }

        // Just reload the configuration list (not connection status)
        // Connection status will be updated via WebSocket events
        setTimeout(() => {
          loadConfiguration()
        }, 2000)
      } else {
        throw new Error('Failed to restart connection')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to restart connection: ${error?.message || 'Unknown error'}` })
    } finally {
      setSaving(false)
    }
  }

  const saveConnectionProfile = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Connection name is required' })
      return
    }

    // Validate file path for file connections
    if (formData.type === 'file' && !formData.filePath?.trim()) {
      setMessage({ type: 'error', text: 'File path is required for file connections' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const profileId = editingProfile?.id || formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: profileId,
          ...formData,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({
          type: 'success',
          text: `Connection profile ${editingProfile ? 'updated' : 'created'} successfully!`,
        })
        setShowModal(false)
        resetForm()
        loadConfiguration()
      } else {
        throw new Error(result.error || 'Failed to save connection profile')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save connection profile: ${error?.message || 'Unknown error'}` })
    } finally {
      setSaving(false)
    }
  }

  const deleteConnectionProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this connection profile?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/connections/${profileId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Connection profile deleted successfully!' })
        loadConfiguration()
      } else {
        throw new Error(result.error || 'Failed to delete connection profile')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to delete connection profile: ${error?.message || 'Unknown error'}` })
    } finally {
      setLoading(false)
    }
  }

  const activateConnectionProfile = async (profileId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/connections/${profileId}/activate`, {
        method: 'POST',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Connection profile activated successfully!' })
        loadConfiguration()
      } else {
        throw new Error(result.error || 'Failed to activate connection profile')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to activate connection profile: ${error?.message || 'Unknown error'}` })
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    resetForm()
    setEditingProfile(null)
    setShowModal(true)
  }

  const openEditModal = (profileId: string) => {
    if (!config?.connections.profiles[profileId]) return

    const profile = config.connections.profiles[profileId]
    setFormData(profile)
    setEditingProfile({ id: profileId, ...profile })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'network',
      signalkUrl: '',
      signalkUsername: '',
      signalkPassword: '',
      serialPort: '',
      baudRate: 115200,
      deviceType: 'Yacht Devices RAW',
      networkHost: '',
      networkPort: 2000,
      networkProtocol: 'tcp',
      socketcanInterface: 'can0',
      filePath: '',
      playbackSpeed: 1.0,
      loopPlayback: false,
    })
    setEditingProfile(null)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const renderConnectionForm = () => {
    return (
      <form>
        <div className="mb-4">
          <div className="mb-3">
            <label htmlFor="connectionName" className="form-label fw-bold">
              Connection Name
            </label>
            <input
              type="text"
              className="form-control form-control-lg"
              id="connectionName"
              placeholder="My NMEA 2000 Gateway"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)}
              required
            />
            <small className="form-text text-muted">Choose a descriptive name to easily identify this connection</small>
          </div>

          <div className="mb-3">
            <label htmlFor="connectionType" className="form-label fw-bold">
              Connection Type
            </label>
            <select
              id="connectionType"
              className="form-select form-select-lg"
              value={formData.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('type', e.target.value)}
            >
              <option value="network">Network (TCP/UDP)</option>
              <option value="serial">Serial Port</option>
              <option value="signalk">SignalK Server</option>
              <option value="socketcan">SocketCAN (Linux CAN)</option>
              <option value="file">File Playback</option>
            </select>
          </div>
        </div>

        {formData.type === 'signalk' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-primary mb-3">SignalK Server Configuration</h6>
            <div className="mb-3">
              <label htmlFor="signalkUrl" className="form-label fw-bold">
                SignalK URL
              </label>
              <input
                type="url"
                className="form-control form-control-lg"
                id="signalkUrl"
                placeholder="http://localhost:3000"
                value={formData.signalkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('signalkUrl', e.target.value)}
              />
              <small className="form-text text-muted">Full URL including protocol (http:// or https://)</small>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label htmlFor="signalkUsername" className="form-label fw-bold">
                    Username (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="signalkUsername"
                    placeholder="username"
                    value={formData.signalkUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('signalkUsername', e.target.value)
                    }
                  />
                  <small className="form-text text-muted">Leave empty if no authentication required</small>
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label htmlFor="signalkPassword" className="form-label fw-bold">
                    Password (Optional)
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="signalkPassword"
                    placeholder="password"
                    value={formData.signalkPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('signalkPassword', e.target.value)
                    }
                  />
                  <small className="form-text text-muted">Leave empty if no authentication required</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'serial' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-success mb-3">Serial Port Configuration</h6>
            <div className="mb-3">
              <label htmlFor="deviceType" className="form-label fw-bold">
                Device Type
              </label>
              <select
                id="deviceType"
                className="form-select form-select-lg"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('deviceType', e.target.value)}
              >
                <option value="Actisense">Actisense (NGT-1 Compatible)</option>
                <option value="iKonvert">Digital Yacht iKonvert</option>
                <option value="Yacht Devices">Yacht Devices RAW (YDNU-02)</option>
              </select>
              <small className="form-text text-muted">Select your specific NMEA 2000 gateway device</small>
            </div>

            <div className="row">
              <div className="col-md-8">
                <div className="mb-3">
                  <label htmlFor="serialPort" className="form-label fw-bold">
                    Serial Port
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="serialPort"
                    placeholder="/dev/ttyUSB0 or COM3"
                    value={formData.serialPort}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('serialPort', e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="mb-3">
                  <label htmlFor="baudRate" className="form-label fw-bold">
                    Baud Rate
                  </label>
                  <select
                    id="baudRate"
                    className="form-select form-select-lg"
                    value={formData.baudRate}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleInputChange('baudRate', parseInt(e.target.value))
                    }
                  >
                    <option value={9600}>9600</option>
                    <option value={38400}>38400</option>
                    <option value={115200}>115200</option>
                    <option value={230400}>230400</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'network' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-info mb-3">Network Configuration</h6>
            <div className="mb-3">
              <label htmlFor="networkDeviceType" className="form-label fw-bold">
                Device Type
              </label>
              <select
                id="networkDeviceType"
                className="form-select form-select-lg"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('deviceType', e.target.value)}
              >
                <option value="Yacht Devices RAW">Yacht Devices RAW (YDWG-02)</option>
                <option value="NavLink2">Digital Yacht NavLink2</option>
                <option value="Actisense ASCII">Actisense ASCII (W2K-1)</option>
              </select>
              <small className="form-text text-muted">Select your specific NMEA 2000 network gateway device</small>
            </div>
            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label htmlFor="networkHost" className="form-label fw-bold">
                    Host/IP Address
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="networkHost"
                    placeholder="192.168.1.100 or ydwg"
                    value={formData.networkHost}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('networkHost', e.target.value)
                    }
                  />
                  <small className="form-text text-muted">IP address or hostname of your gateway</small>
                </div>
              </div>
              <div className="col-md-3">
                <div className="mb-3">
                  <label htmlFor="networkPort" className="form-label fw-bold">
                    Port
                  </label>
                  <input
                    type="number"
                    className="form-control form-control-lg"
                    id="networkPort"
                    value={formData.networkPort}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('networkPort', parseInt(e.target.value))
                    }
                  />
                </div>
              </div>
              <div className="col-md-3">
                <div className="mb-3">
                  <label htmlFor="networkProtocol" className="form-label fw-bold">
                    Protocol
                  </label>
                  <select
                    id="networkProtocol"
                    className="form-select form-select-lg"
                    value={formData.networkProtocol}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleInputChange('networkProtocol', e.target.value as 'tcp' | 'udp')
                    }
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'socketcan' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-warning mb-3">SocketCAN Configuration</h6>
            <div className="alert alert-info mb-3">
              <strong>Linux Only:</strong> SocketCAN requires a Linux system with CAN interface support. Commonly used
              with USB-CAN adapters or built-in CAN controllers.
            </div>

            <div className="mb-3">
              <label htmlFor="socketcanInterface" className="form-label fw-bold">
                CAN Interface
              </label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="socketcanInterface"
                placeholder="can0"
                value={formData.socketcanInterface}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleInputChange('socketcanInterface', e.target.value)
                }
              />
              <small className="form-text text-muted">CAN interface name (e.g., can0, can1, vcan0)</small>
            </div>

            <div className="mt-3">
              <h6 className="text-muted mb-2">Setup Commands</h6>
              <div className="bg-dark text-light p-3 rounded">
                <small>
                  <strong>Setup CAN interface:</strong>
                  <br />
                  <code className="text-warning">sudo ip link set can0 type can bitrate 250000</code>
                  <br />
                  <code className="text-warning">sudo ip link set up can0</code>
                  <br />
                  <br />
                  <strong>Test interface:</strong>
                  <br />
                  <code className="text-warning">ip link show can0</code>
                </small>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'file' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-dark mb-3">File Playback Configuration</h6>
            <div className="alert alert-info mb-3">
              <strong>File Playback:</strong> Play back recorded NMEA 2000 data from various file formats for testing
              and analysis.
            </div>

            <div className="mb-3">
              <label htmlFor="filePath" className="form-label fw-bold">
                File Path
              </label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="filePath"
                placeholder="/path/to/nmea2000.log or C:\logs\data.raw"
                value={formData.filePath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('filePath', e.target.value)}
              />
              <small className="form-text text-muted">Full path to the NMEA 2000 data file</small>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label htmlFor="playbackSpeed" className="form-label fw-bold">
                    Playback Speed
                  </label>
                  <select
                    id="playbackSpeed"
                    className="form-select form-select-lg"
                    value={formData.playbackSpeed}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleInputChange('playbackSpeed', parseFloat(e.target.value))
                    }
                  >
                    <option value={0.25}>0.25x (Quarter Speed)</option>
                    <option value={0.5}>0.5x (Half Speed)</option>
                    <option value={1.0}>1.0x (Real Time)</option>
                    <option value={2.0}>2.0x (Double Speed)</option>
                    <option value={5.0}>5.0x (Fast Forward)</option>
                    <option value={0}>Maximum (No Delay)</option>
                  </select>
                  <small className="form-text text-muted">Speed multiplier for data playback</small>
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label fw-bold">Playback Options</label>
                  <div className="mt-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="loopPlayback"
                        checked={formData.loopPlayback}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('loopPlayback', e.target.checked)
                        }
                      />
                      <label className="form-check-label" htmlFor="loopPlayback">
                        Loop Playback
                      </label>
                    </div>
                    <small className="form-text text-muted">Automatically restart playback when file ends</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    )
  }

  if (loading && !config) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading configuration...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="text-sk-primary mb-1">Connection Manager</h4>
            <p className="mb-0 text-muted">Manage multiple NMEA 2000 data source connections</p>
          </div>
          <button type="button" className="btn btn-primary btn-lg px-4" onClick={openCreateModal}>
            Add Connection
          </button>
        </div>

        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} mb-3`}>
            {message.text}
          </div>
        )}

        {config && (
          <>
            {/* Current Connection Status */}
            <div className="card mb-4 border-left-primary">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">Current Connection</h6>
                    <div className="d-flex align-items-center">
                      <span className={`badge ${getCurrentConnectionStatus() ? 'bg-success' : 'bg-secondary'} me-3`}>
                        {getCurrentConnectionStatus() ? 'Connected' : 'Disconnected'}
                      </span>
                      {config.connection.activeProfile ? (
                        <div className="text-muted">
                          <strong>{config.connection.activeProfile.name}</strong>
                          <span className="ms-2 badge bg-outline-secondary">
                            {config.connection.activeProfile.type.toUpperCase()}
                          </span>
                          {connectionStatus && (
                            <small className="ms-2 text-muted">
                              Last update: {new Date(connectionStatus.lastUpdate).toLocaleTimeString()}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted fst-italic">No active connection</span>
                      )}
                    </div>
                    {/* Display connection error if present */}
                    {connectionStatus?.error ? (
                      <div className="mt-2">
                        <div className="alert alert-danger alert-sm mb-0" role="alert">
                          <strong>Connection Error:</strong> {connectionStatus.error}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="d-flex align-items-center">
                    <div className="d-flex flex-column">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm mb-1"
                        onClick={restartConnection}
                        disabled={saving}
                      >
                        {saving ? 'Restarting...' : 'Restart Connection'}
                      </button>
                      {connectionStatus?.error && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            // Clear error by updating parent component if needed
                            setMessage(null)
                          }}
                        >
                          Clear Error
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Profiles List */}
            <div className="card shadow-sm">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <strong>Connection Profiles</strong>
                <span className="badge bg-secondary">{Object.keys(config.connections.profiles).length} profiles</span>
              </div>
              <div className="card-body p-0">
                {Object.keys(config.connections.profiles).length === 0 ? (
                  <div className="text-center p-5">
                    <h6 className="text-muted mb-2">No connection profiles configured</h6>
                    <p className="text-muted mb-3">Create your first connection profile to get started</p>
                    <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                      Create First Profile
                    </button>
                  </div>
                ) : (
                  <table className="table mb-0 table-hover">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '28%' }}>Connection Name</th>
                        <th style={{ width: '12%' }}>Type</th>
                        <th style={{ width: '35%' }}>Connection Details</th>
                        <th style={{ width: '12%' }}>Status</th>
                        <th style={{ width: '13%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(config.connections.profiles)
                        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                        .map(([profileId, profile]) => (
                          <tr
                            key={profileId}
                            className={config.connections.activeConnection === profileId ? 'table-primary' : ''}
                          >
                            <td>
                              <div className="d-flex align-items-center">
                                <div>
                                  <strong>{profile.name}</strong>
                                  {config.connections.activeConnection === profileId && (
                                    <span className="badge bg-primary ms-2">Active</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge bg-outline-${
                                  profile.type === 'network'
                                    ? 'info'
                                    : profile.type === 'serial'
                                      ? 'success'
                                      : profile.type === 'socketcan'
                                        ? 'warning'
                                        : profile.type === 'file'
                                          ? 'secondary'
                                          : 'primary'
                                }`}
                              >
                                {profile.type.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <small className="text-muted">
                                {profile.type === 'signalk' && (
                                  <>
                                    {profile.signalkUrl}
                                    {profile.signalkUsername && (
                                      <span className="ms-2 badge bg-outline-info">Auth</span>
                                    )}
                                  </>
                                )}
                                {profile.type === 'serial' && (
                                  <>
                                    {profile.serialPort} ({profile.deviceType})
                                  </>
                                )}
                                {profile.type === 'network' && (
                                  <>
                                    {profile.networkHost}:{profile.networkPort} (
                                    {profile.networkProtocol?.toUpperCase()}) - {profile.deviceType}
                                  </>
                                )}
                                {profile.type === 'socketcan' && <>{profile.socketcanInterface}</>}
                                {profile.type === 'file' && (
                                  <>
                                    {profile.filePath
                                      ? profile.filePath.split('/').pop() || profile.filePath.split('\\').pop()
                                      : 'No file'}
                                    {profile.playbackSpeed !== 1.0 && (
                                      <span className="ms-2 badge bg-outline-secondary">{profile.playbackSpeed}x</span>
                                    )}
                                    {profile.loopPlayback && <span className="ms-2 badge bg-outline-info">Loop</span>}
                                  </>
                                )}
                              </small>
                            </td>
                            <td>
                              {config.connections.activeConnection === profileId ? (
                                <span className={`badge ${getCurrentConnectionStatus() ? 'bg-success' : 'bg-warning'}`}>
                                  {getCurrentConnectionStatus() ? 'Connected' : 'Connecting...'}
                                </span>
                              ) : (
                                <span className="badge bg-secondary">Inactive</span>
                              )}
                            </td>
                            <td>
                              <div className="d-flex flex-row" style={{ gap: '2px' }}>
                                {config.connections.activeConnection !== profileId && (
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm d-flex align-items-center justify-content-center"
                                    style={{ minWidth: '50px', fontSize: '0.7rem', padding: '2px 4px' }}
                                    onClick={() => activateConnectionProfile(profileId)}
                                    disabled={loading}
                                  >
                                    Activate
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-center"
                                  style={{ minWidth: '40px', fontSize: '0.7rem', padding: '2px 4px' }}
                                  onClick={() => openEditModal(profileId)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm d-flex align-items-center justify-content-center"
                                  style={{ minWidth: '45px', fontSize: '0.7rem', padding: '2px 4px' }}
                                  onClick={() => deleteConnectionProfile(profileId)}
                                  disabled={config.connections.activeConnection === profileId}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* Connection Profile Modal */}
        {showModal && (
          <>
            <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>
            <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1055 }}>
              <div className="modal-dialog modal-lg">
                <div className="modal-content">
                  <div className="modal-header bg-primary text-white">
                    <h5 className="modal-title">
                      {editingProfile ? 'Edit Connection Profile' : 'Create New Connection Profile'}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setShowModal(false)}
                    ></button>
                  </div>
                  <div className="modal-body p-4">{renderConnectionForm()}</div>
                  <div className="modal-footer bg-light">
                    <button
                      type="button"
                      className="btn btn-primary btn-lg px-4"
                      onClick={saveConnectionProfile}
                      disabled={
                        saving || !formData.name.trim() || (formData.type === 'file' && !formData.filePath?.trim())
                      }
                    >
                      {saving ? 'Saving...' : editingProfile ? 'Update Profile' : 'Create Profile'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-lg px-4" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-4">
          <div className="card bg-light border-0">
            <div className="card-body">
              <h6 className="text-primary mb-3">Usage Tips</h6>
              <div className="row">
                <div className="col-md-6">
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <small>Create multiple connection profiles for different environments or devices</small>
                    </li>
                    <li className="mb-2">
                      <small>Only one connection can be active at a time</small>
                    </li>
                    <li className="mb-2">
                      <small>Switching connections will automatically disconnect the current one</small>
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <small>Connection profiles are saved automatically and persist across server restarts</small>
                    </li>
                    <li className="mb-2">
                      <small>Use descriptive names to easily identify your connections</small>
                    </li>
                    <li className="mb-2">
                      <small>Test your connection after creating a new profile</small>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
