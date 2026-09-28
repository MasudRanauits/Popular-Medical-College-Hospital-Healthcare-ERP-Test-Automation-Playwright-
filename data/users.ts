import { ENV } from '../utils/env';

export type Role = 'admin' | 'doctor' | 'receptionist' | 'accountant';

export interface TestUser {
  username: string;
  password: string;
  role: Role;
}

/** Primary account used by tests/auth.setup.ts. Credentials come from .env, never from source control. */
export const primaryUser = (): TestUser => ({
  ...ENV.credentials,
  role: 'admin',
});
