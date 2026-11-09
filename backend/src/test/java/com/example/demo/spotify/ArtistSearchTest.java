package com.example.demo.spotify;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ArtistSearchTest {
    final RestClient.Builder builder = RestClient.builder();
    final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    final SpotifyTokenService tokens = mock(SpotifyTokenService.class);
    final SpotifyService service = new SpotifyService(tokens, builder);

    @Test void topTracksKeepAllCreditedArtistIdsForExcludingKnownArtists() {
        when(tokens.getValidAccessToken(7L)).thenReturn("test");
        server.expect(anything()).andRespond(withSuccess("""
            {"items":[{"name":"Song","artists":[{"name":"First","id":"first"},{"name":"Guest","id":"guest"}]}]}
            """, MediaType.APPLICATION_JSON));
        assertThat(service.getTopTracks(7L, 20).getFirst().artists()).containsExactly(
            new SpotifyService.ArtistRef("First", "first"), new SpotifyService.ArtistRef("Guest", "guest"));
    }

    @Test void searchSkipsUnrelatedFirstHitAndUsesMatchingArtistsIdentity() {
        when(tokens.getValidAccessToken(7L)).thenReturn("test");
        server.expect(queryParam("type", "artist")).andRespond(withSuccess("""
            {"artists":{"items":[{"id":"wrong","name":"Redoor Tribute","images":[]},
              {"id":"right","name":"Redoor","images":[{"url":"https://image.test/photo.jpg"}]}]}}
            """, MediaType.APPLICATION_JSON));
        assertThat(service.searchArtist(7L, "Redoor")).isEqualTo(
            new SpotifyService.ArtistHit("right", "Redoor", "spotify:artist:right", "https://image.test/photo.jpg"));
        server.verify();
    }

    @Test void ambiguousExactNamesAreNotGuessed() {
        when(tokens.getValidAccessToken(7L)).thenReturn("test");
        server.expect(anything()).andRespond(withSuccess("""
            {"artists":{"items":[{"id":"one","name":"CHAN"},{"id":"two","name":"Chan"}]}}
            """, MediaType.APPLICATION_JSON));
        assertThat(service.searchArtist(7L, "CHAN")).isNull();
    }

    @Test void bilingualLabelCanResolveToOneWholeName() {
        when(tokens.getValidAccessToken(7L)).thenReturn("test");
        server.expect(anything()).andRespond(withSuccess("""
            {"artists":{"items":[{"id":"one","name":"Damons year"},{"id":"two","name":"Other"}]}}
            """, MediaType.APPLICATION_JSON));
        assertThat(service.searchArtist(7L, "데이먼스 이어 Damons year").id()).isEqualTo("one");
    }
}
