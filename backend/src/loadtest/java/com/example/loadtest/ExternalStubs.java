package com.example.loadtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.util.UriComponentsBuilder;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/** Only compiled into loadtest.jar. Real clients, parsing and Redis stay in the path. */
final class ExternalStubs {
    static RestClientCustomizer customizer(ObjectMapper mapper) {
        return builder -> builder.requestInterceptor((request, body, execution) -> {
            Object payload = payload(request.getURI(), body);
            byte[] json = mapper.writeValueAsBytes(payload);
            try { Thread.sleep(5); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new IllegalStateException(interrupted); }
            return new ClientHttpResponse() {
                public HttpStatusCode getStatusCode() { return HttpStatus.OK; }
                public String getStatusText() { return "OK"; }
                public void close() { }
                public InputStream getBody() { return new ByteArrayInputStream(json); }
                public HttpHeaders getHeaders() {
                    var headers = new HttpHeaders(); headers.set("Content-Type", "application/json"); return headers;
                }
            };
        });
    }

    static Object payload(URI uri, byte[] body) {
        var query = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        String host = uri.getHost();
        String path = uri.getPath();
        if ("api.spotify.com".equals(host)) {
            if (path.equals("/v1/me/top/tracks")) return Map.of("items", IntStream.range(0, 20)
                    .mapToObj(i -> Map.of("name", "Fixture Track " + i,
                        "artists", List.of(Map.of("id", "seed" + i % 5, "name", "Fixture Artist " + i % 5))))
                    .toList());
            if (path.equals("/v1/search") && "artist".equals(query.getFirst("type"))) {
                String name = java.net.URLDecoder.decode(query.getFirst("q"), StandardCharsets.UTF_8);
                String id = "candidate" + Integer.toUnsignedString(name.hashCode());
                return Map.of("artists", Map.of("items", List.of(Map.of("id", id, "name", name, "images", List.of()))));
            }
        }
        if ("ws.audioscrobbler.com".equals(host)) {
            String method = query.getFirst("method");
            if ("track.gettoptags".equals(method) || "artist.gettoptags".equals(method))
                return Map.of("toptags", Map.of("tag", List.of(Map.of("name", "indie", "count", "100"),
                    Map.of("name", "r-and-b", "count", "75"), Map.of("name", "fixture-microgenre", "count", "30"))));
            if ("track.getInfo".equals(method)) return Map.of("track", Map.of("listeners", "50000"));
            if ("artist.getsimilar".equals(method)) return Map.of("similarartists", Map.of("artist", IntStream.range(0, 5)
                    .mapToObj(i -> Map.of("name", "New Fixture Artist " + i, "match", "0.8")).toList()));
        }
        if ("generativelanguage.googleapis.com".equals(host)) {
            String prompt = new String(body, StandardCharsets.UTF_8);
            String text = prompt.contains("thinkingConfig") ? "인디와 R&B를 중심으로 듣는 취향이에요. 로컬 부하 테스트용 설명입니다."
                    : "{\"fixture-microgenre\":\"indie\"}";
            return Map.of("candidates", List.of(Map.of("content", Map.of("parts", List.of(Map.of("text", text))))));
        }
        throw new IllegalStateException("Load test blocked an unstubbed external request: " + host + path);
    }
}
