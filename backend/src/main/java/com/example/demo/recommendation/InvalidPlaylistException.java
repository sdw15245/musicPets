package com.example.demo.recommendation;

public class InvalidPlaylistException extends IllegalArgumentException {
    public InvalidPlaylistException() {
        super("저장할 Spotify 곡을 선택해주세요.");
    }
}
