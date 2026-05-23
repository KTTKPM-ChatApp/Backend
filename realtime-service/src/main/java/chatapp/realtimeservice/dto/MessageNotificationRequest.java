package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record MessageNotificationRequest(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("sender_id") String senderId,
        @JsonProperty("sender_name") String senderName,
        @JsonProperty("receiver_id") String receiverId,
        @JsonProperty("receiver_ids") List<String> receiverIds,
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("content") String content,
        @JsonProperty("content_type") String contentType,
        @JsonProperty("created_at") String createdAt,
        @JsonProperty("metadata") Object metadata
) {
}

