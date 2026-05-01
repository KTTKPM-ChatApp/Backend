# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Copy Maven wrapper và pom.xml trước để tận dụng layer cache
COPY mvnw pom.xml ./
COPY .mvn .mvn

# Download dependencies (cache layer riêng)
RUN ./mvnw dependency:go-offline -q

# Copy source code và build
COPY src ./src
RUN ./mvnw package -Dmaven.test.skip=true -q

# ─── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Tạo user non-root để tăng security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy JAR từ stage builder
COPY --from=builder /app/target/realtime-service-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
