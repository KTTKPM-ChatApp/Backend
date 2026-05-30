package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReactionRequest(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("user_id") String userId,
        @JsonProperty("emoji") String emoji
) {
}
