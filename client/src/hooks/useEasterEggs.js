/**
 * Easter Eggs Hook
 * 
 * Hidden features for the nostalgic Indian TV experience:
 * - Konami Code: ↑↑↓↓←→←→BA → Special message
 * - 1947: Independence Day special
 * - 2011: Cricket World Cup memory
 * - 9XM: VJ Mode activation
 * - DD1: Doordarshan nostalgia
 */

import { useEffect, useRef, useCallback, useState } from 'react'

// Konami Code sequence
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

// Special channel codes (type these on number pad)
const SPECIAL_CODES = {
  '1947': {
    name: 'Independence Day Mode',
    message: '🇮🇳 JAI HIND! VANDE MATARAM! 🇮🇳',
    emoji: '🇮🇳',
    duration: 5000
  },
  '2011': {
    name: 'World Cup 2011',
    message: '🏏 INDIA WORLD CHAMPION 2011! DHONI FINISHES IN STYLE! 🏆',
    emoji: '🏏',
    duration: 5000
  },
  '9999': {
    name: 'Developer Mode',
    message: '🛠️ DEVELOPER MODE ACTIVATED. MADE WITH ❤️ BY ISHWAR',
    emoji: '🛠️',
    duration: 3000
  },
  '0000': {
    name: 'Retro Reset',
    message: '📺 PURANA ZAMANA MODE - ALL CLASSICS INCOMING!',
    emoji: '📺',
    duration: 3000
  },
  '1234': {
    name: 'Quick Test',
    message: '✅ SAB THEEK HAI! SYSTEM WORKING PERFECTLY!',
    emoji: '✅',
    duration: 3000
  }
}

export function useEasterEggs(onEasterEgg) {
  const [currentCode, setCurrentCode] = useState('')
  const [lastEasterEgg, setLastEasterEgg] = useState(null)
  const konamiSequenceRef = useRef([])
  const codeTimeoutRef = useRef(null)

  // Check for Konami code
  const checkKonamiCode = useCallback((key) => {
    konamiSequenceRef.current.push(key)
    
    // Keep only last N keys (length of Konami code)
    if (konamiSequenceRef.current.length > KONAMI_CODE.length) {
      konamiSequenceRef.current.shift()
    }
    
    // Check if sequence matches
    const matches = konamiSequenceRef.current.every((k, i) => k === KONAMI_CODE[i])
    
    if (matches && konamiSequenceRef.current.length === KONAMI_CODE.length) {
      konamiSequenceRef.current = []
      return true
    }
    
    return false
  }, [])

  // Check for special number codes
  const checkSpecialCode = useCallback((digit) => {
    // Clear timeout and reset code after inactivity
    if (codeTimeoutRef.current) {
      clearTimeout(codeTimeoutRef.current)
    }
    
    const newCode = (currentCode + digit).slice(-4) // Keep last 4 digits
    setCurrentCode(newCode)
    
    // Reset code after 2 seconds of inactivity
    codeTimeoutRef.current = setTimeout(() => {
      setCurrentCode('')
    }, 2000)
    
    // Check if code matches
    if (SPECIAL_CODES[newCode]) {
      setCurrentCode('')
      return SPECIAL_CODES[newCode]
    }
    
    return null
  }, [currentCode])

  // Trigger easter egg callback
  const triggerEasterEgg = useCallback((egg) => {
    setLastEasterEgg(egg)
    
    if (onEasterEgg) {
      onEasterEgg(egg)
    }
    
    // Clear after duration
    setTimeout(() => {
      setLastEasterEgg(null)
    }, egg.duration || 3000)
  }, [onEasterEgg])

  // Key event handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }
      
      // Check Konami code
      if (checkKonamiCode(e.key)) {
        triggerEasterEgg({
          name: 'Konami Code',
          message: '🎮 KONAMI CODE ACTIVATED! AAP HO ASLI GAMER! 🎮',
          emoji: '🎮',
          duration: 5000
        })
        return
      }
      
      // Check number codes
      if (/^[0-9]$/.test(e.key)) {
        const specialCode = checkSpecialCode(e.key)
        if (specialCode) {
          triggerEasterEgg(specialCode)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (codeTimeoutRef.current) {
        clearTimeout(codeTimeoutRef.current)
      }
    }
  }, [checkKonamiCode, checkSpecialCode, triggerEasterEgg])

  return {
    currentCode,
    lastEasterEgg,
    isActive: lastEasterEgg !== null
  }
}

export default useEasterEggs


