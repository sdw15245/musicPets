package com.example.demo.jwt;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenProviderTest {
    private static final String LEGACY_DEFAULT = "change-me-change-me-change-me-change-me-123456";

    private static String randomSecret() {
        byte[] bytes = new byte[64];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Test void mainConfigurationRequiresExplicitSecret() throws Exception {
        Properties properties = new Properties();
        try (var source = getClass().getResourceAsStream("/application.properties")) {
            properties.load(source);
        }
        assertThat(properties.getProperty("jwt.secret")).isEqualTo("${JWT_SECRET}");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "${JWT_SECRET}", LEGACY_DEFAULT})
    void absentOrKnownDefaultSecretsAreRejectedWithoutEchoingTheSecret(String secret) {
        assertThatThrownBy(() -> new JwtTokenProvider(secret, 60_000, 120_000))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("JWT_SECRET must be configured with a unique, randomly generated secret");
    }

    @Test void undersizedHmacSecretIsRejected() {
        assertThatThrownBy(() -> new JwtTokenProvider("short-audit-secret", 60_000, 120_000))
                .isInstanceOf(io.jsonwebtoken.security.WeakKeyException.class);
    }

    @Test void unresolvedSecretPreventsApplicationContextStartup() {
        new ApplicationContextRunner().withBean(JwtTokenProvider.class)
                .withPropertyValues("jwt.secret=${audit.explicitly.missing.secret}",
                        "jwt.expiration.access=60000", "jwt.expiration.refresh=120000")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test void legacyDefaultPreventsApplicationContextStartup() {
        new ApplicationContextRunner().withBean(JwtTokenProvider.class)
                .withPropertyValues("jwt.secret=" + LEGACY_DEFAULT,
                        "jwt.expiration.access=60000", "jwt.expiration.refresh=120000")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test void tokensPreserveIdentityTypeAndSignatureAcrossInstances() {
        String secret = randomSecret();
        JwtTokenProvider issuer = new JwtTokenProvider(secret, 60_000, 120_000);
        JwtTokenProvider verifier = new JwtTokenProvider(secret, 60_000, 120_000);
        String access = issuer.createAccessToken(42L);
        String refresh = issuer.createRefreshToken(42L);
        assertThat(verifier.validate(access)).isTrue();
        assertThat(verifier.getUserId(access)).isEqualTo(42L);
        assertThat(verifier.isAccessToken(access)).isTrue();
        assertThat(verifier.isRefreshToken(access)).isFalse();
        assertThat(verifier.validate(refresh)).isTrue();
        assertThat(verifier.isRefreshToken(refresh)).isTrue();
        assertThat(verifier.isAccessToken(refresh)).isFalse();
        assertThat(new JwtTokenProvider(randomSecret(), 60_000, 120_000).validate(access)).isFalse();
    }

    @Test void tokenSignedWithLegacyDefaultCannotImpersonateUser() {
        String forged = Jwts.builder().subject("42").claim("type", "access")
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(LEGACY_DEFAULT.getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(new JwtTokenProvider(randomSecret(), 60_000, 120_000).validate(forged)).isFalse();
    }

    @Test void expiredAndTamperedTokensAreRejected() {
        String secret = randomSecret();
        JwtTokenProvider expired = new JwtTokenProvider(secret, -60_000, 120_000);
        assertThat(expired.validate(expired.createAccessToken(42L))).isFalse();
        JwtTokenProvider provider = new JwtTokenProvider(secret, 60_000, 120_000);
        String[] parts = provider.createAccessToken(42L).split("\\.");
        String alteredPayload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8)
                .replace("\"42\"", "\"43\"");
        String tampered = parts[0] + "." + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(alteredPayload.getBytes(StandardCharsets.UTF_8)) + "." + parts[2];
        assertThat(provider.validate(tampered)).isFalse();
        assertThat(provider.validate("not.a.valid-token")).isFalse();
    }
}
