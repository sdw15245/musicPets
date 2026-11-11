import type { AnalysisResult } from './schemas'

export const genrePercent = (value = 0) => Math.round(value * 1000) / 10
export const genreDifference = (before = 0, after = 0) =>
  Math.round((genrePercent(after) - genrePercent(before)) * 10) / 10

export function previousAnalysis(current: AnalysisResult, records: AnalysisResult[]) {
  const timestamp = Date.parse(current.analyzedAt)
  return records.filter(record => record.id !== current.id && Date.parse(record.analyzedAt) < timestamp)
    .sort((a, b) => Date.parse(b.analyzedAt) - Date.parse(a.analyzedAt))[0]
}
