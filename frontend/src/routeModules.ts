// Route modules that load on demand but are fetched early when someone is likely to open them,
// so moving between the landing, analysis and result screens does not wait for a download.
export const loadAnalyzePage = () => import('./features/analysis/AnalyzePage')
export const loadResultPage = () => import('./features/result/ResultPage')
