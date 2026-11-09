export const analysisDate = (date: string) => new Date(date).toLocaleString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
})
