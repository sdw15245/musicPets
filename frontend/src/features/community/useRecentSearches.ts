import { useState } from 'react'

const MAX_RECENT_SEARCHES = 10

function readSearches(key: string | null): string[] {
  if (!key) return []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((term): term is string =>
      typeof term === 'string' && !!term.trim() && term.length <= 100,
    ))].slice(0, MAX_RECENT_SEARCHES)
  } catch { return [] }
}

// The parent remounts when the account changes; guests never read or save history.
export function useRecentSearches(owner: string | null) {
  const key = owner ? `community-searches:${owner}` : null
  const [terms, setTerms] = useState(() => readSearches(key))
  const update = (next: string[]) => {
    if (!key) return
    setTerms(next)
    try {
      if (next.length) localStorage.setItem(key, JSON.stringify(next))
      else localStorage.removeItem(key)
    } catch { /* Search still works when browser storage is unavailable. */ }
  }
  return {
    terms,
    add: (term: string) => {
      if (term) update([term, ...terms.filter(value => value.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT_SEARCHES))
    },
    remove: (term: string) => update(terms.filter(value => value !== term)),
    clear: () => update([]),
  }
}
