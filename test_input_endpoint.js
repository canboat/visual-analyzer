#!/usr/bin/env node

const http = require('http')

// Start the server first
const VisualAnalyzerServer = require('./server/server')
const server = new VisualAnalyzerServer({ port: 8888 })

server.start()

// Wait a bit for server to start
setTimeout(() => {
  runTests()
}, 2000)

function runTests() {
  console.log('Testing /skServer/inputTest endpoint...\n')

  // Test 1: JSON object input
  const jsonTest = {
    value: {
      pgn: 127245,
      src: 204,
      dst: 255,
      timestamp: '2024-01-01T00:00:00.000Z',
      fields: {
        'Rudder': 0.5
      }
    },
    sendToN2K: false
  }

  // Test 2: JSON string input
  const jsonStringTest = {
    value: JSON.stringify({
      pgn: 127245,
      src: 204,
      dst: 255,
      timestamp: '2024-01-01T00:00:00.000Z',
      fields: {
        'Rudder': 0.5
      }
    }),
    sendToN2K: false
  }

  // Test 3: NMEA 2000 string input (Actisense format)
  const nmeaStringTest = {
    value: '2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff',
    sendToN2K: false
  }

  const tests = [
    { name: 'JSON Object Input', data: jsonTest },
    { name: 'JSON String Input', data: jsonStringTest },
    { name: 'NMEA 2000 String Input', data: nmeaStringTest }
  ]

  async function runTest(test) {
    console.log(`\n--- ${test.name} ---`)
    
    const postData = JSON.stringify(test.data)
    
    const options = {
      hostname: 'localhost',
      port: 8888,
      path: '/skServer/inputTest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          console.log('Status:', res.statusCode)
          console.log('Response:', data)
          try {
            const parsed = JSON.parse(data)
            if (parsed.parsedData) {
              console.log('Parsed PGN:', parsed.parsedData.pgn)
              console.log('Parsed Fields:', JSON.stringify(parsed.parsedData.fields, null, 2))
            }
          } catch (e) {
            // Response is not JSON
          }
          resolve()
        })
      })

      req.on('error', (err) => {
        console.error('Request error:', err)
        reject(err)
      })

      req.write(postData)
      req.end()
    })
  }

  // Run tests sequentially
  async function runAllTests() {
    for (const test of tests) {
      await runTest(test)
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay between tests
    }
    
    console.log('\n--- Tests completed ---')
    process.exit(0)
  }

  runAllTests().catch(console.error)
}

// Handle cleanup
process.on('SIGINT', () => {
  server.stop()
  process.exit(0)
})
