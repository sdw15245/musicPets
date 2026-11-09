package com.example.demo.lastfm;

/** Last.fm 태그 + 인기도 점수(0~100). count는 상대 가중치로 사용. */
public record LastfmTag(String name, int count) {}
