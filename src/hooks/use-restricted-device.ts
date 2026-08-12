import { useEffect, useState } from 'react'

const COMPUTER_QUERY = '(pointer: fine) and (hover: hover)'
const PORTRAIT_QUERY = '(orientation: portrait)'
const TABLET_MIN_SHORT_AXIS = 768

function computeIsRestricted() {
  if (typeof window === 'undefined') return false

  const isComputer = window.matchMedia(COMPUTER_QUERY).matches
  if (isComputer) return false

  const isPortrait = window.matchMedia(PORTRAIT_QUERY).matches
  const isTablet =
    Math.min(window.innerWidth, window.innerHeight) >= TABLET_MIN_SHORT_AXIS

  return isTablet ? isPortrait : true
}

/**
 * True on phones (any orientation) and tablets in portrait. Devices with a
 * mouse/trackpad (a "computer") and tablets in landscape are never restricted.
 */
export function useIsRestrictedDevice() {
  const [isRestricted, setIsRestricted] = useState(computeIsRestricted)

  useEffect(() => {
    const queries = [
      window.matchMedia(COMPUTER_QUERY),
      window.matchMedia(PORTRAIT_QUERY),
    ]

    function handleChange() {
      setIsRestricted(computeIsRestricted())
    }

    queries.forEach((query) => query.addEventListener('change', handleChange))
    window.addEventListener('resize', handleChange)

    return () => {
      queries.forEach((query) =>
        query.removeEventListener('change', handleChange),
      )
      window.removeEventListener('resize', handleChange)
    }
  }, [])

  return isRestricted
}
