package com.example.demo.notification;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notifications;
    public NotificationController(NotificationService notifications) { this.notifications = notifications; }
    @GetMapping public NotificationService.NotificationPage list(@AuthenticationPrincipal Long userId, @RequestParam(defaultValue = "0") int page) {
        return notifications.list(userId, page);
    }
    @GetMapping("/unread-count") public Map<String, Long> count(@AuthenticationPrincipal Long userId) {
        return Map.of("count", notifications.unreadCount(userId));
    }
    @PutMapping("/{id}/read") public ResponseEntity<Void> read(@AuthenticationPrincipal Long userId, @PathVariable Long id) {
        notifications.read(userId, id); return ResponseEntity.noContent().build();
    }
    @PutMapping("/read") public ResponseEntity<Void> readAll(@AuthenticationPrincipal Long userId) {
        notifications.readAll(userId); return ResponseEntity.noContent().build();
    }
}
