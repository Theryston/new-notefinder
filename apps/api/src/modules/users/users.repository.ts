import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { CurrentUser } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { users } from '../../database/schema/users.js';

export type CurrentUserRow = Omit<CurrentUser, 'createdAt'> & {
  createdAt: Date;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findCurrentUser(id: string): Promise<CurrentUserRow | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        username: users.username,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row;
  }
}
