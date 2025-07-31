# Visual Analyzer Server

This server component provides WebSocket connectivity for the NMEA 2000 Visual Analyzer, enabling real-time data streaming from various NMEA 2000 sources.

## Features

- **WebSocket Server**: Real-time data streaming to connected clients
- **Multiple Data Sources**: Support for SignalK, serial ports, and network sources
- **NMEA 2000 Parsing**: Integration with @canboat/canboatjs for data parsing
- **Static File Serving**: Serves the built Visual Analyzer web application
- **Production Ready**: Graceful shutdown, error handling, and logging

## Installation

The server dependencies are included in the main package.json. After running `npm install`, you'll have all necessary dependencies.

## Usage

### Basic Usage

1. Build the web application:
```bash
npm run build
```

2. Start the server:
```bash
npm run server
```

3. Access the application at `http://localhost:8080`

### Development Mode

Run both the webpack dev server and the WebSocket server:
```bash
npm run dev
```

This will:
- Start webpack in watch mode to rebuild on changes
- Start the WebSocket server for data streaming
- The web app will be available at `http://localhost:8080`

### Configuration

The server can be configured using environment variables:

#### Basic Configuration
- `PORT`: Server port (default: 8080)
- `PUBLIC_DIR`: Directory containing built web assets (default: ./public)

#### NMEA 2000 Data Sources

**SignalK Server:**
```bash
SIGNALK_URL=http://localhost:3000 npm run server
```

**Serial Port (NMEA 2000 Gateway):**
```bash
SERIAL_PORT=/dev/ttyUSB0 BAUD_RATE=115200 npm run server
```

**Network Source (TCP):**
```bash
NETWORK_HOST=192.168.1.100 NETWORK_PORT=2000 NETWORK_PROTOCOL=tcp npm run server
```

**Network Source (UDP):**
```bash
NETWORK_HOST=192.168.1.100 NETWORK_PORT=2000 NETWORK_PROTOCOL=udp npm run server
```

### Multiple Sources

You can configure multiple data sources simultaneously:
```bash
SIGNALK_URL=http://localhost:3000 \
SERIAL_PORT=/dev/ttyUSB0 \
NETWORK_HOST=192.168.1.100 \
NETWORK_PORT=2000 \
npm run server
```

## API

### WebSocket Events

The server sends the following events to connected clients:

#### Data Events
- `canboatjs:rawoutput`: Raw NMEA 2000 data string
- `canboatjs:parsed`: Parsed NMEA 2000 data object
- `signalk:delta`: SignalK delta format data
- `canboatjs:synthetic`: Synthetic NMEA data generated from SignalK

#### Status Events
- `connection`: Initial connection confirmation
- `nmea:connected`: NMEA data source connected
- `nmea:disconnected`: NMEA data source disconnected
- `error`: Error messages

#### Client Commands
Clients can send these commands to the server:

**Subscribe to data:**
```json
{
  "type": "subscribe",
  "subscription": "nmea2000"
}
```

**Unsubscribe from data:**
```json
{
  "type": "unsubscribe",
  "subscription": "nmea2000"
}
```

## Data Sources

### SignalK Server
Connect to a SignalK server to receive NMEA 2000 data that has already been parsed and converted to SignalK format. The server will subscribe to all vessel data and convert relevant updates back to NMEA 2000 format for visualization.

### Serial Port
Connect directly to a serial NMEA 2000 gateway device (such as Actisense NGT-1) to receive raw NMEA 2000 data.

Supported devices:
- Actisense NGT-1
- NMEA 2000 to USB gateways
- Arduino-based gateways

### Network Sources
Connect to network-based NMEA 2000 data sources via TCP or UDP.

Examples:
- NMEA 2000 gateways with Ethernet connectivity
- WiFi-enabled marine electronics
- Network data loggers

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │◄──►│  WebSocket       │◄──►│  NMEA Provider  │
│   (Browser)     │    │  Server          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                        ┌──────────────────┐    ┌─────────────────┐
                        │  Static Files    │    │  Data Sources   │
                        │  (Web App)       │    │  • SignalK      │
                        └──────────────────┘    │  • Serial       │
                                                │  • Network      │
                                                └─────────────────┘
```

## Security Considerations

- The server currently runs without authentication
- When deploying in production, consider:
  - Adding authentication/authorization
  - Using HTTPS/WSS for encrypted connections
  - Firewall rules to restrict access
  - Rate limiting for WebSocket connections

## Troubleshooting

### No Data Received
1. Check that your data source is properly configured
2. Verify network connectivity to the data source
3. Check server logs for connection errors
4. Ensure the data source is sending NMEA 2000 format data

### Serial Port Issues
1. Verify the device is connected and recognized by the system
2. Check permissions on the serial device (may need to add user to dialout group on Linux)
3. Confirm the baud rate matches your device
4. Test the serial connection with a simple terminal program first

### WebSocket Connection Failed
1. Check that the server is running and accessible
2. Verify firewall settings
3. Check browser developer console for WebSocket errors
4. Ensure the port is not blocked or in use by another service

## Development

To extend the server with additional data sources or functionality:

1. **Adding New Data Sources**: Extend the `NMEADataProvider` class
2. **Custom Message Handling**: Modify the WebSocket message handlers in `server.js`
3. **Data Processing**: Add custom data processing logic in the provider event handlers

## License

This server component is licensed under the same terms as the Visual Analyzer project (Apache-2.0).
