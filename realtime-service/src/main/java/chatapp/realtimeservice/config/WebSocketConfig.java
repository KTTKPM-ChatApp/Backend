package chatapp.realtimeservice.config;

import chatapp.realtimeservice.security.JwtTokenProvider;
import chatapp.realtimeservice.security.UserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.allowed-origins:*}")
    private String allowedOrigins;

    public WebSocketConfig(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Điểm nối kết cho client. Client sẽ gọi ws://domain/ws
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins) // Cấu hình từ properties
                .withSockJS(); // Cung cấp fallback nếu trình duyệt không hỗ trợ WebSocket thuần
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Tiền tố cho các tin nhắn từ Server đẩy về Client (ví dụ: /topic/group-1)
        registry.enableSimpleBroker("/topic", "/queue");

        // Tiền tố cho các request từ Client gửi lên Server (ví dụ: /app/chat.sendMessage)
        registry.setApplicationDestinationPrefixes("/app");

        // Tiền tố cho tin nhắn gửi đích danh một user (1-1)
        registry.setUserDestinationPrefix("/user");
    }

    // Chặn các tin nhắn STOMP để kiểm tra JWT khi Client yêu cầu CONNECT
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null) {
                    return message;
                }

                // Nếu Client đang yêu cầu kết nối
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // Lấy token từ header "Authorization" của STOMP
                    String authorizationHeader = accessor.getFirstNativeHeader("Authorization");
                    String userId = jwtTokenProvider.getUserIdFromToken(authorizationHeader);

                    if (userId == null || userId.isBlank()) {
                        throw new IllegalArgumentException("Invalid JWT token");
                    }

                    // Lưu user vào Principal của WebSocket session
                    accessor.setUser(new UserPrincipal(userId));
                }
                return message;
            }
        });
    }
}
