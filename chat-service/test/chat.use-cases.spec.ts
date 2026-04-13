import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConversationType } from "../src/chat/domain/enums/conversation-type.enum";
import { MessageContentType } from "../src/chat/domain/enums/message-content-type.enum";
import { CreateConversationUseCase } from "../src/chat/application/use-cases/create-conversation.use-case";
import { GetConversationMessagesUseCase } from "../src/chat/application/use-cases/get-conversation-messages.use-case";
import { ListConversationsUseCase } from "../src/chat/application/use-cases/list-conversations.use-case";
import { SendMessageUseCase } from "../src/chat/application/use-cases/send-message.use-case";
import { createInMemoryDependencies } from "./support/in-memory-chat.dependencies";

describe("Chat use cases", () => {
  it("reuses an existing direct conversation for the same member pair", async () => {
    const { conversationRepository, transactionManager } =
      createInMemoryDependencies();
    const useCase = new CreateConversationUseCase(
      conversationRepository,
      transactionManager,
    );

    const firstConversation = await useCase.execute({
      currentUserId: "u1",
      type: ConversationType.DIRECT,
      participantIds: ["u2"],
    });

    const secondConversation = await useCase.execute({
      currentUserId: "u1",
      type: ConversationType.DIRECT,
      participantIds: ["u2"],
    });

    expect(firstConversation.id).toBe(secondConversation.id);
    expect(conversationRepository.conversations.size).toBe(1);
  });

  it("rejects invalid group conversations without a title", async () => {
    const { conversationRepository, transactionManager } =
      createInMemoryDependencies();
    const useCase = new CreateConversationUseCase(
      conversationRepository,
      transactionManager,
    );

    await expect(
      useCase.execute({
        currentUserId: "u1",
        type: ConversationType.GROUP,
        participantIds: ["u2", "u3"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores a message, updates conversation preview, and writes a NEW_MESSAGE outbox event", async () => {
    const {
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    } = createInMemoryDependencies();
    const createConversationUseCase = new CreateConversationUseCase(
      conversationRepository,
      transactionManager,
    );
    const sendMessageUseCase = new SendMessageUseCase(
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    );

    const conversation = await createConversationUseCase.execute({
      currentUserId: "u1",
      type: ConversationType.GROUP,
      title: "Project Team",
      participantIds: ["u2", "u3"],
    });

    const message = await sendMessageUseCase.execute({
      currentUserId: "u2",
      conversationId: conversation.id,
      contentType: MessageContentType.TEXT,
      content: "hello team",
    });

    const updatedConversation = await conversationRepository.findById(
      conversation.id,
    );

    expect(messageRepository.messages).toHaveLength(1);
    expect(outboxRepository.events).toHaveLength(1);
    expect(outboxRepository.events[0].eventType).toBe("NEW_MESSAGE");
    expect(updatedConversation?.lastMessageId).toBe(message.id);
    expect(updatedConversation?.lastMessagePreview).toBe("hello team");
  });

  it("rejects sending a message when the user is not a conversation member", async () => {
    const {
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    } = createInMemoryDependencies();
    const createConversationUseCase = new CreateConversationUseCase(
      conversationRepository,
      transactionManager,
    );
    const sendMessageUseCase = new SendMessageUseCase(
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    );
    const conversation = await createConversationUseCase.execute({
      currentUserId: "u1",
      type: ConversationType.GROUP,
      title: "Project Team",
      participantIds: ["u2", "u3"],
    });

    await expect(
      sendMessageUseCase.execute({
        currentUserId: "u99",
        conversationId: conversation.id,
        contentType: MessageContentType.TEXT,
        content: "intrusion",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists conversations by latest activity and supports cursor pagination", async () => {
    const {
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    } = createInMemoryDependencies();
    const createConversationUseCase = new CreateConversationUseCase(
      conversationRepository,
      transactionManager,
    );
    const sendMessageUseCase = new SendMessageUseCase(
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    );
    const listConversationsUseCase = new ListConversationsUseCase(
      conversationRepository,
    );

    const conversationA = await createConversationUseCase.execute({
      currentUserId: "u1",
      type: ConversationType.DIRECT,
      participantIds: ["u2"],
    });
    const conversationB = await createConversationUseCase.execute({
      currentUserId: "u1",
      type: ConversationType.GROUP,
      title: "Team",
      participantIds: ["u3", "u4"],
    });

    await sendMessageUseCase.execute({
      currentUserId: "u1",
      conversationId: conversationA.id,
      contentType: MessageContentType.TEXT,
      content: "recent message",
    });

    const firstPage = await listConversationsUseCase.execute({
      currentUserId: "u1",
      limit: 1,
    });

    const secondPage = await listConversationsUseCase.execute({
      currentUserId: "u1",
      limit: 1,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(firstPage.items[0].id).toBe(conversationA.id);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(secondPage.items[0].id).toBe(conversationB.id);
  });

  it("returns paginated message history without duplicates", async () => {
    const {
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    } = createInMemoryDependencies();
    const createConversationUseCase = new CreateConversationUseCase(
      conversationRepository,
      transactionManager,
    );
    const sendMessageUseCase = new SendMessageUseCase(
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    );
    const getConversationMessagesUseCase = new GetConversationMessagesUseCase(
      conversationRepository,
      messageRepository,
    );

    const conversation = await createConversationUseCase.execute({
      currentUserId: "u1",
      type: ConversationType.GROUP,
      title: "History",
      participantIds: ["u2", "u3"],
    });

    const firstMessage = await sendMessageUseCase.execute({
      currentUserId: "u1",
      conversationId: conversation.id,
      contentType: MessageContentType.TEXT,
      content: "m1",
    });
    const secondMessage = await sendMessageUseCase.execute({
      currentUserId: "u2",
      conversationId: conversation.id,
      contentType: MessageContentType.TEXT,
      content: "m2",
    });
    const thirdMessage = await sendMessageUseCase.execute({
      currentUserId: "u3",
      conversationId: conversation.id,
      contentType: MessageContentType.TEXT,
      content: "m3",
    });

    const firstPage = await getConversationMessagesUseCase.execute({
      currentUserId: "u1",
      conversationId: conversation.id,
      limit: 2,
    });

    const secondPage = await getConversationMessagesUseCase.execute({
      currentUserId: "u1",
      conversationId: conversation.id,
      limit: 2,
      before: firstPage.nextCursor ?? undefined,
    });

    expect(firstPage.items.map((item) => item.id)).toEqual([
      secondMessage.id,
      thirdMessage.id,
    ]);
    expect(secondPage.items.map((item) => item.id)).toEqual([firstMessage.id]);
  });
});
