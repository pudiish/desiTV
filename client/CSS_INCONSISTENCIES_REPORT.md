# CSS Inconsistencies Report

## Overview
This report documents inconsistencies found across CSS files in the project. The goal is to identify areas where standardization can improve maintainability and reduce potential bugs.

---

## 1. Color Usage Inconsistencies

### Issue: Hardcoded Colors vs CSS Variables
**Severity: High**

Many files use hardcoded hex colors instead of CSS variables defined in `tokens.css`.

**Examples:**
- `responsive.css`: Uses `#4a9eff`, `#39ff14`, `#ff6600`, `#ff4444`, `#888` directly
- `tv-frame.css`: Uses hardcoded black shades (`#1a1a1a`, `#0f0f0f`, `#000000`) instead of `--tv-frame-*` variables
- `menu.css`: Uses `#4a9eff`, `#39ff14`, `#ff6600`, `#ff4444` directly
- `remote.css`: Uses many hardcoded colors (`#666`, `#888`, `#333`, etc.)

**Recommendation:** Replace hardcoded colors with CSS variables:
- `#4a9eff` → `var(--color-primary)`
- `#39ff14` → `var(--color-success)`
- `#ff6600` → `var(--color-warning)`
- `#ff4444` → `var(--color-error)`
- `#d4c4b0` → `var(--color-text)`
- `#888`, `#666` → `var(--color-text-dim)` or `var(--color-text-muted)`

**Files Affected:**
- `responsive.css` (50+ hardcoded colors)
- `tv-frame.css` (27+ hardcoded colors)
- `buttons.css` (32+ hardcoded colors)
- `menu.css` (59+ hardcoded colors)
- `remote.css` (64+ hardcoded colors)

---

## 2. Z-Index Inconsistencies

### Issue: Hardcoded Z-Index Values vs CSS Variables
**Severity: Medium-High**

`tokens.css` defines a z-index scale, but many files use hardcoded values instead.

**Defined Variables (tokens.css):**
```css
--z-base: 1;
--z-overlay: 10;
--z-menu: 100;
--z-remote: 9000;
--z-glass: 8000;
--z-fullscreen-hint: 100;
--z-menu-overlay: 10002;
--z-survey-overlay: 10003;
--z-remote-overlay: 10000;
--z-ios-fullscreen: 99999;
```

**Hardcoded Values Found:**
- `9999` (responsive.css, effects.css) - should use `var(--z-ios-fullscreen)` or define new variable
- `9996` (responsive.css, effects.css) - not defined in variables
- `9995` (responsive.css) - not defined
- `9990` (responsive.css) - not defined
- `20`, `15`, `6`, `5`, `4`, `2`, `1` (multiple files) - should use `var(--z-overlay)` or `var(--z-base)`
- `99998` (fullscreen.css) - should use `var(--z-ios-fullscreen)`

**Potential Conflicts:**
- Multiple elements use `z-index: 100` in different contexts
- Overlay elements have overlapping z-index ranges without clear hierarchy

**Recommendation:** 
1. Use CSS variables consistently
2. Document z-index layers in a comment
3. Add missing variables to `tokens.css` (e.g., `--z-crt-effects: 9996`)

---

## 3. Transition/Animation Timing Inconsistencies

### Issue: Hardcoded Timing vs CSS Variables
**Severity: Medium**

`tokens.css` defines transition timing variables, but many files use hardcoded values.

**Defined Variables:**
```css
--transition-fast: 0.15s ease;
--transition-base: 0.2s ease;
--transition-slow: 0.3s ease;
--transition-slower: 0.5s ease;
```

**Hardcoded Values Found:**
- `0.1s ease` (responsive.css) - not covered by variables
- `0.15s ease` (multiple files) - use `var(--transition-fast)`
- `0.2s ease` (multiple files) - use `var(--transition-base)`
- `0.3s ease` (multiple files) - use `var(--transition-slow)`
- `0.3s ease-out` (player.css) - different easing function

**Recommendation:** 
1. Use CSS variables for all transitions
2. Add `--transition-fast-out: 0.15s ease-out` if needed for different easing

**Files Affected:**
- `responsive.css`
- `tv-frame.css`
- `player.css`
- `menu.css`
- `remote.css`

---

## 4. Spacing Inconsistencies

### Issue: Hardcoded Spacing vs CSS Variables
**Severity: Medium**

`tokens.css` defines spacing scale, but many files use hardcoded `px` values.

**Defined Variables:**
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 20px;
--spacing-2xl: 24px;
--spacing-3xl: 32px;
--spacing-4xl: 40px;
```

**Common Hardcoded Values:**
- `10px`, `15px`, `20px`, `25px`, `30px`, `35px`, `40px`, `50px` - should use variables or `clamp()`
- Many files mix `px` values with `clamp()` inconsistently

**Recommendation:** 
1. Use spacing variables where possible
2. Use `clamp()` for responsive spacing (already done in some places)
3. Document when hardcoded values are intentional (e.g., specific design requirements)

---

## 5. Border Radius Inconsistencies

### Issue: Mixed Usage of Variables and Hardcoded Values
**Severity: Low-Medium**

Some files use CSS variables, others use hardcoded values.

**Defined Variables:**
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-2xl: 16px;
--radius-full: 50%;
```

**Hardcoded Values Found:**
- `3px`, `4px`, `5px`, `6px`, `8px`, `10px`, `12px`, `15px`, `18px`, `20px`
- `50%` instead of `var(--radius-full)`
- `clamp()` values for border-radius (which is fine for responsive design)

**Recommendation:** 
1. Use variables for standard border-radius values
2. Keep `clamp()` for responsive border-radius
3. Document any special cases

---

## 6. Font Size Inconsistencies

### Issue: Mixed Units and Variable Usage
**Severity: Medium**

Some files use CSS variables, others use hardcoded `px` or `rem` values.

**Defined Variables:**
```css
--font-size-xs: clamp(6px, 0.7vw, 8px);
--font-size-sm: clamp(8px, 0.85vw, 10px);
--font-size-base: clamp(10px, 1vw, 12px);
--font-size-md: clamp(12px, 1.2vw, 14px);
--font-size-lg: clamp(14px, 1.4vw, 16px);
--font-size-xl: clamp(16px, 1.6vw, 18px);
--font-size-2xl: clamp(18px, 1.8vw, 20px);
--font-size-3xl: clamp(24px, 2.4vw, 28px);
```

**Hardcoded Values Found:**
- `7px`, `8px`, `9px`, `10px`, `11px`, `12px`, `14px`, `16px`, `18px`, `20px`, `24px`, `32px`
- Fixed `rem` values (e.g., `0.95rem`, `1.1rem`)
- Fixed `px` values that could use variables

**Recommendation:** 
1. Use font-size variables consistently
2. Reserve hardcoded values only for very specific use cases
3. Use `clamp()` for truly responsive typography

---

## 7. Box Shadow Inconsistencies

### Issue: Hardcoded Shadows vs CSS Variables
**Severity: Low-Medium**

`tokens.css` defines shadow variables, but many files use hardcoded complex shadows.

**Defined Variables:**
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.6);
--shadow-glow-primary: 0 0 10px var(--color-primary);
--shadow-glow-success: 0 0 10px var(--color-success);
```

**Issue:** Many files use complex multi-layer shadows that don't fit the simple variables.

**Recommendation:**
1. For simple shadows, use variables
2. For complex shadows (multiple layers), document them as design-specific
3. Consider adding more shadow variables if patterns emerge

---

## 8. Media Query Breakpoint Inconsistencies

### Issue: Hardcoded Breakpoints vs CSS Variables
**Severity: Medium**

`tokens.css` defines breakpoint variables, but media queries use hardcoded values.

**Defined Variables:**
```css
--breakpoint-xs: 399px;
--breakpoint-sm: 599px;
--breakpoint-md: 767px;
--breakpoint-lg: 1023px;
--breakpoint-xl: 1399px;
--breakpoint-2xl: 1400px;
```

**Hardcoded Values Found:**
- `399px`, `480px`, `599px`, `767px`, `768px`, `1023px`, `1024px`, `1399px`, `1400px`
- Some files use `768px` instead of `767px` (close but inconsistent)
- `480px` is not defined as a variable but used in responsive.css

**Note:** CSS custom properties cannot be used directly in media queries, but they can be referenced in comments for consistency.

**Recommendation:**
1. Add `--breakpoint-xs-small: 480px` if needed
2. Standardize on either `767px` or `768px` (prefer `767px` to match variable)
3. Document breakpoint usage in comments
4. Consider using a preprocessor or PostCSS plugin for variable-based media queries

---

## 9. Animation Keyframe Naming Inconsistencies

### Issue: Inconsistent Animation Naming
**Severity: Low**

Different naming conventions for similar animations.

**Examples:**
- `fade-in` vs `fadeIn` vs `menu-fade-in`
- `pulse` vs `pulse-glow` vs `live-pulse`
- `spin` vs `rotate` (though `spin` is more common)
- `slide-in` vs `slideIn` vs `menu-slide-in`

**Recommendation:**
1. Use kebab-case consistently (`fade-in`, not `fadeIn`)
2. Use descriptive prefixes (`menu-fade-in`, `button-pulse`)
3. Document animation naming convention

---

## 10. Duplicate Style Definitions

### Issue: Same Selectors Defined in Multiple Files
**Severity: Medium**

Some selectors appear in multiple files with potentially conflicting styles.

**Examples:**
- `.player-wrapper` - defined in both `player.css` and `effects.css`
- `.tv-screen::after` - defined in both `tv-frame.css` and `player.css`
- `.crt-scanlines` - defined in both `responsive.css` and `effects.css`
- Button styles (`.tv-btn`, `.remote-btn`) - defined in both `buttons.css` and component-specific files
- `.control-btn` - defined in both `layout.css` and `buttons.css`

**Recommendation:**
1. Consolidate duplicate definitions
2. Use CSS cascade order (import order in `styles.css`) to avoid conflicts
3. Document which file is the "source of truth" for each component

---

## 11. Formatting Inconsistencies

### Issue: Indentation and Code Style
**Severity: Low**

Minor formatting differences across files.

**Examples:**
- Some files use tabs, others use spaces (most use tabs, which is good)
- Some files have trailing whitespace
- Comment style varies (`/* */` vs `//` - CSS doesn't support `//` but some may appear)

**Recommendation:**
1. Use consistent indentation (tabs or spaces - stick with tabs if that's the standard)
2. Remove trailing whitespace
3. Use consistent comment style

---

## 12. CSS Variable Naming Inconsistencies

### Issue: Naming Conventions
**Severity: Low**

Most variables follow a good convention, but there are some inconsistencies.

**Examples:**
- Most use kebab-case: `--color-primary` ✓
- Some use descriptive prefixes: `--tv-frame-dark` ✓
- Mix of singular/plural: `--font-size-xs` vs `--font-sizes` (if it existed)

**Recommendation:**
1. Document naming convention: `--[category]-[property]-[modifier]`
2. Use singular for properties (`--font-size-xs`, not `--font-sizes-xs`)
3. Be consistent with prefixes (`--tv-*`, `--admin-*`, `--color-*`)

---

## Summary of Priorities

### High Priority
1. **Color Usage** - Replace hardcoded colors with CSS variables (improves theming and maintainability)
2. **Z-Index** - Standardize z-index usage to prevent layering conflicts

### Medium Priority
3. **Transition Timing** - Use CSS variables for consistency
4. **Spacing** - Standardize spacing using variables where applicable
5. **Media Query Breakpoints** - Document and standardize breakpoint values
6. **Duplicate Styles** - Consolidate duplicate selector definitions

### Low Priority
7. **Border Radius** - Use variables where possible
8. **Font Sizes** - Use variables where possible
9. **Animation Naming** - Standardize naming convention
10. **Formatting** - Ensure consistent code style

---

## Recommended Action Plan

1. **Phase 1: Colors** (High Impact)
   - Replace all hardcoded colors with CSS variables
   - Test visual consistency after changes

2. **Phase 2: Z-Index** (Medium-High Impact)
   - Map all z-index values to variables
   - Add missing variables to `tokens.css`
   - Document z-index layers

3. **Phase 3: Transitions & Spacing** (Medium Impact)
   - Standardize transition timings
   - Use spacing variables where applicable

4. **Phase 4: Cleanup** (Low-Medium Impact)
   - Consolidate duplicate styles
   - Standardize naming conventions
   - Fix formatting inconsistencies

---

## Files Most in Need of Attention

1. `responsive.css` - Most inconsistencies (colors, z-index, transitions, breakpoints)
2. `remote.css` - Many hardcoded colors and values
3. `menu.css` - Many hardcoded colors
4. `tv-frame.css` - Many hardcoded colors (though some are design-specific)
5. `buttons.css` - Some hardcoded colors and duplicate definitions

---

## Notes

- Some inconsistencies may be intentional for specific design requirements
- The use of `clamp()` for responsive sizing is good and should continue
- CSS variable usage in `tokens.css` is well-structured
- The modular CSS architecture (separate files) is good, but requires careful coordination

