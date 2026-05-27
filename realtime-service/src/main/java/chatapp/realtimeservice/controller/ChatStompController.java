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
public class ChatStompController {
    private static final Logger logger = LoggerFactory.getLogger(ChatStompController.class);

    private final MessageBroadcastService messageBroadcastService;

    public ChatStompController(MessageBroadcastService messageBroadcastService) {
        this.messageBroadcastService = messageBroadcastService;
    }

    @MessageMapping("/chat/join")
    public void handleChatJoin(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || conversationId.isBlank()) {
            logger.warn("User {} attempted to join with missing conversation_id", userId);
            return;
        }

        headerAccessor.getSessionAttributes().put("conversation_id", conversationId);
        logger.info("User {} joined conversation {}", userId, conversationId);
    }

    @MessageMapping("/chat/leave")
    public void handleChatLeave(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || conversationId.isBlank()) {
            return;
        }

        headerAccessor.getSessionAttributes().remove("conversation_id");
        logger.info("User {} left conversation {}", userId, conversationId);
    }

    @MessageMapping("/chat/typing")
    public void handleChatTyping(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";
        String displayName = payload.get("display_name") != null
                ? payload.get("display_name").toString()
                : userId;

        if (conversationId == null || conversationId.isBlank()) {
            return;
        }

        messageBroadcastService.broadcastTyping(conversationId, userId, displayName);
    }

    @MessageMapping("/chat/delete")
    public void handleChatDelete(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        String messageId = payload.get("message_id") != null
                ? payload.get("message_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || conversationId.isBlank() || messageId == null || messageId.isBlank()) {
            logger.warn("User {} attempted to delete with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastMessageDelete(conversationId, userId, messageId);
    }

    @MessageMapping("/chat/pin")
    public void handleChatPin(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        String messageId = payload.get("message_id") != null
                ? payload.get("message_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || conversationId.isBlank() || messageId == null || messageId.isBlank()) {
            logger.warn("User {} attempted to pin with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastPin(conversationId, userId, messageId);
    }

    @MessageMapping("/chat/unpin")
    public void handleChatUnpin(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        String messageId = payload.get("message_id") != null
                ? payload.get("message_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || conversationId.isBlank() || messageId == null || messageId.isBlank()) {
            logger.warn("User {} attempted to unpin with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastUnpin(conversationId, userId, messageId);
    }

    @MessageMapping("/chat/stop_typing")
    public void handleChatStopTyping(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";
        String displayName = payload.get("display_name") != null
                ? payload.get("display_name").toString()
                : userId;

        if (conversationId == null || conversationId.isBlank()) {
            return;
        }

        messageBroadcastService.broadcastStopTyping(conversationId, userId, displayName);
    }

    @MessageMapping("/message.read")
    public void handleMessageRead(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = payload.get("conversation_id") != null
                ? payload.get("conversation_id").toString()
                : null;
        String messageId = payload.get("message_id") != null
                ? payload.get("message_id").toString()
                : null;
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || conversationId.isBlank() || messageId == null || messageId.isBlank()) {
            return;
        }

        messageBroadcastService.broadcastMessageRead(conversationId, userId, messageId);
    }
}
