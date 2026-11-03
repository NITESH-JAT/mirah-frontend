import { test, expect, state, createUser, visibleText } from './support/fixtures.js';

const REMOVED_COPY = ['Next: location', 'Start with your account details.'];

test.describe('Auth pages (redesign)', () => {
  test('login page: design, placeholder, side panel per screen size', async ({ page, isPhone }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.getByRole('tab', { name: 'Email' }).click();
    await expect(page.getByLabel('Email address')).toHaveAttribute('placeholder', 'you@yourdomain.com');
    const panel = page.getByLabel('After you sign up');
    if (isPhone) await expect(panel).toBeHidden();
    else await expect(panel).toBeVisible();
  });

  test('signup page: placeholder, removed copy, Continue stays reachable on a short screen', async ({ page, isPhone }) => {
    if (isPhone) await page.setViewportSize({ width: 390, height: 640 });
    await page.goto('/register');
    await expect(page.locator('#reg-email')).toHaveAttribute('placeholder', 'you@yourdomain.com');
    const text = await visibleText(page);
    for (const copy of REMOVED_COPY) expect(text).not.toContain(copy);

    const cont = page.getByRole('button', { name: /^Continue/ });
    await expect(cont).toBeInViewport();
    // The page itself scrolls (body scrolling is locked app-wide) and Continue stays pinned in view.
    const scroller = page.locator('div.overflow-y-auto').first();
    const scrollable = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (isPhone) expect(scrollable).toBe(true);
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(cont).toBeInViewport();
    await expect(page.getByText('By continuing', { exact: false }).or(page.getByText('Already registered?'))).toBeVisible();

    const panel = page.getByLabel('After you sign up');
    if (isPhone) await expect(panel).toBeHidden();
    else await expect(panel).toBeVisible();
  });

  test('signup validates before moving on', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#reg-email')).toBeVisible();
  });

  test('forgot password: code is emailed and resetting the password works end to end', async ({ page }) => {
    const user = createUser('customer');
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await page.getByRole('tab', { name: 'Email' }).click();
    await expect(page.getByLabel('Email address')).toHaveAttribute('placeholder', 'you@yourdomain.com');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByRole('button', { name: /Send code/ }).click();

    // The E2E backend sends through the fake Brevo server, so read the code from the captured email.
    let otp = null;
    await expect
      .poll(async () => {
        const all = await (await fetch(`${state().brevoUrl}/__emails`)).json();
        console.log('DEBUG emails', state().brevoUrl, all.map((e) => e.to.join(',') + ' ' + e.subject));
        const emails = all.filter((e) => e.to.includes(user.email));
        const html = emails.map((e) => e.htmlContent).join('\n');
        otp = (/\b(\d{6})\b/.exec(html.replace(/<[^>]+>/g, ' ')) || [])[1] || null;
        return otp;
      }, { timeout: 20_000 })
      .not.toBeNull();

    await page.locator('input[name=otp]').fill(otp);
    await page.locator('input[name=newPassword]').fill('N3w-Passw0rd!');
    await page.locator('input[name=confirmNewPassword]').fill('N3w-Passw0rd!');
    await page.getByRole('button', { name: /Reset password|Update password|Save/ }).click();

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.getByRole('tab', { name: 'Email' }).click();
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('N3w-Passw0rd!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/customer/);
  });

  test('login through the real form lands on the right home for each role', async ({ page }) => {
    for (const [role, landing] of [['customer', /\/customer/], ['vendor', /\/vendor/]]) {
      const user = state()[role];
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());
      await page.goto('/login');
      await page.getByRole('tab', { name: 'Email' }).click();
      await page.getByLabel('Email address').fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill(user.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(landing);
      const session = await page.evaluate(() => JSON.parse(localStorage.getItem('mirah_session_user') || '{}'));
      expect(session.token).toBeTruthy();
    }
  });

  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Email' }).click();
    await page.getByLabel('Email address').fill(state().customer.email);
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/invalid credentials|incorrect/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
