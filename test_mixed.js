#!/usr/bin/env node

const http = require('http')

// Start the server first
const VisualAnalyzerServer = require('./server/server')
const server = new VisualAnalyzerServer({ port: 8890 })

server.start()

// Wait a bit for server to start
setTimeout(() => {
  runTest()
}, 2000)

function runTest() {
  console.log('Testing mixed valid/invalid lines...\n')

  // Test with mixed valid and invalid lines
  const mixedTest = {
    value: `2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff
invalid line that should be skipped
another invalid line
2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff
# comment line
2024-01-01T00:00:02.000Z,2,129026,204,255,8,ff,ff,00,00,ff,7f,ff,ff`,
    sendToN2K: false
  }

  async function runTest() {
    console.log('--- Mixed Valid/Invalid Lines Test ---')
    
    const postData = JSON.stringify(mixedTest)
    
    const options = {
      hostname: 'localhost',
      port: 8890,
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
              console.log('PGNs parsed:', parsed.results.map(r => r.pgn).join(', '))
            }
          } catch (e) {
            // Response is not JSON
          }
          
          console.log('\n--- Test completed ---')
          process.exit(0)
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

  runTest().catch(console.error)
}

// Handle cleanup
process.on('SIGINT', () => {
  server.stop()
  process.exit(0)
})
