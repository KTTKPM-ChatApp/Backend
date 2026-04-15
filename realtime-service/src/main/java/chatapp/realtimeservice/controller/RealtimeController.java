package chatapp.realtimeservice.controller;

import chatapp.realtimeservice.dto.ApiResponse;
import chatapp.realtimeservice.dto.HealthCheckResponse;
import chatapp.realtimeservice.dto.MessageNotificationRequest;
import chatapp.realtimeservice.service.MessageBroadcastService;
import chatapp.realtimeservice.service.PresenceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RealtimeController {
    private static final Logger logger = LoggerFactory.getLogger(RealtimeController.class);

    private final MessageBroadcastService messageBroadcastService;
    private final PresenceRepository presenceRepository;

    @Value("${app.version:1.0.0}")
    private String appVersion;

    @Value("${app.internal-api-key:}")
    private String internalApiKey;

    public RealtimeController(MessageBroadcastService messageBroadcastService, 
                             PresenceRepository presenceRepository) {
        this.messageBroadcastService = messageBroadcastService;
        this.presenceRepository = presenceRepository;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthCheckResponse> health() {
        logger.debug("Health check request received");
        HealthCheckResponse response = new HealthCheckResponse(
                "up",
                "realtime-service",
                System.currentTimeMillis(),
                appVersion
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/internal/messages/notify")
    public ResponseEntity<ApiResponse<Void>> notifyMessageReceived(
            @RequestBody MessageNotificationRequest notification,
            @RequestHeader(value = "x-internal-api-key", required = false) String apiKey) {
        
        if (validateInternalApiKey(apiKey)) {
            logger.warn("Unauthorized internal message notification attempt");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid internal API key"));
        }

        logger.info("Processing message notification for user: {}", notification.receiverId());
        ApiResponse<Void> response = messageBroadcastService.notifyMessageReceived(notification);
        
        return response.success() 
                ? ResponseEntity.ok(response)
                : ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @GetMapping("/internal/users/online")
    public ResponseEntity<ApiResponse<Boolean>> isUserOnline(
            @RequestHeader(value = "x-internal-api-key", required = false) String apiKey,
            @RequestHeader(value = "user-id") String userId) {
        
        if (validateInternalApiKey(apiKey)) {
            logger.warn("Unauthorized online status check attempt");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid internal API key"));
        }

        boolean online = presenceRepository.isUserOnline(userId);
        logger.debug("Online status check for user {}: {}", userId, online);
        return ResponseEntity.ok(ApiResponse.ok(online, "User online status"));
    }

    @GetMapping("/internal/stats/online-users")
    public ResponseEntity<ApiResponse<Integer>> getOnlineUserCount(
            @RequestHeader(value = "x-internal-api-key", required = false) String apiKey) {
        
        if (validateInternalApiKey(apiKey)) {
            logger.warn("Unauthorized stats request attempt");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid internal API key"));
        }

        int count = presenceRepository.getOnlineUserCount();
        logger.debug("Total online users: {}", count);
        return ResponseEntity.ok(ApiResponse.ok(count, "Online user count"));
    }

    private boolean validateInternalApiKey(String apiKey) {
        if (internalApiKey == null || internalApiKey.isBlank()) {
            logger.warn("Internal API key not configured");
            return true;
        }
        return !internalApiKey.equals(apiKey);
    }
}

