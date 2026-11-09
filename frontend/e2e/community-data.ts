import type { CommunityPost, CommunityTrack } from '../src/features/community/schemas'
// 디자인 확인용 샘플. 실제 Spotify 검색 응답과 구분해 사용한다.
export const sampleTracks: CommunityTrack[] = [
  { name: 'seasons', artist: 'wave to earth', uri: 'spotify:track:5VBjyOQzqlPNgdRPMM6prF', imageUrl: '', color: 'forest' },
  { name: 'Everything', artist: '검정치마', uri: 'spotify:track:3QjI2bkcaQalyd1k0qvmYj', imageUrl: '', color: 'violet' },
  { name: 'Square (2017)', artist: '백예린', uri: 'spotify:track:2cTK5kS6aPYBNdhUQCzFN7', imageUrl: '', color: 'blue' },
  { name: 'Dynamite', artist: 'BTS', uri: 'spotify:track:0t1kP63rueHleOhQkYSXFY', imageUrl: '', color: 'sunset' },
  { name: '가을밤에 든 생각', artist: '잔나비', uri: '', imageUrl: '', color: 'sand' },
  { name: '밤편지', artist: '아이유', uri: '', imageUrl: '', color: 'rose' },
]
export const samplePosts: CommunityPost[] = [
  { id: 'sample-1', author: '초록밤', petSlug: 'mochi', track: sampleTracks[1], caption: '하루가 끝나갈 때, 아무 생각 없이 듣기 좋아요.\n오늘도 수고한 사람들에게 이 노래를 건네고 싶어요.', tags: ['밤산책'], createdAt: '', likes: 24, own: false, liked: false, commentCount: 0 },
  { id: 'sample-2', author: '유월', petSlug: 'mochi', track: sampleTracks[2], caption: '버스 창가에 앉아 듣는 오늘의 첫 곡.\n익숙한 출근길도 영화의 한 장면처럼 느껴져요.', tags: ['출근길'], createdAt: '', likes: 18, own: false, liked: false, commentCount: 0 },
  { id: 'sample-3', author: '리듬산책', petSlug: 'pip', track: sampleTracks[3], caption: '오늘은 조금 신나게 걸어보려고요.\n이어폰을 끼면 발걸음부터 달라지는 곡!', tags: ['기분전환'], createdAt: '', likes: 32, own: false, liked: false, commentCount: 0 },
  { id: 'sample-4', author: '느린오후', petSlug: 'bongbong', track: sampleTracks[5], caption: '책상 위 작은 조명 하나 켜두고 듣는 음악.\n차분한 밤을 보내고 싶은 분께 추천해요.', tags: ['작업할때'], createdAt: '', likes: 11, own: false, liked: false, commentCount: 0 },
  { id: 'sample-5', author: '가을수집가', petSlug: 'yuze', track: sampleTracks[4], caption: '바람이 선선해지면 꼭 다시 찾게 되는 노래.\n여러분에게도 계절이 바뀌면 생각나는 곡이 있나요?', tags: ['산책'], createdAt: '', likes: 16, own: false, liked: false, commentCount: 0 },
]


