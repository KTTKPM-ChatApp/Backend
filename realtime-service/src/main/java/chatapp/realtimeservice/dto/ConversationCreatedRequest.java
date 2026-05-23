package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ConversationCreatedRequest(
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("type") String type,
        @JsonProperty("member_ids") List<String> memberIds,
        @JsonProperty("title") String title,
        @JsonProperty("created_by") String createdBy
) {
}
