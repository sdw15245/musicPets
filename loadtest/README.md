# MusicPets 로컬 k6 부하 테스트

운영 환경과 분리된 실제 MySQL·Redis·Spring Boot에서 API 처리 성능과 요청 제한을 검사합니다.
외부 API 응답만 테스트 JAR의 HTTP 인터셉터가 대체합니다. 운영 JAR에는 이 코드가 포함되지 않습니다.

## 실행

저장소 루트에서 PowerShell로 실행합니다. Java 21, Python 3.10 이상, Docker Desktop이 필요합니다.
Docker에 CPU 4개 이상을 할당합니다. 서버/DB/Redis는 코어 0,1을 공유하고 k6는 코어 2,3을 사용합니다.
다른 프로젝트 컨테이너는 필요하면 먼저 중지합니다. 스크립트가 임의로 다른 프로젝트를 중지하지 않습니다.

```powershell
python -m unittest discover -s loadtest -p test_results.py
python loadtest/run.py prepare
python loadtest/run.py measure --rates 5 10 20 40 80 --duration 60s
python loadtest/run.py measure --rates 100 120 160 --duration 60s
python loadtest/run.py measure --mode analysis --rates 1 2 4 8 --duration 60s
python loadtest/run.py verify
python loadtest/run.py stop
```

`prepare`가 테스트 JAR를 빌드하고 테스트 DB를 준비합니다. 처음 이미지를 받거나 JVM을 시작할 때 시간이 걸립니다.
주간 인기순을 측정할 수 있도록 `prepare`는 기존 전용 볼륨에서도 테스트 게시글의 작성일을 실행 시점 기준 0~27일 전으로 재설정합니다. 새로 만든 데이터는 게시글마다 공감 0·2·4·6·8개를 배정합니다.
`measure`는 제한을 끄고 30초 워밍업 후 지정한 각 단계의 도착률을 유지합니다. 한 단계라도 기준을 벗어나면 다음 단계로 올리지 않고 종료 코드 99로 끝납니다. 실패한 단계의 결과도 저장합니다.
`verify`는 제한을 다시 켜고 정상 조회, 한 계정의 과도한 조회, 여러 계정의 공유 IP 제한, 분석 재시도 제한을 검사합니다.
`stop`은 `musicpets-loadtest` 컨테이너와 네트워크만 종료하고 전용 DB 볼륨은 보존합니다. 개발용 `musicpets` 프로젝트와 운영 서버에는 적용하지 않습니다.

## 측정 조건

- 테스트 DB: 회원 200명, 게시글 5,000개, 태그 10,000개, 댓글 20,000개, 공감 20,000개, 초기 이력 2,000개.
- MySQL 8.0.43: 전용 Docker 디스크 볼륨, 메모리 512MiB, 버퍼 풀 128MiB, 연결 상한 30.
- 백엔드: Java 21, 메모리 768MiB, JVM MaxRAMPercentage 50, DB 연결 풀 5, Tomcat 최대 스레드 50.
- Redis: 메모리 128MiB, 데이터 상한 64MiB, 재생성 가능한 캐시.
- k6 1.6.1: 메모리 512MiB, 서버와 분리한 CPU 코어, 최대 VU 200.
- 조회: 최신 목록·인기순·본문/태그 검색·글 상세·댓글·최신 분석·분석 이력을 같은 비중으로 호출. 각 반복은 HTTP 요청 1개.
- 분석: progressive 핵심 결과 → 설명/지표와 추천을 병렬 요청. 각 반복은 성공 시 HTTP 요청 3개. 원본 분석·벡터·매칭·인증·DB 저장·캐시 코드를 통과합니다.
- 외부 응답: Spotify 청취곡 20개, Last.fm 태그·청취자 수·유사 아티스트, Gemini 분류·설명. 모의 외부 응답은 5ms 지연을 갖습니다.
- 분석 부하는 모든 사용자에게 같은 20곡을 제공하는 따뜻한 캐시 조건입니다. 외부 API의 실제 처리량/지연/요금/사용 한도를 측정하지 않습니다.
- JWT는 로컬 전용 고정 키로 테스트 계정만 생성합니다. 운영 비밀값과 OAuth 로그인은 사용하지 않습니다.

## 합격 기준과 해석

- 조회 HTTP p95 < 500ms; 각 조회 API의 p95도 별도 검사.
- 분석 HTTP p95 < 2,000ms. 분석 전체 흐름은 `workflow_ms`로 별도 기록합니다.
- HTTP 오류율 < 1%, 응답 데이터 검증 성공률 > 99%, 미전송 `dropped_iterations` = 0.
- 429는 성공 처리량에 포함하지 않습니다. 정상 상태 데이터가 없는 HTTP 200도 실패로 집계합니다.
- p90/p95/p99, 최대값, 성공 처리량, 미전송, API별 지연, Docker CPU/메모리를 기록합니다. 초기 수집 중 p99가 없었던 단계는 값을 추정하지 않습니다.
- VU는 동시에 반복을 실행할 수 있는 작업자 수입니다. 실제 사용자 수나 초당 요청 수와 같지 않습니다.
- 도착률을 초과할 만큼 처리가 느려지거나 부하 생성 VU가 부족하면 미전송이 발생합니다. 서버와 k6 자원을 함께 확인해야 합니다.
- p99도 최댓값은 아닙니다. 60초 단계는 초기 용량 탐색이며 장시간 안정성 보증이나 SLA가 아닙니다.

이 결과는 노트북의 Docker VM과 로컬 디스크를 사용합니다. EC2의 CPU 성능/크레딧, EBS, HTTPS/Nginx, 네트워크 지연, 실제 외부 서비스는 포함하지 않으므로 운영 최대 성능으로 환산하지 않습니다.

## 결과 파일

`loadtest/results/`는 Git에서 제외합니다.

- `*-*rps-*.json`: k6 원본 요약(실제 이름은 `read-80rps-...json` 형식).
- `*-report.json`: 성공 처리량·지연·오류·미전송 집계.
- `*-stats.json`: Docker 컨테이너 CPU/메모리 시계열.
- `*.log`: k6 실행 로그.
- `users.json`: 로컬 테스트 JWT. 외부에 공유하지 않습니다.
- `limits-verification.json`: 제한 재활성화 후 검증 결과.
- `stopped-containers.json`: 이번 작업에서 사용자 허락을 받아 중지한 컨테이너 목록.

## 배포와 CI

운영 빌드는 `bootJar` → `app.jar`입니다. 테스트 빌드 `loadTestJar` → `loadtest.jar`는 별도의 소스 세트를 사용합니다.
`src/loadtest`와 테스트 설정이 운영 JAR에 들어가지 않는지 확인합니다. 요청 제한을 끄는 설정은 이 Compose에서만 전달합니다.
부하 테스트를 main 푸시마다 운영 서버에 자동 실행하지 않습니다. CI에서는 가벼운 집계 단위 테스트만 실행합니다.

공식 문서: https://grafana.com/docs/k6/latest/using-k6/scenarios/ 와 https://grafana.com/docs/k6/latest/using-k6/thresholds/
