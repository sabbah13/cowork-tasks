import { test, expect } from '@playwright/test';
import { gotoBoard } from './harness';

/**
 * Core feature tests, organized by surface area. User-journey style tests
 * (longer, recorded for video review) live in `journey.spec.ts`.
 */

test.describe('first paint', () => {
  test('renders 7 seeded tasks in the right columns', async ({ page }) => {
    await gotoBoard(page);
    await expect(page.locator('header[role="banner"]')).toContainText('7 tasks');
    await expect(page.getByTestId('task-card')).toHaveCount(7);
    await expect(page.locator('section[aria-label="Inbox"] [data-testid="task-card"]')).toHaveCount(3);
    await expect(page.locator('section[aria-label="To Do"] [data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('section[aria-label="In Progress"] [data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('section[aria-label="Blocked"] [data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('section[aria-label="Done"] [data-testid="task-card"]')).toHaveCount(1);
  });

  test('shows the empty state CTA when no tasks exist', async ({ page }) => {
    await gotoBoard(page, { fixture: 'empty' });
    await expect(page.getByText('Nothing on the board yet')).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect a source/ })).toBeVisible();
  });

  test('renders gracefully when the bridge is missing entirely', async ({ page }) => {
    await gotoBoard(page, { bridge: 'missing' });
    await expect(page.getByTestId('task-card').first()).toBeVisible();
    await expect(page.getByTestId('task-card')).toHaveCount(7);
  });

  test('initial paint still shows tasks even when callTool throws 400', async ({ page }) => {
    await gotoBoard(page, { bridge: 'fail' });
    await expect(page.getByTestId('task-card').first()).toBeVisible();
    await expect(page.getByTestId('task-card')).toHaveCount(7);
  });
});

test.describe('search', () => {
  test('matches title', async ({ page }) => {
    await gotoBoard(page);
    await page.getByPlaceholder(/Search/).fill('pricing');
    await expect(page.getByTestId('task-card')).toHaveCount(1);
  });
  test('matches description', async ({ page }) => {
    await gotoBoard(page);
    await page.getByPlaceholder(/Search/).fill('legal sign-off');
    await expect(page.getByTestId('task-card')).toHaveCount(1);
  });
  test('matches label', async ({ page }) => {
    await gotoBoard(page);
    await page.getByPlaceholder(/Search/).fill('partner');
    await expect(page.getByTestId('task-card').first()).toBeVisible();
    expect(await page.getByTestId('task-card').count()).toBeGreaterThan(0);
  });
  test('case insensitive', async ({ page }) => {
    await gotoBoard(page);
    await page.getByPlaceholder(/Search/).fill('PRICING');
    await expect(page.getByTestId('task-card')).toHaveCount(1);
  });
  test('clears with empty input', async ({ page }) => {
    await gotoBoard(page);
    const search = page.getByPlaceholder(/Search/);
    await search.fill('pricing');
    await expect(page.getByTestId('task-card')).toHaveCount(1);
    await search.fill('');
    await expect(page.getByTestId('task-card')).toHaveCount(7);
  });
});

test.describe('side panel', () => {
  test('opens with title and description visible in editable form', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expect(panel.locator('input').first()).toHaveValue(/Build v1 analytics dashboard/);
    await expect(panel.getByTestId('side-panel-description-preview')).toContainText(
      /Define requirements scoped/,
    );
  });
  test('renders all four AI buttons', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    for (const name of ['Summarize source', 'Tighten title', 'Draft reply', 'Split into subtasks']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }
  });
  test('Open in <source> link', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    const link = page.getByRole('dialog').getByRole('link', { name: /Open in/ });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('href', /fathom\.video/);
  });
  test('AI button click invokes window.claude', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await page.getByRole('button', { name: /Tighten title/ }).click();
    await page.waitForTimeout(300);
    const calls = await page.evaluate<unknown[]>(() => {
      const w = window as unknown as { __claudeCalls: { kind: string }[] };
      return w.__claudeCalls.filter((c) => c.kind === 'complete' || c.kind === 'sendToChat');
    });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
  test('Title edit commits update_task on blur', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    const input = page.getByRole('dialog').locator('input').first();
    await input.fill('Renamed task title');
    await input.blur();
    await page.waitForTimeout(300);
    const calls = await page.evaluate<unknown[]>(() => {
      const w = window as unknown as { __claudeCalls: { kind: string; tool?: string }[] };
      return w.__claudeCalls.filter((c) => c.kind === 'callTool' && c.tool === 'update_task');
    });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
  test('Description edit commits update_task on blur', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    // Description is rendered as markdown by default; click to open the
    // edit textarea, then type and blur.
    await page.getByTestId('side-panel-description-preview').click();
    const ta = page.getByRole('dialog').locator('textarea').first();
    await ta.fill('Brand-new context.');
    await ta.blur();
    await page.waitForTimeout(300);
    const calls = await page.evaluate<unknown[]>(() => {
      const w = window as unknown as { __claudeCalls: { kind: string; tool?: string }[] };
      return w.__claudeCalls.filter((c) => c.kind === 'callTool' && c.tool === 'update_task');
    });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
  test('Archive removes the card', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^Archive$/ }).click();
    await expect(page.getByTestId('task-card')).toHaveCount(6, { timeout: 8_000 });
  });
  test('Delete removes the card', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click();
    await expect(page.getByTestId('task-card')).toHaveCount(6, { timeout: 8_000 });
  });
  test('Close (X) dismisses without changes', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('task-card')).toHaveCount(7);
  });
});

test.describe('top bar', () => {
  test('Refresh triggers list_tasks', async ({ page }) => {
    await gotoBoard(page);
    await page.evaluate(() => {
      const w = window as unknown as { __claudeCalls: unknown[] };
      w.__claudeCalls = [];
    });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await page.waitForTimeout(400);
    const calls = await page.evaluate<unknown[]>(() => {
      const w = window as unknown as { __claudeCalls: { kind: string; tool?: string }[] };
      return w.__claudeCalls.filter((c) => c.kind === 'callTool' && c.tool === 'list_tasks');
    });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
  test('Triage now hands off to chat', async ({ page }) => {
    await gotoBoard(page);
    await page.getByRole('button', { name: /Triage now/ }).click();
    await page.waitForTimeout(300);
    const calls = await page.evaluate<unknown[]>(() => {
      const w = window as unknown as { __claudeCalls: { kind: string; prompt?: string }[] };
      return w.__claudeCalls.filter((c) => c.kind === 'sendToChat' || c.kind === 'complete');
    });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
  test('Settings button is reachable', async ({ page }) => {
    await gotoBoard(page);
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});

test.describe('drag/drop', () => {
  test('cross-column move updates both column counts', async ({ page }) => {
    await gotoBoard(page);
    const source = page.locator('section[aria-label="Inbox"] [data-testid="task-card"]').first();
    const target = page.locator('section[aria-label="To Do"]');
    const sb = await source.boundingBox();
    const tb = await target.boundingBox();
    if (!sb || !tb) throw new Error('not visible');
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width / 2 + 8, sb.y + sb.height / 2, { steps: 5 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + 80, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('section[aria-label="Inbox"] [data-testid="task-card"]')).toHaveCount(2, { timeout: 8_000 });
    await expect(page.locator('section[aria-label="To Do"] [data-testid="task-card"]')).toHaveCount(2, { timeout: 8_000 });
  });

  test('within-column reorder swaps order', async ({ page }) => {
    await gotoBoard(page);
    const cards = page.locator('section[aria-label="Inbox"] [data-testid="task-card"]');
    const before = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-task-id')));
    const source = cards.nth(2);
    const target = cards.nth(0);
    const sb = await source.boundingBox();
    const tb = await target.boundingBox();
    if (!sb || !tb) throw new Error('not visible');
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width / 2 + 8, sb.y + sb.height / 2 - 4, { steps: 6 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + 12, { steps: 18 });
    await page.mouse.up();
    await expect
      .poll(
        () => cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-task-id'))),
        { timeout: 10_000 },
      )
      .not.toEqual(before);
  });
});

test.describe('inline add task', () => {
  test('+ button opens the form, Enter submits, card appears', async ({ page }) => {
    await gotoBoard(page);
    const todoColumn = page.locator('[data-testid="column"][data-column-id="todo"]');
    await todoColumn.getByTestId('add-task-button').click();
    const input = page.getByTestId('add-task-input');
    await input.fill('Created from inline form');
    await input.press('Enter');
    await expect(
      page
        .locator('section[aria-label="To Do"] [data-testid="task-card"]')
        .filter({ hasText: 'Created from inline form' }),
    ).toHaveCount(1, { timeout: 8_000 });
  });

  test('Esc cancels without creating', async ({ page }) => {
    await gotoBoard(page);
    const todoColumn = page.locator('[data-testid="column"][data-column-id="todo"]');
    await todoColumn.getByTestId('add-task-button').click();
    await page.getByTestId('add-task-input').fill('Should not appear');
    await page.getByTestId('add-task-input').press('Escape');
    await page.waitForTimeout(400);
    await expect(page.getByTestId('task-card')).toHaveCount(7);
  });
});

test.describe('visual', () => {
  test('priority + label badges render', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    await expect(card.getByText('high', { exact: true })).toBeVisible();
    await expect(card.getByText('meeting').first()).toBeVisible();
  });
  test('owner avatar shows initials', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    await expect(card.locator('span[title="Sam Rivera"]')).toContainText("SR");
  });
  test('dark mode applies via prefers-color-scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoBoard(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(2[0-8],/);
  });
});

test.describe('inline title edit', () => {
  test('double-click opens an editable input with the current title', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    await card.dblclick();
    const input = page.getByTestId('task-card-title-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('Enter commits the new title via update_task', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    await card.dblclick();
    const input = page.getByTestId('task-card-title-input');
    await input.fill('Renamed inline');
    await input.press('Enter');
    await expect(card).toContainText('Renamed inline');
    const calls = await page.evaluate<unknown[]>(() => {
      const w = window as unknown as { __claudeCalls: { kind: string; tool?: string }[] };
      return w.__claudeCalls.filter((c) => c.kind === 'callTool' && c.tool === 'update_task');
    });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  test('Escape cancels and leaves the original title', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    const original = (await card.locator('h3').first().textContent()) ?? '';
    await card.dblclick();
    const input = page.getByTestId('task-card-title-input');
    await input.fill('Should not stick');
    await input.press('Escape');
    await expect(card).toContainText(original);
    await expect(page.getByTestId('task-card-title-input')).toBeHidden();
  });

  test('clicking inside the edit input does not open the side panel', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    await card.dblclick();
    const input = page.getByTestId('task-card-title-input');
    await input.click();
    await expect(page.getByTestId('side-panel')).toBeHidden();
  });
});

test.describe('column rename + add', () => {
  test('double-click a column name opens an editable input', async ({ page }) => {
    await gotoBoard(page);
    const inboxHeader = page.locator('section[aria-label="Inbox"] h2').first();
    await inboxHeader.dblclick();
    await expect(page.getByTestId('column-rename-input')).toBeVisible();
    await expect(page.getByTestId('column-rename-input')).toBeFocused();
  });

  test('Enter commits the new column name', async ({ page }) => {
    await gotoBoard(page);
    const inboxHeader = page.locator('section[aria-label="Inbox"] h2').first();
    await inboxHeader.dblclick();
    const input = page.getByTestId('column-rename-input');
    await input.fill('Triage');
    await input.press('Enter');
    await expect(page.locator('section[aria-label="Triage"] h2').first()).toBeVisible();
  });

  test('Escape cancels and leaves the original name', async ({ page }) => {
    await gotoBoard(page);
    const inboxHeader = page.locator('section[aria-label="Inbox"] h2').first();
    await inboxHeader.dblclick();
    const input = page.getByTestId('column-rename-input');
    await input.fill('Wrong name');
    await input.press('Escape');
    await expect(page.locator('section[aria-label="Inbox"] h2').first()).toBeVisible();
    await expect(page.getByTestId('column-rename-input')).toBeHidden();
  });

  test('Add column button reveals an input that creates a new column', async ({ page }) => {
    await gotoBoard(page);
    const before = await page.locator('section[aria-label]').count();
    await page.getByTestId('add-column-button').click();
    const input = page.getByTestId('add-column-input');
    await input.fill('Review');
    await input.press('Enter');
    await expect(page.locator('section[aria-label="Review"]')).toBeVisible();
    const after = await page.locator('section[aria-label]').count();
    expect(after).toBe(before + 1);
  });

  test('Esc cancels add-column without creating', async ({ page }) => {
    await gotoBoard(page);
    const before = await page.locator('section[aria-label]').count();
    await page.getByTestId('add-column-button').click();
    const input = page.getByTestId('add-column-input');
    await input.fill('Should not exist');
    await input.press('Escape');
    await expect(page.getByTestId('add-column-input')).toBeHidden();
    expect(await page.locator('section[aria-label]').count()).toBe(before);
  });
});

test.describe('a11y', () => {
  test('column headers are <h2>', async ({ page }) => {
    await gotoBoard(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Inbox' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Done' })).toBeVisible();
  });
  test('search input has type=search', async ({ page }) => {
    await gotoBoard(page);
    await expect(page.getByPlaceholder(/Search/)).toHaveAttribute('type', 'search');
  });
});
