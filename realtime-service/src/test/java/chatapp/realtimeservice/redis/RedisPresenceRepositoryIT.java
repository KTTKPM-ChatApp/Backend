package chatapp.realtimeservice.redis;

import chatapp.realtimeservice.service.PresenceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class RedisPresenceRepositoryIT {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @DynamicPropertySource
    static void registerRedisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("presence.store", () -> "redis");
    }

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
    void shouldLoadRedisPresenceRepository() {
        assertInstanceOf(RedisPresenceRepository.class, presenceRepository);
    }

    @Test
    void shouldTrackOnlineStateAcrossMultipleSessions() {
        assertTrue(presenceRepository.addSession("u1", "s1"));
        assertFalse(presenceRepository.addSession("u1", "s2"));

        assertTrue(presenceRepository.isUserOnline("u1"));
        assertEquals(2, presenceRepository.getActiveSessionCount("u1"));
        assertEquals(1, presenceRepository.getOnlineUserCount());

        Optional<PresenceRepository.SessionRemoval> firstRemoval = presenceRepository.removeSession("s1");
        assertTrue(firstRemoval.isPresent());
        assertEquals("u1", firstRemoval.get().userId());
        assertFalse(firstRemoval.get().becameOffline());

        Optional<PresenceRepository.SessionRemoval> lastRemoval = presenceRepository.removeSession("s2");
        assertTrue(lastRemoval.isPresent());
        assertEquals("u1", lastRemoval.get().userId());
        assertTrue(lastRemoval.get().becameOffline());

        assertFalse(presenceRepository.isUserOnline("u1"));
        assertEquals(0, presenceRepository.getActiveSessionCount("u1"));
        assertEquals(0, presenceRepository.getOnlineUserCount());
    }

    @Test
    void shouldTreatDuplicateSessionConnectAsIdempotent() {
        assertTrue(presenceRepository.addSession("u1", "s1"));
        assertFalse(presenceRepository.addSession("u1", "s1"));

        assertEquals(1, presenceRepository.getActiveSessionCount("u1"));

        Optional<PresenceRepository.SessionRemoval> removal = presenceRepository.removeSession("s1");
        assertTrue(removal.isPresent());
        assertTrue(removal.get().becameOffline());

        assertTrue(presenceRepository.removeSession("s1").isEmpty());
    }
}


