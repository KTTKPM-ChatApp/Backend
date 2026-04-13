import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageCursorPayload,
  decodeCursor,
  encodeCursor,
} from '../../../common/pagination/cursor';
import { ConversationRepository } from '../ports/conversation.repository';
import { MessageRepository } from '../ports/message.repository';
import {
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
} from '../ports/tokens';
import { toMessageResponse } from './chat-presenter';

export interface GetConversationMessagesQuery {
  currentUserId: string;
  conversationId: string;
  limit: number;
  before?: string;
}

@Injectable()
export class GetConversationMessagesUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
  ) {}

  async execute(query: GetConversationMessagesQuery): Promise<{
    items: ReturnType<typeof toMessageResponse>[];
    nextCursor: string | null;
  }> {
    const conversation = await this.conversationRepository.findById(
      query.conversationId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (!conversation.memberIds.includes(query.currentUserId)) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }

    const safeLimit = Math.min(Math.max(query.limit, 1), 100);
    const result = await this.messageRepository.listByConversation({
      conversationId: query.conversationId,
      limit: safeLimit,
      before: decodeCursor<MessageCursorPayload>(query.before),
    });

    const nextCursor =
      result.hasMore && result.items.length > 0
        ? encodeCursor({
            createdAt: result.items[0].createdAt.toISOString(),
            messageId: result.items[0].id,
          })
        : null;

    return {
      items: result.items.map((message) => toMessageResponse(message)),
      nextCursor,
    };
  }
}

