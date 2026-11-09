package com.example.demo.spotify;

/** 우리 서비스 JWT가 아니라 Spotify 사용자 승인을 다시 받아야 하는 상태. */
public class SpotifyReauthorizationRequiredException extends RuntimeException {
    public SpotifyReauthorizationRequiredException() {
        super("Spotify 연결이 만료되었거나 해제됐어요. Spotify에 다시 연결해주세요.");
    }
}
