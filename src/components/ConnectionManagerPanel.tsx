import React, { useState, useEffect } from 'react'
import { Card, CardBody, Button, Form, FormGroup, Label, Input, Alert, Row, Col, Modal, ModalHeader, ModalBody, ModalFooter, Table } from 'reactstrap'

interface ConnectionProfile {
  id: string
  name: string
  type: 'serial' | 'network' | 'signalk'
  signalkUrl?: string
  serialPort?: string
  baudRate?: number
  deviceType?: 'Actisense' | 'iKonvert' | 'Yacht Devices'
  networkHost?: string
  networkPort?: number
  networkProtocol?: 'tcp' | 'udp'
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

export const ConnectionManagerPanel: React.FC = () => {
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
    serialPort: '',
    baudRate: 115200,
    deviceType: 'Actisense',
    networkHost: '',
    networkPort: 2000,
    networkProtocol: 'tcp'
  })

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
      serialPort: '',
      baudRate: 115200,
      deviceType: 'Actisense',
      networkHost: '',
      networkPort: 2000,
      networkProtocol: 'tcp'
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
        <FormGroup>
          <Label for="connectionName">Connection Name</Label>
          <Input
            type="text"
            id="connectionName"
            placeholder="My NMEA 2000 Gateway"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)}
            required
          />
        </FormGroup>

        <FormGroup>
          <Label for="connectionType">Connection Type</Label>
          <Input
            type="select"
            id="connectionType"
            value={formData.type}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('type', e.target.value)}
          >
            <option value="network">Network (TCP/UDP)</option>
            <option value="serial">Serial Port</option>
            <option value="signalk">SignalK Server</option>
          </Input>
        </FormGroup>

        {formData.type === 'signalk' && (
          <FormGroup>
            <Label for="signalkUrl">SignalK URL</Label>
            <Input
              type="url"
              id="signalkUrl"
              placeholder="http://localhost:3000"
              value={formData.signalkUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('signalkUrl', e.target.value)}
            />
          </FormGroup>
        )}

        {formData.type === 'serial' && (
          <>
            <FormGroup>
              <Label for="deviceType">Device Type</Label>
              <Input
                type="select"
                id="deviceType"
                value={formData.deviceType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('deviceType', e.target.value)}
              >
                <option value="Actisense">Actisense (NGT-1, NGT-1-ISO)</option>
                <option value="iKonvert">iKonvert (NMEA 2000 Gateway)</option>
                <option value="Yacht Devices">Yacht Devices (YDWG-02, YDNU-02)</option>
              </Input>
            </FormGroup>
            <FormGroup>
              <Label for="serialPort">Serial Port</Label>
              <Input
                type="text"
                id="serialPort"
                placeholder="/dev/ttyUSB0 or COM3"
                value={formData.serialPort}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('serialPort', e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Label for="baudRate">Baud Rate</Label>
              <Input
                type="select"
                id="baudRate"
                value={formData.baudRate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('baudRate', parseInt(e.target.value))}
              >
                <option value={9600}>9600</option>
                <option value={38400}>38400</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
              </Input>
            </FormGroup>
          </>
        )}

        {formData.type === 'network' && (
          <>
            <FormGroup>
              <Label for="networkHost">Host/IP Address</Label>
              <Input
                type="text"
                id="networkHost"
                placeholder="192.168.1.100 or ydwg"
                value={formData.networkHost}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('networkHost', e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Label for="networkPort">Port</Label>
              <Input
                type="number"
                id="networkPort"
                value={formData.networkPort}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('networkPort', parseInt(e.target.value))}
              />
            </FormGroup>
            <FormGroup>
              <Label for="networkProtocol">Protocol</Label>
              <Input
                type="select"
                id="networkProtocol"
                value={formData.networkProtocol}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('networkProtocol', e.target.value as 'tcp' | 'udp')}
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </Input>
            </FormGroup>
          </>
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
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="text-sk-primary mb-1">Connection Manager</h4>
            <p className="mb-0">Manage multiple NMEA 2000 data source connections</p>
          </div>
          <Button color="primary" onClick={openCreateModal}>
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
            <Card className="mb-3">
              <CardBody>
                <h6>Current Connection</h6>
                <div className="d-flex align-items-center">
                  <span className={`badge ${config.connection.isConnected ? 'badge-success' : 'badge-secondary'} mr-2`}>
                    {config.connection.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                  {config.connection.activeProfile ? (
                    <span className="text-muted">
                      Active: {config.connection.activeProfile.name} ({config.connection.activeProfile.type})
                    </span>
                  ) : (
                    <span className="text-muted">No active connection</span>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Connection Profiles List */}
            <Card>
              <div className="card-header">
                <strong>Connection Profiles</strong>
              </div>
              <CardBody className="p-0">
                {Object.keys(config.connections.profiles).length === 0 ? (
                  <div className="text-center p-4">
                    <p className="text-muted mb-0">No connection profiles configured</p>
                  </div>
                ) : (
                  <Table className="mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(config.connections.profiles).map(([profileId, profile]) => (
                        <tr key={profileId}>
                          <td>
                            <strong>{profile.name}</strong>
                            {config.connections.activeConnection === profileId && (
                              <span className="badge badge-primary ml-2">Active</span>
                            )}
                          </td>
                          <td>
                            <span className="text-capitalize">{profile.type}</span>
                          </td>
                          <td>
                            {profile.type === 'signalk' && profile.signalkUrl}
                            {profile.type === 'serial' && `${profile.serialPort} (${profile.deviceType})`}
                            {profile.type === 'network' && `${profile.networkHost}:${profile.networkPort} (${profile.networkProtocol?.toUpperCase()})`}
                          </td>
                          <td>
                            {config.connections.activeConnection === profileId ? (
                              <span className={`badge ${config.connection.isConnected ? 'badge-success' : 'badge-warning'}`}>
                                {config.connection.isConnected ? 'Connected' : 'Connecting...'}
                              </span>
                            ) : (
                              <span className="badge badge-secondary">Inactive</span>
                            )}
                          </td>
                          <td>
                            <div className="btn-group" role="group">
                              {config.connections.activeConnection !== profileId && (
                                <Button
                                  size="sm"
                                  color="success"
                                  onClick={() => activateConnectionProfile(profileId)}
                                  disabled={loading}
                                >
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                color="outline-secondary"
                                onClick={() => openEditModal(profileId)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                color="outline-danger"
                                onClick={() => deleteConnectionProfile(profileId)}
                                disabled={config.connections.activeConnection === profileId}
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
        <Modal isOpen={showModal} toggle={() => setShowModal(false)} size="lg">
          <ModalHeader toggle={() => setShowModal(false)}>
            {editingProfile ? 'Edit Connection Profile' : 'Create New Connection Profile'}
          </ModalHeader>
          <ModalBody>
            {renderConnectionForm()}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={saveConnectionProfile} disabled={saving}>
              {saving ? 'Saving...' : (editingProfile ? 'Update' : 'Create')}
            </Button>
            <Button color="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>

        <div className="mt-4">
          <h6>Usage Tips</h6>
          <ul className="text-muted">
            <li>Create multiple connection profiles for different environments or devices</li>
            <li>Only one connection can be active at a time</li>
            <li>Switching connections will automatically disconnect the current one</li>
            <li>Connection profiles are saved automatically and persist across server restarts</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  )
}
