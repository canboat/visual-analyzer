# Recording Functionality

The Visual Analyzer now includes comprehensive NMEA 2000 recording functionality that allows you to capture, store, and manage NMEA 2000 data in various formats.

## Features

### Recording Tab (Frontend)
- **Format Selection**: Choose from multiple output formats including Raw NMEA 2000, Canboat JSON, Actisense formats, and more
- **Custom Filenames**: Option to auto-generate filenames or specify custom names
- **Real-time Status**: View recording status, message count, file size, and duration
- **File Management**: Browse, download, and delete recorded files
- **Format Display**: View format information for each recorded file

### Recording Service (Backend)
- **Multi-format Support**: Records data in 12 different formats using canboatjs transformation functions
- **PGN-based Recording**: Accepts parsed PGN objects and converts to desired output format
- **File Management**: Secure file operations with path traversal protection
- **Error Handling**: Comprehensive error handling and recovery
- **Event System**: Emits events for recording start, stop, progress, and errors

## API Endpoints

### GET `/api/recording/status`
Returns the current recording status including:
- `isRecording`: Boolean indicating if recording is active
- `fileName`: Current recording filename (if active)
- `messageCount`: Number of messages recorded
- `fileSize`: Current file size in bytes
- `format`: Recording format being used

### POST `/api/recording/start`
Starts a new recording session.
**Body Parameters:**
- `fileName` (optional): Custom filename
- `format` (optional): Recording format (defaults to 'raw')

### POST `/api/recording/stop`
Stops the current recording session.

### GET `/api/recording/files`
Returns an array of all recorded files with metadata.

### DELETE `/api/recording/files/:fileName`
Deletes a specific recorded file.

### GET `/api/recording/files/:fileName/download`
Downloads a specific recorded file.

## Supported Formats

1. **Raw NMEA 2000** - Reconstructed canboat-compatible format with timestamp and hex data
2. **Canboat JSON** - Human-readable JSON with parsed fields
3. **Actisense Serial** - Compatible with Actisense NGT-1
4. **Actisense N2K ASCII** - Actisense ASCII format
5. **iKonvert** - iKonvert serial format
6. **Yacht Devices RAW** - YDWG-02 compatible formats
7. **PCDIN** - PCDIN format
8. **MXPGN** - MXPGN format
9. **Linux CAN utils** - Various candump formats

## File Storage

Recording files are stored in:
- **Windows**: `%APPDATA%\visual-analyzer\recordings`
- **Unix/Linux/macOS**: `~/.visual-analyzer/recordings`

## Integration

The recording functionality is integrated with:
- **NMEA Data Stream**: Automatically records parsed PGN objects from incoming NMEA 2000 data
- **WebSocket Events**: Broadcasts recording events to connected clients
- **Server Lifecycle**: Gracefully stops recording on server shutdown
- **Error Recovery**: Handles stream errors and continues operation
- **Format Conversion**: Converts PGN objects to the selected output format using canboatjs

## Usage Notes

- Recording is only available in standalone mode (not when embedded in SignalK)
- The Recording tab appears only when `!isEmbedded`
- Files are automatically created with appropriate extensions based on format
- Message counting and file size are updated in real-time
- All formats fallback to raw format if transformation fails
