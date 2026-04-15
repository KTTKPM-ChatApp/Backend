package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MessageNotificationRequest(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("sender_id") String senderId,
        @JsonProperty("receiver_id") String receiverId,
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("content") String content,
        @JsonProperty("content_type") String contentType,
        @JsonProperty("created_at") String createdAt,
        @JsonProperty("metadata") Object metadata
) {
}

