# InputTest Service Documentation

This document describes the centralized InputTest service for handling all communications with the SignalK server's `/skServer/inputTest` endpoint.

## Overview

The `InputTestService` consolidates all POST requests to `/skServer/inputTest` into a single, reusable service that provides:

- **Centralized error handling** and retry logic
- **Type-safe interfaces** for request/response data
- **Progress tracking** for long-running operations
- **Timeout management** and connection validation
- **Message validation** before sending
- **Specialized methods** for common use cases (metadata requests, message sending)

## Usage

### Basic Import

```typescript
import { inputTestService } from '../services/inputTestService'

// Or for type definitions
import { InputTestRequest, InputTestResponse, SendOptions } from '../services/inputTestService'
```

### Sending a Single Message

```typescript
try {
  const result = await inputTestService.sendMessage(
    '2023-10-15T10:30:00.000Z,2,127251,17,255,8,00,f8,04,01,ff,ff,00,00',
    {
      timeout: 10000, // Optional: 10 second timeout
      retries: 1, // Optional: retry once on failure
      onProgress: (message) => console.log(message), // Optional: progress callback
    },
  )

  console.log('Message sent successfully:', result)
} catch (error) {
  console.error('Failed to send message:', error.message)
}
```

### Requesting Metadata

```typescript
// Single metadata request
try {
  const pgn = new PGN_59904({ pgn: 60928 }, 255) // Request PGN 60928 from destination 255
  const pgnData = JSON.stringify(pgn)

  const result = await inputTestService.sendMetadataRequest(pgnData, 255, {
    timeout: 5000,
    onProgress: (message) => console.log(message),
  })

  console.log('Metadata request completed:', result)
} catch (error) {
  console.error('Metadata request failed:', error.message)
}
```

### Multiple Metadata Requests

```typescript
// Multiple metadata requests (used by AppPanel for device discovery)
try {
  const infoPGNS = [60928, 126998, 126996]
  const pgnDataList = infoPGNS.map((num) => {
    const pgn = new PGN_59904({ pgn: num }, 255)
    return JSON.stringify(pgn)
  })

  const results = await inputTestService.sendMultipleMetadataRequests(pgnDataList, 255, {
    timeout: 5000,
    retries: 1,
    onProgress: (message) => console.log(message),
  })

  console.log(`Completed ${results.length} metadata requests`)
} catch (error) {
  console.error('Metadata requests failed:', error.message)
}
```

### Service Availability Check

```typescript
const isAvailable = await inputTestService.isServiceAvailable()
if (isAvailable) {
  console.log('InputTest service is available')
} else {
  console.warn('InputTest service is not available')
}
```

## API Reference

### Methods

#### `send(data: InputTestRequest, options?: SendOptions): Promise<InputTestResponse>`

Low-level method for sending data to the inputTest endpoint.

**Parameters:**

- `data`: Request data containing message value and sendToN2K flag
- `options`: Optional configuration for timeout, retries, and progress tracking

**Returns:** Promise resolving to server response

#### `sendMessage(message: string, options?: SendOptions): Promise<InputTestResponse>`

Send a raw NMEA message in any supported format (Actisense, YDRAW, JSON, etc.).

**Parameters:**

- `message`: Raw NMEA message string
- `options`: Optional configuration

**Returns:** Promise resolving to server response

#### `sendMetadataRequest(pgnData: string, destination: number, options?: SendOptions): Promise<InputTestResponse>`

Send a PGN message for metadata request.

**Parameters:**

- `pgnData`: Serialized PGN data (usually JSON.stringify of PGN object)
- `destination`: Destination address for the request
- `options`: Optional configuration

**Returns:** Promise resolving to server response

#### `sendMultipleMetadataRequests(pgnDataList: string[], destination: number, options?: SendOptions): Promise<InputTestResponse[]>`

Send multiple PGN requests (typically for metadata discovery).

**Parameters:**

- `pgnDataList`: Array of PGN data strings
- `destination`: Destination address
- `options`: Optional configuration

**Returns:** Promise resolving to array of responses

#### `isServiceAvailable(): Promise<boolean>`

Check if the service endpoint is available.

**Returns:** Promise resolving to true if service is available

### Interfaces

#### `InputTestRequest`

```typescript
interface InputTestRequest {
  value: string // The message content
  sendToN2K: boolean // Whether to send to NMEA 2000 network
}
```

#### `InputTestResponse`

```typescript
interface InputTestResponse {
  error?: string // Error message if request failed
  [key: string]: any // Additional response data
}
```

#### `SendOptions`

```typescript
interface SendOptions {
  timeout?: number // Request timeout in milliseconds (default: 10000)
  retries?: number // Number of retry attempts (default: 0)
  onProgress?: (message: string) => void // Progress callback function
}
```

## Error Handling

The service provides comprehensive error handling:

1. **Network Errors**: Connection failures, timeouts, and HTTP errors
2. **Validation Errors**: Invalid message formats detected before sending
3. **Server Errors**: Error responses from the SignalK server
4. **Retry Logic**: Configurable retry attempts with exponential backoff

### Common Error Types

- `Request timed out after Xms`: Request exceeded timeout limit
- `Send failed (XXX): error details`: HTTP error response from server
- `Message cannot be empty`: Validation error for empty messages
- `Invalid JSON format`: JSON parsing/validation error
- `JSON message must contain at least pgn and src fields`: Missing required JSON fields

## Message Format Support

The service supports all formats handled by canboatjs:

### JSON Format

```json
{
  "pgn": 127251,
  "src": 17,
  "dst": 255,
  "fields": {
    "rateOfTurn": 0.0
  }
}
```

### JSON Array Format

```json
[
  { "pgn": 127251, "src": 17, "fields": { "rateOfTurn": 0.0 } },
  { "pgn": 127250, "src": 17, "fields": { "heading": 1.5708 } }
]
```

### Actisense Format

```
2023-10-15T10:30:00.000Z,2,127251,17,255,8,00,f8,04,01,ff,ff,00,00
```

### YDRAW Format

```
!PDGY,127251,0,17,255,00f80401ffff0000
```

And other formats supported by canboatjs.

## Migration from Direct fetch() Calls

### Before (Direct fetch)

```typescript
const body = { value: JSON.stringify(pgn), sendToN2K: true }
fetch('/skServer/inputTest', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
  .then((response) => response.json())
  .then((data) => {
    if (data.error) {
      console.error('Error:', data.error)
    }
  })
  .catch((error) => {
    console.error('Request failed:', error)
  })
```

### After (Centralized service)

```typescript
try {
  const result = await inputTestService.sendMetadataRequest(JSON.stringify(pgn), destination, {
    timeout: 5000,
    retries: 1,
    onProgress: (msg) => console.log(msg),
  })
  console.log('Success:', result)
} catch (error) {
  console.error('Error:', error.message)
}
```

## Benefits

1. **Consistency**: All inputTest communications use the same error handling and retry logic
2. **Maintainability**: Changes to communication logic only need to be made in one place
3. **Reliability**: Built-in timeout, retry, and error handling
4. **Type Safety**: TypeScript interfaces prevent common mistakes
5. **Debugging**: Centralized logging and progress tracking
6. **Testing**: Easier to mock and test inputTest operations

## Components Using This Service

- **AppPanel**: Uses `sendMultipleMetadataRequests()` for device discovery
- **SendTab**: Uses `sendMessage()` for raw NMEA message transmission
- **Future components**: Can easily integrate the same reliable communication patterns

## Testing

The service can be easily mocked for testing:

```typescript
// Mock the service
jest.mock('../services/inputTestService', () => ({
  inputTestService: {
    sendMessage: jest.fn(),
    sendMetadataRequest: jest.fn(),
    sendMultipleMetadataRequests: jest.fn(),
    isServiceAvailable: jest.fn(),
  },
}))

// In your test
import { inputTestService } from '../services/inputTestService'
const mockSendMessage = inputTestService.sendMessage as jest.MockedFunction<typeof inputTestService.sendMessage>

mockSendMessage.mockResolvedValue({ success: true })
```
