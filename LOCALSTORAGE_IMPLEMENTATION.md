# LocalStorage Implementation for Filter Settings

This document describes the localStorage implementation added to persist filter settings between browser sessions.

## What Gets Persisted

### Filter Settings (`visual_analyzer_settings`)

The following filter data is automatically saved to localStorage whenever changes are made:

- **PGN filters**: Selected PGN IDs and PGN numbers
- **Source filters**: Selected source addresses
- **Destination filters**: Selected destination addresses
- **Manufacturer filters**: Selected manufacturer codes
- **JavaScript filter**: Custom JavaScript filter code
- **Enable Filtering toggle**: Whether filtering is enabled or disabled (now located in the header for easy access)

### Filter Panel State (`visual_analyzer_filter_panel_open`)

- **Collapse state**: Whether the filter panel is expanded or collapsed

## UI Improvements

### Enable Filtering Toggle

The "Enable Filtering" toggle has been moved to the filter panel header, making it:

- **Always visible**: No need to expand the panel to enable/disable filtering
- **Quick access**: Toggle filtering on/off with one click, even when panel is collapsed
- **Better UX**: Immediate visual feedback on filtering state

### Header Layout

- **Left side**: "Filters" title (clickable to expand/collapse)
- **Right side**: "Enable Filtering" label + toggle switch + expand/collapse button
- **Event handling**: Toggle clicks don't trigger panel expansion
- **Clear labeling**: Explicit "Enable Filtering" text makes the toggle purpose obvious

## Implementation Details

### Storage Keys

- `visual_analyzer_settings`: Main filter configuration object
- `visual_analyzer_filter_panel_open`: Boolean for panel collapse state

### Storage Format

```javascript
// visual_analyzer_settings
{
  "filter": {
    "pgn": ["60928", "127251"],
    "src": [1, 2, 3],
    "dst": [255],
    "manufacturer": ["Garmin", "Raymarine"],
    "javaScript": "pgn.src === 1 && pgn.fields.sog > 5"
  },
  "doFiltering": true,
  "lastSaved": "2025-08-02T10:30:00.000Z"
}

// visual_analyzer_filter_panel_open
true
```

### Browser Compatibility

- Gracefully handles cases where localStorage is not available
- Uses try/catch blocks to prevent errors in private browsing mode
- Includes window and localStorage existence checks

### Loading Behavior

- Settings are loaded automatically when the AppPanel component mounts
- If no saved settings exist, defaults are applied (empty filters, filtering disabled)
- Panel state defaults to collapsed if no saved state exists

### Saving Behavior

- Settings are saved automatically whenever filter values change
- Panel state is saved immediately when expanded/collapsed
- Uses RxJS combineLatest to efficiently track multiple observable changes

## Usage

The localStorage functionality works automatically without any user interaction required. Users will notice:

1. **Filter settings persist**: Applied filters remain active when returning to the application
2. **Panel state persists**: If the filter panel was expanded, it stays expanded on reload
3. **Seamless experience**: No loading delays or manual restore required

## Testing

To test the functionality:

1. Open the Visual Analyzer application
2. Apply various filters (PGNs, sources, manufacturers, etc.)
3. Enable/disable filtering
4. Expand/collapse the filter panel
5. Refresh the browser or close/reopen the tab
6. Verify all settings are restored exactly as they were

## Error Handling

All localStorage operations include proper error handling:

- Failed save operations log warnings but don't break functionality
- Failed load operations fall back to default values
- Private browsing mode compatibility maintained
