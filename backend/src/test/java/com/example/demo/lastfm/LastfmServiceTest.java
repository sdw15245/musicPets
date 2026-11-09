package com.example.demo.lastfm;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.anything;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class LastfmServiceTest {
    @Test
    void similarArtistsUseOwnCacheAndMalformedOrProviderErrorsAreNotCached() {
        server.expect(queryParam("method", "artist.getsimilar")).andRespond(withSuccess("{\"error\":29}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        server.expect(queryParam("autocorrect", "1")).andRespond(withSuccess(
            "{\"similarartists\":{\"artist\":[{\"name\":\"Redoor\",\"match\":\"0.9\"},{\"name\":\"Invalid\",\"match\":\"NaN\"}]}}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.getSimilarArtists("HANRORO", 10)).isInstanceOf(RestClientException.class);
        assertThatThrownBy(() -> service.getSimilarArtists("HANRORO", 10)).isInstanceOf(RestClientException.class);
        assertThat(service.getSimilarArtists("HANRORO", 10)).containsExactly(new LastfmService.SimilarArtist("Redoor", .9));
        assertThat(service.getSimilarArtists("HANRORO", 10)).hasSize(1);
        server.verify();
    }
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private LastfmService service;

    @BeforeEach
    void setup() {
        LastfmProperties props = new LastfmProperties();
        props.setBaseUrl("https://lastfm.test");
        props.setApiKey("test");
        service = new LastfmService(props, builder, new com.example.demo.cache.RedisCacheFixture().cache());
    }

    @Test
    void repeatedTrackMetadataDoesNotMakeAnotherExternalRequest() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"pop\",\"count\":100},{\"name\":\"indie\",\"count\":80},{\"name\":\"rock\",\"count\":50}]}}", MediaType.APPLICATION_JSON));
        var first = service.getTrackTags("Artist", "Song");
        assertThat(service.getTrackTags("Artist", "Song")).isEqualTo(first);
        server.verify();
    }

    @Test
    void sparseTrackTagsAreKeptWhenArtistHasNoTags() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"pop\",\"count\":100}]}}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[]}}", MediaType.APPLICATION_JSON));

        assertThat(service.getTrackTags("Artist", "Song"))
                .containsExactly(new LastfmTag("pop", 100));
        server.verify();
    }

    @Test
    void sparseTrackTagsAreKeptWhenArtistIsNotFound() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"rock\",\"count\":80}]}}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(
                "{\"error\":6,\"message\":\"Artist not found\"}", MediaType.APPLICATION_JSON));

        assertThat(service.getTrackTags("Artist", "Song"))
                .containsExactly(new LastfmTag("rock", 80));
        server.verify();
    }

    @Test
    void apiErrorsAreRetryableFailuresAndStringCountsKeepTheirWeight() {
        server.expect(anything()).andRespond(withSuccess("{\"error\":29,\"message\":\"Rate limit\"}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess("{\"toptags\":{\"tag\":[{\"name\":\"pop\",\"count\":\"100\"},{\"name\":\"rock\",\"count\":70},{\"name\":\"indie\",\"count\":\"50\"}]}}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.getTrackTags("Artist", "Song")).isInstanceOf(org.springframework.web.client.RestClientException.class);
        assertThat(service.getTrackTags("Artist", "Song")).extracting(LastfmTag::count).containsExactly(100, 70, 50);
        server.verify();
    }

    @Test
    void artistTagsStillSupplementSparseTrackTagsWhenAvailable() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"pop\",\"count\":100}]}}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"rock\",\"count\":100},{\"name\":\"indie\",\"count\":80}]}}",
                MediaType.APPLICATION_JSON));

        assertThat(service.getTrackTags("Artist", "Song"))
                .containsExactly(new LastfmTag("rock", 100), new LastfmTag("indie", 80));
        server.verify();
    }

    @Test
    void artistApiFailureIsNotTreatedAsMissingTags() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"toptags\":{\"tag\":[{\"name\":\"pop\",\"count\":100}]}}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(
                "{\"error\":29,\"message\":\"Rate limit\"}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.getTrackTags("Artist", "Song"))
                .isInstanceOf(org.springframework.web.client.RestClientException.class);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"123", "\" 123 \""})
    void listenersAcceptNumbersAndTrimmedStrings(String listeners) {
        server.expect(queryParam("method", "track.getInfo"))
                .andExpect(queryParam("artist", "Artist"))
                .andExpect(queryParam("track", "Song"))
                .andExpect(queryParam("api_key", "test"))
                .andExpect(queryParam("format", "json"))
                .andRespond(withSuccess("{\"track\":{\"listeners\":" + listeners + "}}", MediaType.APPLICATION_JSON));

        assertThat(service.getTrackListeners("Artist", "Song")).isEqualTo(123);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"track\":{}}", "{\"track\":{\"listeners\":\"invalid\"}}", "{\"error\":6}"})
    void missingOrInvalidListenerCountsReturnZero(String response) {
        server.expect(anything()).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThat(service.getTrackListeners("Artist", "Song")).isZero();
        server.verify();
    }

    @Test
    void similarArtistsPreserveOrderAndIgnoreInvalidCandidates() {
        server.expect(queryParam("method", "artist.getsimilar"))
                .andExpect(queryParam("artist", "Artist"))
                .andExpect(queryParam("limit", "10"))
                .andExpect(queryParam("autocorrect", "1"))
                .andExpect(queryParam("api_key", "test"))
                .andRespond(withSuccess("""
                        {"similarartists":{"artist":[
                          {"name":"First","match":"0.8"},
                          {"name":"Second","match":0.5},
                          {"name":"Invalid","match":"invalid"},
                          {"name":"Too large","match":2},
                          {"name":"Negative","match":-1},
                          {"name":" ","match":0.9}, {}, null, 1
                        ]}}
                        """, MediaType.APPLICATION_JSON));
        assertThat(service.getSimilarArtists("Artist", 10)).containsExactly(
                new LastfmService.SimilarArtist("First", 0.8),
                new LastfmService.SimilarArtist("Second", 0.5));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"similarartists\":{\"artist\":[]}}", "{\"error\":6}"})
    void genuinelyMissingSimilarArtistsAreCachedAsEmpty(String response) {
        server.expect(anything()).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThat(service.getSimilarArtists("Artist", 10)).isEmpty();
        assertThat(service.getSimilarArtists("Artist", 10)).isEmpty();
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"error\":29}", ""})
    void apiErrorsAndEmptyBodiesFailAllRequestTypes(String response) {
        for (int request = 0; request < 3; request++) {
            server.expect(anything()).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        }
        assertThatThrownBy(() -> service.getTrackListeners("Artist", "Song")).isInstanceOf(RestClientException.class);
        assertThatThrownBy(() -> service.getSimilarArtists("Artist", 10)).isInstanceOf(RestClientException.class);
        assertThatThrownBy(() -> service.getTrackTags("Artist", "Song")).isInstanceOf(RestClientException.class);
        server.verify();
    }

    @Test
    void malformedTagEntriesRemainFailuresRatherThanBeingSilentlySkipped() {
        server.expect(anything()).andRespond(withSuccess("{\"toptags\":{\"tag\":[1]}}", MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess("{\"toptags\":{\"tag\":[null]}}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.getTrackTags("Artist", "Song")).isInstanceOf(ClassCastException.class);
        assertThatThrownBy(() -> service.getTrackTags("Artist", "Song")).isInstanceOf(NullPointerException.class);
        server.verify();
    }
}
