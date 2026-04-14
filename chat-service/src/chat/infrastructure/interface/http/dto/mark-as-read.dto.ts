import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  messageIds!: string[];
}
