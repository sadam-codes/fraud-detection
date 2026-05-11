import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../entities/user.entity';

export type AuthUserPayload = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUserPayload;
  },
);
