const { expect } = require('chai')
const http = require('http')
const VisualAnalyzerServer = require('../dist/server.js').default

describe('Visual Analyzer Server', function () {
  let server
  const testPort = 8891

  before(function (done) {
    // Create server instance for testing
    server = new VisualAnalyzerServer(testPort)
    server.start()

    // Wait for server to start
    setTimeout(done, 1000)
  })

  after(function (done) {
    if (server) {
      server.stop()
      setTimeout(done, 500)
    } else {
      done()
    }
  })

  describe('/skServer/inputTest endpoint', function () {
    describe('JSON input handling', function () {
      it('should handle direct JSON object input', function (done) {
        const testData = {
          value: {
            pgn: 127245,
            src: 204,
            dst: 255,
            timestamp: '2024-01-01T00:00:00.000Z',
            fields: {
              Rudder: 0.5,
            },
          },
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.messagesProcessed).to.equal(1)
          expect(result.results).to.have.length(1)
          expect(result.results[0].pgn).to.equal(127245)
          expect(result.results[0].parsedData.fields.Rudder).to.equal(0.5)
          done()
        })
      })

      it('should handle JSON string input', function (done) {
        const testData = {
          value: JSON.stringify({
            pgn: 127245,
            src: 204,
            dst: 255,
            timestamp: '2024-01-01T00:00:00.000Z',
            fields: {
              Rudder: 0.5,
            },
          }),
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.messagesProcessed).to.equal(1)
          expect(result.results).to.have.length(1)
          expect(result.results[0].pgn).to.equal(127245)
          done()
        })
      })
    })

    describe('NMEA 2000 string input handling', function () {
      it('should handle single line NMEA 2000 string', function (done) {
        const testData = {
          value: '2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff',
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.messagesProcessed).to.equal(1)
          expect(result.results).to.have.length(1)
          expect(result.results[0].pgn).to.equal(127245)
          expect(result.results[0].parsedData).to.have.property('description', 'Rudder')
          done()
        })
      })

      it('should handle multiple lines of NMEA 2000 strings', function (done) {
        const testData = {
          value: `2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff
2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff
2024-01-01T00:00:02.000Z,2,129026,204,255,8,ff,ff,00,00,ff,7f,ff,ff`,
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.messagesProcessed).to.equal(3)
          expect(result.results).to.have.length(3)

          const pgns = result.results.map((r) => r.pgn)
          expect(pgns).to.include.members([127245, 127250, 129026])

          expect(result.results[0].parsedData.description).to.equal('Rudder')
          expect(result.results[1].parsedData.description).to.equal('Vessel Heading')
          expect(result.results[2].parsedData.description).to.equal('COG & SOG, Rapid Update')
          done()
        })
      })

      it('should handle multiline input with whitespace and empty lines', function (done) {
        const testData = {
          value: `
2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff

2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff
   
2024-01-01T00:00:02.000Z,2,129026,204,255,8,ff,ff,00,00,ff,7f,ff,ff
`,
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.messagesProcessed).to.equal(3)
          expect(result.results).to.have.length(3)

          const pgns = result.results.map((r) => r.pgn)
          expect(pgns).to.include.members([127245, 127250, 129026])
          done()
        })
      })

      it('should gracefully handle mixed valid and invalid lines', function (done) {
        const testData = {
          value: `2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff
invalid line that should be skipped
another invalid line
2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff
# comment line
2024-01-01T00:00:02.000Z,2,129026,204,255,8,ff,ff,00,00,ff,7f,ff,ff`,
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.messagesProcessed).to.equal(3)
          expect(result.results).to.have.length(3)

          const pgns = result.results.map((r) => r.pgn)
          expect(pgns).to.include.members([127245, 127250, 129026])
          done()
        })
      })
    })

    describe('Error handling', function () {
      it('should return error for missing value field', function (done) {
        const testData = {
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(400)

          const result = JSON.parse(body)
          expect(result.success).to.be.false
          expect(result.error).to.equal('Missing required field: value')
          done()
        })
      })

      it('should return error for unsupported value type', function (done) {
        const testData = {
          value: 12345, // number instead of string or object
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(400)

          const result = JSON.parse(body)
          expect(result.success).to.be.false
          expect(result.error).to.equal('Value must be a string (JSON or NMEA 2000 format) or object')
          done()
        })
      })

      it('should return error when no valid lines can be parsed', function (done) {
        const testData = {
          value: `invalid line 1
invalid line 2
# comment only`,
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(400)

          const result = JSON.parse(body)
          expect(result.success).to.be.false
          expect(result.error).to.equal('Unable to parse any NMEA 2000 strings from input')
          done()
        })
      })

      it('should return error for empty input after filtering', function (done) {
        const testData = {
          value: `
   
\t\t
`,
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(400)

          const result = JSON.parse(body)
          expect(result.success).to.be.false
          expect(result.error).to.equal('No valid lines found in input')
          done()
        })
      })
    })

    describe('Transmission behavior', function () {
      it('should indicate no transmission when sendToN2K is false', function (done) {
        const testData = {
          value: '2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff',
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.transmitted).to.equal(0)
          expect(result.results[0].transmitted).to.be.false
          done()
        })
      })

      it('should indicate no transmission when sendToN2K is true but no NMEA provider', function (done) {
        const testData = {
          value: '2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff',
          sendToN2K: true,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)
          expect(result.success).to.be.true
          expect(result.transmitted).to.equal(0)
          expect(result.results[0].transmitted).to.be.false
          expect(result.results[0].error).to.equal('No active NMEA connection')
          done()
        })
      })
    })

    describe('Response format validation', function () {
      it('should return correctly structured response', function (done) {
        const testData = {
          value: `2024-01-01T00:00:00.000Z,2,127245,204,255,8,fc,f8,ff,7f,ff,7f,ff,ff
2024-01-01T00:00:01.000Z,2,127250,204,255,8,00,fc,ff,ff,ff,ff,ff,ff`,
          sendToN2K: false,
        }

        makeRequest(testData, (err, response, body) => {
          expect(err).to.be.null
          expect(response.statusCode).to.equal(200)

          const result = JSON.parse(body)

          // Check top-level response structure
          expect(result).to.have.property('success', true)
          expect(result).to.have.property('message')
          expect(result).to.have.property('messagesProcessed', 2)
          expect(result).to.have.property('transmitted', 0)
          expect(result).to.have.property('results')

          // Check results array structure
          expect(result.results).to.be.an('array').with.length(2)

          result.results.forEach((resultItem) => {
            expect(resultItem).to.have.property('pgn')
            expect(resultItem).to.have.property('transmitted')
            expect(resultItem).to.have.property('parsedData')
            expect(resultItem.parsedData).to.have.property('pgn')
            expect(resultItem.parsedData).to.have.property('fields')
            expect(resultItem.parsedData).to.have.property('description')
          })

          done()
        })
      })
    })
  })

  // Helper function to make HTTP requests
  function makeRequest(data, callback) {
    const postData = JSON.stringify(data)

    const options = {
      hostname: 'localhost',
      port: testPort,
      path: '/skServer/inputTest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        callback(null, res, body)
      })
    })

    req.on('error', (err) => {
      callback(err)
    })

    req.write(postData)
    req.end()
  }
})
