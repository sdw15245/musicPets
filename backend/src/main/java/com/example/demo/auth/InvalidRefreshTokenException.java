package com.example.demo.auth;

/** No credential or internal error detail is included in a session error. */
public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException() { super("다시 로그인해주세요."); }
}
