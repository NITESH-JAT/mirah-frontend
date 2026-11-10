import { test, expect, state, signIn, api, adminToken } from './support/fixtures.js';

// Ring sizes in Create Project: US / UK / India toggles plus Custom mm, with equivalents carried across.
test.describe('Create Project ring size picker', () => {
  let categoryId = null;
  let typeName = '';

  test.beforeAll(async () => {
    const token = await adminToken();
    // Use the configured ring chart when there is one, so the test exercises the real data.
    const list = await api('GET', '/api/admin/variant-categories?search=ring&limit=20', { token });
    const items = list.body?.data?.categories ?? list.body?.data?.items ?? list.body?.data ?? [];
    const ring = (Array.isArray(items) ? items : []).find((c) => Array.isArray(c.sizeSystems) && c.sizeSystems.length >= 3);
    const sizeSystems = ring?.sizeSystems ?? [
      { code: 'US', label: 'US', sizes: [{ label: '7', mm: 54.4 }, { label: '7 1/2', mm: 55.7 }, { label: '8', mm: 57 }] },
      { code: 'UK', label: 'UK', sizes: [{ label: 'N', mm: 54.4 }, { label: 'O', mm: 55.7 }, { label: 'P', mm: 57 }] },
      { code: 'IN', label: 'India', sizes: [{ label: '14', mm: 54.4 }, { label: '15', mm: 55.1 }, { label: '16', mm: 56.3 }] },
    ];
    typeName = `E2E Ring ${state().runId}`;
    const res = await api('POST', '/api/admin/variant-categories', {
      token,
      body: {
        name: typeName,
        sizes: [{ size: 'N', sizeDimension: 54.4, unit: 'mm' }],
        sizeSystems,
        showInProjectTypes: true,
        howToMeasure: `E2E measuring guide ${state().runId}`,
      },
    });
    if (res.status !== 201) throw new Error(`category create failed: ${res.status} ${res.body?.message}`);
    categoryId = res.body.data.id;
  });

  test.afterAll(async () => {
    if (categoryId) await api('DELETE', `/api/admin/variant-categories/${categoryId}`, { token: await adminToken() });
  });

  test('switching systems keeps the same ring; Custom takes inner circumference in mm', async ({ page }, info) => {
    await signIn(page, state().customer);
    await page.goto('/customer/projects');
    await page.getByRole('button', { name: 'Create Project', exact: true }).first().click();

    const typeSelect = page.locator('select', { has: page.locator(`option[value="${typeName}"]`) });
    await typeSelect.selectOption(typeName);

    // The How to Measure popup shows the text the admin wrote for this jewellery type.
    await page.getByRole('button', { name: 'How to Measure' }).click();
    await expect(page.getByText(`E2E measuring guide ${state().runId}`)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).last().click();
    await expect(page.getByText(`E2E measuring guide ${state().runId}`)).toBeHidden();

    const systems = page.getByRole('radiogroup', { name: 'Size system' });
    await expect(systems).toBeVisible();
    for (const name of ['US', 'UK', 'India', 'Custom']) await expect(systems.getByRole('radio', { name, exact: true })).toBeVisible();

    await systems.getByRole('radio', { name: 'US', exact: true }).click();
    await page.getByLabel('US ring size').selectOption('7');
    await expect(page.getByText('≈', { exact: false })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('us.png'), animations: 'disabled' });

    await systems.getByRole('radio', { name: 'India', exact: true }).click();
    await expect(page.getByLabel('India ring size')).toHaveValue('14');

    await systems.getByRole('radio', { name: 'UK', exact: true }).click();
    await expect(page.getByLabel('UK ring size')).toHaveValue('N');

    await systems.getByRole('radio', { name: 'Custom', exact: true }).click();
    await expect(page.getByLabel('Inner circumference in mm')).toHaveValue('54.4');

    await expect(page.getByRole('radio', { name: 'Inner diameter' })).toHaveCount(0);
    const custom = page.getByLabel('Inner circumference in mm');
    await custom.fill('56.5');
    await page.screenshot({ path: info.outputPath('custom.png'), animations: 'disabled' });
    await custom.fill('18');
    await expect(page.getByText(/usually between 35 and 80 mm/)).toBeVisible();
    await custom.fill('56.5');

    await systems.getByRole('radio', { name: 'US', exact: true }).click();
    await expect(page.getByLabel('US ring size')).toHaveValue('8');
  });
});
