# MusicPets 배포 준비

프론트는 Vercel, 백엔드는 EC2의 Docker Compose로 실행합니다.
백엔드 이미지는 Docker Hub의 `sdw0501/musicpets:sha-<전체 커밋 SHA>`에 보관합니다.
운영 서버는 Sydney EC2의 `/opt/musicpets`에서 실행합니다. 백업과 자동 배포는 아래 운영 절차를 따릅니다.

## 주소와 DNS

| 용도 | 주소 |
| --- | --- |
| 사용자 접속 · EC2 `APP_ORIGIN` | `https://musicpets.store` |
| API · EC2 `DOMAIN` | `api.musicpets.store` |
| Spotify 운영 Redirect URI | `https://api.musicpets.store/login/oauth2/code/spotify` |
| 로그인 완료 화면 | `https://musicpets.store/oauth/callback` |
| Spotify 로컬 Redirect URI | `http://127.0.0.1:8080/login/oauth2/code/spotify` |

가비아 DNS의 `@` A 레코드와 `www` CNAME은 Vercel에서 안내한 값으로 설정합니다.
`api` A 레코드는 EC2 공개 IP를 가리킵니다. API 하위 도메인은 Vercel에 연결하지 않습니다.

브라우저는 `api.musicpets.store`에 직접 API를 요청하며 Vercel API/OAuth 프록시는 사용하지 않습니다.
Spotify 로그인 시작과 공급자 콜백도 API 주소를 사용하고, 로그인 완료 후 프론트 `/oauth/callback`으로 돌아옵니다.
CORS는 `https://musicpets.store`만 허용합니다. refresh/CSRF 쿠키는 API 호스트에 한정된
HttpOnly/Secure/SameSite=Lax 쿠키이며 `Domain=.musicpets.store`로 범위를 넓히지 않습니다.
프론트와 API는 HTTPS의 동일 사이트이므로 쿠키 기반 로그인 복원이 가능합니다.
Access 토큰은 브라우저 메모리에만 두고 URL이나 영구 저장소에 기록하지 않습니다.
이전 주소의 쿠키는 새 API 주소로 옮겨지지 않으므로 전환 후 한 번 다시 로그인합니다.

## Vercel 프로젝트

1. GitHub musicPets를 Import하고 Hobby 플랜, Framework Vite를 선택합니다.
2. Root Directory는 `frontend`, **Include source files outside of the Root Directory in the Build Step**을 켭니다.
   `shared/characters.json`을 빌드에서 읽기 때문입니다.
3. Node 22.x, Install `npm ci`, Build `npm run build`, Output `dist`.
4. Domains에 `musicpets.store`와 `www.musicpets.store`를 연결하고, 대표 주소는 `musicpets.store`로 유지합니다.
   `frontend/vercel.json`은 www와 기존 production vercel.app 주소를 대표 주소로 이동시킵니다.
   Vercel Dashboard에 반대 방향인 apex → www 리다이렉트를 추가하지 않습니다.
5. 운영 API 주소는 `frontend/src/shared/api/config.ts`의 `https://api.musicpets.store`입니다.
   Vercel에 별도의 BACKEND_ORIGIN 환경변수나 백엔드 비밀값을 입력하지 않습니다.
6. Preview의 임의 도메인은 운영 CORS/로그인 대상이 아닙니다. OAuth 검증은 대표 도메인에서 진행합니다.

`vercel.json`의 rewrite는 SPA 경로를 `index.html`로 연결하는 규칙만 남깁니다.
API 캐시 방지와 HTTPS는 EC2 Nginx에서 처리합니다. Vercel 서버는 API 응답을 중계하지 않습니다.
로컬 개발과 `e2e` 모드는 `http://127.0.0.1:8080`에 직접 연결합니다.
`npm run test:production-origin`은 실제 운영 빌드의 API/OAuth 목적지를 모의 응답으로 검증합니다.
`npm run test:e2e:preview`는 e2e 모드로 빌드해 localhost의 교차 출처 API/쿠키 동작을 검사합니다.
Vercel 배포에서는 반드시 기본 `npm run build`를 사용합니다.

## Docker Hub와 GitHub Actions

Docker Personal은 비공개 저장소 1개 또는 공개 저장소를 사용할 수 있습니다.
현재 계정의 무료 사용량 범위는 Docker Hub 대시보드에서 확인합니다.

- Repository: `sdw0501/musicpets`
- GitHub Settings → Secrets and variables → Actions → Secret:
  `DOCKERHUB_TOKEN`에 이미지 Read/Write 권한의 Docker Hub access token 입력
- 같은 화면의 Variables: 준비 완료 후 `DOCKERHUB_PUBLISH_ENABLED=true`

토큰은 채팅이나 저장소에 기록하지 않습니다. 계정 비밀번호 대신 토큰을 사용합니다.
PR은 검사만 하고, main push 또는 main에서 수동 실행할 때 모든 검사가 통과하면 이미지를 업로드합니다.
이미지 태그는 `sha-<40자리 커밋 SHA>`입니다. latest 태그를 덮어쓰지 않습니다.
EC2의 `musicpets-deploy.timer`가 5분 간격으로 main의 성공한 CI와 image 작업을 확인해 해당 SHA 이미지를 적용합니다. CI에서 EC2로 SSH 접속하지 않습니다.
이미지는 linux/amd64로 빌드하므로 첫 EC2는 x86_64를 선택합니다. ARM 인스턴스는 빌드 대상 변경이 필요합니다.

## 로컬 컨테이너 검증

저장소 루트에서 실행합니다. 기존 `compose.yaml`과 합치지 않습니다.

1. `deploy/.env.example`을 `deploy/.env`로 복사합니다.
2. 로컬 전용 DB 비밀번호 두 개와 JWT 키, 개발용 API 설정을 입력합니다.
3. `APP_ORIGIN=http://127.0.0.1:8088`, `BACKEND_IMAGE=musicpets-backend:local`로 설정합니다.

```powershell
docker compose --env-file deploy/.env -f compose.production.yaml -f compose.build.yaml -f deploy/compose.smoke.yaml -p musicpets-smoke up -d --build --wait --wait-timeout 240
docker compose --env-file deploy/.env -f compose.production.yaml -f deploy/compose.smoke.yaml -p musicpets-smoke ps
node --test deploy/smoke-test.mjs
docker compose --env-file deploy/.env -f compose.production.yaml -f deploy/compose.smoke.yaml -p musicpets-smoke down
```

smoke override는 로컬 HTTP 확인을 위해 쿠키 Secure를 끕니다. 운영에는 절대 적용하지 않습니다.
이 주소는 API 입구입니다. 프론트 화면은 제공하지 않습니다.
`musicpets-smoke`는 개발/운영 볼륨과 분리되며 down 후에도 데이터가 보존됩니다.
DB 데이터 삭제 옵션인 `down -v`는 운영 데이터에 사용하지 않습니다.

## EC2 첫 배포

1. x86_64 Linux에 Docker와 Compose 2.24.4 이상을 설치합니다.
   현재 t3.small(2GiB)용 컨테이너 상한은 backend 768MiB, MySQL 512MiB, Redis 128MiB, Nginx 64MiB입니다.
   합계 1472MiB이며 OS 여유와 별도로 2GiB swap을 준비합니다. swap은 RAM을 대체하지 않습니다.
   JVM 힙은 컨테이너의 50%, DB 연결 풀은 5개, MySQL 연결 상한은 30개로 제한합니다.
   MySQL Performance Schema는 메모리 절약을 위해 껐으므로 상세 SQL 계측은 제공되지 않습니다.
   실제 EC2에서 로그인·분석 요청 중 메모리와 OOM 여부를 확인한 후 운영합니다.
2. 보안 그룹은 HTTP/HTTPS만 공개하고 SSH는 관리자의 IP로 제한합니다.
   MySQL 3306, Redis 6379, 백엔드 8080 포트는 공개하지 않습니다.
3. 가비아의 `api` A 레코드를 서버 공개 IP에 연결합니다.
4. `api.musicpets.store`의 공인 인증서를 발급하고 자동 갱신 및 Nginx reload를 설정합니다.
   인증서 발급/갱신은 이 Compose가 대신하지 않습니다.
5. 서버에 compose.production.yaml과 deploy/ 설정 파일을 전달합니다.
   deploy/.env는 운영용 비밀값으로 별도 작성하고 파일 권한을 제한합니다.
6. APP_ORIGIN을 `https://musicpets.store`로 설정하고 BACKEND_IMAGE를 검증한 Docker Hub SHA 태그로 설정합니다.
7. 비공개 이미지면 서버에서 read-only Docker Hub 토큰으로 `docker login -u sdw0501`을 실행합니다.
   Compose와 login은 같은 OS 사용자로 실행합니다.
8. 인증서가 발급된 뒤 실행합니다.

```sh
docker compose --env-file deploy/.env -f compose.production.yaml -f deploy/compose.https.yaml config --quiet
docker compose --env-file deploy/.env -f compose.production.yaml -f deploy/compose.https.yaml pull
docker compose --env-file deploy/.env -f compose.production.yaml -f deploy/compose.https.yaml up -d --wait --wait-timeout 240
```

기본 Compose는 127.0.0.1에만 HTTP를 엽니다. HTTPS overlay가 있어야 외부 80/443으로 공개됩니다.
Nginx는 자체 healthz와 API/OAuth만 전달하고 Actuator는 공개하지 않습니다.
백엔드 readiness는 DB 연결을 포함합니다. Redis는 재생성 가능한 캐시입니다.

## HTTPS 인증서 자동 갱신

운영 HTTPS 설정은 HTTP의 `/.well-known/acme-challenge/`를 호스트의
`ACME_WEBROOT=/var/www/letsencrypt`에서 제공합니다. 이 경로는 HTTPS로 리다이렉트하지 않습니다.
Certbot은 호스트에 설치하고 인증서는 `/etc/letsencrypt`에 보관합니다.

첫 인증서 발급 때는 이 경로를 제공하는 임시 HTTP 서버가 필요합니다.
최초 발급에 사용한 임시 컨테이너 `musicpets-acme`는 현재 제거했습니다. 아래 절차는 신규 서버를 준비할 때만 해당합니다.
운영 Compose를 시작하기 직전에 `sudo docker stop musicpets-acme`로 80번 포트를 비웁니다.
운영 Nginx의 HTTPS와 ACME 경로를 검증한 뒤 `sudo docker rm musicpets-acme`로 제거합니다.
운영 시작에 실패하면 임시 컨테이너를 다시 시작해 ACME 경로를 복구합니다.

인증서 발급 명령은 다음과 같습니다. 이메일 없이 등록하므로 갱신 상태는 서버에서 확인합니다.

```sh
sudo certbot certonly --webroot -w /var/www/letsencrypt -d api.musicpets.store --cert-name api.musicpets.store --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
sudo install -m 0755 deploy/renew-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/musicpets-nginx
sudo systemctl enable --now certbot.timer
sudo certbot renew --cert-name api.musicpets.store --dry-run --run-deploy-hooks --no-random-sleep-on-renew
```

갱신 후 hook은 `musicpets-production` 프로젝트의 Nginx 설정을 검사하고 reload합니다.
최초 서버 준비 중에는 임시 `musicpets-acme`도 대상으로 합니다.
운영 Compose 전환 후에도 dry-run을 다시 수행합니다.
인증서 개인키나 Certbot 계정 파일은 저장소에 복사하지 않습니다.

## 업데이트와 되돌리기

- 이전 BACKEND_IMAGE 값을 보관하고, 새 SHA 태그로 deploy/.env를 변경합니다.
- 새 이미지 pull 성공 후 `up -d --no-deps --wait backend`로 앱만 교체합니다.
  위 명령들과 동일한 --env-file/-f 옵션을 사용합니다.
- 실패하면 이전 태그로 되돌려 같은 명령을 실행합니다.
- DB 스키마 변경을 포함한 릴리스는 이전 앱과의 호환성을 먼저 확인합니다.
  이미지 되돌리기만으로 DB 마이그레이션이 취소되지는 않습니다.
- 배포마다 Compose 전체를 down하지 않습니다. 단일 백엔드 교체에는 짧은 중단이 있습니다.
- 운영 전 DB 백업·복구 및 인증서 자동 갱신을 검증합니다. Docker 볼륨 자체는 백업이 아닙니다.

## 운영 시 유의 사항

- 브라우저 → API 직접 연결의 CORS, OAuth 왕복, CSRF, 쿠키, 새로고침 후 로그인 복구.
- Nginx 읽기 제한은 120초입니다. 실제 음악 분석 소요 시간과 클라이언트 타임아웃을 함께 확인합니다.
- Nginx는 신뢰할 수 없는 X-Forwarded-For를 덮어씁니다.
  브라우저가 Nginx에 직접 연결하므로 해당 연결의 IP를 전달합니다. 계정별 제한도 유지됩니다.
- EC2의 자동 할당 공개 IP는 중지 후 시작하면 변경될 수 있습니다. 이 경우 가비아의 `api` A 레코드를 새 IP로 갱신해야 합니다.

참고: [Vercel redirects](https://vercel.com/docs/routing/redirects),
[Docker Hub 사용량](https://docs.docker.com/docker-hub/usage/).


## DB 백업과 자동 배포

현재 AWS Free 프로젝트 정책에서는 GitHub OIDC 설정이 제한됩니다.
장기 AWS 키나 SSH 키를 GitHub에 저장하지 않고 EC2가 공개 GitHub API를 조회합니다.
추가 인바운드 포트와 유료 플랜 전환은 필요하지 않습니다. S3 저장/요청은 사용량에 따라 크레딧에서 차감됩니다.

- `musicpets-backup.timer`: 매일 **한국 시간 03:15** MySQL 전체 논리 백업.
- S3: `musicpets-backups-100828721049-ap-southeast-2`, `mysql/` 경로, 비공개/AES256 암호화/HTTPS 전용.
- 보존: 14일 후 S3 수명 주기 삭제 대상이 됩니다. 실제 삭제 시점은 S3 처리 일정에 따릅니다.
- `MusicPetsBackupRole`: 해당 버킷의 백업 경로에만 읽기/쓰기/목록 권한.
- EC2가 꺼져 있으면 백업/배포도 실행되지 않습니다. EC2가 삭제되어도 S3 백업은 남습니다.
- DB 백업에는 `.env`, 인증서, 소스 코드가 포함되지 않습니다. 운영 `.env`는 비밀번호 관리자 등 별도로 안전하게 보관합니다.

자동 배포는 main 최신 SHA의 CI 전체와 image 작업 성공을 확인한 뒤 새 이미지를 pull합니다.
S3 백업을 검증하고 main이 여전히 같은 SHA인지 확인한 후 백엔드만 교체합니다.
컨테이너 readiness와 공개 API가 정상이어야 성공으로 기록합니다. 교체 중 짧은 접속 중단이 있습니다.
실패하면 이전 이미지를 복구하며, 프로세스가 중단되면 다음 실행에서 복구를 시도합니다.
실패한 SHA는 자동 반복하지 않으므로 수정 커밋을 올려야 합니다.

롤백은 **앱 이미지에만** 적용됩니다. DB 마이그레이션은 자동으로 되돌리지 않으므로 이전 앱과 호환되게 작성합니다.
자동 갱신 대상은 백엔드 이미지입니다. Compose, Nginx, 운영 스크립트, `.env` 변경은 서버에 별도 반영합니다.
Vercel 배포는 별도로 실행되므로 프론트/백엔드 변경도 서로 호환되게 배포합니다.

### 새 서버에 설치

Ubuntu의 `python3-boto3`, Docker Compose, 백업 권한의 EC2 인스턴스 프로필이 필요합니다.
파일을 `/opt/musicpets`에 전달한 뒤 해당 디렉터리에서 실행합니다.

```sh
sudo install -d -m 0755 /usr/local/lib/musicpets
sudo install -d -m 0700 /var/lib/musicpets
sudo install -m 0644 deploy/ops.py /usr/local/lib/musicpets/ops.py
sudo install -m 0600 deploy/ops.config.example.json /etc/musicpets-ops.json
sudo install -m 0644 deploy/musicpets-backup.service deploy/musicpets-backup.timer deploy/musicpets-deploy.service deploy/musicpets-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start musicpets-backup.service
sudo systemctl start musicpets-deploy.service
sudo systemctl enable --now musicpets-backup.timer musicpets-deploy.timer
```

### 상태 확인

```sh
sudo systemctl list-timers 'musicpets-*'
sudo journalctl -u musicpets-backup.service -n 20 --no-pager
sudo journalctl -u musicpets-deploy.service -n 20 --no-pager
sudo cat /var/lib/musicpets/deployment.json
```

수동 서버 작업 전 `sudo systemctl stop musicpets-deploy.timer`로 자동 검사를 멈춥니다.
이미 실행 중인 service는 끝날 때까지 기다립니다. 작업 후 `sudo systemctl start musicpets-deploy.timer`로 재개합니다.
API 제한/외부 서비스 장애 시 기존 앱을 유지하고 다음 주기에 다시 확인합니다.
이메일/메신저 장애 알림은 설정하지 않았으므로 로그와 최근 백업 날짜를 확인합니다.
디스크는 `df -h /`와 `sudo docker system df`로 확인하고, 필요할 때 롤백용 이미지를 남겨 두고 사용하지 않는 이미지 태그를 정리합니다.
운영 볼륨 삭제나 `docker system prune --volumes`는 실행하지 않습니다.

### 백업 복원 검증

백업 로그에서 `mysql/...sql.gz` 키를 선택합니다. 다음 명령은 SHA256을 확인하고 **격리된 임시 MySQL**에 복원합니다.
테이블 수와 Flyway 이력을 확인한 뒤 임시 컨테이너/볼륨/파일을 제거하며 운영 DB는 수정하지 않습니다.
추가 메모리가 최대 512MiB 필요합니다.

```sh
sudo python3 /opt/musicpets/deploy/verify-backup.py mysql/YYYY/MM/DD/TIMESTAMP.sql.gz
```

실제 장애 복구는 자동 배포와 쓰기 요청을 중지하고, 검증한 백업으로 별도 DB 볼륨을 준비한 뒤
해당 스키마와 호환되는 앱을 연결합니다. 복구 확인 전까지 기존 DB 볼륨을 보존합니다.
백업 시점 이후 데이터는 복구되지 않습니다. 운영 DB를 덮어쓰는 복원은 자동 실행하지 않습니다.

스크립트 검사: `python -m unittest discover -s deploy -p test_ops.py`.
