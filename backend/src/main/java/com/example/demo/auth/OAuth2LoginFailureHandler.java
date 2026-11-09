package com.example.demo.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** OAuth 실패 원문을 노출하지 않고 프론트 로그인 화면에서 복구할 수 있게 한다. */
@Component
public class OAuth2LoginFailureHandler extends SimpleUrlAuthenticationFailureHandler {
    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginFailureHandler.class);

    public OAuth2LoginFailureHandler(
            @Value("${app.oauth2.failure-redirect:http://127.0.0.1:5173/login?oauthError=spotify}") String failureRedirectUri) {
        setDefaultFailureUrl(failureRedirectUri);
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        String errorCode = exception instanceof OAuth2AuthenticationException oauthError
                ? oauthError.getError().getErrorCode() : "authentication_failure";
        Throwable root = exception;
        while (root.getCause() != null) root = root.getCause();
        // 공급자의 상세 메시지·토큰·사용자 정보 없이 진단에 필요한 유형만 기록한다.
        log.warn("oauth_login_failed error_code={} exception={} root_cause={}",
                errorCode, exception.getClass().getSimpleName(), root.getClass().getSimpleName());
        super.onAuthenticationFailure(request, response, exception);
    }
}
