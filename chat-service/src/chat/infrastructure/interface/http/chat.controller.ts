import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/auth/current-user.decorator';
import { HeaderAuthGuard } from '../../../../common/auth/header-auth.guard';
import { CreateConversationUseCase } from '../../../application/use-cases/create-conversation.use-case';
import { GetConversationMessagesUseCase } from '../../../application/use-cases/get-conversation-messages.use-case';
import { ListConversationsUseCase } from '../../../application/use-cases/list-conversations.use-case';
import { MarkMessagesReadUseCase } from '../../../application/use-cases/mark-messages-read.use-case';
import { SendMessageUseCase } from '../../../application/use-cases/send-message.use-case';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(HeaderAuthGuard)
@Controller('conversations')
export class ChatController {
  constructor(
    private readonly createConversationUseCase: CreateConversationUseCase,
    private readonly listConversationsUseCase: ListConversationsUseCase,
    private readonly getConversationMessagesUseCase: GetConversationMessagesUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly markMessagesReadUseCase: MarkMessagesReadUseCase,
  ) {}

  @Post()
  createConversation(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateConversationDto,
  ) {
    return this.createConversationUseCase.execute({
      currentUserId: currentUser.id,
      type: body.type,
      title: body.title,
      participantIds: body.participantIds,
    });
  }

  @Get()
  listConversations(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.listConversationsUseCase.execute({
      currentUserId: currentUser.id,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(':conversationId/messages')
  getConversationMessages(
    @CurrentUser() currentUser: { id: string },
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.getConversationMessagesUseCase.execute({
      currentUserId: currentUser.id,
      conversationId,
      limit: query.limit,
      before: query.before,
    });
  }

  @Post(':conversationId/messages')
  sendMessage(
    @CurrentUser() currentUser: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.sendMessageUseCase.execute({
      currentUserId: currentUser.id,
      conversationId,
      contentType: body.contentType,
      content: body.content,
      replyToMessageId: body.replyToMessageId,
      metadata: body.metadata,
    });
  }

  @Post(':conversationId/read')
  markAsRead(
    @CurrentUser() currentUser: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() body: MarkAsReadDto,
  ) {
    return this.markMessagesReadUseCase.execute({
      currentUserId: currentUser.id,
      conversationId,
      messageIds: body.messageIds,
    });
  }
}
