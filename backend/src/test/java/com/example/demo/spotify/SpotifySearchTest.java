package com.example.demo.spotify;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class SpotifySearchTest {
    @Test void searchEncodesKoreanAndReservedCharactersOnceAndMapsMultipleTracks() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var tokens = mock(SpotifyTokenService.class);
        when(tokens.getValidAccessToken(1L)).thenReturn("token");
        var spotify = new SpotifyService(tokens, builder);
        server.expect(requestTo("https://api.spotify.com/v1/search?type=track&limit=10&q=%EB%B0%A4+%26+pop"))
                .andExpect(header("Authorization", "Bearer token"))
                .andRespond(withSuccess("""
                    {"tracks":{"items":[
                      {"uri":"spotify:track:5VBjyOQzqlPNgdRPMM6prF","name":"밤","artists":[{"name":"A"},{"name":"B"}],"album":{"images":[{"url":"https://i.scdn.co/image/test"}]}},
                      {"uri":"spotify:track:3QjI2bkcaQalyd1k0qvmYj","name":"두 번째","artists":[],"album":{"images":[]}}
                    ]}}
                    """, MediaType.APPLICATION_JSON));
        var result = spotify.searchTracks(1L, "밤 & pop", 10);
        assertThat(result).hasSize(2);
        assertThat(result.getFirst().artist()).isEqualTo("A, B");
        assertThat(result.get(1).imageUrl()).isEmpty();
        server.verify();
    }
}
