# @canboat/visual-analyzer

A powerful web-based tool for visually analyzing and debugging NMEA 2000 data streams in real-time. This Signal K embeddable webapp provides an intuitive interface for monitoring, filtering, and analyzing NMEA 2000 PGN (Parameter Group Number) messages.

<img width="1610" height="880" alt="Visual Analyzer Screenshot" src="https://github.com/user-attachments/assets/cde33c27-cd0d-4e55-902b-e6cc2b37665b" />

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
