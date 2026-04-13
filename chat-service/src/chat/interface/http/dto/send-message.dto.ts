import { IsEnum, IsString } from 'class-validator';
import { MessageContentType } from '../../../domain/enums/message-content-type.enum';

export class SendMessageDto {
  @IsEnum(MessageContentType)
  contentType!: MessageContentType;

  @IsString()
  content!: string;
}

