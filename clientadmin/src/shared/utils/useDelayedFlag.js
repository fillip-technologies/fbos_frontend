import { useEffect, useState } from 'react'

// `flag`, but only once it has stayed true for `delay` ms. Loading indicators use it so
// a fast or cached response never flashes a skeleton or a progress bar.
export function useDelayedFlag(flag, delay = 200) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!flag) {
      setShown(false)
      return undefined
    }
    const timer = setTimeout(() => setShown(true), delay)
    return () => clearTimeout(timer)
  }, [flag, delay])
  return flag && shown
}
