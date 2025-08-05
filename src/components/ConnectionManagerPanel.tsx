import React, { useState, useEffect } from 'react'
import {
  Card,
  CardBody,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  Alert,
  Row,
  Col,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
} from 'reactstrap'

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
    | 'Yacht Devices'
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
  // Add logging to track connectionStatus changes
  console.log('=== CONNECTION MANAGER PANEL RENDER ===')
  console.log('connectionStatus prop:', connectionStatus)
  console.log('connectionStatus.error:', connectionStatus?.error)
  console.log('onStatusUpdate callback available:', !!onStatusUpdate)
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

  // Add debugging
  React.useEffect(() => {
    console.log('ConnectionManagerPanel received connectionStatus:', connectionStatus)
  }, [connectionStatus])

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
      <Form>
        <div className="mb-4">
          <FormGroup>
            <Label for="connectionName" className="font-weight-bold">
              Connection Name
            </Label>
            <Input
              type="text"
              id="connectionName"
              placeholder="My NMEA 2000 Gateway"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)}
              required
              className="form-control-lg"
            />
            <small className="form-text text-muted">Choose a descriptive name to easily identify this connection</small>
          </FormGroup>

          <FormGroup>
            <Label for="connectionType" className="font-weight-bold">
              Connection Type
            </Label>
            <Input
              type="select"
              id="connectionType"
              value={formData.type}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('type', e.target.value)}
              className="form-control-lg"
            >
              <option value="network">Network (TCP/UDP)</option>
              <option value="serial">Serial Port</option>
              <option value="signalk">SignalK Server</option>
              <option value="socketcan">SocketCAN (Linux CAN)</option>
              <option value="file">File Playback</option>
            </Input>
          </FormGroup>
        </div>

        {formData.type === 'signalk' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-primary mb-3">
              SignalK Server Configuration
            </h6>
            <FormGroup>
              <Label for="signalkUrl" className="font-weight-bold">
                SignalK URL
              </Label>
              <Input
                type="url"
                id="signalkUrl"
                placeholder="http://localhost:3000"
                value={formData.signalkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('signalkUrl', e.target.value)}
                className="form-control-lg"
              />
              <small className="form-text text-muted">Full URL including protocol (http:// or https://)</small>
            </FormGroup>

            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="signalkUsername" className="font-weight-bold">
                    Username (Optional)
                  </Label>
                  <Input
                    type="text"
                    id="signalkUsername"
                    placeholder="username"
                    value={formData.signalkUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('signalkUsername', e.target.value)
                    }
                    className="form-control-lg"
                  />
                  <small className="form-text text-muted">Leave empty if no authentication required</small>
                </FormGroup>
              </div>
              <div className="col-md-6">
                <FormGroup>
                  <Label for="signalkPassword" className="font-weight-bold">
                    Password (Optional)
                  </Label>
                  <Input
                    type="password"
                    id="signalkPassword"
                    placeholder="password"
                    value={formData.signalkPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('signalkPassword', e.target.value)
                    }
                    className="form-control-lg"
                  />
                  <small className="form-text text-muted">Leave empty if no authentication required</small>
                </FormGroup>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'serial' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-success mb-3">
              Serial Port Configuration
            </h6>
            <FormGroup>
              <Label for="deviceType" className="font-weight-bold">
                Device Type
              </Label>
              <Input
                type="select"
                id="deviceType"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('deviceType', e.target.value)}
                className="form-control-lg"
              >
                <option value="Actisense">Actisense (NGT-1 Compatible)</option>
                <option value="iKonvert">iKonvert (NMEA 2000 Gateway)</option>
                <option value="Yacht Devices">Yacht Devices RAW (YDNU-02)</option>
              </Input>
              <small className="form-text text-muted">Select your specific NMEA 2000 gateway device</small>
            </FormGroup>

            <div className="row">
              <div className="col-md-8">
                <FormGroup>
                  <Label for="serialPort" className="font-weight-bold">
                    Serial Port
                  </Label>
                  <Input
                    type="text"
                    id="serialPort"
                    placeholder="/dev/ttyUSB0 or COM3"
                    value={formData.serialPort}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('serialPort', e.target.value)
                    }
                    className="form-control-lg"
                  />
                </FormGroup>
              </div>
              <div className="col-md-4">
                <FormGroup>
                  <Label for="baudRate" className="font-weight-bold">
                    Baud Rate
                  </Label>
                  <Input
                    type="select"
                    id="baudRate"
                    value={formData.baudRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('baudRate', parseInt(e.target.value))
                    }
                    className="form-control-lg"
                  >
                    <option value={9600}>9600</option>
                    <option value={38400}>38400</option>
                    <option value={115200}>115200</option>
                    <option value={230400}>230400</option>
                  </Input>
                </FormGroup>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'network' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-info mb-3">
              Network Configuration
            </h6>
            <FormGroup>
              <Label for="networkDeviceType" className="font-weight-bold">
                Device Type
              </Label>
              <Input
                type="select"
                id="networkDeviceType"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('deviceType', e.target.value)}
                className="form-control-lg"
              >
                <option value="Yacht Devices RAW">Yacht Devices RAW (YDWG-02)</option>
                <option value="NavLink2">NavLink2 Gateway</option>
                <option value="Actisense ASCII">Actisense ASCII (W2K-1)</option>
              </Input>
              <small className="form-text text-muted">Select your specific NMEA 2000 network gateway device</small>
            </FormGroup>
            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="networkHost" className="font-weight-bold">
                    Host/IP Address
                  </Label>
                  <Input
                    type="text"
                    id="networkHost"
                    placeholder="192.168.1.100 or ydwg"
                    value={formData.networkHost}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('networkHost', e.target.value)
                    }
                    className="form-control-lg"
                  />
                  <small className="form-text text-muted">IP address or hostname of your gateway</small>
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label for="networkPort" className="font-weight-bold">
                    Port
                  </Label>
                  <Input
                    type="number"
                    id="networkPort"
                    value={formData.networkPort}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('networkPort', parseInt(e.target.value))
                    }
                    className="form-control-lg"
                  />
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label for="networkProtocol" className="font-weight-bold">
                    Protocol
                  </Label>
                  <Input
                    type="select"
                    id="networkProtocol"
                    value={formData.networkProtocol}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('networkProtocol', e.target.value as 'tcp' | 'udp')
                    }
                    className="form-control-lg"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </Input>
                </FormGroup>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'socketcan' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-warning mb-3">
              SocketCAN Configuration
            </h6>
            <div className="alert alert-info mb-3">
              <strong>Linux Only:</strong> SocketCAN requires a Linux system with CAN interface support. Commonly used
              with USB-CAN adapters or built-in CAN controllers.
            </div>

            <FormGroup>
              <Label for="socketcanInterface" className="font-weight-bold">
                CAN Interface
              </Label>
              <Input
                type="text"
                id="socketcanInterface"
                placeholder="can0"
                value={formData.socketcanInterface}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleInputChange('socketcanInterface', e.target.value)
                }
                className="form-control-lg"
              />
              <small className="form-text text-muted">CAN interface name (e.g., can0, can1, vcan0)</small>
            </FormGroup>

            <div className="mt-3">
              <h6 className="text-muted mb-2">
                Setup Commands
              </h6>
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
            <h6 className="text-dark mb-3">
              File Playback Configuration
            </h6>
            <div className="alert alert-info mb-3">
              <strong>File Playback:</strong> Play back recorded NMEA 2000 data from various file formats for testing
              and analysis.
            </div>

            <FormGroup>
              <Label for="filePath" className="font-weight-bold">
                File Path
              </Label>
              <Input
                type="text"
                id="filePath"
                placeholder="/path/to/nmea2000.log or C:\logs\data.raw"
                value={formData.filePath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('filePath', e.target.value)}
                className="form-control-lg"
              />
              <small className="form-text text-muted">Full path to the NMEA 2000 data file</small>
            </FormGroup>

            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="playbackSpeed" className="font-weight-bold">
                    Playback Speed
                  </Label>
                  <Input
                    type="select"
                    id="playbackSpeed"
                    value={formData.playbackSpeed}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('playbackSpeed', parseFloat(e.target.value))
                    }
                    className="form-control-lg"
                  >
                    <option value={0.25}>0.25x (Quarter Speed)</option>
                    <option value={0.5}>0.5x (Half Speed)</option>
                    <option value={1.0}>1.0x (Real Time)</option>
                    <option value={2.0}>2.0x (Double Speed)</option>
                    <option value={5.0}>5.0x (Fast Forward)</option>
                    <option value={0}>Maximum (No Delay)</option>
                  </Input>
                  <small className="form-text text-muted">Speed multiplier for data playback</small>
                </FormGroup>
              </div>
              <div className="col-md-6">
                <FormGroup>
                  <Label className="font-weight-bold">Playback Options</Label>
                  <div className="mt-2">
                    <div className="custom-control custom-checkbox">
                      <Input
                        type="checkbox"
                        id="loopPlayback"
                        checked={formData.loopPlayback}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange('loopPlayback', e.target.checked)
                        }
                        className="custom-control-input"
                      />
                      <Label className="custom-control-label" htmlFor="loopPlayback">
                        Loop Playback
                      </Label>
                    </div>
                    <small className="form-text text-muted">Automatically restart playback when file ends</small>
                  </div>
                </FormGroup>
              </div>
            </div>
          </div>
        )}
      </Form>
    )
  }

  if (loading && !config) {
    return (
      <Card>
        <CardBody>
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
            <p className="mt-2">Loading configuration...</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="text-sk-primary mb-1">
              Connection Manager
            </h4>
            <p className="mb-0 text-muted">Manage multiple NMEA 2000 data source connections</p>
          </div>
          <Button color="primary" onClick={openCreateModal} size="lg" className="px-4">
            Add Connection
          </Button>
        </div>

        {message && (
          <Alert color={message.type === 'success' ? 'success' : 'danger'} className="mb-3">
            {message.text}
          </Alert>
        )}

        {config && (
          <>
            {/* Current Connection Status */}
            <Card className="mb-4 border-left-primary">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">
                      Current Connection
                    </h6>
                    <div className="d-flex align-items-center">
                      <span
                        className={`badge badge-lg ${getCurrentConnectionStatus() ? 'badge-success' : 'badge-secondary'} mr-3`}
                      >
                       
                        {getCurrentConnectionStatus() ? 'Connected' : 'Disconnected'}
                      </span>
                      {config.connection.activeProfile ? (
                        <div className="text-muted">
                          <strong>{config.connection.activeProfile.name}</strong>
                          <span className="ml-2 badge badge-outline-secondary">
                            {config.connection.activeProfile.type.toUpperCase()}
                          </span>
                          {connectionStatus && (
                            <small className="ml-2 text-muted">
                              Last update: {new Date(connectionStatus.lastUpdate).toLocaleTimeString()}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted font-italic">No active connection</span>
                      )}
                    </div>
                    {/* Display connection error if present */}
                    {(() => {
                      console.log('>>> ERROR DISPLAY CHECK <<<')
                      console.log('connectionStatus:', connectionStatus)
                      console.log('connectionStatus?.error:', connectionStatus?.error)
                      console.log('Error display will show:', !!connectionStatus?.error)
                      return connectionStatus?.error ? (
                        <div className="mt-2">
                          <div className="alert alert-danger alert-sm mb-0" role="alert">
                            <strong>Connection Error:</strong> {connectionStatus.error}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                  <div className="d-flex align-items-center">
                    
                    <div className="d-flex flex-column">
                      <Button
                        color="outline-primary"
                        size="sm"
                        onClick={restartConnection}
                        disabled={saving}
                        className="mb-1"
                      >
                        {saving ? 'Restarting...' : 'Restart Connection'}
                      </Button>
                      {connectionStatus?.error && (
                        <Button
                          color="outline-secondary"
                          size="sm"
                          onClick={() => {
                            // Clear error by updating parent component if needed
                            setMessage(null)
                          }}
                        >
                          Clear Error
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Connection Profiles List */}
            <Card className="shadow-sm">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <strong>
                  Connection Profiles
                </strong>
                <span className="badge badge-secondary">
                  {Object.keys(config.connections.profiles).length} profiles
                </span>
              </div>
              <CardBody className="p-0">
                {Object.keys(config.connections.profiles).length === 0 ? (
                  <div className="text-center p-5">
                    <h6 className="text-muted mb-2">No connection profiles configured</h6>
                    <p className="text-muted mb-3">Create your first connection profile to get started</p>
                    <Button color="primary" onClick={openCreateModal}>
                      Create First Profile
                    </Button>
                  </div>
                ) : (
                  <Table className="mb-0 table-hover">
                    <thead className="thead-light">
                      <tr>
                        <th style={{ width: '28%' }}>
                          Connection Name
                        </th>
                        <th style={{ width: '12%' }}>
                          Type
                        </th>
                        <th style={{ width: '35%' }}>
                          Connection Details
                        </th>
                        <th style={{ width: '12%' }}>
                          Status
                        </th>
                        <th style={{ width: '13%' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(config.connections.profiles).map(([profileId, profile]) => (
                        <tr
                          key={profileId}
                          className={config.connections.activeConnection === profileId ? 'table-primary' : ''}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <div>
                                <strong>{profile.name}</strong>
                                {config.connections.activeConnection === profileId && (
                                  <span className="badge badge-primary ml-2">
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge badge-outline-${
                                profile.type === 'network'
                                  ? 'info'
                                  : profile.type === 'serial'
                                    ? 'success'
                                    : profile.type === 'socketcan'
                                      ? 'warning'
                                      : profile.type === 'file'
                                        ? 'dark'
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
                                    <span className="ml-2 badge badge-outline-info">
                                      Auth
                                    </span>
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
                                  {profile.networkHost}:{profile.networkPort} ({profile.networkProtocol?.toUpperCase()})
                                  - {profile.deviceType}
                                </>
                              )}
                              {profile.type === 'socketcan' && (
                                <>
                                  {profile.socketcanInterface}
                                </>
                              )}
                              {profile.type === 'file' && (
                                <>
                                  {profile.filePath
                                    ? profile.filePath.split('/').pop() || profile.filePath.split('\\').pop()
                                    : 'No file'}
                                  {profile.playbackSpeed !== 1.0 && (
                                    <span className="ml-2 badge badge-outline-secondary">
                                      {profile.playbackSpeed}x
                                    </span>
                                  )}
                                  {profile.loopPlayback && (
                                    <span className="ml-2 badge badge-outline-info">
                                      Loop
                                    </span>
                                  )}
                                </>
                              )}
                            </small>
                          </td>
                          <td>
                            {config.connections.activeConnection === profileId ? (
                              <span
                                className={`badge ${getCurrentConnectionStatus() ? 'badge-success' : 'badge-warning'}`}
                              >
                                {getCurrentConnectionStatus() ? 'Connected' : 'Connecting...'}
                              </span>
                            ) : (
                              <span className="badge badge-secondary">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-row" style={{ gap: '2px' }}>
                              {config.connections.activeConnection !== profileId && (
                                <Button
                                  size="xs"
                                  color="success"
                                  onClick={() => activateConnectionProfile(profileId)}
                                  disabled={loading}
                                  className="d-flex align-items-center justify-content-center"
                                  style={{ minWidth: '50px', fontSize: '0.7rem', padding: '2px 4px' }}
                                >
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="xs"
                                color="outline-primary"
                                onClick={() => openEditModal(profileId)}
                                className="d-flex align-items-center justify-content-center"
                                style={{ minWidth: '40px', fontSize: '0.7rem', padding: '2px 4px' }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                color="outline-danger"
                                onClick={() => deleteConnectionProfile(profileId)}
                                disabled={config.connections.activeConnection === profileId}
                                className="d-flex align-items-center justify-content-center"
                                style={{ minWidth: '45px', fontSize: '0.7rem', padding: '2px 4px' }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </>
        )}

        {/* Connection Profile Modal */}
        <Modal isOpen={showModal} toggle={() => setShowModal(false)} size="lg" className="connection-modal">
          <ModalHeader
            className="bg-primary text-white d-flex justify-content-between align-items-center"
            style={{ border: 'none' }}
          >
            <div className="d-flex align-items-center">
              <span>{editingProfile ? 'Edit Connection Profile' : 'Create New Connection Profile'}</span>
            </div>
            <button
              type="button"
              className="btn-close-modern"
              onClick={() => setShowModal(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              ×
            </button>
          </ModalHeader>
          <ModalBody className="p-4">
            
            {renderConnectionForm()}
          </ModalBody>
          <ModalFooter className="bg-light">
            <Button
              color="primary"
              onClick={saveConnectionProfile}
              disabled={saving || !formData.name.trim() || (formData.type === 'file' && !formData.filePath?.trim())}
              size="lg"
              className="px-4"
            >
              {saving ? (
                <>
                  Saving...
                </>
              ) : (
                <>
                  {editingProfile ? 'Update Profile' : 'Create Profile'}
                </>
              )}
            </Button>
            <Button color="secondary" onClick={() => setShowModal(false)} size="lg" className="px-4">
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        <div className="mt-4">
          <Card className="bg-light border-0">
            <CardBody>
              <h6 className="text-primary mb-3">
                Usage Tips
              </h6>
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
            </CardBody>
          </Card>
        </div>
      </CardBody>
    </Card>
  )
}
