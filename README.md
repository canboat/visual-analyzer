# @canboat/visual-analyzer

A powerful web-- **Device discovery** - Automatically requests and displays device information for detected sources

## Installation & Usage

### As a Signal K Plugin

The Visual Analyzer is designed to be used as an embeddable webapp within Signal K Server. It will be automatically available at `/admin/#/appstore/install/@canboat/visual-analyzer` after installation.

### Standalone Server

You can also run the Visual Analyzer as a standalone server for development or independent use:

#### Global Installation

```bash
npm install -g @canboat/visual-analyzer
visual-analyzer
```

#### Development Installation

```bash
git clone https://github.com/canboat/visual-analyzer.git
cd visual-analyzer
npm install
npm run build  # Build the frontend
visual-analyzer  # Start the server
```

#### Command Line Options

```bash
# Start with default settings (port 8080)
visual-analyzer

# Start on a specific port
visual-analyzer --port 3000

# Start and open browser automatically  
visual-analyzer --open

# Use environment variable
PORT=8080 visual-analyzer

# Use custom configuration file
visual-analyzer --config /path/to/config.json

# Show help
visual-analyzer --help

# Show version
visual-analyzer --version
```

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
```ased tool for visually analyzing and debugging NMEA 2000 data streams in real-time. This Signal K embeddable webapp provides an intuitive interface for monitoring, filtering, and analyzing NMEA 2000 PGN (Parameter Group Number) messages.

<img width="1368" height="815" alt="Visual Analyzer Screenshot" src="https://github.com/user-attachments/assets/060c30c2-51b7-462d-87ea-9deb56981971" />

## Features

- **Real-time NMEA 2000 data visualization** - Live monitoring of PGN messages
- **Advanced filtering capabilities**:
  - Filter by PGN numbers
  - Filter by source addresses
  - Filter by destination addresses
  - Filter by manufacturer
  - Custom JavaScript filtering
- **Device information display** - Automatic detection and display of device metadata
- **Interactive data exploration** - Click on messages to view detailed information
- **Signal K integration** - Seamlessly integrates with Signal K Server as an embeddable webapp

### Standalone Development

```bash
# Start development server with hot reload
npm run watch

# Build for production
npm run build

# Format code
npm run format

# Run linting
npm run lint
```

## How It Works

The visual-analyzer connects to Signal K Server's WebSocket stream and:

1. **Receives NMEA 2000 data** - Listens for real-time PGN messages
2. **Parses messages** - Uses `@canboat/canboatjs` and `@canboat/ts-pgns` for message parsing
3. **Filters data** - Applies user-defined filters to focus on relevant messages
4. **Displays information** - Shows parsed message data in an organized, searchable interface
5. **Device discovery** - Automatically requests and displays device information for detected sources

## Architecture

Built with modern web technologies:

- **Frontend**: React with TypeScript
- **Data Processing**: RxJS for reactive data streams
- **NMEA 2000 Parsing**: @canboat/canboatjs and @canboat/ts-pgns
- **UI Components**: Reactstrap (Bootstrap for React)
- **Build System**: Webpack with hot module replacement

## Configuration

The analyzer automatically configures itself by:

- Connecting to Signal K Server's WebSocket endpoint
- Detecting available NMEA 2000 data sources
- Requesting device information from discovered sources
- Building filter options based on available data

## Filtering Options

### PGN Filtering

Filter messages by specific Parameter Group Numbers to focus on particular message types.

### Source/Destination Filtering

Filter by device source addresses or destination addresses to monitor specific devices.

### Manufacturer Filtering

Filter messages by device manufacturer to focus on equipment from specific vendors.

### JavaScript Filtering

Advanced users can write custom JavaScript expressions for complex filtering logic.

## Development

### Project Structure

```
src/
├── components/
│   ├── AppPanel.tsx      # Main application component
│   ├── DataList.tsx      # Message list and filtering
│   └── SentencePanel.tsx # Message detail view
├── types.ts              # TypeScript type definitions
└── index.js              # Entry point
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
