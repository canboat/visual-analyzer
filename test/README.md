# Visual Analyzer Tests

This directory contains the test suite for the Visual Analyzer server functionality.

## Running Tests

To run all tests:

```bash
npm test
```

To run tests with verbose output:

```bash
npm test -- --reporter spec
```

To run a specific test file:

```bash
npx mocha test/server.test.js
```

## Test Structure

### `/skServer/inputTest` Endpoint Tests

The main test suite covers the following functionality:

#### JSON Input Handling

- Direct JSON object input
- JSON string input (JSON encoded as string)

#### NMEA 2000 String Input Handling

- Single line NMEA 2000 format parsing
- Multi-line NMEA 2000 format parsing
- Whitespace and empty line handling
- Mixed valid/invalid line handling with graceful error recovery

#### Error Handling

- Missing required fields
- Unsupported input types
- Completely unparseable input
- Empty input validation

#### Transmission Behavior

- No transmission when `sendToN2K` is false
- No transmission when no NMEA provider is active
- Proper error reporting for transmission failures

#### Response Format Validation

- Correct response structure
- Proper result array formatting
- Complete parsed data inclusion

## Test Dependencies

- **Mocha**: Test framework
- **Chai**: Assertion library

## Coverage

The tests cover:

- ✅ All input formats (JSON object, JSON string, NMEA 2000 strings)
- ✅ Multi-line input processing
- ✅ Error handling and validation
- ✅ Response format verification
- ✅ Transmission logic (when no active NMEA connection)

## Notes

- Tests use port 8891 to avoid conflicts with development servers
- Each test starts a fresh server instance
- Tests include proper cleanup and server shutdown
- All tests have a 10-second timeout to handle server startup/shutdown
