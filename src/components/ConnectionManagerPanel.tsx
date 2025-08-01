import React, { useState, useEffect } from 'react'
import { Card, CardBody, Button, Form, FormGroup, Label, Input, Alert, Row, Col, Modal, ModalHeader, ModalBody, ModalFooter, Table } from 'reactstrap'

interface ConnectionProfile {
  id: string
  name: string
  type: 'serial' | 'network' | 'signalk' | 'socketcan'
  signalkUrl?: string
  signalkUsername?: string
  signalkPassword?: string
  serialPort?: string
  baudRate?: number
  deviceType?: 'Actisense' | 'iKonvert' | 'Yacht Devices' | 'Yacht Devices RAW' | 'NavLink2' | 'Actisense ASCII' | 'SocketCAN'
  networkHost?: string
  networkPort?: number
  networkProtocol?: 'tcp' | 'udp'
  socketcanInterface?: string
}

interface ServerConfig {
  server: {
    port: number
    publicDir: string
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
}

interface ConnectionManagerPanelProps {
  connectionStatus?: ConnectionStatus
}

export const ConnectionManagerPanel: React.FC<ConnectionManagerPanelProps> = ({ connectionStatus }) => {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
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
    socketcanInterface: 'can0'
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

  const saveConnectionProfile = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Connection name is required' })
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
          ...formData
        }),
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setMessage({ type: 'success', text: `Connection profile ${editingProfile ? 'updated' : 'created'} successfully!` })
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
        method: 'DELETE'
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
        method: 'POST'
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
      socketcanInterface: 'can0'
    })
    setEditingProfile(null)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const renderConnectionForm = () => {
    return (
      <Form>
        <div className="mb-4">
          <FormGroup>
            <Label for="connectionName" className="font-weight-bold">
              <i className="fas fa-tag mr-2"></i>Connection Name
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
            <small className="form-text text-muted">
              Choose a descriptive name to easily identify this connection
            </small>
          </FormGroup>

          <FormGroup>
            <Label for="connectionType" className="font-weight-bold">
              <i className="fas fa-plug mr-2"></i>Connection Type
            </Label>
            <Input
              type="select"
              id="connectionType"
              value={formData.type}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('type', e.target.value)}
              className="form-control-lg"
            >
              <option value="network">🌐 Network (TCP/UDP)</option>
              <option value="serial">🔌 Serial Port</option>
              <option value="signalk">⚓ SignalK Server</option>
              <option value="socketcan">🚗 SocketCAN (Linux CAN)</option>
            </Input>
          </FormGroup>
        </div>

        {formData.type === 'signalk' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-primary mb-3">
              <i className="fas fa-anchor mr-2"></i>SignalK Server Configuration
            </h6>
            <FormGroup>
              <Label for="signalkUrl" className="font-weight-bold">SignalK URL</Label>
              <Input
                type="url"
                id="signalkUrl"
                placeholder="http://localhost:3000"
                value={formData.signalkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('signalkUrl', e.target.value)}
                className="form-control-lg"
              />
              <small className="form-text text-muted">
                Full URL including protocol (http:// or https://)
              </small>
            </FormGroup>
            
            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="signalkUsername" className="font-weight-bold">Username (Optional)</Label>
                  <Input
                    type="text"
                    id="signalkUsername"
                    placeholder="username"
                    value={formData.signalkUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('signalkUsername', e.target.value)}
                    className="form-control-lg"
                  />
                  <small className="form-text text-muted">
                    Leave empty if no authentication required
                  </small>
                </FormGroup>
              </div>
              <div className="col-md-6">
                <FormGroup>
                  <Label for="signalkPassword" className="font-weight-bold">Password (Optional)</Label>
                  <Input
                    type="password"
                    id="signalkPassword"
                    placeholder="password"
                    value={formData.signalkPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('signalkPassword', e.target.value)}
                    className="form-control-lg"
                  />
                  <small className="form-text text-muted">
                    Leave empty if no authentication required
                  </small>
                </FormGroup>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'serial' && (
          <div className="border rounded p-3 bg-light">
            <h6 className="text-success mb-3">
              <i className="fas fa-usb mr-2"></i>Serial Port Configuration
            </h6>
            <FormGroup>
              <Label for="deviceType" className="font-weight-bold">Device Type</Label>
              <Input
                type="select"
                id="deviceType"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('deviceType', e.target.value)}
                className="form-control-lg"
              >
                <option value="Actisense">🔹 Actisense (NGT-1 Compatible)</option>
                <option value="iKonvert">🔹 iKonvert (NMEA 2000 Gateway)</option>
                <option value="Yacht Devices">🔹 Yacht Devices RAW (YDNU-02)</option>
              </Input>
              <small className="form-text text-muted">
                Select your specific NMEA 2000 gateway device
              </small>
            </FormGroup>
            
            <div className="row">
              <div className="col-md-8">
                <FormGroup>
                  <Label for="serialPort" className="font-weight-bold">Serial Port</Label>
                  <Input
                    type="text"
                    id="serialPort"
                    placeholder="/dev/ttyUSB0 or COM3"
                    value={formData.serialPort}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('serialPort', e.target.value)}
                    className="form-control-lg"
                  />
                </FormGroup>
              </div>
              <div className="col-md-4">
                <FormGroup>
                  <Label for="baudRate" className="font-weight-bold">Baud Rate</Label>
                  <Input
                    type="select"
                    id="baudRate"
                    value={formData.baudRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('baudRate', parseInt(e.target.value))}
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
              <i className="fas fa-network-wired mr-2"></i>Network Configuration
            </h6>
            <FormGroup>
              <Label for="networkDeviceType" className="font-weight-bold">Device Type</Label>
              <Input
                type="select"
                id="networkDeviceType"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('deviceType', e.target.value)}
                className="form-control-lg"
              >
                <option value="Yacht Devices RAW">🔹 Yacht Devices RAW (YDWG-02)</option>
                <option value="NavLink2">🔹 NavLink2 Gateway</option>
                <option value="Actisense ASCII">🔹 Actisense ASCII (W2K-1)</option>
              </Input>
              <small className="form-text text-muted">
                Select your specific NMEA 2000 network gateway device
              </small>
            </FormGroup>
            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="networkHost" className="font-weight-bold">Host/IP Address</Label>
                  <Input
                    type="text"
                    id="networkHost"
                    placeholder="192.168.1.100 or ydwg"
                    value={formData.networkHost}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('networkHost', e.target.value)}
                    className="form-control-lg"
                  />
                  <small className="form-text text-muted">
                    IP address or hostname of your gateway
                  </small>
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label for="networkPort" className="font-weight-bold">Port</Label>
                  <Input
                    type="number"
                    id="networkPort"
                    value={formData.networkPort}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('networkPort', parseInt(e.target.value))}
                    className="form-control-lg"
                  />
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label for="networkProtocol" className="font-weight-bold">Protocol</Label>
                  <Input
                    type="select"
                    id="networkProtocol"
                    value={formData.networkProtocol}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('networkProtocol', e.target.value as 'tcp' | 'udp')}
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
              <i className="fas fa-car mr-2"></i>SocketCAN Configuration
            </h6>
            <div className="alert alert-info mb-3">
              <i className="fas fa-info-circle mr-2"></i>
              <strong>Linux Only:</strong> SocketCAN requires a Linux system with CAN interface support. 
              Commonly used with USB-CAN adapters or built-in CAN controllers.
            </div>
            
            <FormGroup>
              <Label for="socketcanInterface" className="font-weight-bold">CAN Interface</Label>
              <Input
                type="text"
                id="socketcanInterface"
                placeholder="can0"
                value={formData.socketcanInterface}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('socketcanInterface', e.target.value)}
                className="form-control-lg"
              />
              <small className="form-text text-muted">
                CAN interface name (e.g., can0, can1, vcan0)
              </small>
            </FormGroup>
            
            <div className="mt-3">
              <h6 className="text-muted mb-2">
                <i className="fas fa-terminal mr-2"></i>Setup Commands
              </h6>
              <div className="bg-dark text-light p-3 rounded">
                <small>
                  <strong>Setup CAN interface:</strong><br/>
                  <code className="text-warning">sudo ip link set can0 type can bitrate 250000</code><br/>
                  <code className="text-warning">sudo ip link set up can0</code><br/><br/>
                  <strong>Test interface:</strong><br/>
                  <code className="text-warning">ip link show can0</code>
                </small>
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
              <i className="fas fa-plug mr-2"></i>Connection Manager
            </h4>
            <p className="mb-0 text-muted">Manage multiple NMEA 2000 data source connections</p>
          </div>
          <Button color="primary" onClick={openCreateModal} size="lg" className="px-4">
            <i className="fas fa-plus mr-2"></i>
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
                      <i className="fas fa-signal mr-2"></i>Current Connection
                    </h6>
                    <div className="d-flex align-items-center">
                      <span className={`badge badge-lg ${getCurrentConnectionStatus() ? 'badge-success' : 'badge-secondary'} mr-3`}>
                        <i className={`fas ${getCurrentConnectionStatus() ? 'fa-check-circle' : 'fa-times-circle'} mr-1`}></i>
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
                  </div>
                  {getCurrentConnectionStatus() && (
                    <div className="text-success">
                      <i className="fas fa-wifi fa-2x"></i>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Connection Profiles List */}
            <Card className="shadow-sm">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <strong>
                  <i className="fas fa-list mr-2"></i>Connection Profiles
                </strong>
                <span className="badge badge-secondary">
                  {Object.keys(config.connections.profiles).length} profiles
                </span>
              </div>
              <CardBody className="p-0">
                {Object.keys(config.connections.profiles).length === 0 ? (
                  <div className="text-center p-5">
                    <i className="fas fa-plug fa-3x text-muted mb-3"></i>
                    <h6 className="text-muted mb-2">No connection profiles configured</h6>
                    <p className="text-muted mb-3">Create your first connection profile to get started</p>
                    <Button color="primary" onClick={openCreateModal}>
                      <i className="fas fa-plus mr-2"></i>Create First Profile
                    </Button>
                  </div>
                ) : (
                  <Table className="mb-0 table-hover">
                    <thead className="thead-light">
                      <tr>
                        <th style={{width: '28%'}}><i className="fas fa-tag mr-1"></i>Connection Name</th>
                        <th style={{width: '12%'}}><i className="fas fa-cogs mr-1"></i>Type</th>
                        <th style={{width: '35%'}}><i className="fas fa-info-circle mr-1"></i>Connection Details</th>
                        <th style={{width: '12%'}}><i className="fas fa-signal mr-1"></i>Status</th>
                        <th style={{width: '13%'}}><i className="fas fa-tools mr-1"></i>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(config.connections.profiles).map(([profileId, profile]) => (
                        <tr key={profileId} className={config.connections.activeConnection === profileId ? 'table-primary' : ''}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className={`fas ${profile.type === 'network' ? 'fa-network-wired' : profile.type === 'serial' ? 'fa-usb' : profile.type === 'socketcan' ? 'fa-car' : 'fa-anchor'} mr-2 text-${profile.type === 'network' ? 'info' : profile.type === 'serial' ? 'success' : profile.type === 'socketcan' ? 'warning' : 'primary'}`}></i>
                              <div>
                                <strong>{profile.name}</strong>
                                {config.connections.activeConnection === profileId && (
                                  <span className="badge badge-primary ml-2">
                                    <i className="fas fa-star mr-1"></i>Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-outline-${profile.type === 'network' ? 'info' : profile.type === 'serial' ? 'success' : profile.type === 'socketcan' ? 'warning' : 'primary'}`}>
                              {profile.type.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">
                              {profile.type === 'signalk' && (
                                <>
                                  <i className="fas fa-globe mr-1"></i>{profile.signalkUrl}
                                  {profile.signalkUsername && (
                                    <span className="ml-2 badge badge-outline-info">
                                      <i className="fas fa-user mr-1"></i>Auth
                                    </span>
                                  )}
                                </>
                              )}
                              {profile.type === 'serial' && (
                                <><i className="fas fa-microchip mr-1"></i>{profile.serialPort} ({profile.deviceType})</>
                              )}
                              {profile.type === 'network' && (
                                <><i className="fas fa-server mr-1"></i>{profile.networkHost}:{profile.networkPort} ({profile.networkProtocol?.toUpperCase()}) - {profile.deviceType}</>
                              )}
                              {profile.type === 'socketcan' && (
                                <>
                                  <i className="fas fa-microchip mr-1"></i>{profile.socketcanInterface}
                                </>
                              )}
                            </small>
                          </td>
                          <td>
                            {config.connections.activeConnection === profileId ? (
                              <span className={`badge ${getCurrentConnectionStatus() ? 'badge-success' : 'badge-warning'}`}>
                                <i className={`fas ${getCurrentConnectionStatus() ? 'fa-check-circle' : 'fa-clock'} mr-1`}></i>
                                {getCurrentConnectionStatus() ? 'Connected' : 'Connecting...'}
                              </span>
                            ) : (
                              <span className="badge badge-secondary">
                                <i className="fas fa-minus-circle mr-1"></i>Inactive
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-row" style={{gap: '2px'}}>
                              {config.connections.activeConnection !== profileId && (
                                <Button
                                  size="xs"
                                  color="success"
                                  onClick={() => activateConnectionProfile(profileId)}
                                  disabled={loading}
                                  className="d-flex align-items-center justify-content-center"
                                  style={{minWidth: '50px', fontSize: '0.7rem', padding: '2px 4px'}}
                                >
                                  <i className="fas fa-play" style={{fontSize: '9px', marginRight: '2px'}}></i>
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="xs"
                                color="outline-primary"
                                onClick={() => openEditModal(profileId)}
                                className="d-flex align-items-center justify-content-center"
                                style={{minWidth: '40px', fontSize: '0.7rem', padding: '2px 4px'}}
                              >
                                <i className="fas fa-edit" style={{fontSize: '9px', marginRight: '2px'}}></i>
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                color="outline-danger"
                                onClick={() => deleteConnectionProfile(profileId)}
                                disabled={config.connections.activeConnection === profileId}
                                className="d-flex align-items-center justify-content-center"
                                style={{minWidth: '45px', fontSize: '0.7rem', padding: '2px 4px'}}
                              >
                                <i className="fas fa-trash" style={{fontSize: '9px', marginRight: '2px'}}></i>
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
          <ModalHeader className="bg-primary text-white d-flex justify-content-between align-items-center" style={{border: 'none'}}>
            <div className="d-flex align-items-center">
              <i className={`fas ${editingProfile ? 'fa-edit' : 'fa-plus-circle'} mr-2`}></i>
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
                justifyContent: 'center'
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
              <i className="fas fa-times"></i>
            </button>
          </ModalHeader>
          <ModalBody className="p-4">
            <div className="mb-3">
              <div className="alert alert-info d-flex align-items-center">
                <i className="fas fa-info-circle mr-2"></i>
                <div>
                  <strong>Connection Profile:</strong> Save multiple gateway configurations for easy switching between different NMEA 2000 data sources.
                </div>
              </div>
            </div>
            {renderConnectionForm()}
          </ModalBody>
          <ModalFooter className="bg-light">
            <Button 
              color="primary" 
              onClick={saveConnectionProfile} 
              disabled={saving || !formData.name.trim()}
              size="lg"
              className="px-4"
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className={`fas ${editingProfile ? 'fa-save' : 'fa-plus'} mr-2`}></i>
                  {editingProfile ? 'Update Profile' : 'Create Profile'}
                </>
              )}
            </Button>
            <Button color="secondary" onClick={() => setShowModal(false)} size="lg" className="px-4">
              <i className="fas fa-times mr-2"></i>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        <div className="mt-4">
          <Card className="bg-light border-0">
            <CardBody>
              <h6 className="text-primary mb-3">
                <i className="fas fa-lightbulb mr-2"></i>Usage Tips
              </h6>
              <div className="row">
                <div className="col-md-6">
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <i className="fas fa-check text-success mr-2"></i>
                      <small>Create multiple connection profiles for different environments or devices</small>
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-check text-success mr-2"></i>
                      <small>Only one connection can be active at a time</small>
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-check text-success mr-2"></i>
                      <small>Switching connections will automatically disconnect the current one</small>
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <i className="fas fa-info text-info mr-2"></i>
                      <small>Connection profiles are saved automatically and persist across server restarts</small>
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-info text-info mr-2"></i>
                      <small>Use descriptive names to easily identify your connections</small>
                    </li>
                    <li className="mb-2">
                      <i className="fas fa-info text-info mr-2"></i>
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
