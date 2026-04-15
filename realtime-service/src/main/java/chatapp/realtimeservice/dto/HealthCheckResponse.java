package chatapp.realtimeservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record HealthCheckResponse(
        @JsonProperty("status") String status,
        @JsonProperty("service") String service,
        @JsonProperty("timestamp") long timestamp,
        @JsonProperty("version") String version
) {
}

