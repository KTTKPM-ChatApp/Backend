package chatapp.realtimeservice.dto;

import lombok.Data;

@Data
public class ChatMessageEvent {
    private String messageId;
    private String senderId;
    private String receiverId; // Người nhận tin nhắn
    private String content;
    private String timestamp;
}
