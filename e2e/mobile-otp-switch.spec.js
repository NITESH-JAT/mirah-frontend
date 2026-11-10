import { test, expect, api, adminToken } from './support/fixtures.js';

// Admin "Mobile OTP" switch: with it off the app asks for the email code only.
test.describe('Mobile OTP turned off', () => {
  let original = true;

  const setPhoneOtp = async (phoneOtpEnabled) => {
    const res = await api('PUT', '/api/admin/settings/verification', { token: await adminToken(), body: { phoneOtpEnabled } });
    if (res.status !== 200) throw new Error(`setting failed: ${res.status} ${res.body?.message}`);
  };

  test.beforeAll(async () => {
    const res = await api('GET', '/api/admin/settings/verification', { token: await adminToken() });
    original = res.body?.data?.phoneOtpEnabled !== false;
    await setPhoneOtp(false);
  });

  test.afterAll(async () => {
    await setPhoneOtp(original);
  });

  test('verification shows only the email step', async ({ page }, info) => {
    await page.goto('/login');
    await page.evaluate(() =>
      localStorage.setItem(
        'mirah_temp_user',
        JSON.stringify({ email: 'someone@e2e.arviah.test', phone: '9123456789', countryCode: '+91', isEmailVerified: false, isPhoneVerified: false }),
      ),
    );
    await page.goto('/verification');
    await expect(page.getByText('Verify your email address to finish signing up.')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Phone' })).toHaveCount(0);
    await expect(page.getByText('someone@e2e.arviah.test')).toBeVisible();
    await page.screenshot({ path: info.outputPath('verification.png'), animations: 'disabled' });
  });

  test('forgot password offers email only', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByText("Enter the email on your account and we'll send you a 6-digit code.")).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Phone number')).toHaveCount(0);
  });
});
