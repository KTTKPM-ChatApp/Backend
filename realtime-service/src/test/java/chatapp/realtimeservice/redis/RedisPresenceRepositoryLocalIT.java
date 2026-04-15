package chatapp.realtimeservice.redis;

import chatapp.realtimeservice.service.PresenceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "presence.store=redis",
        "spring.data.redis.host=localhost",
        "spring.data.redis.port=6380"
})
class RedisPresenceRepositoryLocalIT {

    @Autowired
    private PresenceRepository presenceRepository;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void clearRedis() {
        var connectionFactory = redisTemplate.getConnectionFactory();
        assertNotNull(connectionFactory);
        connectionFactory.getConnection().serverCommands().flushDb();
    }

    @Test
    void shouldUseRedisRepositoryAndTrackPresence() {
        assertInstanceOf(RedisPresenceRepository.class, presenceRepository);

        assertTrue(presenceRepository.addSession("u1", "s1"));
        assertFalse(presenceRepository.addSession("u1", "s2"));

        assertTrue(presenceRepository.isUserOnline("u1"));
        assertEquals(2, presenceRepository.getActiveSessionCount("u1"));
        assertEquals(1, presenceRepository.getOnlineUserCount());

        Optional<PresenceRepository.SessionRemoval> first = presenceRepository.removeSession("s1");
        assertTrue(first.isPresent());
        assertFalse(first.get().becameOffline());

        Optional<PresenceRepository.SessionRemoval> second = presenceRepository.removeSession("s2");
        assertTrue(second.isPresent());
        assertTrue(second.get().becameOffline());

        assertFalse(presenceRepository.isUserOnline("u1"));
        assertEquals(0, presenceRepository.getActiveSessionCount("u1"));
        assertEquals(0, presenceRepository.getOnlineUserCount());
    }
}


