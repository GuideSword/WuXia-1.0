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

async function enterSlot(page: Page) {
  await page.goto('/');
  await resumeSlot(page);
}

async function resumeSlot(page: Page) {
  await click(page, '开始游戏');
  await click(page, /^第1档 (新游戏|继续游戏)$/);
}

test('刷新后仍由标题页选择存档', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('title.png') });
  await click(page, '开始游戏');
  await page.screenshot({ path: testInfo.outputPath('save-select.png') });
  await click(page, '第1档 新游戏');
  await page.reload();
  await expect(page.getByRole('heading', { name: '江湖撤离录' })).toBeVisible();
  await resumeSlot(page);
  await expect(page.getByRole('heading', { name: '青石镇' })).toBeVisible();
});

test('已有档位确认备份后可重新开局', async ({ page }) => {
  await enterSlot(page);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '从山门撤离');
  await click(page, '返回青石镇');
  await click(page, '返回标题');
  await click(page, '开始游戏');
  await expect(page.getByRole('button', { name: '第1档 继续游戏' })).toContainText('入局 1 次');
  await click(page, '第1档重新开局');
  const download = page.waitForEvent('download');
  await click(page, '备份并重新开局');
  expect((await download).suggestedFilename()).toBe('wuxia-slot-1-before-restart.json');
  await expect(page.getByRole('heading', { name: '青石镇' })).toBeVisible();
  await expect(page.getByText('0 次')).toBeVisible();
});

async function leaveThroughGate(page: Page) {
  await click(page, '前往山门');
  if (await page.getByRole('button', { name: '接受山门盘查' }).isVisible().catch(() => false)) {
    await click(page, '接受山门盘查');
  }
  await click(page, '从山门撤离');
  await expect(page.getByRole('heading', { name: '撤离成功' })).toBeVisible();
}

async function unlockSwallow(page: Page, confirmWestern = false) {
  await enterSlot(page);
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
  await click(page, /研读《燕回身》镖师手抄本/);
  await expect(page.getByText(/已掌握：基础剑法、燕回身/)).toBeVisible();
}

test('探索行动与去处独立滚动，选择后文字反馈留在视野内', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await enterSlot(page);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');

  const scene = page.getByRole('region', { name: '当前场景行动，可独立滚动' });
  const moves = page.getByRole('region', { name: '可前往地点，可独立滚动' });
  const story = page.getByRole('region', { name: '场景文字，可独立滚动' });
  const navY = await page.getByRole('navigation', { name: '探索工具' }).evaluate((element) => element.getBoundingClientRect().y);
  expect(await scene.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await moves.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await scene.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await scene.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await moves.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await story.evaluate((element) => element.scrollTop)).toBe(0);
  await moves.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await moves.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.getByRole('navigation', { name: '探索工具' }).evaluate((element) => element.getBoundingClientRect().y)).toBe(navY);

  await click(page, '带走官银包');
  await expect(page.locator('.explore-result')).toContainText('你掀开布，抱起沉甸甸的官银包');
  await expect(page.locator('.explore-result')).toContainText('风声 +18');
  await expect(page.locator('.explore-result')).toBeInViewport();
  await expect(page.getByRole('button', { name: '前往山门' })).toBeInViewport();
});

test('行囊显示占格，可丢下并在刷新后拾回战利品', async ({ page }) => {
  await enterSlot(page);
  for (const name of ['出发整备', '前往黑风寨', '前往山门', '前往西仓', '带走官银包']) await click(page, name);
  await page.getByText('行囊与局势').click();
  await expect(page.getByRole('group', { name: '背包格子，已用 2 格，共 12 格' })).toBeVisible();
  await expect(page.getByRole('button', { name: '官银包，占 2 格，负重 15' })).toBeVisible();
  await click(page, '丢下 1 件');
  await expect(page.getByRole('group', { name: '背包格子，已用 0 格，共 12 格' })).toBeVisible();
  await expect(page.getByRole('region', { name: '此处地上物品' })).toContainText('官银包 ×1');
  await page.reload();
  await resumeSlot(page);
  await page.getByText('行囊与局势').click();
  await click(page, '拾回 1 件');
  await expect(page.getByRole('group', { name: '背包格子，已用 2 格，共 12 格' })).toBeVisible();
  await expect(page.getByRole('region', { name: '此处地上物品' })).toHaveCount(0);
});

test('背包格子已满时拾取失败并显示原因', async ({ page }) => {
  await enterSlot(page);
  for (const name of ['出发整备', '前往黑风寨', '前往山门', '前往西仓']) await click(page, name);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('wuxia.current')!);
    saved.game.run.inventory.medicine = 12;
    localStorage.setItem('wuxia.current', JSON.stringify(saved));
  });
  await page.reload();
  await resumeSlot(page);
  await click(page, '带走官银包');
  await expect(page.getByRole('alert')).toContainText('背包格子已满');
  await expect(page.getByRole('button', { name: '带走官银包' })).toBeVisible();
});

test('独本带回后西仓空缺，家藏在下一次失手后仍在', async ({ page }) => {
  await unlockSwallow(page);
  await click(page, '前往青石镇');
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await expect(page.getByText(/镖师手抄本原先存放的地方已经空了/)).toBeVisible();
  await expect(page.getByRole('button', { name: '翻取燕回身秘笈' })).toHaveCount(0);
  await page.getByText('行囊与局势').click();
  await click(page, '放弃本局');
  await click(page, '确认放弃本局');
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await expect(page.getByRole('button', { name: /研读《燕回身》镖师手抄本.*原本收藏在家/ })).toBeVisible();
});

test('家藏秘籍可选择带出，遗落后可找回并贴身带回', async ({ page }) => {
  await unlockSwallow(page);
  await click(page, '出发整备');
  await page.getByRole('checkbox', { name: /燕回身.*镖师手抄本/ }).check();
  await click(page, '前往黑风寨');
  await page.getByText('行囊与局势').click();
  await expect(page.getByRole('button', { name: /贴身收好《燕回身》镖师手抄本/ })).toBeVisible();
  await click(page, '放弃本局');
  await click(page, '确认放弃本局');
  await expect(page.getByText(/遗落地点：黑风寨山脚/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, /找回遗落的《燕回身》镖师手抄本/);
  await page.getByText('行囊与局势').click();
  await click(page, /贴身收好《燕回身》镖师手抄本/);
  await click(page, '放弃本局');
  await click(page, '确认放弃本局');
  await expect(page.getByText(/贴身带回：.*燕回身/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await expect(page.getByRole('button', { name: /研读《燕回身》镖师手抄本.*原本收藏在家/ })).toBeVisible();
});

test('青燕门原本可以先于西仓抄本取得并传授燕回身', async ({ page }) => {
  await enterSlot(page);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '从山门撤离');
  await click(page, '返回青石镇');
  await click(page, '查看可用情报');
  const rumor = page.locator('article').filter({ has: page.getByRole('heading', { name: '青燕门旧址' }) });
  await rumor.getByRole('button', { name: '探听青燕门旧址' }).click();
  await rumor.getByRole('button', { name: '追查此线索' }).click();
  await click(page, '青燕门旧址');
  await click(page, '前往青燕门旧址');
  await click(page, '前往青燕门回廊');
  await click(page, '前往青燕门旧演武堂');
  await click(page, '取走燕回身原本');
  await click(page, '前往青燕门回廊');
  await click(page, '前往青燕门废门');
  await click(page, '从青燕门旧山门撤离');
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await click(page, /研读《燕回身》原本/);
  await expect(page.getByText(/已掌握：基础剑法、燕回身/)).toBeVisible();
  await click(page, '前往青石镇');
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await expect(page.getByRole('button', { name: '翻取燕回身秘笈' })).toBeVisible();
});

test('藏身研读后失手，见解保留且遗落的独本可找回', async ({ page }) => {
  await enterSlot(page);
  await click(page, '前往黑市');
  await click(page, /购买风灯/);
  await click(page, '前往青石镇');
  await click(page, '出发整备');
  await page.locator('.loadout-row').filter({ hasText: '风灯' }).locator('input').fill('1');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await click(page, '翻取燕回身秘笈');
  await click(page, '寻找藏身处');
  await click(page, /研读《燕回身》镖师手抄本/);
  await page.getByText('行囊与局势').click();
  await click(page, '放弃本局');
  await click(page, '确认放弃本局');
  await expect(page.getByText(/遗落地点：西仓/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await expect(page.getByText(/已掌握：基础剑法、燕回身/)).toBeVisible();
  await click(page, '前往青石镇');
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await click(page, /找回遗落的《燕回身》镖师手抄本/);
  await expect(page.getByRole('button', { name: '翻取燕回身秘笈' })).toHaveCount(0);
});

test('360 与 430 竖屏可操作旧址选择、探索和救援结果', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await enterSlot(page);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '从山门撤离');
  await click(page, '返回青石镇');
  await click(page, '查看可用情报');
  await click(page, '探听青燕门旧址');
  await click(page, '返回青石镇');
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 932 });
    await click(page, '出发整备');
    const region = page.getByRole('button', { name: '青燕门旧址', exact: true });
    await expect(region).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`prep-${width}.png`) });
    expect(await region.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await click(page, '青燕门旧址');
    await click(page, '前往青燕门旧址');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByText('行囊与局势').click();
    await click(page, '放弃本局');
    await click(page, '确认放弃本局');
    await page.screenshot({ path: testInfo.outputPath(`rescue-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await click(page, '返回青石镇');
  }
});

test('探听、交战、残页撤离、参悟后可再入局', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterSlot(page);
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
  await expect(page.getByText(/血刀经.*残页/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await click(page, /研读《燕回身》镖师手抄本/);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await expect(page.getByRole('heading', { name: '黑风寨山脚' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('新手指引随首局推进，刷新后继续，成功撤离后结束', async ({ page }) => {
  await enterSlot(page);
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('去茶馆探听');
  await click(page, '开始这一步');
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('探听目标线索');
  await click(page, '探听西域经书的传闻');
  await click(page, '追查此线索');
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('整备后入寨');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await click(page, '前往西仓');
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('核实传闻');
  await page.reload();
  await resumeSlot(page);
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('核实传闻');
  await click(page, '辨认西域经书印记');
  await click(page, '抄录二当家独行时辰');
  await click(page, '翻取燕回身秘笈');
  await click(page, '前往二当家偏房');
  await click(page, '迎战二当家');
  for (let round = 0; round < 12 && await page.getByRole('heading', { name: '刀光相向' }).isVisible().catch(() => false); round++) {
    await click(page, '施展招式');
  }
  await click(page, '取走血刀经残页');
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('见好就收');
  await click(page, '就此收手，返回西仓');
  await leaveThroughGate(page);
  await expect(page.getByRole('complementary', { name: '新手指引' })).toContainText('首局完成');
  await click(page, '返回青石镇');
  await expect(page.getByRole('complementary', { name: '新手指引' })).toHaveCount(0);
});

test('跳过新手指引后刷新仍保持关闭', async ({ page }) => {
  await enterSlot(page);
  await click(page, '跳过指引');
  await expect(page.getByRole('complementary', { name: '新手指引' })).toHaveCount(0);
  await page.reload();
  await resumeSlot(page);
  await expect(page.getByRole('complementary', { name: '新手指引' })).toHaveCount(0);
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
  await expect(page.getByRole('heading', { name: '此行失手', exact: true })).toBeVisible();
  await expect(page.getByText(/官银包 ×1/)).toBeVisible();
  await click(page, '返回青石镇');
  await click(page, '前往练功处');
  await expect(page.getByText(/已掌握：基础剑法、燕回身/)).toBeVisible();
  await click(page, '前往青石镇');
  await click(page, '查看可用情报');
  await expect(page.getByText('已证实')).toBeVisible();
});

test('刷新恢复稳定地点，坏档导入不覆盖原档；竖屏无横向滚动', async ({ page }) => {
  await enterSlot(page);
  await click(page, '出发整备');
  await click(page, '前往黑风寨');
  await click(page, '前往山门');
  await page.reload();
  await resumeSlot(page);
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
    await enterSlot(page);
    const button = page.getByRole('button', { name: '出发整备' });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('探索首项行动与工具栏在竖屏首屏内', async ({ page }) => {
  for (const [width, height] of [[360, 800], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await resumeSlot(page);
    await click(page, '出发整备');
    await click(page, '前往黑风寨');
    const action = await page.locator('.explore-actions .choice-button').first().boundingBox();
    const toolbar = await page.getByRole('navigation', { name: '探索工具' }).boundingBox();
    expect(action!.y + action!.height).toBeLessThanOrEqual(toolbar!.y);
    expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('短屏战斗的六个行动按钮均在首屏内', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await enterSlot(page);
  for (const name of ['查看可用情报', '探听西域经书的传闻', '追查此线索', '前往黑风寨', '前往山门', '前往西仓', '辨认西域经书印记', '抄录二当家独行时辰', '翻取燕回身秘笈', '前往二当家偏房', '迎战二当家']) {
    await click(page, name);
  }
  const bounds = await page.locator('.combat-actions button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().bottom));
  expect(bounds).toHaveLength(6);
  expect(Math.max(...bounds)).toBeLessThanOrEqual(667);
});

test('商队主动投骰按本局种子结算，失败刷新也不能重掷', async ({ page }) => {
  await enterSlot(page);
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
    await resumeSlot(page);
    await expect(page.getByRole('heading', { name: '黑风寨山脚' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wuxia.current')!).game.run.seed)).toBe(nextSeed);
  }
});

test('有效存档通过校验后仍须二次确认才替换', async ({ page }) => {
  await enterSlot(page);
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
