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
        String track = "spotify:track:5VBjyOQzqlPNgdRPMM6prF";
        assertThatThrownBy(() -> service.saveAsPlaylist(7L, "추천곡", List.of())).isInstanceOf(InvalidPlaylistException.class);
        // 게시글과 같은 규칙: Spotify 곡 ID는 22자다.
        assertThatThrownBy(() -> service.saveAsPlaylist(7L, "추천곡", List.of("spotify:track:abc")))
                .isInstanceOf(InvalidPlaylistException.class);
        verifyNoInteractions(spotify);
        when(spotify.createPlaylist(7L, "추천곡", "음악 캐릭터 매칭이 추천한 곡들"))
                .thenReturn(new SpotifyService.PlaylistRef("playlist", "https://open.spotify.com/playlist/playlist"));
        assertThat(service.saveAsPlaylist(7L, "추천곡", List.of(track)))
                .isEqualTo("https://open.spotify.com/playlist/playlist");
        verify(spotify).addTracksToPlaylist(7L, "playlist", List.of(track));
    }
}
