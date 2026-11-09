// React Query queryKey 중앙 관리. 도메인별 네임스페이스로 캐시 무효화/조회 일관성 확보.
export const queryKeys = {
  analysis: {
    all: ['analysis'] as const,
    result: (sessionId: string) => ['analysis', sessionId] as const,
    run: (sessionId: string) => ['analysis', sessionId, 'run'] as const,
  },
  auth: {
    all: ['auth'] as const,
    me: (sessionId: string) => [...queryKeys.auth.all, 'me', sessionId] as const,
  },
} as const
