package com.example.demo.paging;

import com.example.demo.error.ApiException;
import com.example.demo.error.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/** 목록 API 공통 페이지 규칙: 한 페이지 20개, 0~10000쪽. 범위를 벗어나면 400. */
public final class Paging {
    public static final int SIZE = 20;
    private static final int MAX_PAGE = 10_000;

    private Paging() {}

    public static PageRequest of(int page, Sort sort) {
        if (page < 0 || page > MAX_PAGE) throw new ApiException(ErrorCode.INVALID_REQUEST, "페이지 번호를 확인해주세요.");
        return PageRequest.of(page, SIZE, sort);
    }
}
