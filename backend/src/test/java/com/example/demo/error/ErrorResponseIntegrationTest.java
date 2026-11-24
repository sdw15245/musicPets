package com.example.demo.error;

import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.user.User;
import com.example.demo.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MockMvc는 Tomcat의 /error 재전달을 거치지 않는다.
 * 실제 서버에서 오류 상태 코드가 401로 바뀌지 않는지 HTTP로 확인한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ErrorResponseIntegrationTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired ObjectMapper mapper;

    private final HttpClient client = HttpClient.newHttpClient();
    private String auth;

    @BeforeEach
    void signIn() {
        User user = users.save(new User(UUID.randomUUID().toString(), "", "오류 확인"));
        auth = "Bearer " + tokens.createAccessToken(user.getId());
    }

    @Test
    void serviceValidationKeepsItsStatusAndMessage() throws Exception {
        var response = send(HttpRequest.newBuilder(uri("/api/me")).header("Authorization", auth)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString("{\"name\":\"\"}")));

        assertError(response, 400, "INVALID_REQUEST");
        assertThat(body(response).path("message").asText()).isEqualTo("이름은 1~30자로 입력해주세요.");
    }

    @Test
    void missingResourcesAreNotFoundForSignedInAndAnonymousReaders() throws Exception {
        assertError(send(HttpRequest.newBuilder(uri("/api/posts/999999")).GET()), 404, "NOT_FOUND");
        assertError(send(HttpRequest.newBuilder(uri("/api/posts/999999")).header("Authorization", auth).GET()),
                404, "NOT_FOUND");
    }

    @Test
    void invalidPagingIsBadRequest() throws Exception {
        assertError(send(HttpRequest.newBuilder(uri("/api/notifications?page=-1")).header("Authorization", auth).GET()),
                400, "INVALID_REQUEST");
    }

    @Test
    void unknownApiPathIsNotFound() throws Exception {
        assertError(send(HttpRequest.newBuilder(uri("/api/library")).header("Authorization", auth).GET()),
                404, "NOT_FOUND");
    }

    @Test
    void missingCredentialIsStillUnauthorized() throws Exception {
        assertError(send(HttpRequest.newBuilder(uri("/api/me")).GET()), 401, "UNAUTHORIZED");
    }

    private void assertError(HttpResponse<String> response, int status, String code) throws Exception {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        assertThat(body(response).path("error").asText()).isEqualTo(code);
        assertThat(body(response).path("message").asText()).isNotBlank();
        assertThat(response.headers().firstValue("Cache-Control")).hasValueSatisfying(value ->
                assertThat(value).contains("no-store"));
    }

    private JsonNode body(HttpResponse<String> response) throws Exception {
        return mapper.readTree(response.body());
    }

    private HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
