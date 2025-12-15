# Testing & Analytics Implementation Guide

## Overview
This guide explains how to use the testing, survey, and analytics systems implemented for DesiTV.

---

## 1. User Testing Plan

### Location
`docs/USER_TESTING_PLAN.md`

### Usage
1. **Recruit Testers**: Get 10-15 participants per age group (18-30, 31-50, 51-60+)
2. **Set Up Environment**: Prepare test devices (mobile/desktop)
3. **Run Scenarios**: Follow the 4 testing scenarios in the plan
4. **Collect Data**: Use the provided checklist and reporting template
5. **Analyze Results**: Compile findings and prioritize fixes

### Key Features
- Simple, TV-like testing scenarios
- Age-group specific questions
- Performance metrics tracking
- Low-end device testing checklist

---

## 2. Analytics System

### Location
`client/src/utils/analytics.js`

### Features
- **Non-intrusive**: Runs in background, doesn't interfere with TV watching
- **Privacy-focused**: No personal data collected
- **Automatic Tracking**: Tracks all user interactions automatically
- **Performance Metrics**: Tracks load times, channel switches, etc.

### Events Tracked
- Session start/end
- TV power on/off
- Channel changes (method, from/to)
- Category changes
- Volume changes
- Menu interactions
- Fullscreen events
- Playback events
- Errors
- Performance metrics

### Usage in Code
```javascript
import analytics from '../utils/analytics'

// Track power on
analytics.trackPowerOn()

// Track channel change
analytics.trackChannelChange('up', 0, 1, 'Category Name')

// Track volume change
analytics.trackVolumeChange(0.8, 'up')

// Track menu open
analytics.trackMenuOpen()

// Track errors
analytics.trackError('playback_error', 'Video failed to load')
```

### Backend API
**Endpoint**: `/api/analytics`

**POST** `/api/analytics` - Send events
**GET** `/api/analytics/summary` - Get summary statistics
**GET** `/api/analytics/events` - Get raw events
**GET** `/api/analytics/surveys` - Get survey responses

---

## 3. Performance Monitor

### Location
`client/src/utils/performanceMonitor.js`

### Features
- **Load Performance**: Tracks page load, first paint, time to interactive
- **Frame Rate**: Monitors FPS in real-time
- **Memory Usage**: Tracks JavaScript heap (Chrome/Edge only)
- **Channel Switch Times**: Measures channel switching performance
- **Menu Open Times**: Measures menu responsiveness
- **Error Tracking**: Captures JavaScript errors

### Usage
```javascript
import performanceMonitor from '../utils/performanceMonitor'

// Track channel switch
const startTime = performance.now()
// ... channel switch code ...
const duration = performanceMonitor.trackChannelSwitch(startTime)

// Track menu open
const startTime = performance.now()
// ... menu open code ...
const duration = performanceMonitor.trackMenuOpen(startTime)

// Get summary
const summary = performanceMonitor.getSummary()
console.log('Average FPS:', summary.avgFrameRate)
console.log('Load Time:', summary.loadTime, 'ms')
```

### Metrics Collected
- Load time
- First Contentful Paint
- Time to Interactive
- Average frame rate
- Average channel switch time
- Average menu open time
- Average memory usage
- Error count

---

## 4. TV Survey Component

### Location
`client/src/components/TVSurvey.jsx`

### Features
- **Simple & TV-like**: Minimal user control, just like watching TV
- **Age-specific Questions**: Different questions for different age groups
- **Auto-advance**: Questions advance automatically after selection
- **Non-intrusive**: Appears after watching for a few minutes (configurable)

### Usage
```javascript
import TVSurvey from '../components/TVSurvey'

// In your component
const [surveyOpen, setSurveyOpen] = useState(false)
const [userAgeGroup, setUserAgeGroup] = useState('18-30') // or '31-50', '51-60+'

// Show survey after 5 minutes
useEffect(() => {
	if (power && userAgeGroup) {
		const timer = setTimeout(() => {
			setSurveyOpen(true)
		}, 5 * 60 * 1000) // 5 minutes
		return () => clearTimeout(timer)
	}
}, [power, userAgeGroup])

// Render survey
<TVSurvey
	isOpen={surveyOpen}
	onClose={() => setSurveyOpen(false)}
	ageGroup={userAgeGroup}
/>
```

### Questions Asked
**All Groups**:
- Ease of use (1-5 rating)
- Satisfaction (1-5 rating)
- Would use regularly? (Yes/Maybe/No)
- Compared to regular TV? (Better/Same/Worse)

**Age-Specific**:
- **18-30**: Nostalgia appeal, Performance
- **31-50**: Familiarity, Family use
- **51-60+**: Readability, Button size

### Backend API
**POST** `/api/analytics/survey` - Submit survey response
**GET** `/api/analytics/surveys` - Get all survey responses

---

## 5. Integration Checklist

### ✅ Analytics Integration
- [x] Analytics utility created
- [x] Backend API endpoint created
- [x] Integrated into Home.jsx
- [x] Tracks power on/off
- [x] Tracks channel changes
- [x] Tracks volume changes
- [x] Tracks menu interactions
- [x] Tracks fullscreen events
- [x] Tracks errors

### ✅ Performance Monitor Integration
- [x] Performance monitor created
- [x] Tracks load performance
- [x] Tracks frame rate
- [x] Tracks memory usage
- [x] Tracks channel switch times
- [x] Tracks menu open times
- [x] Integrated into Home.jsx

### ✅ Survey Integration
- [x] TVSurvey component created
- [x] Age-specific questions
- [x] Backend API endpoint
- [x] Integrated into Home.jsx
- [x] Auto-show after watching

### ⚠️ Testing Setup
- [ ] Set user age group for testing (add UI or URL param)
- [ ] Configure survey timing
- [ ] Set up analytics dashboard
- [ ] Prepare test devices
- [ ] Recruit testers

---

## 6. Setting User Age Group for Testing

### Option 1: URL Parameter (Recommended)
Add to URL: `?ageGroup=18-30` or `?ageGroup=31-50` or `?ageGroup=51-60+`

```javascript
// In Home.jsx, add:
useEffect(() => {
	const params = new URLSearchParams(window.location.search)
	const ageGroup = params.get('ageGroup')
	if (ageGroup && ['18-30', '31-50', '51-60+'].includes(ageGroup)) {
		setUserAgeGroup(ageGroup)
		analytics.trackAgeGroup(ageGroup)
	}
}, [])
```

### Option 2: Local Storage
```javascript
// Set age group
localStorage.setItem('userAgeGroup', '18-30')

// Get age group
const ageGroup = localStorage.getItem('userAgeGroup')
```

### Option 3: Admin Panel
Add a simple admin setting to set age group for testing sessions.

---

## 7. Viewing Analytics Data

### Backend Summary
```bash
# Get summary
curl http://localhost:5000/api/analytics/summary

# Get events
curl http://localhost:5000/api/analytics/events?limit=100

# Get surveys
curl http://localhost:5000/api/analytics/surveys
```

### Frontend Console
In development mode, analytics events are logged to console:
```
[Analytics] tv_power_on { timestamp: 1234567890 }
[Analytics] channel_change { method: 'up', fromChannel: 0, toChannel: 1 }
```

### Performance Summary
```javascript
import performanceMonitor from '../utils/performanceMonitor'

// Get summary
const summary = performanceMonitor.getSummary()
console.log('Performance Summary:', summary)

// Get all metrics
const allMetrics = performanceMonitor.getAllMetrics()
console.log('All Metrics:', allMetrics)
```

---

## 8. Testing Workflow

1. **Setup**: Set user age group (URL param or localStorage)
2. **Test**: Use the app normally (watch TV, use remote)
3. **Survey**: Survey appears after 5 minutes of watching
4. **Analytics**: All interactions automatically tracked
5. **Review**: Check analytics summary and survey responses
6. **Iterate**: Make improvements based on findings

---

## 9. Privacy & Ethics

- **No Personal Data**: Only tracks interactions, not personal info
- **Opt-out**: Analytics can be disabled (set `analytics.disable()`)
- **Consent**: Get user consent before testing
- **Transparency**: Explain what data is collected
- **Security**: Analytics data stored securely on server

---

## 10. Next Steps

1. **Add Age Group Selector**: UI or URL param to set age group
2. **Create Analytics Dashboard**: Visual dashboard for viewing data
3. **Export Reports**: Generate PDF/CSV reports from analytics
4. **A/B Testing**: Compare different UI variations
5. **Performance Alerts**: Alert when performance degrades
6. **User Feedback**: Add more survey questions based on findings

---

## Notes

- **Keep it Simple**: Users should only watch TV and use remote
- **Non-intrusive**: Analytics and surveys don't interfere with watching
- **Privacy First**: No personal data collected
- **Performance Focus**: Monitor low-end device performance
- **Age-Appropriate**: Different questions for different age groups

