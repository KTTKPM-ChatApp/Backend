FROM node:20-alpine

WORKDIR /app

COPY ai-chatbot-service/package*.json ./ai-chatbot-service/
RUN cd ai-chatbot-service && npm install

COPY ai-chatbot-service/ ./ai-chatbot-service/

WORKDIR /app/ai-chatbot-service

EXPOSE 3005

CMD ["npm", "run", "dev"]
