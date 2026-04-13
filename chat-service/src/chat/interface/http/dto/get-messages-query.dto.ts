import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetMessagesQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsString()
  before?: string;
}

