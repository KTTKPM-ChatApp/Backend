import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  };
};

@Injectable()
export class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userIdHeader = request.header('x-user-id')?.trim();

    if (!userIdHeader) {
      throw new UnauthorizedException('Missing x-user-id header.');
    }

    request.user = {
      id: userIdHeader,
    };

    return true;
  }
}

