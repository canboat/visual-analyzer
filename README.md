[![npm version](https://img.shields.io/npm/v/@canboat/visual-analyzer.svg)](https://www.npmjs.com/@canboat/visual-analyzer)
[![Node.js CI & Test](https://github.com/canboat/visual-analyzer/actions/workflows/test.yml/badge.svg)](https://github.com/canboat/visual-analyzer/actions/workflows/test.yml)

# @canboat/visual-analyzer

A powerful web-based tool for visually analyzing and debugging NMEA 2000 data streams in real-time. This application provides an intuitive interface for monitoring, filtering, and analyzing NMEA 2000 PGN (Parameter Group Number) messages.

<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
  <img width="300" alt="Main Interface" src="https://github.com/user-attachments/assets/950d0609-3e9c-4b6c-91d5-41b40256fa2b" />
  <img width="300" alt="Data Analysis" src="https://github.com/user-attachments/assets/bf614aae-799c-4a67-b024-0169855fb890" />
  <img width="300" alt="Message Filtering" src="https://github.com/user-attachments/assets/ce61f336-9b79-4386-8d4c-1ff482cc4cff" />
  <img width="300" alt="Device Information" src="https://github.com/user-attachments/assets/0c502c10-e2ea-4892-8dd3-69be97ea8a43" />
  <img width="300" alt="Connection Settings" src="https://github.com/user-attachments/assets/c347985d-f71f-4ca3-a9c5-b1edc24eb037" />
  <img width="300" alt="Recording Features" src="https://github.com/user-attachments/assets/a23ec639-ae24-4a99-bcfd-cbbe8832bf9f" />
</div>

## Installation & Usage

### As a Signal K Plugin

The Visual Analyzer is designed to be used as an embeddable webapp within Signal K Server. It requires server vesion 2.15 or better. It is on the App Store and will be available under "Web Apps" after installation.

### Standalone Server

The Visual Analyzer can also be run as a standalone web server, making it perfect for:

- Direct connection to NMEA 2000 networks via serial/USB adapters
- Independent analysis without requiring Signal K Server
- Quick troubleshooting and debugging of NMEA 2000 systems
- Field testing and diagnostics
- **SignalK transformation** - Convert NMEA 2000 data to SignalK format via REST API

#### Quick Start

Install globally using npm and start the server:

```bash
npm install -g @canboat/visual-analyzer

visual-analyzer --open
```

This will:

1. Install the Visual Analyzer as a global command
2. Start the web server on port 8080
3. Open your browser to `http://localhost:8080`

#### Installation Requirements

- **Node.js** version 22 or higher

To check if you have Node.js installed:

```bash
node --version
```

If you don't have Node.js, download it from [nodejs.org](https://nodejs.org/).

#### Basic Usage

The web interface will be available at `http://localhost:8080` where you can:

- Configure data source connections (serial, TCP, file)
- View real-time NMEA 2000 messages
- Filter and search message data
- Analyze device information

#### Command Line Options

The Visual Analyzer supports several command line options for customization:

```bash
# Start with default settings (port 8080)
visual-analyzer

# Start on a specific port
visual-analyzer --port 3000

# Start and automatically open your web browser
visual-analyzer --open

# Use a custom configuration file
visual-analyzer --config /path/to/config.json

# Set port using environment variable
PORT=8080 visual-analyzer

# Display help information
visual-analyzer --help

# Show the current version
visual-analyzer --version
```

#### Getting Help

If you encounter issues:

1. **Check Node.js version**: Ensure you have Node.js 22 or higher
2. **Port conflicts**: Try a different port with `--port 3000`
3. **Firewall issues**: Make sure your firewall allows the application
4. **Get help**: Run `visual-analyzer --help` for all available options

For additional support, visit the [GitHub Issues](https://github.com/canboat/visual-analyzer/issues) page.

#### Configuration

The standalone server can be configured via:

1. **Command line arguments** (highest priority)
2. **Environment variables**
3. **Configuration file** (lowest priority)

#### Configuration File Location

The server automatically creates and uses a configuration file at:

- **Linux/macOS**: `~/.visual-analyzer/config.json`
- **Windows**: `%APPDATA%\visual-analyzer\config.json`

You can override this location using the `--config` option or the `VISUAL_ANALYZER_CONFIG` environment variable.

Example `config.json`:

```json
{
  "server": {
    "port": 8080
  },
  "connections": {
    "activeConnection": "serial",
    "profiles": {
      "serial": {
        "name": "USB Serial Connection",
        "type": "serial",
        "port": "/dev/ttyUSB0",
        "baudRate": 115200
      },
      "tcp": {
        "name": "TCP Connection",
        "type": "tcp",
        "host": "localhost",
        "port": 10110
      }
    }
  }
}
```

## Features

### Core Features (Available in All Modes)

- **Real-time NMEA 2000 data visualization** - Live monitoring of PGN messages
- **Advanced filtering capabilities**:
  - Filter by PGN numbers
  - Filter by source addresses
  - Filter by destination addresses
  - Filter by manufacturer
  - Custom JavaScript filtering
- **Device information display** - Automatic detection and display of device metadata
- **Interactive data exploration** - Click on messages to view detailed information
- **Message transformation and analysis** - Convert between different NMEA 2000 formats
- **Message sending capabilities** - Send custom NMEA 2000 messages for testing

### Standalone Mode Features

- **Connection management** - Configure and manage multiple data source connections:
  - Serial/USB connections to NMEA 2000 gateways
  - TCP/IP network connections
  - Signal K Server connections
  - SocketCAN connections
  - File playback with speed control
- **Configuration persistence** - Save connection profiles and settings locally
- **Direct hardware access** - Connect directly to NMEA 2000 hardware without intermediate servers
- **Data recording** - Record NMEA 2000 data streams to files in multiple formats:
  - Source format (passthrough)
  - Canboat JSON formats
  - Actisense serial formats
  - Digital Yacht iKonvert format
  - Yacht Devices RAW formats
  - PCDIN and MXPGN formats
  - Linux CAN utils (candump) formats
- **Recording management** - Start/stop recording with custom filenames and format selection
- **File management** - Browse, download, and delete recorded files
- **SignalK transformation API** - REST endpoint to convert NMEA 2000 data to SignalK delta format

### Signal K Embedded Mode Features

- **Seamless Signal K integration** - Uses Signal K Server's existing data connections
- **Unified authentication** - Leverages Signal K Server's user authentication system
- **Embedded web interface** - Runs within Signal K Server's admin interface
- **Zero configuration** - Automatically uses Signal K's configured NMEA 2000 data sources

> **Note**: Connection management and data recording features are not available when embedded in Signal K Server, as data sources are managed by Signal K Server itself.

## Data Sources

### Standalone Mode

The Visual Analyzer supports multiple data source types when running as a standalone server:

- **Serial/USB connections** - Direct connection to NMEA 2000 gateways and adapters
- **TCP/IP connections** - Network-based NMEA 2000 data streams
- **Signal K Server connections** - Connect to remote Signal K Server instances
- **SocketCAN connections** - Direct access to Linux CAN interfaces
- **File input** - Analysis of previously recorded NMEA 2000 data with playback controls
- **Data recording** - Save live NMEA 2000 data streams to files for later analysis or sharing

#### Supported NMEA 2000 Devices

The Visual Analyzer supports the following NMEA 2000 gateways and adapters:

**Serial/USB Devices:**

- **Actisense NGT-1** - Industry-standard USB NMEA 2000 gateway with full bidirectional support
- **Digital Yacht iKonvert** - Serial to NMEA 2000 converter with proprietary protocol support (NOT WORKING)
- **Yacht Devices YDEN-02** - Ethernet NMEA 2000 gateway

**Network Devices:**

- **Actisense W2K-1** - WiFi NMEA 2000 gateway with TCP connectivity
- **Yacht Devices YDWG-02** - WiFi-enabled version with network connectivity
- **Digital Yacht NavLink2** - WiFi marine gateway with UDP broadcast support (NOT WORKING)
- **Network data concentrators** - Some TCP/UDP enabled marine data servers

**CAN Bus Interfaces (Linux Only):**

- **SocketCAN compatible adapters** - Direct Linux CAN bus interface support
- **Various CAN-to-USB adapters** - Hardware interfaces compatible with SocketCAN drivers
- **Embedded CAN controllers** - Direct hardware CAN interface access

**Supported Data Formats:**

- **Actisense Serial Format** - Standard Actisense ASCII format
- **Actisense N2K ASCII** - Human-readable Actisense format
- **iKonvert Format** - Digital Yacht proprietary binary format
- **YDWG Raw Format** - Yacht Devices raw binary format
- **PCDIN Format** - Chetco Digital Instruments format
- **MXPGN Format** - MiniPlex-3 proprietary format
- **SocketCAN Format** - Linux CAN bus native format

### Signal K Embedded Mode

When running as a Signal K plugin, the Visual Analyzer automatically uses:

- **Signal K Server's data connections** - All NMEA 2000 data sources configured in Signal K Server
- **Real-time streaming** - Live data from Signal K Server's data processing pipeline
- **Device discovery** - Inherits device information discovered by Signal K Server

> **Note**: Data source configuration and recording features are not available in embedded mode as they're managed by the host Signal K Server.

## How It Works

### Standalone Mode

The visual-analyzer connects to NMEA 2000 data sources and:

1. **Receives NMEA 2000 data** - Connects to serial ports, TCP streams, Signal K servers, SocketCAN interfaces, or files
2. **Parses messages** - Uses `@canboat/canboatjs` and `@canboat/ts-pgns` for message parsing
3. **Filters data** - Applies user-defined filters to focus on relevant messages
4. **Displays information** - Shows parsed message data in an organized, searchable interface
5. **Device discovery** - Automatically requests and displays device information for detected sources
6. **Manages connections** - Provides full connection management and configuration capabilities

### Signal K Embedded Mode

When embedded in Signal K Server, the analyzer:

1. **Receives processed data** - Gets NMEA 2000 data from Signal K Server's data pipeline
2. **Real-time filtering** - Applies filters to live Signal K delta messages
3. **Displays information** - Shows data within Signal K Server's web interface
4. **Inherits authentication** - Uses Signal K Server's user authentication system
5. **Device information** - Displays device metadata managed by Signal K Server

> **Note**: In embedded mode, connection management is handled by Signal K Server. The analyzer focuses purely on data visualization and analysis.

## Filtering Options

### PGN Filtering

Filter messages by specific Parameter Group Numbers to focus on particular message types.

### Source/Destination Filtering

Filter by device source addresses or destination addresses to monitor specific devices.

### Manufacturer Filtering

Filter messages by device manufacturer to focus on equipment from specific vendors.

### JavaScript Filtering

Advanced users can write custom JavaScript expressions for complex filtering logic.

## Data Recording (Standalone Mode Only)

The Visual Analyzer includes powerful data recording capabilities when running in standalone mode, allowing you to capture live NMEA 2000 data streams for later analysis, sharing, or archival purposes.

### Recording Features

- **Multiple output formats** - Record data in various industry-standard formats
- **Real-time recording** - Capture live data streams without interrupting analysis
- **Custom filenames** - Use auto-generated timestamps or specify custom filenames
- **File management** - Browse, download, and manage recorded files
- **Progress monitoring** - Track recording status, message count, and file size in real-time

### Supported Recording Formats

- **Source Format (Passthrough)** - Records data exactly as received from the source
- **Canboat JSON** - Standard and pretty-printed JSON formats for easy parsing
- **Actisense Formats** - Serial format and N2K ASCII for Actisense devices
- **Digital Yacht iKonvert** - Native format for iKonvert NMEA 2000 gateways
- **Yacht Devices RAW** - Both standard and full RAW formats
- **PCDIN & MXPGN** - Industry-standard proprietary formats
- **Linux CAN Utils** - Multiple candump formats for Linux-based systems

### Recording Storage

Recorded files are automatically saved to:

- **Linux/macOS**: `~/.visual-analyzer/recordings/`
- **Windows**: `%APPDATA%\visual-analyzer\recordings\`

Files are organized with automatic timestamps and include metadata about message counts and file formats.

> **Note**: Recording functionality is only available in standalone mode. When embedded in Signal K Server, use Signal K's built-in data logging features instead.

## Architecture

Built with modern web technologies:

- **Frontend**: React with TypeScript
- **Data Processing**: RxJS for reactive data streams
- **NMEA 2000 Parsing**: @canboat/canboatjs and @canboat/ts-pgns
- **UI Components**: Reactstrap (Bootstrap for React)
- **Build System**: Webpack with hot module replacement

## Development

### Project Structure

```
visual-analyzer/
├── bin/
│   └── visual-analyzer           # Executable script for standalone server
├── server/
│   ├── index.ts                  # Main server entry point (TypeScript)
│   ├── server.ts                 # Express server setup (TypeScript)
│   ├── nmea-provider.ts          # NMEA data source providers (TypeScript)
│   ├── types.ts                  # Server-side TypeScript type definitions
│   └── config.json               # Default server configuration
├── dist/                         # Compiled TypeScript server code (generated)
├── src/
│   ├── components/
│   │   ├── AppPanel.tsx          # Main application component
│   │   ├── ConnectionManagerPanel.tsx # Connection configuration
│   │   ├── DataList.tsx          # Message list and filtering
│   │   ├── Filters.tsx           # Filter components
│   │   ├── SentencePanel.tsx     # Message detail view
│   │   └── SettingsPanel.tsx     # Settings and configuration
│   ├── bootstrap.js              # Application bootstrap
│   ├── index.js                  # Frontend entry point
│   ├── styles.css                # Application styles
│   ├── types.ts                  # TypeScript type definitions
│   └── reactstrap.d.ts           # Reactstrap type definitions
├── public_src/
│   └── index.html                # HTML template
├── public/                       # Built frontend assets (generated)
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # Frontend TypeScript configuration
├── tsconfig.server.json          # Server-side TypeScript configuration
└── webpack.config.js             # Webpack build configuration
```

### Development Setup

```bash
# Clone the repository for development
git clone https://github.com/canboat/visual-analyzer.git
cd visual-analyzer
npm install

# Start development server with hot reload
npm run watch

# Build client-side code for production
npm run build

# Build server-side TypeScript code
npm run build:server

# Build everything
npm run build:all

# Start the compiled server
npm run server

# Format code
npm run format

# Run linting
npm run lint
```

### Key Dependencies

- `@canboat/canboatjs` - NMEA 2000 message parsing
- `@canboat/ts-pgns` - TypeScript PGN definitions
- `react` - UI framework
- `rxjs` - Reactive programming
- `reactstrap` - Bootstrap components

### Building

The project uses Webpack to build a Signal K compatible embeddable webapp:

```bash
npm run build
```

This creates optimized bundles in the `public/` directory that can be served by Signal K Server.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests and linting: `npm run ci`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Documentation**: Additional documentation available in the [Canboat project](https://github.com/canboat/canboat)
- **Signal K**: Learn more about Signal K at [signalk.org](https://signalk.org)

## Related Projects

- **[@canboat/canboatjs](https://www.npmjs.com/package/@canboat/canboatjs)** - JavaScript NMEA 2000 library
- **[@canboat/ts-pgns](https://www.npmjs.com/package/@canboat/ts-pgns)** - TypeScript PGN definitions
- **[Signal K Server](https://github.com/SignalK/signalk-server)** - Open source maritime data server
