# Admin Portal - Quick Start Guide

## 🚀 Getting Started in 30 Seconds

### Step 1: Open the Admin Portal
- Look for the **⚙️ gear button** in the bottom-right corner of the TV view
- Click it to open the admin dashboard

### Step 2: Explore the Dashboard
The sidebar shows 5 sections:

| Icon | Section | Purpose |
|------|---------|---------|
| 📊 | Dashboard | Server health & uptime |
| 📡 | Broadcast State | Real-time playback tracking |
| 📺 | Channels | Manage channels & videos |
| 🎬 | Video Fetcher | Search YouTube videos |
| 🔌 | API Monitor | Log all API requests |

### Step 3: Return to TV
- Click the **← TV** button in top-right to go back

---

## 📊 Dashboard Section

**What it shows:**
- Server is online/offline
- How many channels are active
- Total broadcast states being tracked
- How long the server has been running

**Auto-updates** every 10 seconds

---

## 📡 Broadcast State Monitor

**What it shows:**
- All channels currently in broadcast
- Current video playing
- Playback position
- How videos are cycling

**Click a card** to see full details:
- Exact timestamps
- Video durations
- Playlist information
- Cycle counts

**Auto-updates** every 5 seconds

---

## 📺 Channel Manager

**What you can do:**
- See all available channels
- View how many videos each has
- Click a channel to see all its videos
- Delete a channel (with confirmation)

**Click the Delete button** to remove a channel

**Auto-updates** every 10 seconds

---

## 🎬 Video Fetcher

**How to search for videos:**
1. Type in the search box (e.g., "music", "comedy")
2. Press Enter or click Search
3. Results appear in a grid with thumbnails
4. Click a video card to select it (checkbox appears)
5. Selected videos highlight in brighter green

**Next steps** (coming soon):
- Add selected videos to a channel

---

## 🔌 API Monitor

**What it tracks:**
- Every API request the system makes
- Request type (GET, POST, DELETE)
- Response time in milliseconds
- Success or failure status

**How to use:**
- **Filter**: Choose what to see (All/Success/Errors)
- **Auto-scroll**: Keep up with latest requests
- **Clear**: Delete all logged requests

**Color-coded status:**
- 🟢 Green = Success
- 🔴 Red = Error
- 🟡 Orange = Warning

---

## 🎨 Understanding the Display

### Colors (Retro Terminal Theme)
- **🟢 Green (#00ff88)**: Primary action, success
- **⚪ Light Green (#00ff00)**: Highlights, hover effects
- **🔴 Red (#ff4444)**: Errors, delete actions
- **🟡 Orange (#ffaa00)**: Warnings, slow requests

### Interactions
- **Hover over cards** → See preview info
- **Click cards** → Open detail modal
- **Click ✕ button** → Close modal
- **Click outside modal** → Close it

---

## ⌚ Auto-Refresh Rates

Different sections update at different speeds:

| Section | Refresh Rate | Why |
|---------|--------------|-----|
| Dashboard | Every 10 sec | Server status less volatile |
| Broadcast Monitor | Every 5 sec | Need real-time playback info |
| Channels | Every 10 sec | Channel list changes rarely |
| API Monitor | Real-time | Capture all requests live |

---

## 💡 Pro Tips

1. **Keep API Monitor open** while testing to see all requests
2. **Check Broadcast State** to verify videos are advancing correctly
3. **Use Dashboard** to confirm server is running
4. **Search and add videos** from Video Fetcher to test playlists
5. **Watch the stats** in API Monitor to identify slow requests

---

## ❓ Common Questions

### Q: Why are some requests red in API Monitor?
**A:** Red means an error occurred (4xx or 5xx status code). Check the server logs for details.

### Q: How do I add videos to a channel?
**A:** Currently, the UI foundation is laid. Use the VideoFetcher to search, select videos, and add them to channels.

### Q: Why does the broadcast time keep advancing when I close the app?
**A:** That's the broadcast state system working correctly! It tracks virtual time using an algorithm, so videos advance even when the app is closed.

### Q: Can I delete a broadcast state?
**A:** Currently, you can delete channels (which includes their broadcast state). Direct broadcast state deletion coming soon.

### Q: What if the API Monitor is empty?
**A:** Make sure you're using the app while the monitor is open. Each request gets logged in real-time.

---

## 🔧 Troubleshooting

### Admin button not showing?
- Refresh the page
- Make sure you're on the TV view (not already in admin)
- Check browser console for errors (F12)

### Dashboard shows "offline"?
- Verify the backend server is running
- Check that the API endpoint is correct
- Look at network requests in browser dev tools

### Broadcast monitor not updating?
- Check that channels have videos in them
- Verify the backend broadcast state API is working
- Try clicking "Refresh" button manually

### API monitor not logging?
- Make sure the monitor page is open
- Check for CORS errors in console
- Try making a request manually from another section

---

## 📱 Mobile Access

The admin portal works on mobile too!

**On mobile:**
- Sidebar collapses into a horizontal menu
- Grid layouts become single column
- Buttons are sized for touch
- Swipe is supported for scrolling

---

## 🎓 Learning Resources

- See detailed docs in: `ADMIN_PORTAL.md`
- See completion details in: `ADMIN_PORTAL_COMPLETION.md`
- Backend API routes in: `server/routes/*.js`

---

## 🚀 Next Time

Just remember:
1. Go to TV view
2. Click ⚙️ button
3. Explore the dashboard
4. Click ← TV to return

**That's it! You're now an admin. 🎉**

---

**Need more details?** Check out the full documentation in `ADMIN_PORTAL.md`
