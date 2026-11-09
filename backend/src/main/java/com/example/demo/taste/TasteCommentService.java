package com.example.demo.taste;

import com.example.demo.llm.GeminiClient;
import com.example.demo.character.Character;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * 우리가 분석한 결과(장르 비중 순서 + 대중성 성향)를 근거로 LLM이 짧은 취향 평을 생성.
 * LLM은 분석을 하지 않는다. 주어진 정보를 자연어로 풀어주기만 한다(없는 사실 금지).
 * 비중은 설명의 근거로만 사용하고 최종 문장에는 수치를 나열하지 않는다.
 */
@Service
public class TasteCommentService {

    private static final String PROMPT = """
            MusicPets의 음악 취향 해설을 작성하세요. 실제 분석 근거와 펫의 설정을 연결해
            사용자가 이 펫과 음악 취향의 어떤 부분이 닮았는지 알 수 있도록 2문장, 160자 안팎으로 설명하세요.

            규칙:
            - 퍼센트 수치나 점수를 숫자로 쓰지 마세요. (예: "팝 23퍼센트", "대중성 51점" 같은 표현 금지)
            - 장르 하나가 두드러지는지, 여러 장르의 비중이 비슷한지 실제 분포에 맞춰 묘사하세요.
            - 사용자 소개와 펫 소개를 따로 쓰지 마세요. 가장 뚜렷한 공통점 하나를 골라,
              사용자의 실제 장르 특징과 그에 맞는 펫의 기존 장면을 한 문장 안에서 직접 연결하세요.
              닮았다고 결론만 붙이지 말고, 어떤 음악을 함께 즐기는 점이 닮았는지 드러내세요.
              첫 문장의 주어는 사용자의 '취향'이나 '조합'으로 두세요.
              구조는 '[근거가 있는 취향]이 [기존 장면 속 펫]과 닮았어요'처럼 관계가 명확해야 해요.
              '사용자의 취향', '당신의 취향'이라고 뭉뚱그리지 말고 구체적인 음악 특징으로 시작하세요.
            - 다음 문장은 그 연결의 근거가 되는 사용자만의 장르 조합이나 비중 특징을 짧게 보충하세요.
              펫의 일상을 다시 소개하거나 첫 문장의 장르 목록을 반복하지 마세요.
            - 장르는 연결에 필요한 2~3개만 언급하세요. 입력의 모든 장르를 나열하지 마세요.
              일부 장르가 뚜렷하면 '편식 없이', '모든 장르를 고루' 같은 포괄적인 평가는 쓰지 마세요.
            - 같은 펫이라도 사용자의 장르 비중과 조합에 따라 연결하는 장면이 달라야 해요. 설정 전체를 요약하지 마세요.
            - 사용자 비중이 낮거나 없는 장르를 주요 취향인 것처럼 부풀려 펫에 맞추지 마세요.
            - 펫의 설정은 허구이며 사용자의 실제 행동, 청취 시간대, 감정, 성격을 의미하지 않아요.
              사용자가 공연장에 가거나 밤에 듣는다고 추측하지 마세요. 설정의 행동은 반드시 펫을 주어로 쓰세요.
            - 성격 유형, 궁합, 멜로디·비트·가사 선호를 장르만으로 단정하지 마세요.
            - 펫은 이미 장르 분포로 매칭됐어요. 다른 펫을 고르거나 새로운 설정·별명을 만들지 마세요.
              펫에게 사용자의 장르 순위를 그대로 옮기거나, 설정에 없는 행동과 강한 선호를 덧붙이지 마세요.
              장면은 설정에 실제로 있는 행동 하나를 골라 그대로 유지하세요.
              예를 들어 인디 공연을 듣는 설정을 인디 음반 코너를 찾는 행동으로 바꾸지 마세요.
            - 듣지 않는 장르를 굳이 언급하지 마세요.
            - "엄청난", "황금비율", "야무지게" 같은 과장·오글거리는 표현은 피하고, 담백하고 센스 있게.
            - 주어진 정보 외의 사실(특정 가수, 곡 제목 등)은 지어내지 마세요.
            - 친근한 존댓말로, 군더더기 없이 평가 문장만 출력하세요.

            연결 방식 예시(입력과 다르면 내용은 사용하지 마세요):
            'R&B와 힙합을 함께 즐기는 취향이, 두 장르 코너를 자주 찾는 삐냥과 닮았어요.
            여기에 인디의 비중이 가장 높다는 점이 이번 취향의 특징이에요.'
            여기서 '인디의 비중이 가장 높다'는 사용자에게만 해당해요.
            삐냥도 인디를 가장 좋아한다고 바꾸거나 '인상 깊어요' 같은 막연한 칭찬으로 끝내지 마세요.

            장르별 태그 비중(청취 시간 비율이 아님): %s
            대중성 성향: %s
            매칭된 펫과 고정 설정: %s
            """;

    private final GeminiClient gemini;

    public TasteCommentService(GeminiClient gemini) {
        this.gemini = gemini;
    }

    public String comment(Map<String, Double> genreVector, Double mainstream, String matchedSlug) {
        List<String> ranked = genreVector.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
                .map(Map.Entry::getKey)
                .toList();

        if (ranked.isEmpty()) {
            return "아직 취향을 평하기엔 데이터가 부족해요.";
        }

        try {
            String distribution = ranked.stream()
                    .map(genre -> String.format(Locale.ROOT, "%s %.1f%%", genre, genreVector.get(genre) * 100))
                    .collect(Collectors.joining(", "));
            String context = Character.POOL.stream().filter(pet -> pet.slug().equals(matchedSlug))
                    .findFirst().map(pet -> pet.name() + " — " + pet.story())
                    .orElse("펫 연결 없이 장르만 설명하세요. 매칭된 펫 설정을 확인할 수 없어요.");
            String out = gemini.generateWithoutThinking(PROMPT.formatted(distribution, mainstreamLabel(mainstream), context));
            return out == null || out.isBlank() ? fallback(ranked) : out.trim();
        } catch (Exception e) {
            // LLM 실패해도 페이지는 죽지 않게.
            return fallback(ranked);
        }
    }

    /** 대중성 점수(0~100)를 숫자 대신 말로. LLM이 점수를 그대로 읊지 않게. */
    private String fallback(List<String> ranked) {
        return String.join(", ", ranked.stream().limit(3).toList())
                + " 장르를 중심으로 듣고 있어요. AI 취향 설명은 잠시 사용할 수 없어 장르 요약을 보여드려요.";
    }

    private String mainstreamLabel(Double mainstream) {
        if (mainstream == null) return "청취자 수 정보 부족 — 대중성에 대해서는 언급하지 마세요";
        if (mainstream >= 70) return "대중적인 곡 위주";
        if (mainstream >= 55) return "대체로 대중적인 편";
        if (mainstream > 45) return "대중적인 곡과 마이너한 곡이 비슷하게 섞임";
        if (mainstream > 30) return "다소 마이너한 편";
        return "마이너한 곡 위주";
    }
}
