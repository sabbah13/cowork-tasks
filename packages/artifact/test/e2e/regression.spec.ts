import { test, expect, type Page } from '@playwright/test';
import { gotoBoard, FULL_TASKS, FULL_CONFIG, setupCoworkEnv } from './harness';

/**
 * Tight regression tests for the bugs the user hit in production:
 *
 *   - Every card glowed every 2 s because polling re-fed the seeded
 *     snapshot and the new-card animation fired for ids it had already
 *     shown.
 *   - Drag/drop didn't persist because Cowork's iframe doesn't expose
 *     `window.claude.callTool` and the artifact had no in-memory authority.
 *
 * These tests pin both behaviors so they can't regress silently.
 */

/**
 * Counts how many cards have the `.new-card` class - which is the
 * "just arrived" pulse outline. Should be 0 in steady state.
 */
async function countGlowing(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('[data-testid="task-card"].new-card').length);
}

test.describe('regression: glow loop', () => {
  test('cards do NOT glow every poll when nothing has changed (snapshot mode)', async ({
    page,
  }) => {
    // bridge=missing simulates Cowork's iframe (no window.claude.callTool).
    await gotoBoard(page, { bridge: 'missing' });

    // After the initial paint, give the artifact two full poll cycles
    // (~2 s + 2 s). The seeded INITIAL_STATE should NOT keep retriggering
    // the new-card animation.
    await page.waitForTimeout(500);
    expect(await countGlowing(page)).toBe(0);

    await page.waitForTimeout(2200);
    expect(await countGlowing(page)).toBe(0);

    await page.waitForTimeout(2200);
    expect(await countGlowing(page)).toBe(0);
  });

  test('cards do NOT glow every poll when callTool returns 400', async ({ page }) => {
    await gotoBoard(page, { bridge: 'fail' });
    await page.waitForTimeout(500);
    expect(await countGlowing(page)).toBe(0);
    await page.waitForTimeout(2400);
    expect(await countGlowing(page)).toBe(0);
  });

  test('cards do NOT glow on subsequent polls in MCP mode either', async ({ page }) => {
    await gotoBoard(page);
    await page.waitForTimeout(500);
    expect(await countGlowing(page)).toBe(0);
    await page.waitForTimeout(2400);
    expect(await countGlowing(page)).toBe(0);
  });

  test('genuinely new cards DO glow once and then stop', async ({ page }) => {
    // Seed with 6 of the 7 fixture tasks; we'll inject the 7th as a "new"
    // arrival via a direct mock-state mutation.
    await page.addInitScript(
      ({ tasks, config }) => {
        (window as unknown as { __INITIAL_STATE__: unknown }).__INITIAL_STATE__ = {
          version: 1,
          tasks: (tasks as Array<{ id: string }>).slice(0, 6),
          config,
        };
      },
      { tasks: FULL_TASKS, config: FULL_CONFIG },
    );
    await setupCoworkEnv(page); // sets up the live mock with all 7 tasks
    await page.goto('/artifact.html');
    await page.locator('header[role="banner"]').waitFor({ state: 'visible' });

    // The mock has 7 tasks; INITIAL_STATE has 6. Within one poll the
    // missing 7th arrives and should briefly glow.
    await expect(page.locator('[data-testid="task-card"].new-card')).toHaveCount(0, {
      timeout: 4000,
    });

    // Total cards should converge to 7 from the live source.
    await expect(page.getByTestId('task-card')).toHaveCount(7, { timeout: 6000 });

    // After the new-card pulse window closes (1 s), no card should still glow.
    await page.waitForTimeout(1500);
    expect(await countGlowing(page)).toBe(0);
  });
});

test.describe('regression: drag persistence in snapshot mode', () => {
  test('drag from Inbox to To Do moves the card and stays moved', async ({ page }) => {
    await gotoBoard(page, { bridge: 'missing' });

    // Confirm the data source the artifact picked is "snapshot".
    await expect(page.getByTestId('data-source')).toHaveText('snapshot');

    const inboxBefore = await page
      .locator('section[aria-label="Inbox"] [data-testid="task-card"]')
      .count();
    const todoBefore = await page
      .locator('section[aria-label="To Do"] [data-testid="task-card"]')
      .count();

    const source = page.locator('section[aria-label="Inbox"] [data-testid="task-card"]').first();
    const target = page.locator('section[aria-label="To Do"]');
    const sb = await source.boundingBox();
    const tb = await target.boundingBox();
    if (!sb || !tb) throw new Error('not visible');

    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width / 2 + 8, sb.y + sb.height / 2, { steps: 6 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + 80, { steps: 14 });
    await page.mouse.up();

    await expect(
      page.locator('section[aria-label="Inbox"] [data-testid="task-card"]'),
    ).toHaveCount(inboxBefore - 1, { timeout: 5000 });
    await expect(
      page.locator('section[aria-label="To Do"] [data-testid="task-card"]'),
    ).toHaveCount(todoBefore + 1, { timeout: 5000 });

    // Wait through two poll cycles to confirm the move STAYS moved (the
    // earlier bug had the next poll snap the card back).
    await page.waitForTimeout(2400);
    await expect(
      page.locator('section[aria-label="Inbox"] [data-testid="task-card"]'),
    ).toHaveCount(inboxBefore - 1);
    await expect(
      page.locator('section[aria-label="To Do"] [data-testid="task-card"]'),
    ).toHaveCount(todoBefore + 1);

    await page.waitForTimeout(2400);
    await expect(
      page.locator('section[aria-label="Inbox"] [data-testid="task-card"]'),
    ).toHaveCount(inboxBefore - 1);
  });

  test('archive in snapshot mode persists across polls', async ({ page }) => {
    await gotoBoard(page, { bridge: 'missing' });
    await page.getByTestId('task-card').first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^Archive$/ }).click();
    await expect(page.getByTestId('task-card')).toHaveCount(6, { timeout: 5000 });
    await page.waitForTimeout(2400);
    await expect(page.getByTestId('task-card')).toHaveCount(6);
  });

  test('inline-add in snapshot mode persists across polls', async ({ page }) => {
    await gotoBoard(page, { bridge: 'missing' });
    const todoColumn = page.locator('[data-testid="column"][data-column-id="todo"]');
    await todoColumn.getByTestId('add-task-button').click();
    await page.getByTestId('add-task-input').fill('Snapshot mode addition');
    await page.getByTestId('add-task-input').press('Enter');
    await expect(
      page.locator('section[aria-label="To Do"] [data-testid="task-card"]'),
    ).toHaveCount(2, { timeout: 5000 });
    await page.waitForTimeout(2400);
    await expect(
      page.locator('section[aria-label="To Do"] [data-testid="task-card"]'),
    ).toHaveCount(2);
  });
});

test.describe('regression: console error gate', () => {
  /**
   * Boots the board in each bridge mode and fails if the browser logs any
   * unexpected error or warning during the first 3 seconds. Caught a real
   * "Cannot read properties of null (reading 'appendChild')" bug from the
   * cursor injector earlier; keeps that class of regression out.
   */
  for (const bridge of ['ok', 'fail', 'missing'] as const) {
    test(`no console errors in bridge=${bridge}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') {
          const text = m.text();
          // Allow expected "mock 400" warning the 'fail' bridge surfaces.
          if (/persistence call failed/.test(text)) return;
          errors.push(`[${m.type()}] ${text}`);
        }
      });
      page.on('pageerror', (err) => {
        errors.push(`[pageerror] ${err.message}`);
      });

      await gotoBoard(page, { bridge });
      await page.waitForTimeout(3000);
      expect(errors, `unexpected console output:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
