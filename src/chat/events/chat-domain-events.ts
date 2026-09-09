export const ChatDomainEventName = {
  MESSAGE_CREATED: 'chat.message.created',
} as const;

export type ChatMessageCreatedEvent = {
  conversationId: string;
  recipientId: string;
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: string;
  };
};
