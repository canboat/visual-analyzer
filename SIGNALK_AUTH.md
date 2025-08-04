# SignalK Authentication Implementation

This implementation adds SignalK authentication support to the Visual Analyzer's NMEA Data Provider, following the [SignalK Security Specification v1.7.0](https://signalk.org/specification/1.7.0/doc/security.html).

## Features

- **WebSocket-based Authentication**: Uses the existing WebSocket connection instead of separate HTTP requests
- **Automatic Token Management**: Handles token renewal automatically before expiration
- **Graceful Fallback**: Works with both authenticated and non-authenticated SignalK servers
- **Token Validation**: Validates and renews tokens as needed
- **Proper Logout**: Sends logout messages when disconnecting

## Configuration

Add authentication credentials to your SignalK connection profile in `config.json`:

```json
{
  "connections": {
    "profiles": {
      "my-signalk-server": {
        "name": "My SignalK Server",
        "type": "signalk",
        "signalkUrl": "http://localhost:3000",
        "signalkUsername": "your-username",
        "signalkPassword": "your-password"
      }
    }
  }
}
```

## Authentication Flow

1. **Connection**: WebSocket connects to SignalK server
2. **Authentication**: If credentials are provided, sends login message:
   ```json
   {
     "requestId": "auth-1",
     "login": {
       "username": "your-username",
       "password": "your-password"
     }
   }
   ```
3. **Token Storage**: Stores received token and expiry time
4. **Token Renewal**: Automatically renews token 5 minutes before expiry
5. **Message Authentication**: Includes token in outgoing messages for authenticated connections
6. **Logout**: Sends logout message when disconnecting

## Authentication Status

The system exposes authentication status through the WebSocket API:

```json
{
  "event": "nmea:connected",
  "timestamp": "2025-08-04T12:00:00.000Z",
  "auth": {
    "isAuthenticated": true,
    "hasToken": true,
    "tokenExpiry": 1722772800000,
    "timeUntilExpiry": 86400000
  }
}
```

## Error Handling

- **No Credentials**: Connects without authentication (works with open servers)
- **Invalid Credentials**: Logs error and continues with unauthenticated connection
- **Token Expiry**: Automatically attempts renewal
- **Network Issues**: Gracefully handles connection drops and reconnects

## Security Considerations

- Credentials are stored in configuration files - ensure proper file permissions
- Tokens are kept in memory only and cleared on disconnect
- Uses secure WebSocket connections when available (wss://)
- Follows SignalK security specification for token handling

## Testing

To test authentication, you can:

1. Set up a SignalK server with authentication enabled
2. Configure valid credentials in the connection profile
3. Monitor console logs for authentication status
4. Check WebSocket messages for authentication events

## Troubleshooting

- **Authentication Timeout**: Check network connectivity and server response
- **Invalid Credentials**: Verify username/password in configuration
- **Token Renewal Failures**: Check server logs for token validation issues
- **Connection Drops**: Authentication will retry on reconnection
