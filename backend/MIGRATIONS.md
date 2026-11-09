# MySQL 스키마 관리

Flyway가 테이블·인덱스·제약조건을 관리하고 Hibernate는 `ddl-auto=validate`로 매핑을 확인합니다. MySQL은 유지합니다. 일반 실행에서 자동 baseline과 `clean`은 비활성화합니다.

## 빈 DB

접속할 DB와 계정을 먼저 준비한 뒤 백엔드를 실행하면 `src/main/resources/db/migration/V1__initial_schema.sql`이 13개 테이블을 생성합니다. DB 자체나 계정을 생성하는 SQL은 마이그레이션에 넣지 않습니다.

## 기존 DB의 최초 도입

1. 애플리케이션 쓰기를 중지하고 전체 백업을 만듭니다. 백업에는 토큰과 개인정보가 포함되므로 Git에 올리지 않습니다.
2. `gradlew.bat restoreTest -Pbackup=<백업 절대 경로>`로 격리된 MySQL에 복원하고 코드 정리·baseline 후 데이터가 유지되는지 검증합니다. Docker가 필요합니다. 테스트는 외부 Spotify/Last.fm API를 호출하지 않습니다.
3. 현재 엔티티와 실제 스키마를 비교합니다. 최초 도입 시 확인한 기존 DB는 `users.avatar`만 더 가지고 있었으며, `scripts/align-legacy-schema.sql`로 제거합니다. 다른 구조의 DB에 이 SQL을 무조건 적용하지 않습니다. 보관함 API·엔티티는 제거했지만, 기존 데이터와 V1 이력을 보존하기 위해 `saved_tracks` 테이블은 유지합니다. 앱에서는 이 테이블을 사용하지 않습니다.
4. DB 정리 후 `./scripts/baseline-existing.ps1`을 실행합니다. 기본 동작은 읽기 전용 비교입니다. 테이블·컬럼·제약조건·인덱스·문자 정렬 규칙이 V1과 일치하지 않으면 중단합니다. 증가한 AUTO_INCREMENT 값은 무시합니다.
5. 일치하는 DB에만 `./scripts/baseline-existing.ps1 -Backup '<검증한 백업 절대 경로>'`를 실행합니다. V1 상태임을 `flyway_schema_history`에 등록하며 기존 테이블에 V1 생성 SQL을 다시 실행하지 않습니다. 이 명령은 백업 파일 존재 여부만 확인하므로 앞 단계의 복원 검증을 생략하면 안 됩니다.
6. 백엔드를 다시 실행해 Flyway 및 JPA 검증을 확인합니다. 잘못된 구조를 숨기려고 `baseline-on-migrate=true` 또는 `ddl-auto=update`로 바꾸지 않습니다.

PowerShell 스크립트는 현재 프로세스의 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 우선 사용하고 없는 값만 `backend/.env`에서 읽습니다. 인증 값을 출력하지 않습니다. 다른 환경은 환경 변수를 지정한 뒤 `gradlew.bat baselineExisting` 또는 `gradlew.bat baselineExisting -PbaselineBackup=<경로>`로 실행할 수 있습니다.

## 다음 변경

- V1 적용 후에는 해당 SQL을 수정하지 않고 `V2__설명.sql`, `V3__설명.sql`을 추가합니다. 이미 실행된 SQL 변경은 체크섬 검증으로 탐지합니다.
- 엔티티 변경과 대응하는 SQL을 같이 작성하고 `migrationTest`로 검증합니다.
- 초기 V1은 기존 MySQL 8.0의 데이터형·문자 정렬·인덱스·외래키 이름을 유지합니다. 이름 정리나 자료형 변경이 필요하면 별도 버전으로 처리합니다.
- 캐릭터 카탈로그는 `shared/characters.json`을 계속 사용합니다. 개인정보·토큰·사용자 분석 결과를 초기 데이터 SQL에 넣지 않습니다.
- MySQL DDL은 실패 시 전체가 자동 롤백되지 않을 수 있습니다. 실패한 변경은 실제 구조를 확인하고 복구/후속 변경을 설계합니다. `repair`는 데이터를 복구하는 기능이 아닙니다.

## 검사

```powershell
.\gradlew.bat test
.\gradlew.bat migrationTest
.\gradlew.bat restoreTest '-Pbackup=C:\path\to\private-backup.sql'
```

`test`는 기존 H2 기반 서비스 검사이며 Flyway를 끕니다. `migrationTest`는 Testcontainers의 별도 MySQL 8.0.43에서 초기 생성, 기존 스키마 정리, 명시적 baseline, 후속 마이그레이션, 체크섬, JPA 매핑·저장을 검증합니다. 실제 DB URL과 데이터를 테스트용 DB로 사용하지 않습니다. `restoreTest`는 지정된 백업만 격리 컨테이너로 복사하며 유지 대상 컬럼의 값과 행 수를 비교합니다.

참고: [Spring Boot 초기화](https://docs.spring.io/spring-boot/3.5/how-to/data-initialization.html), [Flyway baseline](https://documentation.red-gate.com/fd/flyway-baseline-on-migrate-setting-277578974.html).
