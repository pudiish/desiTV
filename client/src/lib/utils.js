/**
 * Custom utility functions to replace clsx and tailwind-merge
 * Reduces dependencies and bundle size
 */

/**
 * Combines class names, filtering out falsy values
 * Replacement for clsx
 */
function clsx(...inputs) {
  const classes = [];
  for (const input of inputs) {
    if (!input) continue;
    
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const inner = clsx(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const key in input) {
        if (input[key]) {
          classes.push(key);
        }
      }
    }
  }
  return classes.join(' ');
}

/**
 * Merges Tailwind CSS classes, resolving conflicts
 * Replacement for tailwind-merge
 * Simplified version - handles common cases
 */
function twMerge(...inputs) {
  const merged = clsx(...inputs);
  if (!merged) return '';
  
  // Split by spaces and deduplicate conflicting classes
  const classes = merged.split(/\s+/);
  const classMap = new Map();
  
  // Group classes by prefix (e.g., 'p-', 'm-', 'text-', etc.)
  for (const cls of classes) {
    if (!cls) continue;
    
    // Extract prefix (everything before the last dash and number/value)
    const prefixMatch = cls.match(/^([a-z]+(?:-[a-z]+)*?)-/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      // Store the last occurrence of each prefix group
      classMap.set(prefix, cls);
    } else {
      // Non-conflicting class (no prefix pattern)
      classMap.set(cls, cls);
    }
  }
  
  return Array.from(classMap.values()).join(' ');
}

/**
 * Combined class name utility (cn = className)
 * Combines clsx and twMerge functionality
 */
export function cn(...inputs) {
  return twMerge(clsx(...inputs));
}

