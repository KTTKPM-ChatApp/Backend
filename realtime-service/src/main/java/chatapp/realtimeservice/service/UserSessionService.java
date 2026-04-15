package chatapp.realtimeservice.service;

import chatapp.realtimeservice.security.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Optional;

@Service
public class UserSessionService {
    private static final Logger logger = LoggerFactory.getLogger(UserSessionService.class);

    private final PresenceRepository presenceRepository;

    public UserSessionService(PresenceRepository presenceRepository) {
        this.presenceRepository = presenceRepository;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        Principal principal = accessor.getUser();
        String sessionId = accessor.getSessionId();
        if (!(principal instanceof UserPrincipal) || principal.getName() == null || principal.getName().isBlank()
                || sessionId == null || sessionId.isBlank()) {
            return;
        }

        String userId = principal.getName();
        boolean becameOnline = presenceRepository.addSession(userId, sessionId);
        if (becameOnline) {
            logger.info("User online: {}", userId);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = accessor.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        Optional<PresenceRepository.SessionRemoval> removal = presenceRepository.removeSession(sessionId);
        removal.filter(PresenceRepository.SessionRemoval::becameOffline)
                .ifPresent(sessionRemoval -> logger.info("User offline: {}", sessionRemoval.userId()));
    }

    public boolean isUserOnline(String userId) {
        return presenceRepository.isUserOnline(userId);
    }

    // Package-private helpers for tests/monitoring.
    int getActiveSessionCount(String userId) {
        return presenceRepository.getActiveSessionCount(userId);
    }

    int getOnlineUserCount() {
        return presenceRepository.getOnlineUserCount();
    }
}
