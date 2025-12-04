# 🎛️ Admin Portal - Visual Navigation Guide

## 📱 Admin Portal Layout

Your admin portal now has a professional retro-themed layout with a fully functional menu system:

```
┌──────────────────────────────────────────────────────────────────┐
│                    RETRO TV ADMIN DASHBOARD                      │
├─────────────────────────┬──────────────────────────────────────┤
│                         │                                        │
│  🎛️ ADMIN              │  📊 DASHBOARD                          │
│  [◀/▶]                  │  ═══════════════════════════════════  │
│  ─────────────────────  │                                        │
│  📊 Dashboard           │  [Content shows here based on]         │
│  ❤️  Component Health    │  [selected menu item from sidebar]   │
│  🔌 API Health          │                                        │
│  💾 Cache Manager       │                                        │
│  📡 Broadcast State     │                                        │
│  📺 Channels            │                                        │
│  🎬 Video Fetcher       │                                        │
│  📋 API Monitor         │                                        │
│                         │                                        │
│  ─────────────────────  │                                        │
│  🟢 Online              │                                        │
│                         │                                        │
└─────────────────────────┴──────────────────────────────────────┘
```

## 🎯 How to Navigate

### 1. **Open Admin Portal**
   - Click the ⚙️ button in the bottom-right corner of the TV interface
   - Wait for initialization (1-2 seconds)

### 2. **Sidebar Menu**
   - **Left Panel** shows all available sections
   - Each item has an emoji icon + label
   - Click any item to switch sections
   - Active section is highlighted in green with glow effect

### 3. **Main Content Area**
   - **Right Panel** displays the selected section content
   - Shows the section title in the header with current time
   - Scrollable if content exceeds viewport

### 4. **Collapse/Expand Sidebar**
   - Click the **[◀/▶]** button to toggle sidebar
   - Collapsed sidebar shows only icons (perfect for small screens)
   - Expanded sidebar shows full labels with smooth animations

## 📋 Available Sections

| Icon | Section | Purpose |
|------|---------|---------|
| 📊 | **Dashboard** | System overview and health status |
| ❤️ | **Component Health** | Performance metrics & error tracking |
| 🔌 | **API Health** | API endpoint status & response times |
| 💾 | **Cache Manager** | View & manage application cache |
| 📡 | **Broadcast State** | Monitor broadcast state synchronization |
| 📺 | **Channels** | Manage TV channels |
| 🎬 | **Video Fetcher** | Fetch and manage videos |
| 📋 | **API Monitor** | API call logging & monitoring |

## 🎨 Visual Features

### Sidebar Styling
- **Active Item**: Green border + glow effect + uppercase font
- **Hover Effect**: Slides right with background highlight
- **Icons**: Large emoji for quick visual identification
- **Status Indicator**: Online/Offline dot with pulse animation

### Color Scheme (Retro Theme)
- **Primary Green**: `#00ff88` (CRT monitor green)
- **Accent Green**: `#00ff00` (bright highlight)
- **Background**: `#0a0e27` & `#0f1229` (dark retro)
- **Text**: `#e0e0e0` (light gray for readability)

### Animations
- **Slide In**: Sections fade in smoothly when selected
- **Pulse**: Online status indicator pulses continuously
- **Glow**: Active menu items glow with green text-shadow
- **Hover**: Menu items slide right on hover

## 🔍 New Monitoring Sections

### 🔌 API Health
```
Shows:
- Overall health percentage
- Healthy vs unhealthy endpoints
- Individual endpoint status (✅ or ❌)
- Response times for each endpoint
- Last check time
- Auto-refresh toggle
- Manual refresh button
```

### 💾 Cache Manager
```
Shows:
- Total cache size (bytes/KB/MB)
- localStorage usage
- sessionStorage usage
- Browser cache usage
- Clear individual caches
- Full cleanup with key preservation
- Recently cleared items log
```

### ❤️ Component Health
```
Shows:
- Application uptime
- API call statistics
- Error summary and list
- Response time trends
- Cache hit rate percentage
- Recent errors with details
- Expandable error details
```

## ⌨️ Keyboard Navigation

While the menu doesn't have keyboard shortcuts yet, you can:
- **Tab** through menu items
- **Enter** to select active menu item
- **Escape** to collapse sidebar (future enhancement)

## 📊 Data Updates

All sections update in real-time:
- **API Health**: Checks every 10 seconds (configurable)
- **Component Health**: Updates on each API call
- **Cache Manager**: Updates on demand
- **All**: Manual refresh buttons available

## 🔧 Configuration

To customize timing intervals, edit:
```
client/src/config/constants.js

TIMING = {
  HEALTH_CHECK_INTERVAL: 10000,  // milliseconds
  API_HEALTH_TIMEOUT: 5000,      // milliseconds
  // ... other timings
}
```

## 📱 Responsive Design

The sidebar:
- **Full Width**: On desktop (280px)
- **Collapsed**: On small screens (60px icons only)
- **Toggle Button**: Easily switch between modes
- **Mobile Friendly**: Touch-friendly icon buttons

## 🌙 Retro Theme Features

- CRT monitor-style green phosphor colors
- Monospace "Courier New" font (authentic 80s computer look)
- Glow effects and text-shadow for depth
- Box shadows for layered appearance
- Smooth transitions for retro elegance

## ✅ Status Indicators

**Sidebar Footer Shows:**
- 🟢 **Online** - Application is connected
- 🟡 **Warning** - Minor connectivity issues
- 🔴 **Offline** - Lost connection
- Pulse animation indicates active monitoring

## 🚀 Quick Tips

1. **First Time?** Click 📊 Dashboard to get oriented
2. **Check Health?** Click 🔌 API Health to see service status
3. **Memory Issues?** Click 💾 Cache Manager to cleanup
4. **Debugging?** Click 📋 API Monitor to see API calls
5. **On Mobile?** Collapse sidebar to save space

---

**Your admin portal is now fully functional with beautiful retro styling!**
Click any menu item to start exploring. 🎯
