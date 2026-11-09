// 앱 라우팅 정의. path → 페이지 컴포넌트 매핑.
import { lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { restoreSession } from './features/auth/session'
import LandingPage from './features/landing/LandingPage'
import AnalyzePage from './features/analysis/AnalyzePage'
import ResultPage from './features/result/ResultPage'
import RequireAuth from './shared/components/RequireAuth'
import NotFoundPage from './shared/components/NotFoundPage'
import RouteBoundary from './shared/components/RouteBoundary'
import RouteScrollRestoration from './shared/components/RouteScrollRestoration'

const LoginPage = lazy(() => import('./features/auth/LoginPage'))
const OAuthCallback = lazy(() => import('./features/auth/OAuthCallback'))
const CommunityPage = lazy(() => import('./features/community/CommunityPage'))
const MyPage = lazy(() => import('./features/mypage/MyPage'))
const HistoryPage = lazy(() => import('./features/history/HistoryPage'))
const HistoryDetailPage = lazy(() => import('./features/history/HistoryDetailPage'))
const PetsPage = lazy(() => import('./features/landing/PetsPage'))
const LibraryPage = lazy(() => import('./features/library/LibraryPage'))
const NotificationsPage = lazy(() => import('./features/notifications/NotificationsPage'))
const PostDetailPage = lazy(() => import('./features/community/PostDetailPage'))

function App() {
  useEffect(() => { void restoreSession() }, [])
  return (
    <BrowserRouter>
      <RouteBoundary>
        <RouteScrollRestoration />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/posts/:id" element={<PostDetailPage />} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/history/:id" element={<RequireAuth><HistoryDetailPage /></RequireAuth>} />
          <Route path="/pets" element={<RequireAuth><PetsPage /></RequireAuth>} />
          <Route path="/library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
          <Route path="/analyze" element={<RequireAuth><AnalyzePage /></RequireAuth>} />
          <Route path="/result" element={<RequireAuth><ResultPage /></RequireAuth>} />
          <Route
            path="/test"
            element={
              <RequireAuth>
                <Navigate to="/analyze" replace />
              </RequireAuth>
            }
          />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteBoundary>
    </BrowserRouter>
  )
}

export default App
