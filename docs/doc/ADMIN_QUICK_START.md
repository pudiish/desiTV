# ⚡ Admin Portal - Quick Start

## 🎯 Most Common Tasks

### 1️⃣ Add a Single Video
1. Go to **📹 Videos & Channels** tab (first tab)
2. Click **➕ Add Single Video**
3. Fill form:
   - **Channel**: Select from dropdown
   - **Video ID**: `dQw4w9WgXcQ` (from YouTube URL)
   - **Title**: Name of the video
   - **Description**: Optional
   - **Thumbnail**: Leave empty (auto-fetched)
4. Click **✨ Add Video**

### 2️⃣ Add Multiple Videos from Excel

**Step 1: Prepare Excel**
| channelId | videoId | title | description | thumbnail |
|-----------|---------|-------|-------------|-----------|
| uuid123 | dQw4w9WgXcQ | My Song | Great song | |
| uuid123 | another-id | Another Video | Description | |

**Step 2: Import**
1. Select all data (headers + rows)
2. Copy (Cmd+C / Ctrl+C)
3. Go to **📹 Videos & Channels**
4. Click **📊 Bulk Import**
5. Select **CSV**
6. Paste data
7. Click **🚀 Import Videos**

### 3️⃣ Add Multiple Videos from JSON

**Step 1: Create JSON**
```json
[
  {"channelId": "uuid123", "videoId": "dQw4w9WgXcQ", "title": "Song 1"},
  {"channelId": "uuid123", "videoId": "another-id", "title": "Song 2"}
]
```

**Step 2: Import**
1. Copy JSON
2. Go to **📹 Videos & Channels**
3. Click **📊 Bulk Import**
4. Select **JSON**
5. Paste JSON
6. Click **🚀 Import Videos**

---

## 🔍 Finding Channel IDs

1. Click **📺 Manage Channels** tab
2. Find your channel
3. Copy the channel ID (looks like: `507f1f77bcf86cd799439011`)

---

## 📺 Finding YouTube Video IDs

**From URL:**
```
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
ID: dQw4w9WgXcQ
```

**From Short URL:**
```
URL: https://youtu.be/dQw4w9WgXcQ
ID: dQw4w9WgXcQ
```

---

## ✅ Required vs Optional

| Field | Required? | Example |
|-------|-----------|---------|
| channelId | ✅ Yes | `507f1f77bcf86cd799439011` |
| videoId | ✅ Yes | `dQw4w9WgXcQ` |
| title | ✅ Yes | `My Favorite Song` |
| description | ❌ No | `This is a great song` |
| thumbnail | ❌ No | (auto-fetched from YouTube) |

---

## 🎬 CSV Template

Copy this and fill in your data:

```
channelId,videoId,title,description,thumbnail
,dQw4w9WgXcQ,Video 1,Description 1,
,another-id,Video 2,Description 2,
,third-id,Video 3,,
```

---

## 📝 JSON Template

```json
[
  {
    "channelId": "",
    "videoId": "dQw4w9WgXcQ",
    "title": "Video 1",
    "description": "Description here",
    "thumbnail": ""
  }
]
```

---

## 🚀 Tips for Speed

1. **Bulk import is faster** for multiple videos
2. **Leave thumbnail empty** - YouTube auto-fetches it
3. **Use Google Sheets** - easier to manage than Excel
4. **Copy as CSV** from Sheets: Data → Download → CSV
5. **Validate IDs** before importing - check channels and video IDs exist

---

## ❌ Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| Full YouTube URL | Just the video ID |
| Wrong channel ID | Copy from Channels tab |
| Empty required fields | Fill channelId, videoId, title |
| Bad CSV headers | Use: channelId,videoId,title,description,thumbnail |
| Invalid JSON | Use proper JSON format with quotes |

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Channel not found | Check channelId in Channels tab |
| Video not added | Check all required fields are filled |
| Import fails | Verify JSON is valid or CSV has correct headers |
| Duplicate video error | Video already exists in that channel |

---

## 🎯 Keyboard Shortcuts

- `Tab` - Navigate between fields
- `Enter` - Submit form
- `Escape` - Close any open dialogs

---

## 📊 Supported Formats

### CSV
- ✅ Comma-separated values
- ✅ Must include header row
- ✅ Copy from Excel/Sheets

### JSON
- ✅ Valid JSON array
- ✅ One object per video
- ✅ Fields: channelId, videoId, title, description (opt), thumbnail (opt)

---

**Need help?** Check the **❓ Instructions** tab in the Videos & Channels section!
