import type { Page } from '@playwright/test'
import { samplePosts, sampleTracks } from './community-data'
import type { CommunityComment, CommunityPost } from '../src/features/community/schemas'
import { mockAuth } from './auth-fixture'

const mocked = new WeakSet<Page>()
export async function mockCommunity(page: Page) {
  if (mocked.has(page)) return
  mocked.add(page)
  let rows = samplePosts.map((post, index) => ({ ...post, id: String(index + 1), token: '' }))
  let nextId = 100
  let comments: (CommunityComment & { token: string })[] = []
  let nextCommentId = 1
  const likes = new Map<string, Set<string>>()
  await page.route(/\/api\/posts\/\d+\/like$/, route => {
    const request = route.request()
    const token = request.headers().authorization ?? ''
    if (!token) return route.fulfill({ status: 401 })
    const id = new URL(request.url()).pathname.split('/')[3]
    const post = rows.find(post => post.id === id)
    if (!post) return route.fulfill({ status: 404 })
    const users = likes.get(id) ?? new Set<string>()
    if (request.method() === 'PUT') users.add(token)
    if (request.method() === 'DELETE') users.delete(token)
    likes.set(id, users)
    return route.fulfill({ json: { likes: post.likes + users.size, liked: users.has(token) } })
  })
  await page.route(/\/api\/posts\/\d+\/comments(?:\/\d+)?(?:\?.*)?$/, async route => {
    const request = route.request()
    const url = new URL(request.url())
    const token = request.headers().authorization ?? ''
    const postId = url.pathname.split('/')[3]
    const id = url.pathname.split('/')[5]
    if (request.method() === 'GET') {
      const pageNo = Number(url.searchParams.get('page') ?? 0)
      const roots = comments.filter(comment => comment.postId === postId && !comment.parentId).reverse()
      const selected = roots.slice(pageNo * 20, (pageNo + 1) * 20)
      const replies = comments.filter(comment => selected.some(root => root.id === comment.parentId))
      return route.fulfill({ json: { items: [...selected, ...replies].map(comment => ({ ...comment, own: !!token && comment.token === token && !comment.deleted })), page: pageNo, hasMore: roots.length > (pageNo + 1) * 20 } })
    }
    if (!token) return route.fulfill({ status: 401 })
    if (id) {
      const comment = comments.find(comment => comment.id === id && comment.postId === postId)
      if (!comment) return route.fulfill({ status: 404 })
      if (comment.token !== token) return route.fulfill({ status: 403 })
      if (request.method() === 'DELETE') {
        comment.deleted = true; comment.body = ''; comment.author = ''; comment.own = false
        return route.fulfill({ status: 204 })
      }
      comment.body = request.postDataJSON().body
      return route.fulfill({ json: comment })
    }
    const { body, parentId } = request.postDataJSON()
    const comment = { id: String(nextCommentId++), postId, parentId, body, author: '음악 친구', avatarSlug: null, createdAt: new Date().toISOString(), deleted: false, own: true, token }
    comments.push(comment)
    return route.fulfill({ status: 201, json: comment })
  })
  await page.route('**/api/tracks/search?*', route => {
    const query = new URL(route.request().url()).searchParams.get('q')!.toLowerCase()
    return route.fulfill({ json: sampleTracks.filter(track => track.uri && `${track.name} ${track.artist}`.toLowerCase().includes(query)) })
  })
  await page.route(/\/api\/posts(?:\/\d+)?(?:\?.*)?$/, async route => {
    const request = route.request()
    const url = new URL(request.url())
    const token = request.headers().authorization ?? ''
    const id = url.pathname.split('/')[3]
    if (request.method() === 'GET') {
      let selected = rows.map(post => ({ ...post, own: !!token && post.token === token,
        commentCount: comments.filter(comment => comment.postId === post.id && !comment.deleted).length,
        likes: post.likes + (likes.get(post.id)?.size ?? 0), liked: !!token && (likes.get(post.id)?.has(token) ?? false) }))
      if (id) {
        const post = selected.find(post => post.id === id)
        return route.fulfill(post ? { json: post } : { status: 404 })
      }
      if (url.searchParams.get('view') === 'mine') selected = selected.filter(post => post.own)
      const pet = url.searchParams.get('pet') ?? 'mochi'
      if (url.searchParams.get('filter') === 'same') selected = selected.filter(post => post.petSlug === pet)
      if (url.searchParams.get('filter') === 'other') selected = selected.filter(post => post.petSlug && post.petSlug !== pet)
      const query = (url.searchParams.get('q') ?? '').trim().replace(/^#+/, '').trim().toLowerCase()
      if (query) selected = selected.filter(post => post.caption.toLowerCase().includes(query) || post.tags.some(tag => tag.toLowerCase().includes(query)))
      if (url.searchParams.get('sort') === 'popular') selected.sort((a, b) => b.likes - a.likes)
      const pageNo = Number(url.searchParams.get('page') ?? 0)
      return route.fulfill({ json: { items: selected.slice(pageNo * 20, (pageNo + 1) * 20), page: pageNo, hasMore: selected.length > (pageNo + 1) * 20 } })
    }
    if (request.method() === 'DELETE') { rows = rows.filter(post => post.id !== id); comments = comments.filter(comment => comment.postId !== id); likes.delete(id); return route.fulfill({ status: 204 }) }
    const body = request.postDataJSON()
    // 현재 작성창에 표시된 프로필을 테스트 응답에 사용한다.
    const author = (await page.locator('.share-identity').innerText()).split(' 이름으로')[0].trim()
    const post: CommunityPost & { token: string } = {
      id: id ?? String(nextId++), author, token, avatarSlug: null,
      petSlug: token.includes('test-access') ? 'pip' : null,
      track: sampleTracks.find(track => track.uri === body.trackUri)!, caption: body.caption,
      tags: body.tags, createdAt: new Date().toISOString(), likes: 0, own: true, liked: false,
      commentCount: comments.filter(comment => comment.postId === id && !comment.deleted).length,
    }
    if (id) rows = rows.map(previous => previous.id === id ? post : previous)
    else rows.unshift(post)
    return route.fulfill({ status: id ? 200 : 201, json: post })
  })
}

export async function signedInPreview(page: Page, pet: string | null = 'mochi') {
  await mockCommunity(page)
  await mockAuth(page, 'preview-access')
  const profiles = new Map<string, { nickname: string | null }>()
  await page.route('**/api/analysis/latest', route => route.fulfill({ status: 204 }))
  await page.route('**/api/me', route => {
    const token = route.request().headers().authorization ?? ''
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      profiles.set(token, { nickname: body.name })
    }
    return route.fulfill({ json: {
    id: 1, spotifyId: 'music-friend', displayName: '음악 친구', email: '',
    nickname: null, analyzedPet: token.includes('preview-access') ? pet : null,
    unlockedCharacters: pet ? [pet] : [], ...profiles.get(token),
    } })
  })
}

export async function mockPlayers(page: Page) {
  await mockCommunity(page)
  await page.route('https://open.spotify.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Spotify player</p>' }))
}
