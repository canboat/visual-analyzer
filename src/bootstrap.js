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
      }
    }

    // Simulate some sample NMEA 2000 data after a short delay
    setTimeout(() => {
      if (mockWs.onmessage) {
        const sampleData = {
          data: JSON.stringify({
            event: 'canboatjs:rawoutput',
            data: '2024-01-01T00:00:00.000Z,2,127251,1,255,8,ff,ff,ff,ff,7f,ff,ff,ff'
          })
        }
        mockWs.onmessage(sampleData)
      }
    }, 1000)

    return mockWs
  }
}

// Render the AppPanel with mock props
ReactDOM.render(
  <React.StrictMode>
    <div className="container-fluid mt-3">
      <AppPanel adminUI={mockAdminUI} />
    </div>
  </React.StrictMode>,
  document.getElementById('root')
)
