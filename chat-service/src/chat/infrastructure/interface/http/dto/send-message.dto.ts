import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { MessageContentType } from '../../../../domain/enums/message-content-type.enum';

export class SendMessageDto {
  @IsEnum(MessageContentType)
  contentType!: MessageContentType;

  @IsString()
  content!: string;

  @IsUUID()
  @IsOptional()
  replyToMessageId?: string | null;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown> | null;
}

