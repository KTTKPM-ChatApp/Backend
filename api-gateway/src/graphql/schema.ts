export const typeDefs = `#graphql
  type User {
    id: ID!
    username: String!
    displayName: String!
    avatarUrl: String
    email: String
    bio: String
  }

  type Attachment {
    key: String!
    url: String!
    type: String!
    name: String!
    size: Float!
    contentType: String
    thumbnailUrl: String
  }

  type ReplyTo {
    messageId: ID!
    senderId: ID!
    senderName: String!
    body: String!
    attachments: [Attachment!]!
    isDeleted: Boolean!
  }

  type Message {
    messageId: ID!
    conversationId: ID!
    senderId: ID!
    senderName: String!
    body: String!
    contentType: String!
    attachments: [Attachment!]!
    createdAt: Float!
    isDeleted: Boolean!
    replyToMessageId: ID
    replyTo: ReplyTo
    editedAt: Float
  }

  type ConversationMember {
    userId: ID!
    role: String!
    nickname: String
    user: User
  }

  type Conversation {
    id: ID!
    type: String!
    title: String
    avatarUrl: String
    createdAt: Float!
    unreadCount: Int
    lastMessage: Message
    members: [ConversationMember!]
  }

  type MessagePage {
    items: [Message!]!
    nextCursor: String
    hasMore: Boolean!
  }

  type Query {
    conversations(page: Int, limit: Int): [Conversation!]!
    conversation(id: ID!): Conversation
    messages(conversationId: ID!, cursor: String, limit: Int): MessagePage!
    messageDetail(conversationId: ID!, createdAt: Float!, messageId: ID!): Message
    user(id: ID!): User
    searchUsers(q: String!, limit: Int): [User!]!
  }

  type Mutation {
    sendMessage(
      conversationId: ID!
      content: String!
      contentType: String
      attachments: [AttachmentInput!]
      replyToId: ID
      clientMessageId: ID
    ): Message!
  }

  input AttachmentInput {
    key: String!
    url: String!
    type: String!
    name: String!
    size: Float!
    contentType: String
    thumbnailUrl: String
    publicId: String
    resourceType: String
  }
`;
