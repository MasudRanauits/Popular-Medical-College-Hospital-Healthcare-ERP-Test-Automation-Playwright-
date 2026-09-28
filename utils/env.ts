import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/** Reads a required env var, failing loudly instead of producing a silent `undefined`. */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable "${key}". Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const ENV = {
  /** Base URL of the ERP web app under test. */
  baseURL: optional('BASE_URL', 'http://localhost:3000'),
  /** Base URL of the ERP REST API. */
  apiURL: optional('API_URL', optional('BASE_URL', 'http://localhost:3000')),
  isCI: !!process.env.CI,
  get credentials() {
    return {
      username: required('ERP_USERNAME'),
      password: required('ERP_PASSWORD'),
    };
  },
};

/** Where the authenticated browser state is persisted by tests/auth.setup.ts. */
export const STORAGE_STATE = path.resolve(__dirname, '..', 'playwright', '.auth', 'user.json');
