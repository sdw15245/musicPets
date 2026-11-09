package com.example.demo.recommendation;

import com.example.demo.lastfm.LastfmService;

import com.example.demo.spotify.SpotifyService;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationServiceTest {

    @Test
    void savingAddsTheDisplayedUrisAndRejectsEmptyPlaylistsBeforeCreating() {
        SpotifyService spotify = mock(SpotifyService.class);
        RecommendationService service = new RecommendationService(spotify, mock(LastfmService.class));
        assertThatThrownBy(() -> service.saveAsPlaylist(7L, "추천곡", List.of())).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(spotify);
        when(spotify.createPlaylist(7L, "추천곡", "음악 캐릭터 매칭이 추천한 곡들"))
                .thenReturn(new SpotifyService.PlaylistRef("playlist", "https://open.spotify.com/playlist/playlist"));
        assertThat(service.saveAsPlaylist(7L, "추천곡", List.of("spotify:track:abc")))
                .isEqualTo("https://open.spotify.com/playlist/playlist");
        verify(spotify).addTracksToPlaylist(7L, "playlist", List.of("spotify:track:abc"));
    }
}
