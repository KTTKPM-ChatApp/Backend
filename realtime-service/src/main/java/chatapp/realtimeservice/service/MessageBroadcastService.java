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

    public MessageBroadcastService(SimpMessagingTemplate simpMessagingTemplate) {
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    public ApiResponse<Void> notifyMessageReceived(MessageNotificationRequest notification) {
        if (notification.receiverId() == null || notification.receiverId().isBlank()) {
            logger.warn("Receiver ID is empty for message: {}", notification.messageId());
            return ApiResponse.error("Receiver ID cannot be empty");
        }

        if (!isUserOnline(notification.receiverId())) {
            logger.debug("User {} is not online, message {} will be delivered when user comes online", 
                    notification.receiverId(), notification.messageId());
        }

        String destination = "/user/" + notification.receiverId() + "/queue/messages";
        try {
            simpMessagingTemplate.convertAndSend(destination, notification);
            logger.info("Message {} sent to user {} via WebSocket", notification.messageId(), notification.receiverId());
            return ApiResponse.ok(null, "Message notification sent successfully");
        } catch (Exception ex) {
            logger.error("Failed to send message notification to user {}: {}", 
                    notification.receiverId(), ex.getMessage(), ex);
            return ApiResponse.error("Failed to send message notification: " + ex.getMessage());
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
        return true;
    }

    public record PresenceUpdate(String userId, String event) {
    }
}


