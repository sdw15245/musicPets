package com.example.demo.user;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


/** 현재 로그인 사용자 정보 반환 (/api/me). JWT 필터가 인증된 요청만 통과시킴. */
@RestController
@RequestMapping("/api")
public class UserController {

    private final ProfileService profiles;

    public UserController(ProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/me")
    public ProfileService.Profile me(@AuthenticationPrincipal Long userId) {
        return profiles.get(userId);
    }

    @PutMapping("/me")
    public ProfileService.Profile edit(@AuthenticationPrincipal Long userId, @RequestBody ProfileService.EditProfile request) {
        return profiles.edit(userId, request);
    }
}
