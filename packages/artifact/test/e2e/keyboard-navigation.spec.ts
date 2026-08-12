import { test, expect } from '@playwright/test';
import { gotoBoard } from './harness';

test.describe('keyboard: card navigation', () => {
  test('uses a roving tabindex and moves vertically within a column', async ({ page }) => {
    await gotoBoard(page);
    const inboxCards = page.locator(
      '[data-testid="column"][aria-label="Inbox"] [data-testid="task-card"]',
    );

    await expect(inboxCards.nth(0)).toHaveAttribute('tabindex', '0');
    await expect(inboxCards.nth(1)).toHaveAttribute('tabindex', '-1');
    await inboxCards.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(inboxCards.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(inboxCards.nth(0)).toBeFocused();
  });

  test('moves focus between adjacent non-empty columns', async ({ page }) => {
    await gotoBoard(page);
    const inboxCard = page.locator('[data-task-id="t1"]');
    const todoCard = page.locator('[data-task-id="t4"]');

    await inboxCard.focus();
    await page.keyboard.press('ArrowRight');
    await expect(todoCard).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(inboxCard).toBeFocused();
  });

  test('opens the focused card with Enter and Space', async ({ page }) => {
    await gotoBoard(page);
    const card = page.locator('[data-task-id="t1"]');

    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('side-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('side-panel')).toBeHidden();
    await expect(card).toBeFocused();

    await page.keyboard.press(' ');
    await expect(page.getByTestId('side-panel')).toBeVisible();
  });
});

test.describe('keyboard: side-panel focus', () => {
  test('focuses Close, traps Tab, and restores focus on Escape', async ({ page }) => {
    await gotoBoard(page);
    const card = page.locator('[data-task-id="t1"]');

    await card.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByTestId('side-panel');
    await expect(panel).toBeVisible();
    const close = panel.getByRole('button', { name: 'Close' });
    await expect(close).toBeFocused();

    const focusable = panel.locator(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    const last = focusable.last();
    await last.focus();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(card).toBeFocused();
  });
});

test.describe('keyboard: additional shortcuts', () => {
  test('Meta+/ and Control+/ focus the search input', async ({ page }) => {
    await gotoBoard(page);
    const search = page.locator('input[type="search"]');

    await page.keyboard.press('Meta+Slash');
    await expect(search).toBeFocused();
    await search.blur();
    await page.keyboard.press('Control+Slash');
    await expect(search).toBeFocused();
  });

  test('Alt+Arrow moves a focused card between status columns', async ({ page }) => {
    await gotoBoard(page);
    const card = page.locator('[data-task-id="t1"]');
    const inbox = page.locator('[data-testid="column"][aria-label="Inbox"]');
    const todo = page.locator('[data-testid="column"][aria-label="To Do"]');

    await expect(inbox.locator('[data-testid="task-card"]')).toHaveCount(3);
    await expect(todo.locator('[data-testid="task-card"]')).toHaveCount(1);
    await card.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(inbox.locator('[data-testid="task-card"]')).toHaveCount(2);
    await expect(todo.locator('[data-testid="task-card"]')).toHaveCount(2);
    await expect(page.locator('[data-task-id="t1"]')).toBeFocused();

    await page.keyboard.press('Alt+ArrowLeft');
    await expect(inbox.locator('[data-testid="task-card"]')).toHaveCount(3);
    await expect(todo.locator('[data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('[data-task-id="t1"]')).toBeFocused();
  });
});
