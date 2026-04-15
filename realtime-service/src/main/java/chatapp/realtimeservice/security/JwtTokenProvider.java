package chatapp.realtimeservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtTokenProvider {
    private static final Logger logger = LoggerFactory.getLogger(JwtTokenProvider.class);

    // Lấy chuỗi bí mật từ file application.properties hoặc application.yml
    // (Lưu ý: Chuỗi này phải giống hệt với chuỗi mà API Gateway dùng để tạo Token)
    @Value("${jwt.secret:}")
    private String jwtSecret;

    public String getUserIdFromToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }

        if (jwtSecret == null || jwtSecret.isBlank()) {
            logger.error("JWT secret is not configured");
            return null;
        }

        String normalizedToken = token.startsWith("Bearer ") ? token.substring(7) : token;

        try {
            SecretKey signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(normalizedToken)
                    .getPayload();

            // Giả sử User ID được lưu trong trường "sub" (Subject) của JWT
            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException ex) {
            logger.warn("Invalid JWT token: {}", ex.getMessage());
            return null;
        }
    }
}
