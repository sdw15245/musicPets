import { useMe } from '../features/auth/useAuth'

const emptyCatalog: string[] = []

export function useMyCharacters() {
  return useMe().data?.unlockedCharacters ?? emptyCatalog
}
