package chatapp.realtimeservice.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Repository
@ConditionalOnProperty(name = "presence.store", havingValue = "memory", matchIfMissing = true)
public class InMemoryPresenceRepository implements PresenceRepository {
    private final ConcurrentHashMap<String, Set<String>> userSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> sessionToUser = new ConcurrentHashMap<>();

    @Override
    public boolean addSession(String userId, String sessionId) {
        if (userId == null || userId.isBlank() || sessionId == null || sessionId.isBlank()) {
            return false;
        }

        if (sessionToUser.putIfAbsent(sessionId, userId) != null) {
            return false;
        }

        AtomicBoolean becameOnline = new AtomicBoolean(false);
        userSessions.compute(userId, (id, sessions) -> {
            if (sessions == null) {
                Set<String> newSessions = ConcurrentHashMap.newKeySet();
                newSessions.add(sessionId);
                becameOnline.set(true);
                return newSessions;
            }

            sessions.add(sessionId);
            return sessions;
        });
        return becameOnline.get();
    }

    @Override
    public Optional<SessionRemoval> removeSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }

        String userId = sessionToUser.remove(sessionId);
        if (userId == null || userId.isBlank()) {
            return Optional.empty();
        }

        AtomicBoolean becameOffline = new AtomicBoolean(false);
        userSessions.computeIfPresent(userId, (id, sessions) -> {
            sessions.remove(sessionId);
            if (sessions.isEmpty()) {
                becameOffline.set(true);
                return null;
            }
            return sessions;
        });

        return Optional.of(new SessionRemoval(userId, becameOffline.get()));
    }

    @Override
    public void extendSession(String sessionId) {
        // In-memory: nothing to extend, sessions live until explicitly removed
    }

    @Override
    public boolean isUserOnline(String userId) {
        Set<String> sessions = userSessions.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    @Override
    public int getActiveSessionCount(String userId) {
        Set<String> sessions = userSessions.get(userId);
        return sessions == null ? 0 : sessions.size();
    }

    @Override
    public int getOnlineUserCount() {
        return userSessions.size();
    }
}
