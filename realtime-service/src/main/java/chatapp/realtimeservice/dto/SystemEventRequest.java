package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public record SystemEventRequest(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("sender_id") String senderId,
        @JsonProperty("system_event_type") String systemEventType,
        @JsonProperty("metadata") Map<String, Object> metadata,
        @JsonProperty("created_at") String createdAt
) {
}
