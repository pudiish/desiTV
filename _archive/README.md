# Archived Files

This folder contains files that were removed from the main codebase during cleanup on January 3, 2026.

## Folder Structure

### `/test-scripts/`
Test and validation scripts that were created during development but are not part of the main application:
- `test-api-showcase.js` - API test showcase
- `test-channels-complete.js` - Channel feature tests
- `test-channels-feature.js` - Channel feature validation
- `test-content-filter.js` - Content filter tests
- `test-gemini-direct.js` - Direct Gemini API tests
- `test-improvements.js` - Search improvement tests
- `test-intent.js` - Intent detection tests
- `test-vjcore.js` - VJ Core tests

### `/server-unused/`
Server-side files that were superseded by newer implementations:
- `vjCore.js` - Original VJ Core (replaced by `enhancedVJCore.js`)
- `suggestionEngine.js` - Standalone suggestion engine (functionality integrated into `advancedVJCore.js`)
- `verify-imports.js` - Import verification utility script

### `/debug-scripts/`
Debug and diagnostic scripts:
- `comprehensive-debug.js` - Full system debugging script

### `/docs-old/`
Documentation files from previous development phases. Contains implementation guides, summaries, and technical documentation.

### `/empty-files/`
Empty placeholder files that were accidentally created:
- `0` - Empty file from root
- `client-0` - Empty file from client

### `/data-imports/`
Data import files for batch video imports:
- `new batch/` - YouTube links for various channel playlists

### `/utility-scripts/`
Python utility scripts for data management:
- `fetch_channels.py` - MongoDB channel fetcher
- `fetch_honey_singh_videos.py` - YouTube video fetcher
- `sanitize_codebase.py` - Code cleanup utility
- `requirements.txt` - Python dependencies

## Notes
- These files can be safely deleted if not needed for reference
- Some test scripts may reference old file paths that no longer exist
- Documentation in `/docs-old/` may be outdated but useful for understanding design decisions
