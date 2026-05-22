package chatapp.realtimeservice.service;

import chatapp.realtimeservice.dto.ApiResponse;
import chatapp.realtimeservice.dto.MessageNotificationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class MessageBroadcastService {
    private static final Logger logger = LoggerFactory.getLogger(MessageBroadcastService.class);

    private final SimpMessagingTemplate simpMessagingTemplate;
    private final PresenceRepository presenceRepository;

    public MessageBroadcastService(SimpMessagingTemplate simpMessagingTemplate,
                                   PresenceRepository presenceRepository) {
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.presenceRepository = presenceRepository;
    }

    public ApiResponse<Void> notifyMessageReceived(MessageNotificationRequest notification) {
        if (notification.conversationId() == null || notification.conversationId().isBlank()) {
            logger.warn("Conversation ID is empty for message: {}", notification.messageId());
            return ApiResponse.error("Conversation ID cannot be empty");
        }

        try {
            simpMessagingTemplate.convertAndSend(
                    "/topic/conv." + notification.conversationId() + "/messages",
                    notification
            );
            logger.info("Message {} broadcast to conversation {} via WebSocket", notification.messageId(), notification.conversationId());
            return ApiResponse.ok(null, "Message notification sent successfully");
        } catch (Exception ex) {
            logger.error("Failed to broadcast message notification to conversation {}: {}", 
                    notification.conversationId(), ex.getMessage(), ex);
            return ApiResponse.error("Failed to send message notification: " + ex.getMessage());
        }
    }

    public void broadcastTyping(String conversationId, String userId) {
        String destination = "/topic/conv." + conversationId + "/typing";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new TypingEvent(conversationId, userId, true));
            logger.debug("Typing broadcast: user {} in conversation {}", userId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast typing for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public void broadcastStopTyping(String conversationId, String userId) {
        String destination = "/topic/conv." + conversationId + "/typing";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new TypingEvent(conversationId, userId, false));
            logger.debug("Stop typing broadcast: user {} in conversation {}", userId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast stop typing for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public void broadcastMessageRead(String conversationId, String userId, String messageId) {
        String destination = "/topic/conv." + conversationId + "/read";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new ReadReceiptEvent(conversationId, userId, messageId));
            logger.info("Read receipt broadcast: user {} read message {} in conv {}",
                    userId, messageId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast read receipt for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public void notifyPresenceChange(String userId, boolean online) {
        String event = online ? "USER_ONLINE" : "USER_OFFLINE";
        try {
            simpMessagingTemplate.convertAndSend("/topic/presence-updates", 
                    new PresenceUpdate(userId, event));
            logger.info("Broadcast presence event: {} for user {}", event, userId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast presence change for user {}: {}", userId, ex.getMessage());
        }
    }

    private boolean isUserOnline(String userId) {
        return presenceRepository.isUserOnline(userId);
    }

    public record PresenceUpdate(String userId, String event) {
    }

    public record TypingEvent(String conversationId, String userId, boolean typing) {
    }

    public record ReadReceiptEvent(String conversationId, String userId, String messageId) {
    }

    public void broadcastMessageDelete(String conversationId, String userId, String messageId) {
        String destination = "/topic/conv." + conversationId + "/delete";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new MessageDeletedEvent(conversationId, userId, messageId));
            logger.info("Delete broadcast: user {} deleted message {} in conv {}",
                    userId, messageId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast delete for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public record MessageDeletedEvent(String conversationId, String userId, String messageId) {
    }

    public void broadcastPin(String conversationId, String userId, String messageId) {
        String destination = "/topic/conv." + conversationId + "/pin";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new PinEvent(conversationId, userId, messageId, true));
            logger.info("Pin broadcast: user {} pinned message {} in conv {}",
                    userId, messageId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast pin for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public void broadcastUnpin(String conversationId, String userId, String messageId) {
        String destination = "/topic/conv." + conversationId + "/pin";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new PinEvent(conversationId, userId, messageId, false));
            logger.info("Unpin broadcast: user {} unpinned message {} in conv {}",
                    userId, messageId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast unpin for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public record PinEvent(String conversationId, String userId, String messageId, boolean pinned) {
    }

    public void broadcastSystemEvent(String conversationId, String messageId, String senderId,
                                     String systemEventType, Object metadata, String createdAt) {
        String destination = "/topic/conv." + conversationId + "/system";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new SystemEventPayload(conversationId, messageId, senderId, systemEventType, metadata, createdAt));
            logger.info("System event broadcast: {} in conv {} by {}", systemEventType, conversationId, senderId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast system event in conv {}: {}",
                    conversationId, ex.getMessage());
        }
    }

    public record SystemEventPayload(
            String conversationId,
            String messageId,
            String senderId,
            String systemEventType,
            Object metadata,
            String createdAt
    ) {
    }
}


