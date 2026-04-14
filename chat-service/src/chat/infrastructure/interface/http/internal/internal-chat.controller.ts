import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageUseCase } from '../../../../application/use-cases/send-message.use-case';
import { MessageContentType } from '../../../../domain/enums/message-content-type.enum';

// DTO cho Realtime Service gọi đến
export interface InternalSendMessageDto {
  conversationId: string;
  senderId: string;
  clientMessageId: string; // Để Realtime Service tracking
  contentType: MessageContentType;
  content: string;
  replyToMessageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

// DTO response
export interface InternalSendMessageResponse {
  messageId: string;
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string;
  replyToMessageId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  // Thông tin để Realtime Service biết cần broadcast đến ai
  participantIds: string[];
}

@Controller('internal/messages')
export class InternalChatController {
  constructor(
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async sendMessage(
    @Headers('x-internal-service') internalServiceHeader: string,
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: InternalSendMessageDto,
  ): Promise<InternalSendMessageResponse> {
    // Verify call đến từ internal service
    const validApiKey = this.configService.get<string>('INTERNAL_API_KEY');
    if (!validApiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    // Gọi use-case để lưu tin nhắn
    const message = await this.sendMessageUseCase.execute({
      currentUserId: body.senderId,
      conversationId: body.conversationId,
      contentType: body.contentType,
      content: body.content,
      replyToMessageId: body.replyToMessageId,
      metadata: body.metadata,
    });

    return {
      messageId: message.id,
      clientMessageId: body.clientMessageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      contentType: message.contentType as MessageContentType,
      content: message.content,
      replyToMessageId: message.replyToMessageId,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
      participantIds: [], // Sẽ được lấy từ conversation
    };
  }
}
