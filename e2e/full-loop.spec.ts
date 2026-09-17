import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e.initialized')) {
      localStorage.clear();
      sessionStorage.setItem('e2e.initialized', '1');
    }
  });
});

async function click(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).click();
}

async function leaveThroughGate(page: Page) {
  await click(page, '前往山门');
  if (await page.getByRole('button', { name: '接受山门盘查' }).isVisible().catch(() => false)) {
    await click(page, '接受山门盘查');
  }
  await click(page, '从山门撤离');
  await expect(page.getByRole('heading', { name: '撤离成功' })).toBeVisible();
}

async function unlockSwallow(page: Page, confirmWestern = false) {
  await page.goto('/');
  if (confirmWestern) {
    await click(page, '查看可用情报');
    await click(page, '探听西域经书的传闻');
    await click(page, '追查此线索');
  } else {
    await click(page, '出发整备');
  }
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  if (confirmWestern) await click(page, '辨认西域经书印记');
  await click(page, '翻取燕回身秘笈');
  await leaveThroughGate(page);
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await click(page, /参悟燕回身/);
  await expect(page.getByText(/已掌握：基础剑法、燕回身/)).toBeVisible();
}

test('探听、交战、残页撤离、参悟后可再入局', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('town.png') });
  await click(page, '查看可用情报');
  await click(page, '探听西域经书的传闻');
  await click(page, '追查此线索');
  await click(page, '前往黑风寨');
  await expect(page.getByText(/风声 · 平静/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('explore.png') });
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await click(page, '辨认西域经书印记');
  await click(page, '抄录二当家独行时辰');
  await click(page, '翻取燕回身秘笈');
  await click(page, '前往二当家偏房');
  await click(page, '迎战二当家');
  for (let round = 0; round < 6 && await page.getByRole('heading', { name: '刀光相向' }).isVisible().catch(() => false); round++) {
    await click(page, /普通攻击/);
  }
  await expect(page.getByRole('heading', { name: '二当家偏房' })).toBeVisible();
  await click(page, '取走血刀经残页');
  await expect(page.getByRole('button', { name: '继续追查寨主密室' })).toBeVisible();
  await click(page, '就此收手，返回西仓');
  await leaveThroughGate(page);
  await expect(page.getByText(/血刀经残页/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await click(page, /参悟燕回身/);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await expect(page.getByRole('heading', { name: '黑风寨山脚' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('习得轻功后，高风声可从悬崖撤离', async ({ page }) => {
  await unlockSwallow(page);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '触发机关引开守卫');
  await click(page, '与巡逻喽啰打斗');
  await click(page, '前往山门');
  await click(page, '故意引开巡逻');
  await expect(page.getByText(/风声 · 追捕/)).toBeVisible();
  await click(page, '前往后山');
  await click(page, '从悬崖撤离');
  await expect(page.getByText(/从悬崖离开/)).toBeVisible();
});

test('放弃本局会丢失战利品，但保留武学和重要确认情报', async ({ page }) => {
  await unlockSwallow(page, true);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await click(page, '带走官银包');
  await page.getByText('行囊与局势').click();
  await click(page, '放弃本局');
  await click(page, '确认放弃本局');
  await expect(page.getByRole('heading', { name: '此行失手' })).toBeVisible();
  await expect(page.getByText(/官银包 ×1/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await expect(page.getByText(/燕回身/)).toBeVisible();
  await click(page, '前往青石镇');
  await click(page, '查看可用情报');
  await expect(page.getByText('已证实')).toBeVisible();
});

test('刷新恢复稳定地点，坏档导入不覆盖原档；竖屏无横向滚动', async ({ page }) => {
  await page.goto('/');
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await page.reload();
  await expect(page.getByRole('heading', { name: '黑风寨山门' })).toBeVisible();
  await click(page, '从山门撤离');
  await click(page, '返回青石镇');
  await page.getByText('存档 · 导入与导出').click();
  const before = await page.evaluate(() => localStorage.getItem('wuxia.current'));
  await page.getByLabel('选择 JSON 存档文件').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('JSON');
  expect(await page.evaluate(() => localStorage.getItem('wuxia.current'))).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const minHeight = await page.getByRole('button', { name: '出发整备' }).evaluate((el) => el.getBoundingClientRect().height);
  expect(minHeight).toBeGreaterThanOrEqual(44);
});

test('360、390、430 竖屏宽度主操作始终可触达', async ({ page }) => {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: width === 430 ? 932 : width === 360 ? 800 : 844 });
    await page.goto('/');
    const button = page.getByRole('button', { name: '出发整备' });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('商队主动投骰按本局种子结算，失败刷新也不能重掷', async ({ page }) => {
  await page.goto('/');
  await click(page, '出发整备');
  await page.getByLabel('携带银两').fill('200');
  await click(page, '前往黑风寨');
  await click(page, '拾取遗落的蒙面巾');
  await click(page, '触发机关引开守卫');
  await click(page, '与巡逻喽啰打斗');
  await click(page, '前往山门');
  await click(page, '故意引开巡逻');
  await click(page, '前往山脚');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('wuxia.current')!).game.run as { seed: number; heat: number; coins: number });
  expect(before.heat).toBe(78);
  const nextSeed = (Math.imul(before.seed, 1664525) + 1013904223) >>> 0;
  const rolled = (nextSeed % 6) + 1;
  await expect(page.getByRole('button', { name: '掷骰争取商队通行' })).toHaveAccessibleDescription(/5\+/);
  await click(page, '掷骰争取商队通行');
  if (rolled >= 5) {
    await expect(page.getByRole('heading', { name: '撤离成功' })).toBeVisible();
    await expect(page.getByText(/从商队离开/)).toBeVisible();
  } else {
    await expect(page.getByRole('status').getByText(new RegExp(`掷出 ${rolled}`))).toBeVisible();
    const failed = await page.evaluate(() => JSON.parse(localStorage.getItem('wuxia.current')!).game.run as { seed: number; heat: number; coins: number });
    expect(failed).toMatchObject({ seed: nextSeed, heat: 88, coins: 0 });
    await page.reload();
    await expect(page.getByRole('heading', { name: '黑风寨山脚' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wuxia.current')!).game.run.seed)).toBe(nextSeed);
  }
});

test('有效存档通过校验后仍须二次确认才替换', async ({ page }) => {
  await page.goto('/');
  await page.getByText('存档 · 导入与导出').click();
  const raw = await page.evaluate(() => localStorage.getItem('wuxia.current'));
  const archive = raw ? JSON.parse(raw) : { schemaVersion: 1, game: { phase: 'town', permanent: { coins: 500, stash: {}, learnedArts: ['basic_sword'], heardRumors: [], confirmedRumors: [], flags: [], relations: {}, raids: 0 }, run: null, safeLocationId: 'town_square', selectedRumorId: null, lastResult: null, notice: null } };
  archive.game.permanent.coins = 777;
  await page.getByLabel('选择 JSON 存档文件').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) });
  await expect(page.getByRole('button', { name: '确认导入并替换' })).toBeVisible();
  await expect(page.getByText('500', { exact: true })).toBeVisible();
  await click(page, '确认导入并替换');
  await expect(page.getByText('777', { exact: true })).toBeVisible();
});
