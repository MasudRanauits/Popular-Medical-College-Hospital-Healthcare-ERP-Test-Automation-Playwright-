import { test, expect } from '../../fixtures/api-fixtures';

/** Smoke-level availability check for the ERP host. */
test.describe('API | Health', () => {
  test('health endpoint reports Healthy', async ({ api }) => {
    const response = await api.get('/health');

    expect(response.status()).toBe(200);
    expect((await response.text()).trim()).toBe('Healthy');
  });

  test('login page is served', async ({ api }) => {
    const response = await api.get('/Account/Login');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Input.Email');
  });
});
