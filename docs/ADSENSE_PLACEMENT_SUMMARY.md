# Google AdSense Placement Summary - Quick Reference

## 📍 Visual Placement Map

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDING PAGE                              │
├─────────────────────────────────────────────────────────────┤
│  [HEADER BANNER AD - 728x90] ← Priority: HIGH              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Hero Section                                                │
│  Features                                                    │
│  CTA Button                                                 │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  [FOOTER BANNER AD - 728x90] ← Priority: HIGH              │
│  ─────────────────────────────────────────────────────────  │
│  Footer Links                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TV VIEW (Home.jsx)                        │
├──────────────────┬──────────────────────────────────────────┤
│                  │  [RIGHT PANEL AD - 300x250]              │
│   TV FRAME       │  ← Priority: MEDIUM-HIGH                │
│   (Player)       │  (Hidden in fullscreen)                   │
│                  │                                          │
│                  │  TV Remote                               │
│                  │  ──────────────────                     │
│                  │  [AdSense Ad Here]                       │
│                  │                                          │
├──────────────────┴──────────────────────────────────────────┤
│  [FOOTER STATUS AD - 728x90] ← Priority: LOW               │
│  Status Message                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TV MENU (TVMenuV2.jsx)                   │
├─────────────────────────────────────────────────────────────┤
│  Menu Header                                                 │
│  ─────────────────────────────────────────────────────────  │
│  [Tabs: Categories | Up Next]                               │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Category Cards List                                         │
│  ─────────────────────────────────────────────────────────  │
│  [MENU AD - 300x250] ← Priority: MEDIUM                    │
│  (Only on Categories tab)                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Priority Ranking

### **HIGH PRIORITY** (Implement First)
1. ✅ **Landing Page - Header Banner**
   - File: `client/src/pages/Landing.jsx`
   - Line: ~36 (after landing-container, before hero)
   - Ad Type: Responsive Display (728x90/320x50)
   - Visibility: Always visible, above fold

2. ✅ **Landing Page - Footer Banner**
   - File: `client/src/pages/Landing.jsx`
   - Line: ~113 (after legal section, before footer)
   - Ad Type: Responsive Display (728x90/320x50)
   - Visibility: Always visible

### **MEDIUM-HIGH PRIORITY** (Implement Second)
3. ✅ **TV View - Right Panel Ad**
   - File: `client/src/pages/Home.jsx`
   - Line: ~812 (in right-panel div, after TVRemote)
   - Ad Type: Medium Rectangle (300x250)
   - Visibility: Only when NOT fullscreen
   - Conditional: `{!isFullscreen && <AdSense />}`

4. ✅ **TV Menu - Sidebar Ad**
   - File: `client/src/components/TVMenuV2.jsx`
   - Line: ~238 (after channels-grid, in Categories tab)
   - Ad Type: Medium Rectangle (300x250)
   - Visibility: Only when menu is open
   - Conditional: `{activeTab === 'channels' && <AdSense />}`

### **LOW PRIORITY** (Optional)
5. ⚠️ **TV View - Footer Status Ad**
   - File: `client/src/pages/Home.jsx`
   - Line: ~816 (in footer-status div)
   - Ad Type: Horizontal Banner (728x90)
   - Visibility: Always visible (small, non-intrusive)

6. ⚠️ **Landing Page - Sidebar Ad** (Desktop Only)
   - File: `client/src/pages/Landing.jsx`
   - Requires: Layout restructure to add sidebar
   - Ad Type: Skyscraper (160x600) or Rectangle (300x250)
   - Visibility: Desktop only

---

## 📋 Implementation Checklist

### Phase 1: Setup (Do Once)
- [ ] Get Google AdSense account approved
- [ ] Add AdSense script to `index.html`
- [ ] Create `AdSense.jsx` component
- [ ] Create `adsense.css` stylesheet
- [ ] Test AdSense script loads correctly

### Phase 2: High Priority Ads
- [ ] Landing Page Header Banner
- [ ] Landing Page Footer Banner
- [ ] Test on desktop
- [ ] Test on mobile
- [ ] Verify ads don't break layout

### Phase 3: Medium Priority Ads
- [ ] TV View Right Panel Ad
- [ ] TV Menu Sidebar Ad
- [ ] Test fullscreen mode (ads should hide)
- [ ] Test menu open/close (ads should show/hide)
- [ ] Verify responsive behavior

### Phase 4: Optimization
- [ ] Monitor ad performance
- [ ] A/B test different placements
- [ ] Optimize ad sizes for revenue
- [ ] Check mobile user experience

---

## 🚫 DO NOT Place Ads

1. ❌ **Inside Player Component** - Don't overlay video
2. ❌ **Admin Dashboard** - Keep admin area clean
3. ❌ **Fullscreen Mode** - Always hide ads
4. ❌ **On Top of Controls** - Don't block user interactions
5. ❌ **Too Close to Video** - Maintain minimum distance

---

## 📱 Mobile vs Desktop Strategy

### Desktop (> 768px)
- Show all ad placements
- Use larger ad units (728x90, 300x250)
- Right panel ads visible

### Mobile (≤ 768px)
- Hide right panel ads (already handled by fullscreen)
- Use smaller ad units (320x50)
- Prioritize header/footer banners
- Menu ads can be smaller (250x250)

---

## 🔢 Ad Unit Count Per Page

| Page | Ad Units | Notes |
|------|----------|-------|
| Landing | 2-3 | Header, Footer, Sidebar (optional) |
| TV View | 1-2 | Right Panel, Footer (optional) |
| TV Menu | 1 | Sidebar (when open) |
| **Total** | **4-6** | Per user session |

---

## 💡 Pro Tips

1. **Start Small**: Implement 2-3 high-priority ads first
2. **Monitor Performance**: Use AdSense dashboard to track revenue
3. **User Feedback**: Watch for complaints about ad placement
4. **A/B Testing**: Try different positions to maximize revenue
5. **Mobile First**: Ensure mobile experience isn't degraded
6. **Lazy Load**: Load ads only when visible to improve performance

---

## 🎨 Ad Styling Best Practices

- Use subtle borders/backgrounds
- Match site color scheme
- Ensure proper spacing from content
- Don't make ads look like content
- Use "Ad" label if required by policy
- Test on multiple screen sizes

---

## 📞 Support

If you encounter issues:
1. Check AdSense dashboard for errors
2. Verify ad code is correct
3. Test in AdSense test mode
4. Check browser console for errors
5. Review AdSense policies compliance

