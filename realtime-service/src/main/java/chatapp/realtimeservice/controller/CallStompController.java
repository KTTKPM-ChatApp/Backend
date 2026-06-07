package chatapp.realtimeservice.controller;

import chatapp.realtimeservice.service.MessageBroadcastService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class CallStompController {
    private static final Logger logger = LoggerFactory.getLogger(CallStompController.class);

    private final MessageBroadcastService messageBroadcastService;

    public CallStompController(MessageBroadcastService messageBroadcastService) {
        this.messageBroadcastService = messageBroadcastService;
    }

    @MessageMapping("/call.offer")
    public void handleCallOffer(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";
        Object sdp = payload.get("sdp");

        if (conversationId == null || sdp == null) {
            logger.warn("User {} attempted to send offer with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "offer",
            "sender_id", userId,
            "sdp", sdp
        ));
        logger.info("Call offer from user {} in conv {}", userId, conversationId);
    }

    @MessageMapping("/call.answer")
    public void handleCallAnswer(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";
        Object sdp = payload.get("sdp");

        if (conversationId == null || sdp == null) {
            logger.warn("User {} attempted to send answer with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "answer",
            "sender_id", userId,
            "sdp", sdp
        ));
        logger.info("Call answer from user {} in conv {}", userId, conversationId);
    }

    @MessageMapping("/call.ice-candidate")
    public void handleIceCandidate(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";
        Object candidate = payload.get("candidate");

        if (conversationId == null || candidate == null) {
            logger.warn("User {} attempted to send ICE candidate with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "ice-candidate",
            "sender_id", userId,
            "candidate", candidate
        ));
        logger.debug("ICE candidate from user {} in conv {}", userId, conversationId);
    }

    @MessageMapping("/call.hangup")
    public void handleCallHangup(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null) {
            logger.warn("User {} attempted to hangup with missing conversation_id", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "hangup",
            "sender_id", userId
        ));
        logger.info("Call hangup from user {} in conv {}", userId, conversationId);
    }

    private String getString(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }
}
