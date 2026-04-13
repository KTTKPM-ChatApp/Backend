import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListConversationsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}

