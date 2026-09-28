import { test as base, expect, APIRequestContext, request } from '@playwright/test';
import { ENV } from '../utils/env';

type ApiFixtures = {
  /** Request context pointed at the ERP API. */
  api: APIRequestContext;
};

export const test = base.extend<ApiFixtures>({
  api: async ({}, use) => {
    const context = await request.newContext({
      baseURL: ENV.apiURL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(context);
    await context.dispose();
  },
});

export { expect };
