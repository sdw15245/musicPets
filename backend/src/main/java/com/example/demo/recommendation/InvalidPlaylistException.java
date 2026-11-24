package com.example.demo.recommendation;

import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;

public class InvalidPlaylistException extends ApiException {
    public InvalidPlaylistException() {
        super(ErrorCode.INVALID_PLAYLIST);
    }
}
