#!/usr/bin/env node

const http = require('http')

// Start the server first
const VisualAnalyzerServer = require('./server/server')
const server = new VisualAnalyzerServer({ port: 8889 })

server.start()

// Wait a bit for server to start
setTimeout(() => {
  runTests()
}, 2000)

function runTests() {
  console.log('Testing /skServer/inputTest endpoint with multi-line support...\n')

  // Test 1: Single line NMEA 2000 string
  const singleLineTest = {
    value: '2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff',
    sendToN2K: false
  }

  // Test 2: Multi-line NMEA 2000 strings
  const multiLineTest = {
    value: `2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff
2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff
2024-01-01T00:00:02.000Z,2,129026,204,255,8,ff,ff,00,00,ff,7f,ff,ff`,
    sendToN2K: false
  }

  // Test 3: Multi-line with empty lines and whitespace
  const multiLineWithWhitespaceTest = {
    value: `
2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff

2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff
   
2024-01-01T00:00:02.000Z,2,129026,204,255,8,ff,ff,00,00,ff,7f,ff,ff
`,
    sendToN2K: false
  }

  // Test 4: Mixed valid and invalid lines
  const mixedTest = {
    value: `2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff
invalid line that should be skipped
2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff`,
    sendToN2K: false
  }

  const tests = [
    { name: 'Single Line NMEA 2000', data: singleLineTest },
    { name: 'Multi-Line NMEA 2000', data: multiLineTest },
    { name: 'Multi-Line with Whitespace', data: multiLineWithWhitespaceTest },
    { name: 'Mixed Valid/Invalid Lines', data: mixedTest }
  ]

  async function runTest(test) {
    console.log(`\n--- ${test.name} ---`)
    
    const postData = JSON.stringify(test.data)
    
    const options = {
      hostname: 'localhost',
      port: 8889,
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
            if (parsed.results) {
              console.log(`Messages processed: ${parsed.messagesProcessed}`)
              console.log(`Messages transmitted: ${parsed.transmitted}`)
              console.log('PGNs parsed:', parsed.results.map(r => r.pgn).join(', '))
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
      await new Promise(resolve => setTimeout(resolve, 200)) // Small delay between tests
    }
    
    console.log('\n--- Multi-line tests completed ---')
    process.exit(0)
  }

  runAllTests().catch(console.error)
}

// Handle cleanup
process.on('SIGINT', () => {
  server.stop()
  process.exit(0)
})
