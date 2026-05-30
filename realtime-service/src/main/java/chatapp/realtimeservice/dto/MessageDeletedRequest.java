package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MessageDeletedRequest(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("sender_id") String senderId,
        @JsonProperty("deleted_at") String deletedAt
) {
}
