package chatapp.realtimeservice.redis;

import chatapp.realtimeservice.service.PresenceRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@ConditionalOnProperty(name = "presence.store", havingValue = "redis")
public class RedisPresenceRepository implements PresenceRepository {
    private static final String ONLINE_USERS_KEY = "presence:users:online";
    private static final String USER_SESSIONS_PREFIX = "presence:user:sessions:";
    private static final String SESSION_USER_PREFIX = "presence:session:user:";

    private final StringRedisTemplate redisTemplate;

    public RedisPresenceRepository(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean addSession(String userId, String sessionId) {
        if (userId == null || userId.isBlank() || sessionId == null || sessionId.isBlank()) {
            return false;
        }

        Boolean created = redisTemplate.opsForValue().setIfAbsent(sessionUserKey(sessionId), userId);
        if (!Boolean.TRUE.equals(created)) {
            return false;
        }

        redisTemplate.opsForSet().add(userSessionsKey(userId), sessionId);
        Long becameOnline = redisTemplate.opsForSet().add(ONLINE_USERS_KEY, userId);
        return Long.valueOf(1L).equals(becameOnline);
    }

    @Override
    public Optional<SessionRemoval> removeSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }

        String userId = redisTemplate.opsForValue().get(sessionUserKey(sessionId));
        if (userId == null || userId.isBlank()) {
            return Optional.empty();
        }

        redisTemplate.delete(sessionUserKey(sessionId));
        redisTemplate.opsForSet().remove(userSessionsKey(userId), sessionId);

        Long remaining = redisTemplate.opsForSet().size(userSessionsKey(userId));
        boolean becameOffline = remaining == null || remaining == 0;
        if (becameOffline) {
            redisTemplate.delete(userSessionsKey(userId));
            redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId);
        }

        return Optional.of(new SessionRemoval(userId, becameOffline));
    }

    @Override
    public boolean isUserOnline(String userId) {
        if (userId == null || userId.isBlank()) {
            return false;
        }

        Boolean member = redisTemplate.opsForSet().isMember(ONLINE_USERS_KEY, userId);
        return Boolean.TRUE.equals(member);
    }

    @Override
    public int getActiveSessionCount(String userId) {
        if (userId == null || userId.isBlank()) {
            return 0;
        }

        Long size = redisTemplate.opsForSet().size(userSessionsKey(userId));
        return size == null ? 0 : Math.toIntExact(size);
    }

    @Override
    public int getOnlineUserCount() {
        Long size = redisTemplate.opsForSet().size(ONLINE_USERS_KEY);
        return size == null ? 0 : Math.toIntExact(size);
    }

    private String userSessionsKey(String userId) {
        return USER_SESSIONS_PREFIX + userId;
    }

    private String sessionUserKey(String sessionId) {
        return SESSION_USER_PREFIX + sessionId;
    }
}
