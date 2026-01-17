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
import * as ReactDOMClient from 'react-dom/client'
import AppPanel from './components/AppPanel'
import 'bootstrap/dist/css/bootstrap.min.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './styles.css'

// Mock adminUI for standalone usage
const mockAdminUI = {
  openWebsocket: (options) => {
    console.log('Connecting to WebSocket server with options:', options)

    // Connect to the actual WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`

    console.log('WebSocket URL:', wsUrl)

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('Connected to Visual Analyzer WebSocket server')

      // Subscribe to NMEA 2000 data
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          subscription: 'nmea2000',
        }),
      )
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
    }

    // Return the real WebSocket with the expected interface
    return {
      onmessage: null,
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      },
      close: () => {
        ws.close()
      },

      // Set up message forwarding
      _setupForwarding: function () {
        ws.onmessage = (event) => {
          if (this.onmessage) {
            this.onmessage({
              data: event.data,
            })
          }
        }
      },
    }
  },
}

// Create the app element
const App = () => (
  <React.StrictMode>
    <div>
      {/* SignalK-style Header */}
      <nav
        className="navbar navbar-expand-lg"
        style={{
          backgroundColor: '#003399',
          borderBottom: '1px solid #c2cfd6',
          marginBottom: '0',
        }}
      >
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1" style={{ color: 'white', fontWeight: '600' }}>
            NMEA 2000 Visual Analyzer
          </span>
          <span className="navbar-text" style={{ color: '#a4b7c1', fontSize: '0.875rem' }}>
            <a href="https://github.com/canboat" target="_blank" rel="noopener noreferrer" style={{ color: 'white' }}>
              Canboat
            </a>
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid">
        <AppPanel
          adminUI={{
            ...mockAdminUI,
            openWebsocket: (options) => {
              const ws = mockAdminUI.openWebsocket(options)
              // Set up the forwarding immediately
              ws._setupForwarding()
              return ws
            },
          }}
        />
      </div>
    </div>
  </React.StrictMode>
)

// Use createRoot for React 18+ (modern rendering API)
const container = document.getElementById('root')
const root = ReactDOMClient.createRoot(container)
root.render(<App />)
