# Admin Portal Documentation

## Overview

The Retro TV Admin Portal provides a comprehensive dashboard for monitoring and managing the broadcast system. Access it via the **⚙️ button** in the bottom-right corner of the TV app.

## Features

### 1. **Dashboard** 📊
- Real-time server health status
- Active channels count
- Total broadcast states
- Server uptime tracking
- Auto-refresh every 10 seconds

### 2. **Broadcast State Monitor** 📡
- Real-time monitoring of all active broadcast states
- Grid display of channel states
- Modal detail view with full state information:
  - Channel ID and name
  - Current video index
  - Current playback time
  - Video durations
  - Playlist total duration
  - Virtual elapsed time
  - Last sync time
- Auto-refresh every 5 seconds

### 3. **Channel Manager** 📺
- View all available channels
- Display video count per channel
- Channel detail modal showing:
  - Channel metadata (ID, name, dates)
  - Complete video list with durations
- Delete channels (with confirmation)
- Auto-refresh every 10 seconds

### 4. **Video Fetcher** 🎬
- Search YouTube videos by query
- Display search results in grid layout
- Select multiple videos
- View video metadata and thumbnails
- Ready for adding to channels (UI foundation laid)

### 5. **API Monitor** 🔌
- Real-time API request logging
- Filter by request status (All, Success, Errors, Warnings)
- Displays:
  - HTTP method (GET, POST, etc.)
  - API endpoint URL
  - Response status and duration
  - Timestamp
- Statistics dashboard:
  - Total requests
  - Success count
  - Error count
  - Average response time
- Auto-scroll to latest requests
- Clear logs functionality

## Design Features

### Visual Theme
- **Retro Terminal Aesthetic**: Green on black color scheme (#00ff88 accent)
- **Glow Effects**: Text shadows and box shadows for authentic retro feel
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Smooth Animations**: Slide-in, fade-in effects for modern feel

### UI Components
- **Sidebar Navigation**: Collapsible menu with 5 sections
- **Modal Dialogs**: Detailed information views
- **Notification System**: Auto-dismissing alerts
- **Real-time Refresh**: Data updates automatically
- **Status Badges**: Visual indicators for request status

## API Endpoints Used

```
GET  /health                           # Server health check
GET  /api/broadcast-state/all         # All broadcast states
GET  /api/channels                     # List all channels
GET  /api/channels/:id                 # Single channel details
DELETE /api/channels/:id               # Delete channel
GET  /api/youtube/search?q=query      # YouTube video search
GET  /api/youtube/video/:videoId      # Video details
```

## Keyboard Shortcuts & Interactions

- **Search**: Press Enter in search box to search
- **Select Videos**: Click card to toggle selection
- **Close Modal**: Click X button or overlay
- **Auto-scroll**: Toggle checkbox to auto-scroll logs
- **Clear Logs**: Click Clear button to reset API monitor

## Performance Notes

- **Broadcast State Refresh**: Every 5 seconds
- **System Health Refresh**: Every 10 seconds
- **Channel Manager Refresh**: Every 10 seconds
- **API Logging**: Captured in real-time via fetch interceptor
- **Log Retention**: Keeps last 100 requests

## Responsive Breakpoints

| Device | Features |
|--------|----------|
| Desktop (>1200px) | Full sidebar + full grid layouts |
| Tablet (768-1200px) | Sidebar + adjusted grid (2 columns) |
| Mobile (<768px) | Collapsed sidebar + single column |

## Future Enhancements

- [ ] Channel creation UI
- [ ] Video duration input
- [ ] Broadcast schedule editor
- [ ] Advanced search filters
- [ ] API response inspection panel
- [ ] Performance metrics dashboard
- [ ] Admin authentication/authorization
- [ ] Log export functionality
- [ ] System alert rules

## Styling

Main CSS files:
- `AdminDashboard.css` - Complete admin portal styling
- `App.css` - Admin button and layout

All components use consistent retro-green color scheme for cohesive design.

## Notes for Developers

- Admin portal toggles between TV app and admin view
- All data fetches use browser fetch API with error handling
- Components use React hooks for state management
- Real-time updates use setInterval for refresh
- API interceptor in APIMonitor.jsx captures all fetch calls
- Each section is independent and can be extended
