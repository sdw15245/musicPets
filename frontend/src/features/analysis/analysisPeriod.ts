import type { AnalysisResult } from './schemas'

// Results stored before the four-week rollout used Spotify's six-month period.
export const analysisPeriod = (data: AnalysisResult) => data.genres.timeRange ?? 'medium_term'
export function analysisPeriodLabel(data: AnalysisResult) {
  return { short_term: '최근 4주', medium_term: '최근 6개월', long_term: '최근 1년' }[analysisPeriod(data)]
}
