export class DirectConversationConflictError extends Error {
  constructor() {
    super('Direct conversation already exists.');
  }
}
