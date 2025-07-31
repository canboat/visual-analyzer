import React from 'react'
import ReactDOM from 'react-dom'
import AppPanel from './components/AppPanel'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'

// Mock adminUI for standalone usage
const mockAdminUI = {
  openWebsocket: (options) => {
    console.log('Mock WebSocket - would connect with options:', options)

    // Create a mock WebSocket that simulates some data
    const mockWs = {
      onmessage: null,
      send: (data) => {
        console.log('Mock WebSocket - would send:', data)
      },
      close: () => {
        console.log('Mock WebSocket - would close')
      },
    }

    // Simulate some sample NMEA 2000 data after a short delay
    setTimeout(() => {
      if (mockWs.onmessage) {
        const sampleData = {
          data: JSON.stringify({
            event: 'canboatjs:rawoutput',
            data: '2024-01-01T00:00:00.000Z,2,127251,1,255,8,ff,ff,ff,ff,7f,ff,ff,ff',
          }),
        }
        mockWs.onmessage(sampleData)
      }
    }, 1000)

    return mockWs
  },
}

// Render the AppPanel with mock props
ReactDOM.render(
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
            📡 NMEA 2000 Visual Analyzer
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
        <AppPanel adminUI={mockAdminUI} />
      </div>
    </div>
  </React.StrictMode>,
  document.getElementById('root'),
)
