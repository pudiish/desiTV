# Visual Examples - Markdown Options

## Search Results Display

### Example 1: YouTube Song Search
```
User Input:
"Play blinding lights"

Bot Response (Markdown):
🎵 Found on YouTube! Pick a song:

[Blinding Lights - The Weeknd](play:dQw4w9WgXcQ)
[Blinding Lights Remix - DJ Mix](play:abc123def456)
[Blinding Lights Cover - Artist](play:xyz789uvw123)

Rendered as:
┌─────────────────────────────────────────────┐
│ 🎧                                        ✕ │
│ DJ Desi • LIVE                              │
├─────────────────────────────────────────────┤
│                                             │
│ ✓ Hey! I'm DJ Desi. You're watching...     │
│                                             │
│ 🎵 Found on YouTube! Pick a song:          │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Blinding Lights - The Weeknd        │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Blinding Lights Remix - DJ Mix      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Blinding Lights Cover - Artist      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ [Ask DJ Desi...                    ] [➤]  │
└─────────────────────────────────────────────┘

Click any button:
→ Immediately plays video on TV
→ Executes PLAY_EXTERNAL action
→ No additional user input needed
```

### Example 2: Hover States
```
Button States:

Default:
┌────────────────────────────────┐
│ Blinding Lights - The Weeknd   │  ← Gold border, semi-transparent bg
└────────────────────────────────┘

Hover:
 ┌────────────────────────────────┐
 │ Blinding Lights - The Weeknd   │  ← Moved right 4px
 └────────────────────────────────┘
   ↑ More opaque, shadow added

Active/Pressed:
  ┌────────────────────────────────┐
  │ Blinding Lights - The Weeknd   │  ← Moved right 2px
  └────────────────────────────────┘
```

### Example 3: Multiple Message Types

User Conversation:
```
┌─────────────────────────────────────────────┐
│ 🎧                                        ✕ │
├─────────────────────────────────────────────┤
│                                             │
│ ✓ Hey! I'm DJ Desi, your DesiTV VJ!       │
│                                             │
│ > What's playing?                           │ ← User message (right, gold)
│                                             │
│ ✓ "Midnight City" by M83                   │
│   Now playing on Retro Gold channel        │
│                                             │
│ > Play some romantic songs                  │ ← User message
│                                             │
│ ✓ Found romantic songs:                     │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Tum Saath Ho - A.R. Rahman         │   │
│ └─────────────────────────────────────┘   │ ← Clickable option
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Kabhi Main Badal Ban - Rascals      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ > I love romantic songs!                    │ ← User message
│                                             │
│ ✓ I know you do! Playing more romantic...  │
│                                             │
│ [Ask DJ Desi...                    ] [➤]  │
└─────────────────────────────────────────────┘
```

## Color & Styling Details

### Option Button Styling
```css
Background Gradient:
  Off-state:     rgba(212, 165, 116, 0.08) → rgba(212, 165, 116, 0.08)
  Hover-state:   rgba(212, 165, 116, 0.25) → rgba(212, 165, 116, 0.15)
  
Border:
  Color:         #d4a574 (VJ Primary Gold)
  Width:         1.5px
  Radius:        10px (rounded rectangle)

Text:
  Color:         #d4a574 (Primary gold)
  Size:          13px
  Weight:        500 (medium)
  Family:        System fonts (-apple-system, Segoe UI, etc)

Padding:
  Vertical:      10px
  Horizontal:    12px
  
Gap (between text and next element): 8px

Animation:
  Duration:      250ms (0.25s)
  Timing:        cubic-bezier(0.2, 0, 0.2, 1)
  Transform:     translateX(4px) on hover
  Shadow:        0 4px 12px rgba(212, 165, 116, 0.2) on hover
```

### Message Container Styling
```css
Assistant Message Box:
  Background:    rgba(255, 255, 255, 0.05) - Very subtle white
  Border:        1px solid rgba(212, 165, 116, 0.2)
  Radius:        2px 14px 14px 14px (rounded bottom-right)
  Backdrop:      blur(4px) - glassmorphic effect
  
Display:
  Type:          flex
  Direction:     column
  Gap:           8px (between text and buttons)
  
Padding:
  Vertical:      10px
  Horizontal:    14px
```

## Interaction Flow Diagram

```
User Types Message
        ↓
"Play blinding lights"
        ↓
[VJChat.jsx handleSend()]
        ↓
chatService.sendMessage()
        ↓
[Server: /api/chat]
        ↓
vjCore.processMessage()
        ↓
tools.searchYouTubeForSong()
        ↓
youtubeSearch.searchSong()
        ↓
YouTube API v3 (returns 5 results)
        ↓
Tool formats top 3 as markdown:
"🎵 Found on YouTube! Pick a song:
[Title 1 - Artist](play:id1)
[Title 2 - Artist](play:id2)
[Title 3 - Artist](play:id3)"
        ↓
Response returned to frontend
        ↓
[VJChat.jsx renderMessageContent()]
        ↓
parseMessageContent() detects regex:
/\[([^\]]+)\]\(play:([^)]+)\)/g
        ↓
Creates array of {type: 'option', label, videoId}
        ↓
Renders as React buttons with onClick
        ↓
User clicks button
        ↓
onClick handler executes:
executeAction({
  type: 'PLAY_EXTERNAL',
  videoId: 'abc123',
  videoTitle: 'Song - Artist'
})
        ↓
Home.jsx onPlayExternal() called
        ↓
Main TV player loads YouTube video
        ↓
Video plays! 🎵
```

## Code Examples

### parseMessageContent() in Action

```javascript
Input:
"Found songs:\n[Song 1 - Artist](play:id1)\n[Song 2 - Artist](play:id2)"

Execution:
const regex = /\[([^\]]+)\]\(play:([^)]+)\)/g;
// First match: [Song 1 - Artist](play:id1)
// Second match: [Song 2 - Artist](play:id2)

Output Array:
[
  { type: 'text', content: 'Found songs:\n' },
  { type: 'option', label: 'Song 1 - Artist', videoId: 'id1' },
  { type: 'text', content: '\n' },
  { type: 'option', label: 'Song 2 - Artist', videoId: 'id2' }
]
```

### Rendered JSX Output

```jsx
<div className="vj-msg-content">
  <div className="vj-msg-text">Found songs:</div>
  
  <button className="vj-msg-option" onClick={...}>
    Song 1 - Artist
  </button>
  
  <div className="vj-msg-text"></div>
  
  <button className="vj-msg-option" onClick={...}>
    Song 2 - Artist
  </button>
</div>
```

### DOM Output

```html
<div class="vj-msg-content">
  <div class="vj-msg-text">Found songs:</div>
  
  <button class="vj-msg-option" title="Play: Song 1 - Artist">
    Song 1 - Artist
  </button>
  
  <div class="vj-msg-text"></div>
  
  <button class="vj-msg-option" title="Play: Song 2 - Artist">
    Song 2 - Artist
  </button>
</div>
```

## Responsive Behavior

### Desktop (360px+)
```
┌──────────────────────────┐
│ Full width options        │
│ ┌────────────────────┐   │
│ │ Full Song Title    │   │
│ └────────────────────┘   │
│                          │
│ Hover animates smoothly  │
└──────────────────────────┘
```

### Tablet (480px+)
```
┌──────────────────────────────┐
│ Wider option buttons          │
│ ┌──────────────────────────┐ │
│ │ Full Song Title Info     │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### Mobile (<360px)
```
┌──────────────────┐
│ Wrapped text     │
│ ┌──────────────┐ │
│ │ Song Title   │ │
│ │ Wraps if     │ │
│ │ needed       │ │
│ └──────────────┘ │
│ min-width still  │
│ maintains 200px  │
└──────────────────┘
```

## Accessibility

### Keyboard Navigation
```
User presses Tab:
  ┌────────────────┐
  │ [Focused]      │ ← Gold border glow
  └────────────────┘

User presses Enter:
  → Triggers onClick handler
  → Video plays
```

### Screen Reader Output
```
<button class="vj-msg-option" title="Play: Blinding Lights - The Weeknd">
  Blinding Lights - The Weeknd
</button>

Announced as:
"Button, Blinding Lights - The Weeknd, Play: Blinding Lights - The Weeknd"
```

### Touch Interaction
```
Button Size: min 200px wide, 40px tall
Touch Target: 44px minimum (WCAG AA)
Padding: Adequate for fat-finger selection
Spacing: 8px gap between buttons
```

## Real-World Examples

### Example: Bollywood Search
```
User: "Play Deepika Padukone songs"

Bot:
🎵 Found on YouTube! Pick a song:

[Padmaavat - Anirudh Ravichander](play:deYaVxZ4F7o)
[Ghoomar - Swaroop Khan](play:6ZfuNTqbHE8)
[Nagada Sang Dhol - A.R. Rahman](play:gZUn6yB_fTo)
```

### Example: Artist Search
```
User: "Play Dua Lipa"

Bot:
🎵 Found on YouTube! Pick a song:

[Dua Lipa - Levitating (Official Video)](play:aTqjhPkWZ6g)
[Dua Lipa - Don't Start Now](play:N_jpuH0TjOA)
[Dua Lipa - Physical (Official Video)](play:Xo8-py_JaK0)
```

### Example: Mood Search
```
User: "I'm sad, play something chill"

Bot:
🎵 Found on YouTube! Pick a song:

[Chillhop Music - Lofi Study Mix](play:5yx5ZtS299o)
[Peaceful Piano - Ludovico Einaudi](play:lFeDj1C1Cqc)
[Ambient Sleep Music - Brian Eno](play:sTVHVvLXwkY)
```

## Summary

- ✅ Clean, intuitive UI for song selection
- ✅ Minimal code changes (regex-based)
- ✅ Fully responsive and accessible
- ✅ Smooth animations and interactions
- ✅ Easy to extend to other action types
- ✅ No breaking changes to existing system
