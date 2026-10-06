import { test, expect, type Page } from '@playwright/test';
import { gotoBoard, HOST_SERVER } from './harness';

/**
 * Since 2026-08-19 a published artifact reaches the user's local MCP server
 * through the runtime's `mcp` capability: `await window.claude.use("mcp")`,
 * then `mcp.callTool("host:<server>", tool, input)`. The harness's use-*
 * modes mock exactly that (window.claude carries only `use`).
 */

interface Call {
  kind: string;
  server?: string;
  tool?: string;
  args?: Record<string, unknown>;
  options?: unknown;
}

const allCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __claudeCalls: Call[] }).__claudeCalls);

const useCalls = async (page: Page, tool: string) =>
  (await allCalls(page)).filter((c) => c.kind === 'use.callTool' && c.tool === tool);

async function openFirstCard(page: Page) {
  await page.getByTestId('task-card').first().click();
  await expect(page.getByTestId('side-panel')).toBeVisible();
}

test.describe('runtime capability bridge: live', () => {
  test('reads tasks through the host server, not the legacy bridges', async ({ page }) => {
    await gotoBoard(page, { bridge: 'use' });

    await expect(page.getByTestId('board-root')).toHaveAttribute('data-source', 'mcp');
    await expect(page.getByTestId('snapshot-banner')).toHaveCount(0);
    await expect(page.getByTestId('task-card').first()).toBeVisible();

    await expect.poll(async () => (await useCalls(page, 'list_tasks')).length).toBeGreaterThan(0);
    const first = (await useCalls(page, 'list_tasks'))[0];
    expect(first?.server).toBe(HOST_SERVER);
    expect(first?.options).toEqual({ cache: false });
    // The page has no legacy bridge at all, so the only way in was use("mcp").
    expect(
      await page.evaluate(() => ({
        cowork: typeof (window as unknown as { cowork?: unknown }).cowork,
        callTool: typeof (window as unknown as { claude?: { callTool?: unknown } }).claude
          ?.callTool,
      })),
    ).toEqual({ cowork: 'undefined', callTool: 'undefined' });
    // The mock's shared handler logs a `callTool` per request it serves: every
    // one of them must have arrived as a use.callTool.
    const calls = await allCalls(page);
    expect(calls.filter((c) => c.kind === 'callTool')).toHaveLength(
      calls.filter((c) => c.kind === 'use.callTool').length,
    );
  });

  test('edits are written through the same server', async ({ page }) => {
    await gotoBoard(page, { bridge: 'use' });
    await openFirstCard(page);
    const input = page.getByRole('dialog').locator('input').first();
    await input.fill('Renamed through the capability bridge');
    await input.blur();

    await expect.poll(async () => (await useCalls(page, 'update_task')).length).toBeGreaterThan(0);
    const call = (await useCalls(page, 'update_task'))[0];
    expect(call?.server).toBe(HOST_SERVER);
    expect((call?.args?.patch as { title?: string }).title).toBe(
      'Renamed through the capability bridge',
    );
  });

  test('Delete then Undo reaches restore_task (0.4.14 regression, now via use("mcp"))', async ({
    page,
  }) => {
    await gotoBoard(page, { bridge: 'use' });
    const before = await page.getByTestId('task-card').count();
    await openFirstCard(page);
    await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click();
    await expect(page.getByTestId('task-card')).toHaveCount(before - 1, { timeout: 6_000 });

    await page.getByTestId('toast-undo').click();
    await expect(page.getByTestId('task-card')).toHaveCount(before, { timeout: 6_000 });

    expect((await useCalls(page, 'delete_task')).length).toBe(1);
    const restore = await useCalls(page, 'restore_task');
    expect(restore.length).toBe(1);
    expect(restore[0]?.server).toBe(HOST_SERVER);
  });

  test('polls no faster than every few seconds (never tighten a loop through the capability)', async ({
    page,
  }) => {
    await gotoBoard(page, { bridge: 'use' });
    await page.waitForTimeout(3_500);
    // The legacy bridge polls every 2 s (2+ calls in this window); this one waits at least 5 s.
    expect((await useCalls(page, 'list_tasks')).length).toBeLessThanOrEqual(2);
  });
});

test.describe('runtime capability bridge: degraded', () => {
  test('use("mcp") resolving null gives a read-only snapshot with a banner', async ({ page }) => {
    await gotoBoard(page, { bridge: 'use-null' });

    await expect(page.getByTestId('board-root')).toHaveAttribute('data-source', 'snapshot');
    await expect(page.getByTestId('snapshot-banner')).toBeVisible();
    await expect(page.getByTestId('snapshot-banner')).toContainText(/Read-only snapshot/);
    // The seeded tasks still render: a snapshot is degraded, not empty.
    await expect(page.getByTestId('task-card').first()).toBeVisible();
    expect((await allCalls(page)).filter((c) => c.kind === 'use.callTool')).toHaveLength(0);
  });

  test('server_not_connected retires the bridge: snapshot, banner, tasks still shown', async ({
    page,
  }) => {
    await gotoBoard(page, { bridge: 'use-down' });

    await expect(page.getByTestId('snapshot-banner')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('board-root')).toHaveAttribute('data-source', 'snapshot');
    await expect(page.getByTestId('task-card').first()).toBeVisible();
    // Retired after the first failure, not hammered.
    const attempts = (await useCalls(page, 'list_tasks')).length;
    await page.waitForTimeout(1_500);
    expect((await useCalls(page, 'list_tasks')).length).toBe(attempts);
  });

  test('a declined write keeps the bridge and says the change was not saved', async ({ page }) => {
    await gotoBoard(page, { bridge: 'use-declined' });
    await openFirstCard(page);
    const input = page.getByRole('dialog').locator('input').first();
    await input.fill('Will be declined');
    await input.blur();

    await expect(page.getByTestId('toast')).toContainText(/Change not saved.*declined/i, {
      timeout: 5_000,
    });
    // Declining one write must not turn the whole board read-only.
    await expect(page.getByTestId('board-root')).toHaveAttribute('data-source', 'mcp');
    await expect(page.getByTestId('snapshot-banner')).toHaveCount(0);
  });
});
