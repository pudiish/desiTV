/**
 * Tests for utility functions (clsx, twMerge, cn)
 */

import { cn } from './utils'

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should combine class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should filter out falsy values', () => {
      expect(cn('foo', false, 'bar', null, 'baz')).toBe('foo bar baz')
    })

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
    })

    it('should handle objects', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
    })

    it('should handle mixed inputs', () => {
      expect(cn('foo', { bar: true, baz: false }, 'qux')).toBe('foo bar qux')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null, undefined, false)).toBe('')
    })

    it('should merge conflicting Tailwind classes', () => {
      // Simple merge - last class wins for same prefix
      const result = cn('p-4', 'p-8')
      expect(result).toContain('p-8')
      expect(result).not.toContain('p-4')
    })

    it('should preserve non-conflicting classes', () => {
      const result = cn('p-4', 'm-2', 'text-red-500')
      expect(result).toContain('p-4')
      expect(result).toContain('m-2')
      expect(result).toContain('text-red-500')
    })
  })
})

