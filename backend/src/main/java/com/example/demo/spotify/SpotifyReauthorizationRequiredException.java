package com.example.demo.spotify;

import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;

/** 우리 서비스 JWT가 아니라 Spotify 사용자 승인을 다시 받아야 하는 상태. */
public class SpotifyReauthorizationRequiredException extends ApiException {
    public SpotifyReauthorizationRequiredException() {
        super(ErrorCode.SPOTIFY_REAUTH_REQUIRED);
    }
}
