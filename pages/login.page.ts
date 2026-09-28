import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * ASP.NET Core Identity login page at /Account/Login.
 * Selectors verified against the live EMSL Health ERP (v5.0.1).
 */
export class LoginPage extends BasePage {
  protected readonly path = '/Account/Login';

  readonly username: Locator;
  readonly password: Locator;
  readonly rememberMe: Locator;
  readonly submit: Locator;
  readonly forgotPassword: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.locator('input[name="Input.Email"]');
    this.password = page.locator('input[name="Input.Password"]');
    this.rememberMe = page.locator('input[name="Input.RememberMe"]');
    this.submit = page.locator('button.omrs-submit');
    // Rendered as a span, not an anchor, in this build.
    this.forgotPassword = page.locator('span.omrs-forgot');
    this.error = page.getByText(/invalid login attempt/i);
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.username).toBeVisible();
    await expect(this.password).toBeVisible();
    await expect(this.submit).toBeVisible();
  }

  async expectInvalidLogin(): Promise<void> {
    await expect(this.error).toBeVisible();
    await expect(this.page).toHaveURL(/\/Account\/Login/);
  }

  /**
   * Native HTML5 constraint state of a field. Both inputs carry `required`, so an
   * empty submit is blocked by the browser and never reaches the server — there is
   * no server-rendered validation summary to assert against.
   */
  async validity(field: Locator): Promise<{ valueMissing: boolean; message: string }> {
    return field.evaluate((el: HTMLInputElement) => ({
      valueMissing: el.validity.valueMissing,
      message: el.validationMessage,
    }));
  }

  /** Asserts the browser flagged `field` as a missing required value. */
  async expectRequiredFieldValidation(field: Locator): Promise<void> {
    await expect(field).toHaveAttribute('required', '');
    const { valueMissing, message } = await this.validity(field);
    expect(valueMissing, 'browser reports the required field as empty').toBe(true);
    // Wording is browser/locale specific ("Please fill out this field." in Chromium).
    expect(message.length, 'browser surfaces a validation message').toBeGreaterThan(0);
  }

  /** Asserts the form was never submitted: still on the login page, no server error. */
  async expectNotSubmitted(): Promise<void> {
    await expect(this.page).toHaveURL(/\/Account\/Login/);
    await expect(this.error).toBeHidden();
  }
}
