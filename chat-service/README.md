# Chat Service

Core chat service for:

- creating direct and group conversations
- storing messages
- listing user conversations
- fetching message history
- emitting `NEW_MESSAGE` events through RabbitMQ with a transactional outbox

## Architecture

- `src/chat/interface`: HTTP controller and DTOs
- `src/chat/application`: use cases and repository/event ports
- `src/chat/domain`: chat rules and domain models
- `src/chat/infrastructure`: TypeORM, PostgreSQL, RabbitMQ, outbox processor

## Auth assumption

The service expects the current user id in the `x-user-id` request header. In a real deployment this should be populated by the gateway/auth layer.

## Environment

Copy `.env.example` to `.env` and update values as needed.

## Run

```bash
npm install
npm run migration:run
npm run start:dev
```

## Run with Docker

From the repo root:

```bash
docker compose up -d postgres rabbitmq
docker compose up -d --build chat-service
```

RabbitMQ management UI:

- URL: `http://localhost:15672`
- User: `guest`
- Password: `guest`

PostgreSQL:

- Host: `localhost`
- Port: `5432`
- Database: `chat_service`
- User: `postgres`
- Password: `postgres`

Stop the stack:

```bash
docker compose down
```

## API overview

- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/messages`
