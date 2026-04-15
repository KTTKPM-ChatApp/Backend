package chatapp.realtimeservice.service;

import java.util.Optional;

public interface PresenceRepository {
    boolean addSession(String userId, String sessionId);

    Optional<SessionRemoval> removeSession(String sessionId);

    boolean isUserOnline(String userId);

    int getActiveSessionCount(String userId);

    int getOnlineUserCount();

    record SessionRemoval(String userId, boolean becameOffline) {
    }
}
