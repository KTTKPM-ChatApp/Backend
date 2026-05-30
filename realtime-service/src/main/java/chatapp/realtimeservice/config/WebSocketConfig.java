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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketConfig.class);

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.allowed-origins:*}")
    private String allowedOrigins;

    @Value("${broker.relay.enabled:false}")
    private boolean brokerRelayEnabled;

    @Value("${broker.relay.host:localhost}")
    private String relayHost;

    @Value("${broker.relay.port:61613}")
    private int relayPort;

    @Value("${broker.relay.login:guest}")
    private String relayLogin;

    @Value("${broker.relay.passcode:guest}")
    private String relayPasscode;

    @Value("${broker.relay.virtual-host:/}")
    private String relayVirtualHost;

    public WebSocketConfig(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        if (brokerRelayEnabled) {
            registry.enableStompBrokerRelay("/topic", "/queue")
                    .setRelayHost(relayHost)
                    .setRelayPort(relayPort)
                    .setClientLogin(relayLogin)
                    .setClientPasscode(relayPasscode)
                    .setVirtualHost(relayVirtualHost)
                    .setSystemLogin(relayLogin)
                    .setSystemPasscode(relayPasscode);
            logger.info("STOMP broker relay enabled: {}:{}", relayHost, relayPort);
        } else {
            registry.enableSimpleBroker("/topic", "/queue");
            logger.info("STOMP simple broker enabled (single-instance mode)");
        }

        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

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

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authorizationHeader = accessor.getFirstNativeHeader("Authorization");
                    String userId = jwtTokenProvider.getUserIdFromToken(authorizationHeader);

                    if (userId == null || userId.isBlank()) {
                        logger.warn("Invalid or missing JWT token for STOMP CONNECT");
                    } else {
                        accessor.setUser(new UserPrincipal(userId));
                        logger.debug("Set user {} on STOMP CONNECT session {}", userId, accessor.getSessionId());
                    }
                }
                return message;
            }
        });
    }
}
