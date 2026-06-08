package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record GroupCallNotificationRequest(
    @JsonProperty("session_id") String sessionId,
    @JsonProperty("conversation_id") String conversationId,
    @JsonProperty("sfu_room_id") String sfuRoomId,
    @JsonProperty("started_by") String startedBy,
    @JsonProperty("host_id") String hostId,
    @JsonProperty("caller_name") String callerName,
    @JsonProperty("caller_avatar_url") String callerAvatarUrl,
    @JsonProperty("member_ids") List<String> memberIds
) {
}
