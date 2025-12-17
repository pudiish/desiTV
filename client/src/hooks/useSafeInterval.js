import { useEffect, useRef } from 'react';

/**
 * useSafeInterval - Hook that automatically cleans up intervals
 * Prevents memory leaks by ensuring cleanup on unmount
 * 
 * Usage:
 *   useSafeInterval(() => {
 *     // Your code
 *   }, 1000);
 */
export function useSafeInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

/**
 * useSafeTimeout - Hook that automatically cleans up timeouts
 * Prevents memory leaks by ensuring cleanup on unmount
 * 
 * Usage:
 *   useSafeTimeout(() => {
 *     // Your code
 *   }, 1000);
 */
export function useSafeTimeout(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay !== null) {
      const id = setTimeout(() => {
        savedCallback.current();
      }, delay);
      return () => clearTimeout(id);
    }
  }, [delay]);
}

/**
 * useIntervalRef - Returns a ref that can be used to store interval IDs
 * Automatically cleans up on unmount
 * 
 * Usage:
 *   const intervalRef = useIntervalRef();
 *   intervalRef.current = setInterval(fn, delay);
 *   // Cleanup happens automatically
 */
export function useIntervalRef() {
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return intervalRef;
}

/**
 * useTimeoutRef - Returns a ref that can be used to store timeout IDs
 * Automatically cleans up on unmount
 * 
 * Usage:
 *   const timeoutRef = useTimeoutRef();
 *   timeoutRef.current = setTimeout(fn, delay);
 *   // Cleanup happens automatically
 */
export function useTimeoutRef() {
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return timeoutRef;
}

