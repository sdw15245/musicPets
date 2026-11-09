package com.example.demo.user;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
public class ProfileService {
    private final UserRepository users;

    public ProfileService(UserRepository users) { this.users = users; }

    public record Profile(Long id, String spotifyId, String email, String displayName,
                          String nickname, String analyzedPet, List<String> unlockedCharacters) {
        static Profile from(User user) {
            return new Profile(user.getId(), user.getSpotifyId(), user.getEmail() == null ? "" : user.getEmail(),
                    user.getDisplayName() == null ? "" : user.getDisplayName(), user.getNickname(),
                    user.getAnalyzedPet(), user.getUnlockedCharacters().stream().sorted().toList());
        }
    }

    public record EditProfile(String name) {}

    @Transactional(readOnly = true)
    public Profile get(Long userId) {
        return Profile.from(users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
    }

    @Transactional
    public Profile edit(Long userId, EditProfile request) {
        String name = request.name() == null ? "" : request.name().strip();
        if (name.isBlank() || name.length() > 30 || name.codePoints().anyMatch(java.lang.Character::isISOControl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이름은 1~30자로 입력해주세요.");
        }
        User user = users.findForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        user.editProfile(name);
        return Profile.from(user);
    }
}
