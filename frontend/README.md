# Frontend

## 역할

MusicPets의 로그인·음악 분석·결과 공유·추천 아티스트·커뮤니티 화면을 제공한다.

## 현재 상태

- React 19 + Vite 8 + TypeScript
- SEED Design + Tailwind CSS v4
- API 상태는 React Query, 브라우저 상태는 Zustand, 외부 입력 검증은 Zod
- 커뮤니티 게시물·댓글·공감은 서버 API를 사용한다.
- Access 토큰은 Zustand 메모리에만 보관하고 새로고침 시 HttpOnly refresh 쿠키로 복구한다. 인증 토큰을 localStorage·sessionStorage·URL에 보관하지 않는다.

## 구조 원칙

- `src/features/`: landing, auth, analysis, result, community, history, notifications, profile, mypage 기능별 화면·훅·스키마. `library/`에는 이전 링크를 위한 종료 안내 화면만 남긴다.
- `src/shared/`: API 클라이언트, 공통 UI, 캐릭터 데이터와 도감 상태.
- `src/styles/base.css`: 초기화·공통 레이아웃·공통 텍스트 스타일.
- `src/styles/theme.css`: 색상·간격·타이포그래피 변수.
- `src/features/*/*.css`: 기능별 스타일과 반응형 규칙.
- `src/shared/components/taste-preview.css`: 랜딩의 음악 펫 결과 미리보기.

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

`test:e2e:preview`는 실제 배포용 빌드를 대상으로 같은 테스트를 실행한다. `build`는 초기 JavaScript 합계가 gzip 220 kB 이하이고, 개별 JavaScript 파일이 500 kB 이하인지도 확인한다. 커뮤니티·마이페이지·로그인·OAuth 콜백 화면은 방문할 때 불러오며, 다운로드 중에는 로딩 상태와 실패 시 새로고침 안내를 제공한다. 분석·결과 화면은 기존 표시 흐름을 유지하도록 즉시 준비한다. 공유 이미지 생성 코드는 공유창을 열 때 동적으로 불러온다. 로딩 중에도 창을 닫을 수 있으며, 코드 다운로드 또는 이미지 생성 실패 시 다시 만들기를 제공한다.

개발 서버 주소는 `http://127.0.0.1:5173`이다. 로컬 인증 설정은 [루트 README](../README.md#로컬-인증키-설정)를 참고한다.

분석 캐시는 로그인 세션별, 커뮤니티 기록·도감은 사용자 ID별로 분리한다. 브라우저 기록 분리에 사용하는 JWT subject는 인증 검증을 대신하지 않는다.
