# Visual Analyzer Server Binary

This directory contains the command-line executable for the Visual Analyzer Server.

## Installation

When installed via npm, the `visual-analyzer` command will be available globally:

```bash
npm install -g @canboat/visual-analyzer
visual-analyzer
```

For development or local installation:

```bash
npm install
npm link  # Creates global symlink to local package
visual-analyzer
```

## Usage

```bash
visual-analyzer [options]
```

### Options

- `--port <port>` - Specify the server port (default: 8080)
- `--config <file>` - Path to custom configuration file
- `--help`, `-h` - Show help message
- `--version`, `-v` - Show version information

### Examples

```bash
# Start with default settings (port 8080)
visual-analyzer

# Start on a specific port
visual-analyzer --port 3000

# Use environment variable for port
PORT=8080 visual-analyzer

# Use custom configuration file
visual-analyzer --config /path/to/my-config.json

# Show help
visual-analyzer --help

# Show version
visual-analyzer --version
```

### Configuration

The server can be configured through:

1. **Command line arguments** (highest priority)
2. **Environment variables**
3. **Configuration file** (lowest priority)

#### Environment Variables

- `PORT` - Server port number
- `PUBLIC_DIR` - Path to public directory for static files
- `VISUAL_ANALYZER_CONFIG` - Path to configuration file

#### Configuration File

The server looks for a `config.json` file in the server directory by default. You can specify a custom configuration file with the `--config` option.

Example config.json:
```json
{
  "server": {
    "port": 8080,
    "publicDir": "./public"
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

## Development

For development, you can run the server directly:

```bash
node server/index.js
```

Or use npm scripts:

```bash
npm run server
npm run dev  # Starts both server and webpack watch
```
