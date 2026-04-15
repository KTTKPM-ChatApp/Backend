package chatapp.realtimeservice.service;

import chatapp.realtimeservice.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserSessionServiceTest {

    private UserSessionService userSessionService;
    private PresenceRepository presenceRepository;

    @BeforeEach
    void setUp() {
        presenceRepository = new InMemoryPresenceRepository();
        userSessionService = new UserSessionService(presenceRepository);
    }

    @Test
    void marksUserOnlineOnConnectAndOfflineOnLastDisconnect() {
        userSessionService.handleWebSocketConnectListener(connectEvent("s1", "u1"));

        assertTrue(userSessionService.isUserOnline("u1"));
        assertEquals(1, userSessionService.getActiveSessionCount("u1"));

        userSessionService.handleWebSocketDisconnectListener(disconnectEvent("s1", "u1"));

        assertFalse(userSessionService.isUserOnline("u1"));
        assertEquals(0, userSessionService.getActiveSessionCount("u1"));
    }

    @Test
    void keepsUserOnlineWhenOneOfMultipleSessionsDisconnects() {
        userSessionService.handleWebSocketConnectListener(connectEvent("s1", "u1"));
        userSessionService.handleWebSocketConnectListener(connectEvent("s2", "u1"));

        assertTrue(userSessionService.isUserOnline("u1"));
        assertEquals(2, userSessionService.getActiveSessionCount("u1"));

        userSessionService.handleWebSocketDisconnectListener(disconnectEvent("s1", "u1"));

        assertTrue(userSessionService.isUserOnline("u1"));
        assertEquals(1, userSessionService.getActiveSessionCount("u1"));
    }

    @Test
    void ignoresConnectWithoutUserPrincipal() {
        userSessionService.handleWebSocketConnectListener(connectEventWithoutPrincipal("s1"));

        assertFalse(userSessionService.isUserOnline("u1"));
        assertEquals(0, userSessionService.getOnlineUserCount());
    }

    @Test
    void ignoresUnknownDisconnectSession() {
        userSessionService.handleWebSocketDisconnectListener(disconnectEvent("unknown", "u1"));

        assertEquals(0, userSessionService.getOnlineUserCount());
    }

    @Test
    void ignoresDuplicateConnectForSameSession() {
        userSessionService.handleWebSocketConnectListener(connectEvent("s1", "u1"));
        userSessionService.handleWebSocketConnectListener(connectEvent("s1", "u1"));

        assertTrue(userSessionService.isUserOnline("u1"));
        assertEquals(1, userSessionService.getActiveSessionCount("u1"));
        assertEquals(1, userSessionService.getOnlineUserCount());
    }

    @Test
    void ignoresDuplicateDisconnectForSameSession() {
        userSessionService.handleWebSocketConnectListener(connectEvent("s1", "u1"));
        userSessionService.handleWebSocketDisconnectListener(disconnectEvent("s1", "u1"));
        userSessionService.handleWebSocketDisconnectListener(disconnectEvent("s1", "u1"));

        assertFalse(userSessionService.isUserOnline("u1"));
        assertEquals(0, userSessionService.getActiveSessionCount("u1"));
    }

    private SessionConnectedEvent connectEvent(String sessionId, String userId) {
        Message<byte[]> message = stompMessage(StompCommand.CONNECT, sessionId, userId, true);
        SessionConnectedEvent event = mock(SessionConnectedEvent.class);
        when(event.getMessage()).thenReturn(message);
        return event;
    }

    private SessionConnectedEvent connectEventWithoutPrincipal(String sessionId) {
        Message<byte[]> message = stompMessage(StompCommand.CONNECT, sessionId, null, false);
        SessionConnectedEvent event = mock(SessionConnectedEvent.class);
        when(event.getMessage()).thenReturn(message);
        return event;
    }

    private SessionDisconnectEvent disconnectEvent(String sessionId, String userId) {
        Message<byte[]> message = stompMessage(StompCommand.DISCONNECT, sessionId, userId, true);
        SessionDisconnectEvent event = mock(SessionDisconnectEvent.class);
        when(event.getMessage()).thenReturn(message);
        return event;
    }

    private Message<byte[]> stompMessage(StompCommand command, String sessionId, String userId, boolean withPrincipal) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setSessionId(sessionId);
        if (withPrincipal) {
            accessor.setUser(new UserPrincipal(userId));
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}

