-- refresh 토큰을 원문 대신 SHA-256 해시(소문자 16진수 64자)로 저장한다. 앱의 RefreshToken.hash와 같은 값이다.
-- 같은 자리에서 바꾸므로 기존 로그인 세션은 유지된다.
-- 주의: 이후 V3 이하 앱으로 롤백하면 시작은 되지만 저장값이 해시라 기존 세션은 모두 다시 로그인해야 한다.
UPDATE refresh_tokens SET token = SHA2(token, 256);
