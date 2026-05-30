package chatapp.realtimeservice.service;

import chatapp.realtimeservice.dto.ApiResponse;
import chatapp.realtimeservice.dto.ConversationCreatedRequest;
import chatapp.realtimeservice.dto.MessageNotificationRequest;
import chatapp.realtimeservice.dto.NewConversationRequest;
import org.slf4j.Logger;
import java.util.Map;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

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
            // 1. Broadcast to conversation topic (for users who have this conversation open)
            simpMessagingTemplate.convertAndSend(
                    "/topic/conv." + notification.conversationId() + "/messages",
                    notification
            );

            for (String receiverId : getReceiverIds(notification)) {
                simpMessagingTemplate.convertAndSendToUser(
                        receiverId,
                        "/queue/messages",
                        notification
                );
            }

            logger.info("Message {} broadcast to conversation {} via WebSocket", notification.messageId(), notification.conversationId());

            // 2. Broadcast to each recipient's personal topic (for conversation list preview updates)
            if (notification.receiverIds() != null && !notification.receiverIds().isEmpty()) {
                for (String receiverId : notification.receiverIds()) {
                    if (receiverId == null || receiverId.isBlank()) continue;
                    try {
                        simpMessagingTemplate.convertAndSend(
                                "/topic/user-messages/" + receiverId,
                                notification
                        );
                    } catch (Exception ex) {
                        logger.warn("Failed to send user notification to {}: {}", receiverId, ex.getMessage());
                    }
                }
            }

            return ApiResponse.ok(null, "Message notification sent successfully");
        } catch (Exception ex) {
            logger.error("Failed to broadcast message notification to conversation {}: {}", 
                    notification.conversationId(), ex.getMessage(), ex);
            return ApiResponse.error("Failed to send message notification: " + ex.getMessage());
        }
    }

    public void broadcastTyping(String conversationId, String userId, String displayName) {
        String destination = "/topic/conv." + conversationId + "/typing";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new TypingEvent(conversationId, userId, displayName, true));
            logger.debug("Typing broadcast: user {} ({}) in conversation {}", userId, displayName, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast typing for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public void broadcastStopTyping(String conversationId, String userId, String displayName) {
        String destination = "/topic/conv." + conversationId + "/typing";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new TypingEvent(conversationId, userId, displayName, false));
            logger.debug("Stop typing broadcast: user {} ({}) in conversation {}", userId, displayName, conversationId);
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

    private List<String> getReceiverIds(MessageNotificationRequest notification) {
        List<String> receiverIds = new ArrayList<>();
        if (notification.receiverIds() != null) {
            receiverIds.addAll(notification.receiverIds());
        }
        if (notification.receiverId() != null && !notification.receiverId().isBlank()) {
            receiverIds.add(notification.receiverId());
        }
        return receiverIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }

    public void notifyConversationCreated(ConversationCreatedRequest conversation) {
        if (conversation.memberIds() == null || conversation.memberIds().isEmpty()) {
            logger.warn("Conversation {} has no members to notify", conversation.conversationId());
            return;
        }

        for (String memberId : conversation.memberIds()) {
            if (memberId == null || memberId.isBlank()) continue;
            simpMessagingTemplate.convertAndSendToUser(
                    memberId,
                    "/queue/conversations",
                    conversation
            );
        }

        logger.info("Conversation {} notification sent to {} members",
                conversation.conversationId(), conversation.memberIds().size());
    }

    public record PresenceUpdate(String userId, String event) {
    }

    public record TypingEvent(String conversationId, String userId, String displayName, boolean typing) {
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

    public void broadcastReactionAdded(String conversationId, String userId, String messageId, String emoji) {
        String destination = "/topic/conv." + conversationId + "/reaction";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new ReactionEvent(conversationId, userId, messageId, emoji, "added"));
            logger.info("Reaction added broadcast: {} -> {} on message {} in conv {}",
                    userId, emoji, messageId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast reaction added for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public void broadcastReactionRemoved(String conversationId, String userId, String messageId, String emoji) {
        String destination = "/topic/conv." + conversationId + "/reaction";
        try {
            simpMessagingTemplate.convertAndSend(destination,
                    new ReactionEvent(conversationId, userId, messageId, emoji, "removed"));
            logger.info("Reaction removed broadcast: {} -> {} on message {} in conv {}",
                    userId, emoji, messageId, conversationId);
        } catch (Exception ex) {
            logger.warn("Failed to broadcast reaction removed for user {} in conv {}: {}",
                    userId, conversationId, ex.getMessage());
        }
    }

    public record ReactionEvent(String conversationId, String userId, String messageId, String emoji, String action) {
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

        // For MEMBER_REMOVED, also notify the removed user directly via their personal topic
        if ("MEMBER_REMOVED".equals(systemEventType) && metadata instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> metaMap = (Map<String, Object>) metadata;
            Object removedUserIdObj = metaMap.get("removed_user_id");
            if (removedUserIdObj instanceof String removedUserId && !removedUserId.isBlank()) {
                String userTopic = "/topic/user-conversations/" + removedUserId;
                try {
                    simpMessagingTemplate.convertAndSend(userTopic, Map.of(
                            "type", "MEMBER_REMOVED",
                            "conversation_id", conversationId,
                            "removed_by", senderId
                    ));
                    logger.info("Sent MEMBER_REMOVED notification to user {}", removedUserId);
                } catch (Exception ex) {
                    logger.warn("Failed to notify removed user {}: {}", removedUserId, ex.getMessage());
                }
            }
        }
    }

    public void broadcastNewConversation(NewConversationRequest request) {
        if (request.memberIds() == null || request.memberIds().isEmpty()) {
            logger.warn("No members to notify for new conversation: {}", request.conversationId());
            return;
        }

        try {
            simpMessagingTemplate.convertAndSend(
                    "/topic/new-conversations",
                    request
            );
            logger.info("New conversation notification broadcast for {} with {} members",
                    request.conversationId(), request.memberIds().size());
        } catch (Exception ex) {
            logger.warn("Failed to broadcast new conversation {}: {}",
                    request.conversationId(), ex.getMessage());
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


