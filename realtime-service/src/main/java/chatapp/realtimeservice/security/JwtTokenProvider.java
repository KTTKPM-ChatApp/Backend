package chatapp.realtimeservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class JwtTokenProvider {
    private static final Logger logger = LoggerFactory.getLogger(JwtTokenProvider.class);

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
            byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);

            Claims claims = Jwts.parser()
                    .setSigningKey(keyBytes)
                    .build()
                    .parseClaimsJws(normalizedToken)
                    .getBody();

            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException ex) {
            logger.warn("Invalid JWT token: {}", ex.getMessage());
            return null;
        }
    }
}
