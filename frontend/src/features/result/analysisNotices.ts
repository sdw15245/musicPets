const legacyPopularityWarning = '일부 곡의 청취자 수가 없어 대중성 분석에서 제외했어요.'

// 주의: 서버 경고는 코드가 아닌 문장이라 문구로 구분한다. 백엔드 Popularity.java의 문구가 바뀌면 함께 고친다.
export const isPopularityNotice = (warning: string) => warning === legacyPopularityWarning || warning.includes('Last.fm 청취자 수')
export const popularityNoticeText = (warning: string) => warning === legacyPopularityWarning
  ? '확인할 수 있는 곡의 Last.fm 청취자 수만 대중성 계산에 사용했어요.'
  : warning
