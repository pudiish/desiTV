# Google AdSense Integration Guide for DesiTV

## Overview
This document outlines strategic locations for Google AdSense integration across the DesiTV application. All placements are designed to be non-intrusive while maximizing visibility and revenue potential.

---

## 🎯 Recommended Ad Placements

### 1. **Landing Page (`/pages/Landing.jsx`)**
**Priority: HIGH** - First impression, high traffic

#### 1.1 Header Banner (Top of Page)
- **Location**: Above hero section
- **Ad Type**: Responsive Display Ad (728x90 or 320x50 on mobile)
- **Placement**: Between navigation and hero title
- **Code Location**: `Landing.jsx` - After line 36, before hero div
- **Visibility**: Always visible, above the fold

```jsx
// Suggested placement in Landing.jsx
<div className="landing-container">
  {/* AdSense Header Banner */}
  <div className="adsense-header-banner">
    <ins className="adsbygoogle"
         style={{display:'block'}}
         data-ad-client="ca-pub-XXXXXXXXXX"
         data-ad-slot="XXXXXXXXXX"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
  </div>
  
  <div className="landing-content-single">
    {/* Hero section */}
  </div>
</div>
```

#### 1.2 Sidebar Ad (Desktop Only)
- **Location**: Right side of landing page
- **Ad Type**: Vertical Rectangle (300x250) or Skyscraper (160x600)
- **Placement**: Next to main content
- **Code Location**: `Landing.jsx` - Create sidebar wrapper
- **Visibility**: Desktop only, hidden on mobile

#### 1.3 Footer Banner
- **Location**: Above footer section
- **Ad Type**: Responsive Display Ad
- **Placement**: After legal section, before footer
- **Code Location**: `Landing.jsx` - After line 113, before footer
- **Visibility**: Always visible

---

### 2. **Home/TV View (`/pages/Home.jsx`)**
**Priority: MEDIUM-HIGH** - Main viewing experience (must be non-intrusive)

#### 2.1 Right Panel Ad (When Not Fullscreen)
- **Location**: Right panel, below TVRemote component
- **Ad Type**: Medium Rectangle (300x250)
- **Placement**: In `right-panel` div, after TVRemote
- **Code Location**: `Home.jsx` - Line 791-812, add after TVRemote
- **Visibility**: Only when `!isFullscreen` (already handled)
- **Conditional**: Hide when menu is open

```jsx
{/* Right Side - Remote Control and Categories (hidden in fullscreen) */}
{!isFullscreen && (
  <div className="right-panel">
    <TVRemote {...remoteProps} />
    
    {/* AdSense Ad - Right Panel */}
    <div className="adsense-right-panel">
      <ins className="adsbygoogle"
           style={{display:'block'}}
           data-ad-client="ca-pub-XXXXXXXXXX"
           data-ad-slot="XXXXXXXXXX"
           data-ad-format="rectangle"
           data-full-width-responsive="true"></ins>
    </div>
  </div>
)}
```

#### 2.2 Footer Status Area Ad
- **Location**: Footer status area, next to status text
- **Ad Type**: Horizontal Banner (728x90 desktop, 320x50 mobile)
- **Placement**: In `footer-status` div
- **Code Location**: `Home.jsx` - Line 816-820, modify footer-status
- **Visibility**: Always visible (but small, non-intrusive)

#### 2.3 TV Menu Overlay Ad (`/components/TVMenuV2.jsx`)
- **Location**: Sidebar within TV Menu
- **Ad Type**: Medium Rectangle (300x250)
- **Placement**: In menu content area, after categories list
- **Code Location**: `TVMenuV2.jsx` - Line 238, after channels-grid
- **Visibility**: Only when menu is open
- **Conditional**: Show only on "Categories" tab, not "Queue" tab

```jsx
{/* Categories Tab */}
{activeTab === 'channels' && (
  <div className="channels-grid">
    {/* ... existing category cards ... */}
  </div>
  
  {/* AdSense Ad in Menu */}
  <div className="adsense-menu-ad">
    <ins className="adsbygoogle"
         style={{display:'block'}}
         data-ad-client="ca-pub-XXXXXXXXXX"
         data-ad-slot="XXXXXXXXXX"
         data-ad-format="rectangle"
         data-full-width-responsive="true"></ins>
  </div>
)}
```

---

### 3. **Player Component (`/components/Player.jsx`)**
**Priority: LOW** - Avoid interfering with video playback

#### 3.1 Pre-Roll Ad Placeholder (Optional)
- **Location**: Before video starts playing
- **Ad Type**: Video Ad (via AdSense for Video)
- **Placement**: Overlay before video loads
- **Code Location**: `Player.jsx` - In static overlay area
- **Note**: Requires AdSense for Video setup, more complex

---

### 4. **Admin Dashboard (`/admin/AdminDashboard.jsx`)**
**Priority: NONE** - Admin area should NOT have ads
- **Recommendation**: Do NOT add ads to admin pages
- **Reason**: Admin interface should be clean and professional

---

## 📱 Mobile Considerations

### Responsive Ad Units
- Use `data-full-width-responsive="true"` for all ad units
- Test on mobile devices to ensure ads don't break layout
- Consider hiding ads on very small screens (< 320px width)

### Mobile-Specific Placements
1. **Landing Page**: Header banner (320x50) - Always visible
2. **TV View**: Hide right panel ads on mobile (already handled by fullscreen logic)
3. **Menu**: Smaller ad unit in menu (250x250) for mobile

---

## 🎨 CSS Styling Recommendations

Create a new CSS file: `/client/src/styles/adsense.css`

```css
/* AdSense Container Styles */
.adsense-header-banner {
  width: 100%;
  max-width: 728px;
  margin: 0 auto 20px;
  text-align: center;
  padding: 10px 0;
}

.adsense-right-panel {
  width: 100%;
  max-width: 300px;
  margin: 20px auto;
  text-align: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.adsense-menu-ad {
  width: 100%;
  max-width: 300px;
  margin: 20px auto;
  text-align: center;
  padding: 10px;
}

.adsense-footer-banner {
  width: 100%;
  max-width: 728px;
  margin: 20px auto;
  text-align: center;
  padding: 10px 0;
}

/* Hide ads in fullscreen */
.ios-fullscreen-active .adsense-right-panel,
.fullscreen-active .adsense-right-panel {
  display: none;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .adsense-right-panel {
    display: none; /* Already hidden by fullscreen logic */
  }
  
  .adsense-menu-ad {
    max-width: 250px;
  }
}
```

---

## 🔧 Implementation Steps

### Step 1: Add AdSense Script to HTML
**File**: `/client/index.html`

Add before closing `</head>` tag:
```html
<!-- Google AdSense -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX"
     crossorigin="anonymous"></script>
```

### Step 2: Create AdSense Component
**File**: `/client/src/components/AdSense.jsx` (NEW FILE)

```jsx
import { useEffect } from 'react';

export default function AdSense({ 
  adClient, 
  adSlot, 
  adFormat = 'auto',
  style = {},
  className = ''
}) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: 'block', ...style }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive="true"
    />
  );
}
```

### Step 3: Add Ad Units to Components
1. Import AdSense component
2. Add ad units in recommended locations
3. Use conditional rendering based on fullscreen/menu state

### Step 4: Initialize Ads
**File**: `/client/src/main.jsx`

Add AdSense initialization:
```jsx
// Initialize AdSense
if (window.adsbygoogle) {
  window.adsbygoogle.loaded = true;
}
```

---

## ⚠️ Important Considerations

### AdSense Policies
1. **No Click Fraud**: Don't encourage clicks
2. **Content Guidelines**: Ensure content is AdSense-compliant
3. **Placement Rules**: 
   - Don't place ads too close to video player
   - Don't use misleading labels ("Click here")
   - Don't place more than 3 ad units per page

### Performance
1. **Lazy Loading**: Load ads only when visible
2. **Async Loading**: Use async script loading
3. **Error Handling**: Handle ad loading failures gracefully

### User Experience
1. **Fullscreen**: Always hide ads in fullscreen mode
2. **Mobile**: Ensure ads don't break mobile layout
3. **Loading**: Show placeholder or nothing while ads load

---

## 📊 Ad Unit Recommendations

### Ad Sizes (Priority Order)
1. **Responsive Display Ads** (auto-size) - Best for all placements
2. **300x250 Medium Rectangle** - Right panel, menu
3. **728x90 Leaderboard** - Header/footer banners
4. **320x50 Mobile Banner** - Mobile header

### Ad Slots Needed
- Landing Page Header: 1 slot
- Landing Page Footer: 1 slot
- Landing Page Sidebar (desktop): 1 slot
- TV View Right Panel: 1 slot
- TV Menu: 1 slot
- Footer Status: 1 slot (optional)

**Total: 5-6 ad slots recommended**

---

## 🚀 Testing Checklist

- [ ] Ads load correctly on desktop
- [ ] Ads load correctly on mobile
- [ ] Ads are hidden in fullscreen mode
- [ ] Ads don't interfere with video playback
- [ ] Ads are responsive and don't break layout
- [ ] AdSense account is approved
- [ ] Ad units are properly configured in AdSense dashboard
- [ ] Analytics tracking is working (if implemented)

---

## 📝 Notes

- **Ad Revenue**: Revenue depends on traffic, content, and ad placement
- **Ad Blockers**: Some users may have ad blockers enabled
- **Compliance**: Ensure all content meets AdSense policies
- **Testing**: Use AdSense test mode before going live
- **Optimization**: Monitor performance and adjust placements as needed

---

## 🔗 Resources

- [Google AdSense Help Center](https://support.google.com/adsense)
- [AdSense Policies](https://support.google.com/adsense/answer/48182)
- [Ad Formats Guide](https://support.google.com/adsense/answer/6002621)
- [Responsive Ads Guide](https://support.google.com/adsense/answer/3215789)

