package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record CallNotificationRequest(
    @JsonProperty("call_id") String callId,
    @JsonProperty("conversation_id") String conversationId,
    @JsonProperty("started_by") String startedBy,
    String type,
    @JsonProperty("member_ids") List<String> memberIds
) {
}
