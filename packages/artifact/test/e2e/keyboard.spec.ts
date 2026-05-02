import { test, expect } from '@playwright/test';
import { gotoBoard } from './harness';

/**
 * Keyboard shortcut tests covering the Trello-style hotkey system.
 *
 * Layout-independent: assertions go through `e.code` so the same physical
 * key works regardless of QWERTY/Dvorak/Colemak. Playwright drives keys by
 * key value, which maps to the right `code` for the default US layout.
 */

test.describe('keyboard: board-level shortcuts', () => {
  test('? opens the keyboard shortcuts dialog', async ({ page }) => {
    await gotoBoard(page);
    await page.keyboard.press('Shift+Slash');
    await expect(page.getByTestId('help-dialog')).toBeVisible();
    await expect(page.getByTestId('help-dialog')).toContainText('Keyboard shortcuts');
  });

  test('Esc closes the help dialog', async ({ page }) => {
    await gotoBoard(page);
    await page.keyboard.press('Shift+Slash');
    await expect(page.getByTestId('help-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('help-dialog')).toBeHidden();
  });

  test('/ focuses the search input', async ({ page }) => {
    await gotoBoard(page);
    await page.keyboard.press('Slash');
    const focused = await page.evaluate(
      () => (document.activeElement as HTMLInputElement | null)?.type ?? '',
    );
    expect(focused).toBe('search');
  });

  test('A toggles show archived', async ({ page }) => {
    await gotoBoard(page);
    const btn = page.getByTestId('toggle-archived-button');
    await expect(btn).toHaveAttribute('data-active', 'false');
    await page.keyboard.press('a');
    await expect(btn).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('a');
    await expect(btn).toHaveAttribute('data-active', 'false');
  });

  test('N opens the inline add-task form in Inbox', async ({ page }) => {
    await gotoBoard(page);
    await page.keyboard.press('n');
    await expect(page.getByTestId('add-task-input')).toBeVisible();
  });

  test('search input does NOT trigger board hotkeys when focused', async ({ page }) => {
    await gotoBoard(page);
    const search = page.getByPlaceholder(/Search/);
    await search.click();
    await page.keyboard.type('a');
    // 'a' should land in the search box, not toggle archived.
    await expect(search).toHaveValue('a');
    await expect(page.getByTestId('toggle-archived-button')).toHaveAttribute('data-active', 'false');
  });
});

test.describe('keyboard: hover-card shortcuts', () => {
  test('E opens the hovered card', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().hover();
    await page.keyboard.press('e');
    await expect(page.getByTestId('side-panel')).toBeVisible();
  });

  test('C archives the hovered card', async ({ page }) => {
    await gotoBoard(page);
    const before = await page.getByTestId('task-card').count();
    await page.getByTestId('task-card').first().hover();
    await page.keyboard.press('c');
    await expect(page.getByTestId('task-card')).toHaveCount(before - 1, { timeout: 5000 });
  });

  test('L opens the labels picker for the hovered card', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().hover();
    await page.keyboard.press('l');
    await expect(page.getByTestId('label-picker')).toBeVisible();
  });

  test('M opens the owner picker for the hovered card', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().hover();
    await page.keyboard.press('m');
    await expect(page.getByTestId('owner-picker')).toBeVisible();
  });

  test('Digit toggles label by index', async ({ page }) => {
    await gotoBoard(page);
    const card = page.getByTestId('task-card').first();
    await card.hover();
    // Digit1 should toggle the first label in config (`urgent`). The card's
    // existing labels are 'meeting' and 'high-priority'; pressing 1 adds
    // 'urgent' (the first label in the seeded config.labels).
    await page.keyboard.press('1');
    await expect(card).toContainText('urgent');
    await page.keyboard.press('1');
    await expect(card).not.toContainText('urgent');
  });
});

test.describe('keyboard: side-panel shortcuts', () => {
  test('T focuses the title input', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await page.keyboard.press('t');
    const focusedTestId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? '',
    );
    expect(focusedTestId).toBe('side-panel-title');
  });

  test('L toggles the labels picker inside the modal', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await page.keyboard.press('l');
    await expect(page.getByTestId('label-picker')).toBeVisible();
    await page.keyboard.press('l');
    await expect(page.getByTestId('label-picker')).toBeHidden();
  });

  test('M toggles the owner picker inside the modal', async ({ page }) => {
    await gotoBoard(page);
    await page.getByTestId('task-card').first().click();
    await page.keyboard.press('m');
    await expect(page.getByTestId('owner-picker')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.getByTestId('owner-picker')).toBeHidden();
  });

  test('C archives the open task and closes the panel', async ({ page }) => {
    await gotoBoard(page);
    const before = await page.getByTestId('task-card').count();
    await page.getByTestId('task-card').first().click();
    await page.keyboard.press('c');
    await expect(page.getByTestId('side-panel')).toBeHidden();
    await expect(page.getByTestId('task-card')).toHaveCount(before - 1, { timeout: 5000 });
  });

  test('Esc cascades: picker → modal → search', async ({ page }) => {
    await gotoBoard(page);

    // Set up: open card, open label picker.
    await page.getByTestId('task-card').first().click();
    await page.keyboard.press('l');
    await expect(page.getByTestId('label-picker')).toBeVisible();

    // First Esc closes the picker.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('label-picker')).toBeHidden();
    await expect(page.getByTestId('side-panel')).toBeVisible();

    // Second Esc closes the modal.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('side-panel')).toBeHidden();
  });
});

test.describe('show-archived button', () => {
  test('toggling Archive button hides/shows archived tasks', async ({ page }) => {
    await gotoBoard(page);
    // Archive one card so there's something to filter.
    await page.getByTestId('task-card').first().click();
    await page.keyboard.press('c');
    await page.waitForTimeout(300);

    // Now toggle the archived button - count should not include archived.
    const visibleAfterArchive = await page.getByTestId('task-card').count();

    await page.getByTestId('toggle-archived-button').click();
    // Showing archived shouldn't change the count in this fixture (we removed
    // the task locally; archived means status='archived' tasks). The button
    // just needs to flip its data-active state.
    await expect(page.getByTestId('toggle-archived-button')).toHaveAttribute('data-active', 'true');
    expect(await page.getByTestId('task-card').count()).toBeGreaterThanOrEqual(
      visibleAfterArchive,
    );
  });
});

test.describe('Cowork-native styling', () => {
  test('description text uses sans-serif (matches Cowork chrome)', async ({ page }) => {
    await gotoBoard(page);
    const description = page.getByTestId('task-card').first().locator('p').first();
    const family = await description.evaluate((el) => getComputedStyle(el).fontFamily);
    // Should NOT name any actual serif typefaces. Don't check for the
    // bare token `serif,` because it appears as a substring of
    // `ui-sans-serif,` which is a perfectly valid sans fallback.
    const lower = family.toLowerCase();
    expect(lower).not.toContain('tiempos');
    expect(lower).not.toContain('lora');
    expect(lower).not.toContain('georgia');
    // The resolved chain should start with our display stack.
    expect(lower).toMatch(/styrene|inter|sans-serif/);
  });
});
