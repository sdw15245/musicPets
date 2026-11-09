import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export default function RouteScrollRestoration() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef(pathname)

  useLayoutEffect(() => {
    const changedPage = previousPath.current !== pathname
    previousPath.current = pathname
    // Keep native history restoration and in-page search/anchor navigation.
    if (!changedPage || navigationType === 'POP') return
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [pathname, hash, navigationType])

  return null
}
