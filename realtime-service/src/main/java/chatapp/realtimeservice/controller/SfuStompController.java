package chatapp.realtimeservice.controller;

import chatapp.realtimeservice.service.MessageBroadcastService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class SfuStompController {
    private static final Logger logger = LoggerFactory.getLogger(SfuStompController.class);

    private final MessageBroadcastService messageBroadcastService;

    public SfuStompController(MessageBroadcastService messageBroadcastService) {
        this.messageBroadcastService = messageBroadcastService;
    }

    @MessageMapping("/sfu.join")
    public void handleSfuJoin(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        String sfuRoomId = getString(payload, "sfu_room_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || sfuRoomId == null) {
            logger.warn("User {} attempted to join SFU room with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "sfu-peer-joined",
            "sender_id", userId,
            "sfu_room_id", sfuRoomId
        ));
        logger.info("User {} joined SFU room {} in conv {}", userId, sfuRoomId, conversationId);
    }

    @MessageMapping("/sfu.leave")
    public void handleSfuLeave(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        String sfuRoomId = getString(payload, "sfu_room_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null) {
            logger.warn("User {} attempted to leave SFU room with missing conversation_id", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "sfu-peer-left",
            "sender_id", userId,
            "sfu_room_id", sfuRoomId != null ? sfuRoomId : ""
        ));
        logger.info("User {} left SFU room in conv {}", userId, conversationId);
    }

    @MessageMapping("/sfu.active-speaker")
    public void handleActiveSpeaker(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        String activePeerId = getString(payload, "active_peer_id");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null) {
            logger.warn("User {} attempted to send active speaker with missing conversation_id", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "sfu-active-speaker",
            "sender_id", userId,
            "active_peer_id", activePeerId
        ));
    }

    @MessageMapping("/sfu.transport-state")
    public void handleTransportState(Map<String, Object> payload, SimpMessageHeaderAccessor headerAccessor) {
        String conversationId = getString(payload, "conversation_id");
        String transportState = getString(payload, "state");
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "unknown";

        if (conversationId == null || transportState == null) {
            logger.warn("User {} attempted to send transport state with missing params", userId);
            return;
        }

        messageBroadcastService.broadcastCallSignal(conversationId, Map.of(
            "type", "sfu-transport-state",
            "sender_id", userId,
            "state", transportState
        ));
        logger.debug("Transport state update from user {} in conv {}: {}", userId, conversationId, transportState);
    }

    private String getString(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }
}
