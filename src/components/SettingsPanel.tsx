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

interface ServerConfig {
  server: {
    port: number
    publicDir: string
  }
  connections: {
    activeConnection: string | null
    profiles: { [key: string]: any }
  }
  connection: {
    isConnected: boolean
    activeProfile: any | null
  }
}

export const SettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState({
    signalkUrl: '',
    serialPort: '',
    baudRate: 115200,
    deviceType: 'Actisense' as 'Actisense' | 'iKonvert' | 'Yacht Devices',
    networkHost: '',
    networkPort: 2000,
    networkProtocol: 'tcp' as 'tcp' | 'udp',
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

        // Get the active profile data to populate the form
        const activeProfile = data.connection.activeProfile
        if (activeProfile) {
          setFormData({
            signalkUrl: activeProfile.type === 'signalk' ? activeProfile.signalkUrl || '' : '',
            serialPort: activeProfile.type === 'serial' ? activeProfile.serialPort || '' : '',
            baudRate: activeProfile.type === 'serial' ? activeProfile.baudRate || 115200 : 115200,
            deviceType: activeProfile.type === 'serial' ? activeProfile.deviceType || 'Actisense' : 'Actisense',
            networkHost: activeProfile.type === 'network' ? activeProfile.networkHost || '' : '',
            networkPort: activeProfile.type === 'network' ? activeProfile.networkPort || 2000 : 2000,
            networkProtocol: activeProfile.type === 'network' ? activeProfile.networkProtocol || 'tcp' : 'tcp',
          })
        }
      } else {
        throw new Error('Failed to load configuration')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to load configuration: ${error?.message || 'Unknown error'}` })
    } finally {
      setLoading(false)
    }
  }

  const saveConfiguration = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Note: This now uses the connection profiles API
      // Create a temporary profile for immediate use
      const profileData = {
        id: 'settings-temp',
        name: 'Settings Panel Configuration',
        type: formData.signalkUrl
          ? 'signalk'
          : formData.serialPort
            ? 'serial'
            : formData.networkHost
              ? 'network'
              : 'network',
        signalkUrl: formData.signalkUrl || undefined,
        serialPort: formData.serialPort || undefined,
        baudRate: formData.baudRate,
        deviceType: formData.deviceType,
        networkHost: formData.networkHost || undefined,
        networkPort: formData.networkPort,
        networkProtocol: formData.networkProtocol,
      }

      // Save as a connection profile
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Activate the profile
        const activateResponse = await fetch(`/api/connections/${profileData.id}/activate`, {
          method: 'POST',
        })

        if (activateResponse.ok) {
          setMessage({ type: 'success', text: 'Configuration saved and activated successfully!' })
          setTimeout(() => {
            loadConfiguration()
          }, 1000)
        } else {
          setMessage({ type: 'success', text: 'Configuration saved! Use the Connections tab to activate it.' })
        }
      } else {
        throw new Error(result.error || 'Failed to save configuration')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save configuration: ${error?.message || 'Unknown error'}` })
    } finally {
      setSaving(false)
    }
  }

  const restartConnection = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/restart-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Connection restart initiated!' })
        // Reload configuration after restart
        setTimeout(() => {
          loadConfiguration()
        }, 2000)
      } else {
        throw new Error(result.error || 'Failed to restart connection')
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to restart connection: ${error?.message || 'Unknown error'}` })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const clearDataSource = (type: 'signalk' | 'serial' | 'network') => {
    switch (type) {
      case 'signalk':
        setFormData((prev) => ({ ...prev, signalkUrl: '' }))
        break
      case 'serial':
        setFormData((prev) => ({ ...prev, serialPort: '', deviceType: 'Actisense' }))
        break
      case 'network':
        setFormData((prev) => ({ ...prev, networkHost: '' }))
        break
    }
  }

  if (loading && !config) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
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
        <h4 className="text-sk-primary">Server Configuration</h4>
        <p className="mb-3">Configure NMEA 2000 data sources and server settings.</p>

        <div className="alert alert-info mb-3" role="alert">
          <strong>💡 New!</strong> For better connection management, use the <strong>Connections</strong> tab to create
          and manage multiple named connection profiles.
        </div>

        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} mb-3`}>
            {message.text}
          </div>
        )}

        {config && (
          <div className="mb-3">
            <h6>Connection Status</h6>
            <div className="d-flex align-items-center">
              <span className={`badge ${config.connection.isConnected ? 'bg-success' : 'bg-secondary'} mr-2`}>
                {config.connection.isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {config.connection.activeProfile && (
                <span className="text-muted">
                  Active: {config.connection.activeProfile.name} ({config.connection.activeProfile.type})
                </span>
              )}
            </div>
          </div>
        )}

        <form>
          <div className="row">
            <div className="col-md-6">
              <div className="card mb-3">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <strong>SignalK Server</strong>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => clearDataSource('signalk')}
                  >
                    Clear
                  </button>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="signalkUrl" className="form-label">
                      SignalK URL
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      id="signalkUrl"
                      placeholder="http://localhost:3000"
                      value={formData.signalkUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('signalkUrl', e.target.value)
                      }
                    />
                    <small className="form-text text-muted">
                      Connect to a SignalK server for converted NMEA 2000 data
                    </small>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card mb-3">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <strong>Serial Port</strong>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => clearDataSource('serial')}
                  >
                    Clear
                  </button>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="deviceType" className="form-label">
                      Device Type
                    </label>
                    <select
                      className="form-control"
                      id="deviceType"
                      value={formData.deviceType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        handleInputChange('deviceType', e.target.value as 'Actisense' | 'iKonvert' | 'Yacht Devices')
                      }
                    >
                      <option value="Actisense">Actisense (NGT-1, NGT-1-ISO)</option>
                      <option value="iKonvert">iKonvert (NMEA 2000 Gateway)</option>
                      <option value="Yacht Devices">Yacht Devices (YDWG-02, YDNU-02)</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="serialPort" className="form-label">
                      Serial Port
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="serialPort"
                      placeholder="/dev/ttyUSB0 or COM3"
                      value={formData.serialPort}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('serialPort', e.target.value)
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="baudRate" className="form-label">
                      Baud Rate
                    </label>
                    <select
                      className="form-control"
                      id="baudRate"
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
                  <small className="form-text text-muted">
                    Select your NMEA 2000 gateway device type and configure the serial connection
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <div className="card mb-3">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <strong>Network Source</strong>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => clearDataSource('network')}
                  >
                    Clear
                  </button>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="networkHost" className="form-label">
                      Host/IP Address
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="networkHost"
                      placeholder="192.168.1.100 or ydwg"
                      value={formData.networkHost}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('networkHost', e.target.value)
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="networkPort" className="form-label">
                      Port
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="networkPort"
                      value={formData.networkPort}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('networkPort', parseInt(e.target.value))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="networkProtocol" className="form-label">
                      Protocol
                    </label>
                    <select
                      className="form-control"
                      id="networkProtocol"
                      value={formData.networkProtocol}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        handleInputChange('networkProtocol', e.target.value as 'tcp' | 'udp')
                      }
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <small className="form-text text-muted">Connect to network-enabled NMEA 2000 gateways</small>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card mb-3">
                <div className="card-header">
                  <strong>Server Information</strong>
                </div>
                <div className="card-body">
                  {config && (
                    <div>
                      <p>
                        <strong>Port:</strong> {config.server.port}
                      </p>
                      <p>
                        <strong>Public Directory:</strong> {config.server.publicDir}
                      </p>
                      <div className="alert alert-info">
                        <small>
                          <strong>Note:</strong> Server port changes require a full server restart. Use environment
                          variable PORT=8080 to change the port.
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-4">
            <button type="button" className="btn btn-primary mr-2" onClick={saveConfiguration} disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button type="button" className="btn btn-secondary mr-2" onClick={restartConnection} disabled={loading}>
              {loading ? 'Restarting...' : 'Restart Connection'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={loadConfiguration} disabled={loading}>
              Reload
            </button>
          </div>
        </form>

        <div className="mt-4">
          <h6>Usage Tips</h6>
          <ul className="text-muted">
            <li>Only configure one data source at a time for best performance</li>
            <li>SignalK connections provide parsed and converted data</li>
            <li>Serial connections provide raw NMEA 2000 data</li>
            <li>Network connections work with TCP or UDP protocols</li>
            <li>Changes are saved automatically and connection restarts immediately</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
