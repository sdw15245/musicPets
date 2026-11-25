# Frontend

## 역할

MusicPets의 로그인·음악 분석·결과 공유·추천 아티스트·커뮤니티 화면을 제공한다.

## 현재 상태

- React 19 + Vite 8 + TypeScript
- SEED Design + Tailwind CSS v4
- API 상태는 React Query, 브라우저 상태는 Zustand, 외부 입력 검증은 Zod(`zod/mini`: 쓰는 검증만 번들에 들어가도록 함수형 API를 쓴다. 예: `z.optional(z.string())`, `.check(z.minLength(1))`, `z.pipe(schema, z.transform(...))`)
- HTTP 요청은 `src/shared/api/http.ts`의 fetch 클라이언트를 쓴다. 일반 API는 `client.ts`의 `api`(Bearer 토큰, 401 시 한 번 refresh 후 재시도, 세션이 바뀐 응답은 버림), 쿠키가 필요한 세션 요청은 `session.ts`만 보낸다.
- 커뮤니티 게시물·댓글·공감은 서버 API를 사용한다.
- Access 토큰은 Zustand 메모리에만 보관하고 새로고침 시 HttpOnly refresh 쿠키로 복구한다. 인증 토큰을 localStorage·sessionStorage·URL에 보관하지 않는다. 인증 수단이 아닌 CSRF 토큰만 탭의 sessionStorage에 두어, 새로고침 때 `/api/auth/csrf`를 거치지 않고 바로 refresh를 요청한다. 토큰이 거부되면(`CSRF_INVALID`) 새로 받아 한 번 다시 시도한다.

## 구조 원칙

- `src/features/`: landing, auth, analysis, result, community, history, notifications, profile, mypage 기능별 화면·훅·스키마. `library/`에는 이전 링크를 위한 종료 안내 화면만 남긴다.
- `src/shared/`: API 클라이언트, 공통 UI, 캐릭터 데이터와 도감 상태.
- `src/styles/base.css`: 초기화·공통 레이아웃·공통 텍스트 스타일.
- `src/styles/theme.css`: 색상·간격·타이포그래피 변수.
- `src/features/*/*.css`: 기능별 스타일과 반응형 규칙.
- `src/shared/components/taste-preview.css`: 랜딩의 음악 펫 결과 미리보기.

펫 이미지는 `shared/characters.json`의 1024px PNG(`imageUrl`, 백엔드 응답용)를 화면에 그대로 쓰지 않는다. `src/shared/characters.ts`가 `src/assets/characters/`의 WebP 사본으로 바꿔 `imageUrl`(640px)과 `thumbUrl`(192px, 96 CSS px 이하의 아바타·썸네일용)을 제공한다. 원본을 바꾸거나 펫을 추가하면 `frontend/`에서 `python scripts/optimize-character-images.py`(Pillow 필요)로 사본을 다시 만든다. 스키마와 Node에서 도는 테스트는 번들러 기능이 없는 `src/shared/characterCatalog.ts`를 쓴다.

펫마다 `shared/characters.json`의 `color`가 있다. 결과 요약 카드, 공유 이미지, 만난 펫 카드는 그 펫의 색을 배경으로 쓰고, 아직 만나지 않은 펫은 흑백(`grayscale`)으로 보여주며 이야기는 잠근다. 화면 문구에는 전체 펫 수를 적지 않는다. Spotify 로고는 출처 표시로만 쓰고 "에서 듣기" 같은 문장 일부로 붙이지 않는다.

`community.css`는 선택자마다 규칙을 한 번만 두고, 화면 폭 기준은 1150px(좁은 데스크톱)과 767px(휴대폰) 두 가지만 쓴다. 다른 기능 CSS에는 아직 1100·1023·960·880·639·560·479·359px 기준이 남아 있으니, 새로 만드는 규칙은 767px 기준을 우선 쓴다. 본문 글꼴 Pretendard는 `index.html`에서 버전을 고정한 링크(`pretendard@v1.3.9`)로 불러온다.

기능 전용 타입을 다른 화면이나 임시 테스트 폴더에 두지 않는다. 같은 파일에 속한 스타일을 수정하며, 개편 때마다 별도 덮어쓰기 CSS를 추가하지 않는다. `main.tsx`는 SEED 컴포넌트 스타일 이후 제품 스타일을 불러온다.

## 실행·검증

```powershell
npm ci
npm run dev
npm run build
npm run lint
npm run test:e2e -- --workers=2
npm run test:e2e:preview -- --workers=2
```

Playwright는 설치된 Google Chrome을 사용하며 5178 포트에서 외부 API를 모킹한다. 실제 OAuth와 플레이리스트 저장은 별도 연동 검증이 필요하다.

브랜드 글꼴 `public/fonts/DNFBitBitv2.otf`(1.8 MB)는 네오플 라이선스상 수정·서브셋할 수 없다. 헤더·푸터 로고는 이 글꼴로 조판한 윤곽선을 `BrandLogo.tsx`에 SVG로 넣어 화면마다 글꼴을 받지 않으며, 원본 글꼴은 공유 이미지를 만들 때만 불러온다. 로고 문구를 바꾸면 윤곽선을 다시 추출한다. 화면 제목은 `RouteTitle.tsx`에서 경로별로 정하고, 링크 미리보기용 `og:` 태그는 `index.html`에 절대 주소로 둔다. 글·댓글·알림 시각은 `src/shared/dates.ts`의 `activityTime`(일주일 안은 "3분 전" 같은 상대 시간)으로 표시하고, 정확한 시각은 `title`로 보여준다. 분석 기록 날짜는 기존 `historyFormat.ts`를 쓴다.

`test:e2e:preview`는 실제 배포용 빌드를 대상으로 같은 테스트를 실행한다. `build`는 초기 JavaScript 합계가 gzip 150 kB 이하이고, 개별 JavaScript 파일이 500 kB 이하인지도 확인한다. 첫 다운로드에는 랜딩 화면만 들어간다. 분석·결과·커뮤니티·마이페이지·로그인·OAuth 콜백 화면은 방문할 때 불러오며, 다운로드 중에는 로딩 상태와 실패 시 새로고침 안내를 제공한다. 분석·결과 화면(`src/routeModules.ts`)은 전환을 기다리지 않도록 미리 받는다: 랜딩·헤더의 해당 링크에 포인터나 포커스가 닿을 때, 저장된 결과가 있는 랜딩의 유휴 시간, 분석이 진행되는 동안. 랜딩의 펫 상세 다이얼로그와 헤더의 프로필 메뉴도 처음 쓸 때 불러온다. 공유 이미지 생성 코드는 공유창을 열 때 동적으로 불러온다. 로딩 중에도 창을 닫을 수 있으며, 코드 다운로드 또는 이미지 생성 실패 시 다시 만들기를 제공한다.

개발 서버 주소는 `http://127.0.0.1:5173`이다. 로컬 인증 설정은 [루트 README](../README.md#로컬-인증키-설정)를 참고한다.

분석 캐시는 로그인 세션별, 커뮤니티 기록·도감은 사용자 ID별로 분리한다. 커뮤니티 글·댓글은 보는 사람(`guest` 또는 사용자 ID, `useViewer`)별로 캐시한다. 로그인 상태였던 탭은 세션 확인이 끝날 때까지 글 목록 요청을 미루고, 그 밖의 경우 게스트 목록을 먼저 보여준 뒤 로그인이 확인되면 같은 목록을 자리표시로 둔 채 다시 받는다. 게스트로 확인된 세션은 `sessionId`를 바꾸지 않는다. 브라우저 기록 분리에 사용하는 JWT subject는 인증 검증을 대신하지 않는다.

커뮤니티 글은 문장을 먼저, 곡은 가벼운 행(앨범아트·곡명·아티스트·Spotify 로고)으로 보여준다. Spotify 플레이어(iframe)는 "듣기"를 눌렀을 때만 불러온다. 운영 빌드(`vite.config.ts`)는 `index.html`에 API 주소(`src/shared/api/origins.ts`) preconnect를 넣고, `vercel.json`은 해시된 `/assets/*`를 1년간 캐시하며 그 경로는 SPA로 rewrite하지 않는다.
