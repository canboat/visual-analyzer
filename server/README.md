# Visual Analyzer Server

This server component provides WebSocket connectivity for the NMEA 2000 Visual Analyzer, enabling real-time data streaming from various NMEA 2000 sources. The Visual Analyzer can operate in two modes:

## Operating Modes

### Standalone Mode (Full Featured)

When run independently, the Visual Analyzer server provides complete functionality including:

- **Web-based Configuration**: Full REST API and web interface for managing connection profiles
- **Multiple Data Sources**: Direct support for SignalK, serial devices, network sources, and SocketCAN
- **Connection Management**: Create, edit, and manage multiple connection profiles
- **Static File Serving**: Serves the built Visual Analyzer web application
- **Persistent Configuration**: JSON-based configuration with connection profiles

### Embedded Mode (Signal K Plugin)

When embedded in Signal K Server as a plugin, some features are managed by the host server:

- **Data Source**: Uses Signal K Server's existing NMEA 2000 data connections _(connection management not available)_
- **Authentication**: Uses Signal K Server's authentication system _(no separate auth required)_
- **Web Interface**: Served through Signal K's plugin system _(no standalone web server)_

### Choosing the Right Mode

**Use Standalone Mode when:**

- You need direct control over NMEA 2000 connections
- You want to run Visual Analyzer independently of Signal K Server
- You need file playback capabilities
- You prefer a dedicated web interface for Visual Analyzer
- You're developing or debugging NMEA 2000 connections

**Use Embedded Mode when:**

- You already have Signal K Server running
- You want to leverage Signal K's connection management
- You prefer a unified web interface through Signal K
- You want to benefit from Signal K's security and authentication
- You're using other Signal K plugins and webapps

## Core Features (Available in Both Modes)

- **WebSocket Server**: Real-time bidirectional data streaming to connected clients
- **Device-Specific Support**: Optimized support for Actisense NGT-1, Digital Yacht iKonvert, and Yacht Devices gateways
- **NMEA 2000 Parsing**: Full integration with @canboat/canboatjs for comprehensive data parsing
- **Production Ready**: Graceful shutdown, error handling, comprehensive logging, and auto-reconnection

## Installation

### For Standalone Mode

The server dependencies are included in the main package.json. After running `npm install`, you'll have all necessary dependencies.

### For Embedded Mode (Signal K Plugin)

Install through Signal K Server's App Store or via npm:

```bash
npm install @canboat/visual-analyzer
```

The Visual Analyzer will be available as an embeddable webapp in Signal K Server's web interface.

## Usage

### Standalone Mode - Quick Start

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

### Embedded Mode (Signal K Plugin)

When used as a Signal K plugin:

1. Install via Signal K Server's App Store
2. Access through Signal K's web interface under Web Apps
3. Data connection is automatically provided by Signal K Server
4. No additional configuration needed - uses Signal K's existing NMEA 2000 connections

> **Note**: Configuration management features are not available in embedded mode as data sources are managed by Signal K Server.

### Development Mode (Standalone Only)

Run both the webpack dev server and the WebSocket server:

```bash
npm run dev
```

This will:

- Start webpack in watch mode to rebuild on changes
- Start the WebSocket server for data streaming
- The web app will be available at `http://localhost:8080`

> **Note**: Development mode is only available in standalone mode. For Signal K plugin development, use Signal K's development environment.

### Configuration (Standalone Mode Only)

> **Important**: Configuration management is only available in standalone mode. When embedded in Signal K Server, data sources are managed through Signal K's connection configuration.

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

#### Environment Variables (Standalone Mode)

Basic server configuration can be overridden with environment variables:

- `VISUAL_ANALYZER_PORT`: Server port (default: 8080)
- `VISUAL_ANALYZER_CONFIG`: Config file location


### Multiple Sources (Standalone Mode Only)

The server supports multiple simultaneous data sources. You can configure multiple connection profiles and activate them through the web interface, or use multiple environment variables simultaneously for legacy configuration.

> **Note**: In embedded mode, data sources are managed by Signal K Server's connection configuration.

## Configuration Management (Standalone Mode Only)

> **Important**: Configuration management features are only available in standalone mode. When embedded in Signal K Server, configuration is handled through Signal K's admin interface.

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

### Connection Behavior by Mode

#### Standalone Mode

- Direct WebSocket connection to the Visual Analyzer server
- Full control over data subscription and connection management
- Custom WebSocket protocol for configuration and data streaming

#### Embedded Mode

- Uses Signal K Server's WebSocket connection
- Integrates with Signal K's streaming API
- Data provided through Signal K's delta message system

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

#### Client Commands (Standalone Mode Only)

Clients can send commands to the server via WebSocket when in standalone mode:

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

> **Note**: In embedded mode, these commands are handled by Signal K Server's WebSocket protocol.

## Supported Data Sources

### Data Source Availability by Mode

| Data Source Type | Standalone Mode           | Embedded Mode                   |
| ---------------- | ------------------------- | ------------------------------- |
| SignalK Server   | ✅ Direct connection      | ✅ Automatic (host server)      |
| Serial Devices   | ✅ Direct hardware access | ✅ Through Signal K connections |
| Network Sources  | ✅ Direct TCP/UDP         | ✅ Through Signal K connections |
| SocketCAN        | ✅ Direct CAN interface   | ✅ Through Signal K connections |
| File Playback    | ✅ Direct file access     | ❌ Not available                |

> **Note**: When embedded in Signal K Server, all NMEA 2000 data sources are managed through Signal K's connection configuration. The Visual Analyzer receives data through Signal K's unified data model.

### SignalK Server

**Standalone Mode**: Connect to a SignalK server to receive NMEA 2000 data that has already been parsed and converted to SignalK format. The server will subscribe to all vessel data and can convert relevant updates back to NMEA 2000 format for visualization.

**Embedded Mode**: Automatically receives data from the host Signal K Server's unified data model without requiring separate configuration.

**Features:**

- WebSocket connection to SignalK server
- Automatic subscription to vessel data streams
- Bidirectional data conversion
- Real-time delta message processing

### Serial Devices

**Standalone Mode**: Connect directly to serial NMEA 2000 gateway devices to receive raw NMEA 2000 data with device-specific optimizations.

**Embedded Mode**: Serial devices are configured through Signal K Server's connection management. The Visual Analyzer receives the parsed data through Signal K's data model.

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

**Standalone Mode**: Connect to network-based NMEA 2000 data sources via TCP or UDP with automatic reconnection.

**Embedded Mode**: Network sources are configured through Signal K Server's connection management.

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

**Standalone Mode**: Direct connection to Linux SocketCAN interfaces for native CAN bus access.

**Embedded Mode**: SocketCAN interfaces are configured through Signal K Server's connection management.

**Features:**

- Native Linux CAN support
- Direct hardware interface access
- Low-level CAN frame processing
- Automatic interface detection

## Architecture

### Standalone Mode Architecture

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
                                                │  • File Input   │
                                                └─────────────────┘
```

### Embedded Mode Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │◄──►│   Signal K       │◄──►│   Signal K      │
│   (Browser)     │    │   WebSocket      │    │   Data Model    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                        ┌──────────────────┐    ┌─────────────────┐
                        │  Visual Analyzer │    │ SK Connections  │
                        │  Embedded App    │    │  Management     │
                        └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Data Sources   │
                                                │  • Serial       │
                                                │  • Network      │
                                                │  • SocketCAN    │
                                                │  • File Input   │
                                                │  • Other SK     │
                                                │    Providers    │
                                                └─────────────────┘
```

### Key Components

#### Standalone Mode

- **Express Server**: Serves static files and provides REST API
- **WebSocket Server**: Handles real-time bidirectional communication
- **NMEA Data Provider**: Manages connections to various NMEA 2000 sources
- **Configuration Manager**: Persistent storage and management of connection profiles
- **Device-Specific Streams**: Optimized processors for different hardware types

#### Embedded Mode

- **Signal K Integration**: Leverages Signal K Server's WebSocket and data management
- **Embedded Web App**: Runs within Signal K's web interface framework
- **Data Stream Adapter**: Converts Signal K delta messages to Visual Analyzer format
- **Authentication Integration**: Uses Signal K Server's authentication system

## Security Considerations

### Standalone Mode

- The server currently runs without authentication for local development
- When deploying in production, consider:
  - Adding authentication/authorization for the configuration API
  - Using HTTPS/WSS for encrypted connections
  - Firewall rules to restrict access to trusted networks only
  - Rate limiting for WebSocket connections
  - Input validation for configuration data
  - Securing the config.json file with appropriate file permissions

### Embedded Mode

- Security is managed by the host Signal K Server
- Inherits Signal K Server's authentication and authorization system
- Benefits from Signal K's security features including:
  - User authentication and access control
  - HTTPS/WSS support
  - Role-based permissions
  - Security token management

## Troubleshooting

### Mode-Specific Issues

#### Standalone Mode Issues

**No Data Received:**

1. **Check Connection Status**: Use the web interface to verify your data source is connected
2. **Verify Data Source**: Ensure your NMEA 2000 source is actively transmitting data
3. **Network Connectivity**: Test network connectivity to remote data sources
4. **Check Server Logs**: Review console output for connection errors and status messages
5. **Device Compatibility**: Verify your device type is correctly configured in the connection profile

#### Embedded Mode Issues

**No Data in Signal K Plugin:**

1. **Check Signal K Connections**: Verify NMEA 2000 data sources are configured in Signal K Server
2. **Plugin Status**: Ensure the Visual Analyzer plugin is installed and enabled
3. **Signal K Data Flow**: Check Signal K Server's data browser to confirm data is flowing
4. **Authentication**: Ensure you're properly authenticated in Signal K Server
5. **Signal K Logs**: Review Signal K Server logs for connection issues

### General Issues (Both Modes)

### Serial Port Issues (Standalone Mode Only)

1. **Device Recognition**: Verify the device is connected and recognized by the system (`ls /dev/tty*` on Linux/macOS)
2. **Permissions**: Check permissions on the serial device
   - Linux: Add user to `dialout` group: `sudo usermod -a -G dialout $USER`
   - macOS: Check device ownership and permissions
3. **Device Configuration**: Confirm baud rate and device type match your hardware
4. **Test Connection**: Use a terminal program (screen, minicom) to test basic serial communication
5. **USB Driver**: Ensure proper USB drivers are installed for your device

> **Note**: In embedded mode, serial port configuration is handled through Signal K Server's connection management.

### WebSocket Connection Issues

#### Standalone Mode

1. **Server Status**: Verify the server is running and accessible at the configured port
2. **Firewall Settings**: Check that the port is not blocked by firewall rules
3. **Browser Console**: Check browser developer console for WebSocket error messages
4. **Port Conflicts**: Ensure the port is not in use by another service (`lsof -i :8080`)
5. **Network Configuration**: Verify network routing if accessing remotely

#### Embedded Mode

1. **Signal K Status**: Ensure Signal K Server is running and accessible
2. **Plugin Status**: Verify the Visual Analyzer plugin is properly installed and enabled
3. **Signal K WebSocket**: Check Signal K Server's WebSocket connection status
4. **Authentication**: Ensure proper authentication with Signal K Server

### Configuration Problems (Standalone Mode Only)

1. **File Permissions**: Ensure the server can read/write to the config.json file
2. **JSON Validation**: Verify config.json syntax is valid JSON
3. **Profile Validation**: Check that all required fields are present in connection profiles
4. **Path Issues**: Verify file paths are correct and accessible

> **Note**: In embedded mode, configuration issues are handled through Signal K Server's configuration system.

### Performance Issues

1. **Data Rate**: Monitor incoming data rate - very high-frequency sources may need filtering
2. **WebSocket Backpressure**: Check for WebSocket message queuing in high-data scenarios
3. **Memory Usage**: Monitor server memory usage with high-frequency data streams
4. **Client Processing**: Ensure client-side code can keep up with data rate

## Development

### Mode-Specific Development

#### Standalone Mode Development

For developing standalone features:

For developing standalone features:

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

#### Embedded Mode Development

For developing Signal K plugin features:

1. **Signal K Integration**:
   - Follow Signal K plugin development guidelines
   - Use Signal K's plugin API for data access and configuration
   - Implement proper plugin lifecycle management

2. **Data Stream Handling**:
   - Work with Signal K's delta message format
   - Implement conversion between Signal K and Visual Analyzer formats
   - Handle Signal K subscription management

3. **Authentication Integration**:
   - Use Signal K's authentication system
   - Implement proper permission checking
   - Handle user session management

### Code Structure

#### Standalone Mode Structure

```
server/
├── index.js           # Entry point and process management
├── server.js          # Express server and WebSocket handling
├── nmea-provider.js   # Data source connection management
├── config.json        # Runtime configuration (created automatically)
└── README.md          # This documentation
```

#### Embedded Mode Integration

```
Visual Analyzer Plugin/
├── index.js           # Signal K plugin entry point
├── public/            # Built web application assets
├── server/            # Server components (shared with standalone)
└── package.json       # Plugin metadata and dependencies
```

### Testing

#### Standalone Mode Testing

1. **Manual Testing**: Use the web interface to test different connection types
2. **API Testing**: Use curl or Postman to test the REST API endpoints
3. **WebSocket Testing**: Use browser developer tools or WebSocket testing tools
4. **Data Source Testing**: Verify compatibility with your specific NMEA 2000 hardware

#### Embedded Mode Testing

1. **Signal K Integration**: Test within a Signal K Server environment
2. **Plugin Installation**: Test installation through Signal K's App Store
3. **Data Flow**: Verify data flows from Signal K connections to Visual Analyzer
4. **Authentication**: Test with Signal K's authentication system

## License

This server component is licensed under the Apache-2.0 license, same as the Visual Analyzer project.
