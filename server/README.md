# Visual Analyzer Server

This standalone server component provides WebSocket connectivity for the NMEA 2000 Visual Analyzer, enabling real-time data streaming from various NMEA 2000 sources. The server features a web-based configuration interface for managing connection profiles and supports multiple simultaneous data sources.

## Features

- **WebSocket Server**: Real-time bidirectional data streaming to connected clients
- **Web-based Configuration**: REST API and web interface for managing connection profiles
- **Multiple Data Sources**: Support for SignalK, serial devices, network sources, and SocketCAN
- **Device-Specific Support**: Optimized support for Actisense NGT-1, Digital Yacht iKonvert, and Yacht Devices gateways
- **NMEA 2000 Parsing**: Full integration with @canboat/canboatjs for comprehensive data parsing
- **Static File Serving**: Serves the built Visual Analyzer web application
- **Persistent Configuration**: JSON-based configuration with connection profiles
- **Production Ready**: Graceful shutdown, error handling, comprehensive logging, and auto-reconnection

## Installation

The server dependencies are included in the main package.json. After running `npm install`, you'll have all necessary dependencies.

## Usage

### Quick Start

1. Build the web application:
```bash
npm run build
```

2. Start the server:
```bash
npm run server
```

3. Access the application at `http://localhost:8080`

The server will start with a default configuration. You can create connection profiles through the web interface.

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

#### File-based Configuration

The server uses a `server/config.json` file for persistent configuration. The server will create this file automatically if it doesn't exist. Example configuration:

```json
{
  "server": {
    "port": 8080
  },
  "connections": {
    "activeConnection": "yacht-devices-tcp",
    "profiles": {
      "yacht-devices-tcp": {
        "name": "Yacht Devices TCP",
        "type": "network",
        "networkHost": "ydwg",
        "networkPort": 1457,
        "networkProtocol": "tcp",
        "deviceType": "Yacht Devices RAW"
      },
      "local-signalk": {
        "name": "Local SignalK Server", 
        "type": "signalk",
        "signalkUrl": "http://localhost:3000"
      },
      "actisense-usb": {
        "name": "Actisense NGT-1 USB",
        "type": "serial",
        "serialPort": "/dev/ttyUSB0",
        "baudRate": 115200,
        "deviceType": "Actisense"
      }
    }
  }
}
```

#### Environment Variables

Basic server configuration can be overridden with environment variables:
- `PORT`: Server port (default: 8080)
- `PUBLIC_DIR`: Directory containing built web assets (default: ./public)

#### Legacy Environment Variable Configuration

For backward compatibility, you can still configure data sources using environment variables (though the web interface is recommended):

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

The server supports multiple simultaneous data sources. You can configure multiple connection profiles and activate them through the web interface, or use multiple environment variables simultaneously for legacy configuration.

## Configuration Management

### Web Interface

The server provides a web-based configuration interface accessible at `http://localhost:8080`. Through this interface you can:

- **Create Connection Profiles**: Define multiple data source configurations
- **Activate Connections**: Switch between different data sources
- **Edit Profiles**: Modify existing connection settings
- **Delete Profiles**: Remove unused connection profiles
- **Monitor Status**: View connection status and data flow

### REST API

The server exposes a REST API for programmatic configuration management:

#### Configuration Endpoints
- `GET /api/config`: Get current server configuration
- `POST /api/config`: Update server configuration

#### Connection Profile Endpoints
- `GET /api/connections`: List all connection profiles
- `POST /api/connections`: Create a new connection profile  
- `DELETE /api/connections/:profileId`: Delete a connection profile
- `POST /api/connections/:profileId/activate`: Activate a connection profile
- `POST /api/restart-connection`: Restart the current active connection

#### SignalK Integration
- `POST /skServer/inputTest`: Test SignalK server connectivity

## WebSocket API

### Events Sent to Clients

The server sends the following events to connected WebSocket clients:

#### Data Events
- `canboatjs:rawoutput`: Raw NMEA 2000 data string
- `canboatjs:parsed`: Parsed NMEA 2000 data object with full field information
- `signalk:delta`: SignalK delta format data (when connected to SignalK)
- `canboatjs:synthetic`: Synthetic NMEA data generated from SignalK

#### Status Events
- `connection`: Initial connection confirmation with server information
- `nmea:connected`: NMEA data source connected successfully
- `nmea:disconnected`: NMEA data source disconnected
- `error`: Error messages and connection issues

#### Client Commands

Clients can send commands to the server via WebSocket:

**Subscribe to data stream:**
```json
{
  "type": "subscribe",
  "subscription": "nmea2000"
}
```

**Unsubscribe from data stream:**
```json
{
  "type": "unsubscribe", 
  "subscription": "nmea2000"
}
```

**Start heartbeat monitoring:**
```json
{
  "type": "startHeartbeat"
}
```

**Stop heartbeat monitoring:**
```json
{
  "type": "stopHeartbeat"
}
```

## Supported Data Sources

### SignalK Server
Connect to a SignalK server to receive NMEA 2000 data that has already been parsed and converted to SignalK format. The server will subscribe to all vessel data and can convert relevant updates back to NMEA 2000 format for visualization.

**Features:**
- WebSocket connection to SignalK server
- Automatic subscription to vessel data streams
- Bidirectional data conversion
- Real-time delta message processing

### Serial Devices
Connect directly to serial NMEA 2000 gateway devices to receive raw NMEA 2000 data with device-specific optimizations.

**Supported Devices:**
- **Actisense NGT-1**: Full support with ActisenseStream for optimal message handling
- **Digital Yacht iKonvert**: Specialized iKonvertStream with device-specific formatting
- **Yacht Devices YDWG-02**: Generic serial support with configurable delimiters
- **Arduino-based gateways**: Configurable support for custom implementations

**Features:**
- Device-specific stream processors
- Automatic baud rate detection
- Robust error handling and reconnection
- Custom delimiter support for different protocols

### Network Sources
Connect to network-based NMEA 2000 data sources via TCP or UDP with automatic reconnection.

**Supported Protocols:**
- **TCP**: Reliable connection for stable network sources
- **UDP**: Low-latency connection for broadcast data
- **Yacht Devices RAW format**: Native support for YDWG network gateways

**Examples:**
- NMEA 2000 gateways with Ethernet connectivity
- WiFi-enabled marine electronics
- Network data loggers and concentrators
- Yacht Devices YDWG-02 WiFi Gateway

### SocketCAN (Linux Only)
Direct connection to Linux SocketCAN interfaces for native CAN bus access.

**Features:**
- Native Linux CAN support
- Direct hardware interface access
- Low-level CAN frame processing
- Automatic interface detection

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │◄──►│  WebSocket       │◄──►│  Configuration  │
│   (Browser)     │    │  Server          │    │  Management     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                        ┌──────────────────┐    ┌─────────────────┐
                        │  Static Files    │    │  NMEA Provider  │
                        │  (Web App)       │    │  (Multi-source) │
                        └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Data Sources   │
                                                │  • SignalK      │
                                                │  • Serial       │
                                                │    - Actisense  │
                                                │    - iKonvert   │
                                                │    - YDWG       │
                                                │  • Network      │
                                                │    - TCP/UDP    │
                                                │  • SocketCAN    │
                                                └─────────────────┘
```

### Key Components

- **Express Server**: Serves static files and provides REST API
- **WebSocket Server**: Handles real-time bidirectional communication
- **NMEA Data Provider**: Manages connections to various NMEA 2000 sources
- **Configuration Manager**: Persistent storage and management of connection profiles
- **Device-Specific Streams**: Optimized processors for different hardware types

## Security Considerations

- The server currently runs without authentication for local development
- When deploying in production, consider:
  - Adding authentication/authorization for the configuration API
  - Using HTTPS/WSS for encrypted connections
  - Firewall rules to restrict access to trusted networks only
  - Rate limiting for WebSocket connections
  - Input validation for configuration data
  - Securing the config.json file with appropriate file permissions

## Troubleshooting

### No Data Received
1. **Check Connection Status**: Use the web interface to verify your data source is connected
2. **Verify Data Source**: Ensure your NMEA 2000 source is actively transmitting data
3. **Network Connectivity**: Test network connectivity to remote data sources
4. **Check Server Logs**: Review console output for connection errors and status messages
5. **Device Compatibility**: Verify your device type is correctly configured in the connection profile

### Serial Port Issues
1. **Device Recognition**: Verify the device is connected and recognized by the system (`ls /dev/tty*` on Linux/macOS)
2. **Permissions**: Check permissions on the serial device
   - Linux: Add user to `dialout` group: `sudo usermod -a -G dialout $USER`
   - macOS: Check device ownership and permissions
3. **Device Configuration**: Confirm baud rate and device type match your hardware
4. **Test Connection**: Use a terminal program (screen, minicom) to test basic serial communication
5. **USB Driver**: Ensure proper USB drivers are installed for your device

### WebSocket Connection Issues
1. **Server Status**: Verify the server is running and accessible at the configured port
2. **Firewall Settings**: Check that the port is not blocked by firewall rules
3. **Browser Console**: Check browser developer console for WebSocket error messages
4. **Port Conflicts**: Ensure the port is not in use by another service (`lsof -i :8080`)
5. **Network Configuration**: Verify network routing if accessing remotely

### Configuration Problems
1. **File Permissions**: Ensure the server can read/write to the config.json file
2. **JSON Validation**: Verify config.json syntax is valid JSON
3. **Profile Validation**: Check that all required fields are present in connection profiles
4. **Path Issues**: Verify file paths are correct and accessible

### Performance Issues
1. **Data Rate**: Monitor incoming data rate - very high-frequency sources may need filtering
2. **WebSocket Backpressure**: Check for WebSocket message queuing in high-data scenarios
3. **Memory Usage**: Monitor server memory usage with high-frequency data streams
4. **Client Processing**: Ensure client-side code can keep up with data rate

## Development

### Extending the Server

To extend the server with additional functionality:

1. **Adding New Data Sources**: 
   - Extend the `NMEADataProvider` class in `nmea-provider.js`
   - Add connection logic for your specific data source type
   - Implement proper error handling and reconnection logic

2. **Custom Message Processing**: 
   - Modify WebSocket message handlers in `server.js`
   - Add new client command types and responses
   - Implement custom data filtering or transformation

3. **Configuration Extensions**:
   - Add new configuration options to the config schema
   - Update the REST API endpoints to handle new settings
   - Extend the web interface to manage new options

4. **Device-Specific Support**:
   - Add device-specific stream processors to `nmea-provider.js`
   - Implement custom message formatting functions
   - Add device detection and auto-configuration logic

### Code Structure

```
server/
├── index.js           # Entry point and process management
├── server.js          # Express server and WebSocket handling
├── nmea-provider.js   # Data source connection management
├── config.json        # Runtime configuration (created automatically)
└── README.md          # This documentation
```

### Testing

1. **Manual Testing**: Use the web interface to test different connection types
2. **API Testing**: Use curl or Postman to test the REST API endpoints
3. **WebSocket Testing**: Use browser developer tools or WebSocket testing tools
4. **Data Source Testing**: Verify compatibility with your specific NMEA 2000 hardware

## Version History

- **v1.2.0**: Added web-based configuration, connection profiles, REST API
- **v1.1.0**: Added device-specific support, SocketCAN integration
- **v1.0.0**: Initial standalone server implementation

## License

This server component is licensed under the Apache-2.0 license, same as the Visual Analyzer project.
