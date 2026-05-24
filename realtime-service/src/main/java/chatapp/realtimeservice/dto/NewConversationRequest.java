package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record NewConversationRequest(
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("type") String type,
        @JsonProperty("created_by") String createdBy,
        @JsonProperty("member_ids") List<String> memberIds,
        @JsonProperty("title") String title
) {
}
