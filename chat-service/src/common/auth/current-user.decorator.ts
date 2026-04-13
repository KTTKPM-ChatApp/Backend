import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  };
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): { id: string } => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user ?? { id: '' };
  },
);

