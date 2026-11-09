# Build context: repository root (shared/characters.json is required).
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace/backend
COPY backend/gradlew backend/build.gradle backend/settings.gradle ./
COPY backend/gradle ./gradle
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew
COPY shared /workspace/shared
COPY backend/src ./src
# The image build must pass tests, even before CI is connected.
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon test bootJar

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 musicpets \
    && useradd --uid 10001 --gid musicpets --no-create-home musicpets
WORKDIR /app
COPY --from=build --chown=musicpets:musicpets /workspace/backend/build/libs/app.jar ./app.jar
USER musicpets
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
