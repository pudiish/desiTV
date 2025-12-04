/**
 * useErrors - Hook for monitoring and accessing application errors
 */

import { useState, useEffect } from 'react'

export function useErrors(errorAggregator) {
  const [errors, setErrors] = useState({
    total: 0,
    byType: {},
    byEndpoint: {},
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    recent: [],
  })

  useEffect(() => {
    if (!errorAggregator) {
      console.warn('[useErrors] No error aggregator provided')
      return
    }

    // Subscribe to error changes
    const unsubscribe = errorAggregator.onErrorsChange((summary) => {
      setErrors(summary)
    })

    // Initial errors
    setErrors(errorAggregator.getErrorSummary())

    return () => {
      unsubscribe()
    }
  }, [errorAggregator])

  return errors
}

export default useErrors
