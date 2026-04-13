import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConversationType } from '../../domain/enums/conversation-type.enum';
import { ConversationPolicyService } from '../../domain/services/conversation-policy.service';
import { DirectConversationConflictError } from '../errors/direct-conversation-conflict.error';
import { ConversationRepository } from '../ports/conversation.repository';
import { TransactionManager } from '../ports/transaction-manager';
import {
  CONVERSATION_REPOSITORY,
  TRANSACTION_MANAGER,
} from '../ports/tokens';
import {
  ConversationResponse,
  toConversationResponse,
} from './chat-presenter';

export interface CreateConversationCommand {
  currentUserId: string;
  type: ConversationType;
  title?: string;
  participantIds: string[];
}

@Injectable()
export class CreateConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateConversationCommand): Promise<ConversationResponse> {
    const { directKey, memberIds, normalizedTitle } =
      ConversationPolicyService.validateConversationInput({
        currentUserId: command.currentUserId,
        type: command.type,
        title: command.title,
        participantIds: command.participantIds,
      });

    if (command.type === ConversationType.DIRECT && !directKey) {
      throw new BadRequestException('Unable to build direct conversation key.');
    }

    const conversation = await this.transactionManager.runInTransaction(
      async (context) => {
        if (command.type === ConversationType.DIRECT && directKey) {
          const existingConversation =
            await this.conversationRepository.findDirectByKey(directKey, context);

          if (existingConversation) {
            return existingConversation;
          }
        }

        try {
          return await this.conversationRepository.create(
            {
              type: command.type,
              title: normalizedTitle,
              createdBy: command.currentUserId,
              directKey,
              memberIds,
            },
            context,
          );
        } catch (error) {
          if (
            error instanceof DirectConversationConflictError &&
            command.type === ConversationType.DIRECT &&
            directKey
          ) {
            const existingConversation =
              await this.conversationRepository.findDirectByKey(directKey, context);

            if (existingConversation) {
              return existingConversation;
            }
          }

          throw error;
        }
      },
    );

    return toConversationResponse(conversation);
  }
}

