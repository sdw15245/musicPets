# musicPets

사용자 음악 취향기반 캐릭터 매칭 서비스

Spotify에서 최근 듣는 음악으로 나를 닮은 음악 펫을 발견하고 SNS에 공유하는 서비스입니다. 취향 설명과 추천 아티스트는 결과를 더 즐기는 부가 기능이며, 커뮤니티에서는 곡을 공유하고 음악 이야기를 이어갑니다.

- `frontend/`: React 웹 앱. 실행·구조는 [프론트 문서](frontend/README.md).
- `backend/`: Java 21 / Spring Boot API와 MySQL 저장소.
- DB 구조 변경: [Flyway 도입·변경 절차](backend/MIGRATIONS.md). Hibernate 자동 변경 대신 SQL 버전으로 관리합니다.
- `shared/characters.json`: 프론트 도감과 백엔드 매칭이 함께 쓰는 캐릭터 원본.

프론트와 백엔드는 각각 실행하되 빌드 시 `shared/`의 상대 경로를 유지합니다. 실제 서버 실행에는 DB 및 Spotify·Last.fm·Gemini 환경 설정이 필요합니다.

## 로컬 인증키 설정

`backend/.env.example`을 참고해 `backend/.env`를 준비합니다. `JWT_SECRET`은 필수이며 기본키나 빈 값으로 실행할 수 없습니다. 다음 명령으로 64바이트 난수 키를 생성해 `.env`의 `JWT_SECRET`에 설정합니다.

```powershell
node -e "console.log(require('node:crypto').randomBytes(64).toString('base64'))"
```

키는 환경마다 별도로 생성하고 `.env`는 Git에 올리지 않습니다. 키를 바꾸면 기존 로그인 토큰이 무효화되므로 다시 로그인해야 합니다. 테스트는 별도의 테스트 키와 H2 DB를 사용합니다.

로컬에서는 `backend/.env`에 `AUTH_COOKIE_SECURE=false`를 설정하고 프론트를 **http://127.0.0.1:5173**으로 엽니다. 백엔드와 Spotify 콜백도 `127.0.0.1`을 사용합니다. `localhost`와 섞으면 쿠키가 전달되지 않습니다. 배포 환경의 쿠키는 기본값인 `Secure=true`와 HTTPS를 사용합니다.

Access 토큰은 앱 메모리에, refresh 토큰은 HttpOnly 쿠키에 보관합니다. 이전 버전의 `localStorage` 인증 정보는 제거하므로 적용 후 한 번 다시 로그인해야 합니다.

분석·추천·검색·게시 등의 API에는 계정/IP별 요청 제한과 외부 API 작업의 동시 실행 상한을 적용합니다.

## 분석 기준과 Redis 캐시

새 분석은 Spotify `short_term`(최근 약 4주)의 선호도 상위 **최대 20곡**을 사용합니다. 실제 재생 횟수 순위나 달력 기준 월간 통계는 아닙니다. Spotify가 더 적은 곡을 반환하면 반환된 곡으로 분석합니다. 추천은 곡 목록에 자주 등장한 아티스트 최대 5명의 Last.fm 유사 아티스트를 모으고, Spotify에서 확인한 최대 3명을 보여줍니다. 분석에 사용한 전체 곡의 아티스트는 후보에서 제외합니다. 펫과 공유 카드는 취향 설명·추천 조회가 끝나기 전에도 이용할 수 있습니다. 과거 분석의 추천곡 조회와 Spotify 플레이리스트 저장은 유지합니다.

분석 결과와 공유 이미지에 기간을 표시합니다. 이전 결과는 기존의 최근 6개월 기준을 유지하고, 서로 다른 기간의 기록을 비교하면 차이를 안내합니다. 저장한 결과·기록을 다시 여는 것은 새 분석을 실행하지 않습니다.

저장된 분석과 이력은 MySQL에, 사용자 공통으로 재사용하는 **공개 Last.fm 정보만 Redis에** 저장합니다. Spotify 토큰·사용자 ID·개인의 청취 목록은 이 캐시에 넣지 않습니다. Spotify 검색 결과는 국가·사용자별 차이를 고려해 공유 캐시로 저장하지 않습니다.

| 캐시 | 유효 기간 |
| --- | --- |
| 곡 태그·아티스트 태그 | 7일 |
| 곡의 청취자 수·유사 아티스트 후보 | 1일 |
| 정보 없음(빈 목록·청취자 수 없음) | 10분 |

요청 오류는 캐시하지 않습니다. 동일 서버의 동시 요청은 하나로 모으고, 여러 서버는 Redis에 저장된 결과를 재사용합니다. 서로 다른 서버에서 동시에 처음 요청하는 경우까지 잠그는 분산 락은 적용하지 않습니다. Redis 연결 실패 시 30초 동안 직접 조회로 우회한 뒤 다시 연결을 시도합니다. 조회 제한·인증·Gemini 생성은 이 캐시의 대상이 아닙니다.

저장소 루트에서 로컬 Redis를 실행합니다.

```powershell
docker compose up -d redis
docker compose exec -T redis redis-cli ping
```

`backend/.env`의 `REDIS_URL` 기본값은 `redis://127.0.0.1:6379`이며 `MUSIC_CACHE_ENABLED=false`로 끌 수 있습니다. 배포 시 제공받은 인증 포함 Redis URL을 환경 변수로 설정합니다. TLS 연결은 `rediss://`를 사용합니다. 캐시 TTL은 `app.music-cache.*` 설정으로 조정할 수 있습니다.

로컬 컨테이너는 루프백에서만 접근 가능하며, 캐시 메모리 128MB·컨테이너 메모리 256MB로 제한합니다. 오래 사용하지 않은 키부터 제거하고 영구 저장은 하지 않으므로 재시작 후에는 필요한 정보를 다시 조회합니다. 이 설정만으로 다중 서버 운영 전체가 준비되는 것은 아니며, 진행 중 분석의 임시 곡 목록과 요청 제한은 여전히 서버별 메모리에 있습니다.

일반 백엔드 검사는 Redis 없이 `backend`에서 `./gradlew.bat test`, 실제 Redis 저장·재사용·TTL 검사는 로컬 Redis 실행 후 `./gradlew.bat redisTest`로 실행합니다. 실제 Redis 검사는 DB 15의 임의 테스트 키만 사용하고 삭제합니다.

## 개인 음악 활동

- **분석 기록** (`/history`): 최근 10회의 분석 결과를 보관하고, 최신 기록과 이전 기록의 장르 비중을 비교합니다. 상세 결과 조회는 재분석을 실행하지 않습니다. 기존 최신 결과는 첫 기록 조회 또는 다음 분석 시 포함됩니다. 이미 덮어쓴 과거 결과는 복원할 수 없습니다.
- **이전 음악 보관함 링크** (`/library`): 기능 종료 안내와 내 취향 화면 링크만 제공합니다. 보관함 API와 저장 로직은 제거했습니다. 기존 `saved_tracks` 데이터와 Flyway V1은 보존하며 새 앱에서는 사용하지 않습니다.
- **알림** (`/notifications`): 내 글의 공감·댓글과 내 댓글의 답글을 확인합니다. 본인 행동은 알리지 않으며, 공감 취소·댓글 삭제·게시글 삭제 시 관련 알림을 정리합니다. 메뉴의 읽지 않은 개수는 화면 활성 상태에서 60초 간격으로 갱신합니다.

| API | 동작 |
| --- | --- |
| `GET /api/analysis/history` | 최근 분석 기록 |
| `GET, DELETE /api/analysis/history/{id}` | 본인 기록 조회·삭제 |
| `GET /api/notifications?page=0` | 알림 20개씩 조회 |
| `GET /api/notifications/unread-count` | 읽지 않은 알림 수 |
| `PUT /api/notifications/{id}/read` | 알림 하나 읽음 |
| `PUT /api/notifications/read` | 현재 알림 모두 읽음 |

위 API는 모두 로그인한 계정을 기준으로 동작합니다. 저장소 구조는 Flyway 마이그레이션으로 관리하고 Hibernate는 `ddl-auto=validate`로 검사합니다. 기존 DB는 최초 도입 절차가 필요합니다. 최신 분석 기록을 삭제하면 `/api/analysis/latest`도 비워지지만 수집한 펫은 유지됩니다.

검증은 `backend`에서 `./gradlew.bat test`, `frontend`에서 `npm run lint`와 `npm run test:e2e:preview -- --workers=2`로 실행합니다. 백엔드 테스트는 H2(MySQL 모드)를 사용하며, 브라우저 테스트는 외부 Spotify 호출을 모의 응답으로 대체합니다.
