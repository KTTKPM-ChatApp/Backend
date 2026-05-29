import {
  AppDataSource,
  ConversationMember,
  Message,
  MessageForward,
  MessagePin,
  MessageReaction,
} from '../../db';

export const memberRepo = () => AppDataSource.getRepository(ConversationMember);
export const messageRepo = () => AppDataSource.getRepository(Message);
export const pinRepo = () => AppDataSource.getRepository(MessagePin);
export const reactionRepo = () => AppDataSource.getRepository(MessageReaction);
export const forwardRepo = () => AppDataSource.getRepository(MessageForward);

export function parseAttachments(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeAttachment(raw: any): any {
  if (!raw) return null;
  const contentType = raw.contentType || raw.mimeType || raw.content_type || '';
  const inferredType = raw.type ||
    (contentType.startsWith('image/') ? 'image' :
     contentType.startsWith('video/') ? 'video' :
     contentType.startsWith('audio/') ? 'audio' : 'document');
  return {
    key: raw.key || raw.publicId || '',
    url: raw.url || '',
    type: inferredType,
    name: raw.name || raw.fileName || raw.originalName || 'file',
    size: raw.size || 0,
    contentType,
    thumbnailUrl: raw.thumbnailUrl || raw.thumbnail_key || null,
    publicId: raw.publicId || raw.key || null,
    resourceType: raw.resourceType || null,
  };
}

export function detectContentType(content: string, attachments: any[]): string {
  if (!content && attachments.length > 0) {
    const hasMedia = attachments.some(a => a.type === 'image' || a.type === 'video');
    const hasFiles = attachments.some(a => a.type === 'document' || a.type === 'file' || a.type === 'audio');
    if (hasMedia && hasFiles) return 'MIXED';
    if (hasMedia) return 'MEDIA';
    if (hasFiles) return 'FILE';
    return 'MEDIA';
  }
  if (content && attachments.length > 0) return 'MIXED';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  if (urlRegex.test(content) && !attachments.length) return 'LINK';
  return 'TEXT';
}

export async function ensureMember(userId: string, conversationId: string) {
  const member = await memberRepo().findOneBy({ userId, conversationId });
  if (!member) {
    throw new Error('You are not a member of this conversation');
  }
  return member;
}

export function toEpoch(value: Date | string | number) {
  return new Date(value).getTime();
}
