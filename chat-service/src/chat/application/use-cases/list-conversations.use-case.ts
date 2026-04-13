import { Inject, Injectable } from '@nestjs/common';
import {
  ConversationCursorPayload,
  decodeCursor,
  encodeCursor,
} from '../../../common/pagination/cursor';
import { ConversationRepository } from '../ports/conversation.repository';
import { CONVERSATION_REPOSITORY } from '../ports/tokens';
import { toConversationResponse } from './chat-presenter';

export interface ListConversationsQuery {
  currentUserId: string;
  limit: number;
  cursor?: string;
}

@Injectable()
export class ListConversationsUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async execute(query: ListConversationsQuery): Promise<{
    items: ReturnType<typeof toConversationResponse>[];
    nextCursor: string | null;
  }> {
    const cursorPayload = decodeCursor<ConversationCursorPayload>(query.cursor);
    const safeLimit = Math.min(Math.max(query.limit, 1), 100);
    const result = await this.conversationRepository.listForUser({
      userId: query.currentUserId,
      limit: safeLimit,
      cursor: cursorPayload,
    });

    const nextCursor =
      result.hasMore && result.items.length > 0
        ? encodeCursor({
            activityAt:
              result.items[result.items.length - 1].activityAt.toISOString(),
            conversationId: result.items[result.items.length - 1].id,
          })
        : null;

    return {
      items: result.items.map((conversation) => toConversationResponse(conversation)),
      nextCursor,
    };
  }
}

