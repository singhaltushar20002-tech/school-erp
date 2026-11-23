import { PlatformRole } from '~/modules/users/enums/platform-role.enum';

export interface SeedUser {
  email: string;
  username: string;
  name: string;
  role: PlatformRole;
  password: string;
}

/** Platform accounts for local/dev environments. Never seeded in production. */
export const SEED_USERS: SeedUser[] = [
  {
    email: 'superadmin@platform.test',
    username: 'superadmin',
    name: 'Super Admin',
    role: PlatformRole.SUPER_ADMIN,
    password: 'Admin@1234',
  },
  {
    email: 'admin@platform.test',
    username: 'admin',
    name: 'Platform Admin',
    role: PlatformRole.ADMIN,
    password: 'Admin@1234',
  },
  {
    email: 'support@platform.test',
    username: 'support',
    name: 'Support Team',
    role: PlatformRole.SUPPORT,
    password: 'Support@1234',
  },
  {
    email: 'developer@platform.test',
    username: 'developer',
    name: 'Developer',
    role: PlatformRole.DEVELOPER,
    password: 'Developer@1234',
  },
];
