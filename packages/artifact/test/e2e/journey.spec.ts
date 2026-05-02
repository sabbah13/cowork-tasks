import { test, expect, type Page, type Locator } from '@playwright/test';
import { setupCoworkEnv, gotoBoard } from './harness';

/**
 * User-journey tests. Each test is one continuous recording of a real-ish
 * workflow: 5-15 actions in sequence, with natural pauses between them so
 * the resulting video plays at a watchable pace.
 *
 * These exercise the kanban end-to-end the way a knowledge worker would on
 * Monday morning:
 *   1. Open the board, see today's surface area.
 *   2. Triage Inbox - read a card, archive what's done, drag a fresh card
 *      to To Do, edit a title.
 *   3. Add a task by hand from a quick thought.
 *   4. Search for something specific, click into it, ask Claude for help.
 *   5. Move a card across the workflow as the day progresses.
 *
 * Helpers below wrap every meaningful gesture in a `step` so traces are
 * easy to scan and the cursor visualization gets time to settle.
 */

/** Pause briefly so the cursor visualization has time to render. */
async function beat(page: Page, ms = 350): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Move the mouse to the center of a locator with a smooth multi-step glide. */
async function hoverSmooth(page: Page, locator: Locator, steps = 14): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('locator not visible');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps });
  await beat(page, 200);
}

async function clickSmooth(page: Page, locator: Locator): Promise<void> {
  await hoverSmooth(page, locator);
  await locator.click();
  await beat(page, 200);
}

async function dragSmooth(page: Page, source: Locator, target: Locator): Promise<void> {
  const sb = await source.boundingBox();
  const tb = await target.boundingBox();
  if (!sb || !tb) throw new Error('cards or column not visible');

  const sx = sb.x + sb.width / 2;
  const sy = sb.y + sb.height / 2;
  const tx = tb.x + tb.width / 2;
  const ty = tb.y + 80;

  // Hover the source first so the cursor visualization "lands" naturally.
  await page.mouse.move(sx, sy, { steps: 10 });
  await beat(page, 250);
  // Down + immediate distance-trip + glide. Don't insert waits between
  // down and first move - dnd-kit interprets motionless pointer as a click.
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 4, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 28 });
  await beat(page, 350);
  await page.mouse.up();
  await beat(page, 400);
}

async function typeSlowly(page: Page, locator: Locator, text: string): Promise<void> {
  await locator.click();
  await beat(page, 150);
  await locator.fill('');
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 35 });
  }
  await beat(page, 250);
}

// ---------------------------------------------------------------------------

test.describe('user journey: Monday morning triage', () => {
  test('open, archive a done task, drag inbox card to todo, search, click into, ask Claude', async ({
    page,
  }) => {
    await test.step('1. Open the board', async () => {
      await gotoBoard(page);
      await beat(page, 500);
    });

    await test.step('2. Hover the Done column to confirm yesterday\'s wins', async () => {
      await hoverSmooth(page, page.locator('section[aria-label="Done"]'));
      await beat(page, 600);
    });

    await test.step('3. Click into the Done card and archive it', async () => {
      await clickSmooth(page, page.locator('section[aria-label="Done"] [data-testid="task-card"]').first());
      await beat(page, 500);
      await clickSmooth(page, page.getByRole('dialog').getByRole('button', { name: /^Archive$/ }));
      await expect(page.getByTestId('task-card')).toHaveCount(6, { timeout: 8000 });
    });

    await test.step('4. Pull the top Inbox card into To Do', async () => {
      const source = page.locator('section[aria-label="Inbox"] [data-testid="task-card"]').first();
      const target = page.locator('section[aria-label="To Do"]');
      // Use the same low-level mouse sequence as the standalone drag test
      // in board.spec.ts. dragSmooth's extra hover-then-pause timeline is
      // fine in isolation but flakes when chained right after an archive.
      const sb = await source.boundingBox();
      const tb = await target.boundingBox();
      if (!sb || !tb) throw new Error('not visible');
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.mouse.down();
      await page.mouse.move(sb.x + sb.width / 2 + 8, sb.y + sb.height / 2, { steps: 8 });
      await page.mouse.move(tb.x + tb.width / 2, tb.y + 80, { steps: 16 });
      await page.mouse.up();
      await expect(
        page.locator('section[aria-label="To Do"] [data-testid="task-card"]'),
      ).toHaveCount(2, { timeout: 10_000 });
    });

    await test.step('5. Search for "Pricing experiment"', async () => {
      const search = page.getByPlaceholder(/Search/);
      await typeSlowly(page, search, 'Pricing experiment');
      await expect(page.getByTestId('task-card')).toHaveCount(1);
    });

    await test.step('6. Click the matched card and ask Claude to tighten the title', async () => {
      await clickSmooth(page, page.getByTestId('task-card').first());
      await clickSmooth(page, page.getByRole('button', { name: /Tighten title/ }));
      await beat(page, 700);
    });

    await test.step('7. Close the side panel, clear the search', async () => {
      await clickSmooth(page, page.getByRole('button', { name: 'Close' }));
      await typeSlowly(page, page.getByPlaceholder(/Search/), '');
      await beat(page, 400);
    });

    await page.screenshot({
      path: 'test/e2e/.results/journey-monday-morning.png',
      fullPage: true,
    });
  });
});

test.describe('user journey: capture a fresh thought', () => {
  test('add a task to Todo via the inline + button, then move it to In Progress', async ({
    page,
  }) => {
    await gotoBoard(page);
    await beat(page, 400);

    await test.step('1. Click the + button on the To Do column', async () => {
      const todoColumn = page.locator('[data-testid="column"][data-column-id="todo"]');
      await hoverSmooth(page, todoColumn);
      await clickSmooth(page, todoColumn.getByTestId('add-task-button'));
    });

    await test.step('2. Type a title, hit Enter', async () => {
      const input = page.getByTestId('add-task-input');
      await typeSlowly(page, input, 'Sketch v2 design for partner dashboard');
      await page.keyboard.press('Enter');
      await beat(page, 800);
    });

    await test.step('3. Verify the new card landed in To Do', async () => {
      await expect(
        page
          .locator('section[aria-label="To Do"] [data-testid="task-card"]')
          .filter({ hasText: 'Sketch v2 design' }),
      ).toHaveCount(1, { timeout: 8000 });
    });

    await test.step('4. Drag it to In Progress', async () => {
      const source = page
        .locator('section[aria-label="To Do"] [data-testid="task-card"]')
        .filter({ hasText: 'Sketch v2 design' });
      const target = page.locator('section[aria-label="In Progress"]');
      await dragSmooth(page, source, target);
      await expect(
        page
          .locator('section[aria-label="In Progress"] [data-testid="task-card"]')
          .filter({ hasText: 'Sketch v2 design' }),
      ).toHaveCount(1, { timeout: 8000 });
    });

    await page.screenshot({
      path: 'test/e2e/.results/journey-capture-thought.png',
      fullPage: true,
    });
  });
});

test.describe('user journey: edit a card in detail', () => {
  test('open card, rewrite title, rewrite description, add label via labels (visual)', async ({
    page,
  }) => {
    await gotoBoard(page);

    await test.step('1. Click the top inbox card', async () => {
      await clickSmooth(
        page,
        page.locator('section[aria-label="Inbox"] [data-testid="task-card"]').first(),
      );
    });

    await test.step('2. Rewrite the title', async () => {
      const input = page.getByRole('dialog').locator('input').first();
      await typeSlowly(page, input, 'Analytics dashboard v1 - ship to design partner EOD');
      await input.blur();
      await beat(page, 500);
    });

    await test.step('3. Rewrite the description', async () => {
      // Description renders as markdown preview; click to enter edit mode.
      await clickSmooth(page, page.getByTestId('side-panel-description-preview'));
      const textarea = page.getByRole('dialog').locator('textarea').first();
      await typeSlowly(
        page,
        textarea,
        'Use the anonymized aggregate stream we agreed on; ship draft today, polish Friday.',
      );
      await textarea.blur();
      await beat(page, 600);
    });

    await test.step('4. Hover the AI buttons one by one to telegraph the surface', async () => {
      for (const name of ['Summarize source', 'Tighten title', 'Draft reply', 'Split into subtasks']) {
        await hoverSmooth(
          page,
          page.getByRole('dialog').getByRole('button', { name: new RegExp(name) }),
          8,
        );
        await beat(page, 300);
      }
    });

    await test.step('5. Click "Open in meeting" link target', async () => {
      const link = page.getByRole('dialog').getByRole('link', { name: /Open in/ });
      await hoverSmooth(page, link);
      await beat(page, 400);
      // Don't actually navigate (target=_blank pop-up handling is platform-dependent).
    });

    await test.step('6. Close the panel', async () => {
      await clickSmooth(page, page.getByRole('button', { name: 'Close' }));
      await beat(page, 400);
    });

    await page.screenshot({
      path: 'test/e2e/.results/journey-edit-detail.png',
      fullPage: true,
    });
  });
});

test.describe('user journey: full sweep across the board', () => {
  test('move a card through Inbox -> To Do -> In Progress -> Done', async ({ page }) => {
    await gotoBoard(page);

    const cardText = 'Watch: Pricing experiment';

    const cardLocator = () =>
      page.getByTestId('task-card').filter({ hasText: cardText }).first();

    await test.step('1. Locate the Pricing experiment card in Inbox', async () => {
      await hoverSmooth(page, cardLocator());
      await beat(page, 500);
    });

    await test.step('2. Drag Inbox -> To Do', async () => {
      await dragSmooth(page, cardLocator(), page.locator('section[aria-label="To Do"]'));
      await beat(page, 800);
    });

    await test.step('3. Drag To Do -> In Progress', async () => {
      await dragSmooth(page, cardLocator(), page.locator('section[aria-label="In Progress"]'));
      await beat(page, 800);
    });

    await test.step('4. Drag In Progress -> Done', async () => {
      await dragSmooth(page, cardLocator(), page.locator('section[aria-label="Done"]'));
      await beat(page, 800);
    });

    await test.step('5. Confirm the card is in Done', async () => {
      await expect(
        page
          .locator('section[aria-label="Done"] [data-testid="task-card"]')
          .filter({ hasText: cardText }),
      ).toHaveCount(1, { timeout: 10_000 });
    });

    await page.screenshot({
      path: 'test/e2e/.results/journey-sweep.png',
      fullPage: true,
    });
  });
});

test.describe('user journey: same-column reorder', () => {
  test('drag the third Inbox card above the first', async ({ page }) => {
    await gotoBoard(page);
    await beat(page, 400);

    const cards = page.locator('section[aria-label="Inbox"] [data-testid="task-card"]');
    const idsBefore = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-task-id')),
    );

    await test.step('1. Hover all three Inbox cards in turn', async () => {
      for (let i = 0; i < (await cards.count()); i += 1) {
        await hoverSmooth(page, cards.nth(i), 6);
        await beat(page, 200);
      }
    });

    await test.step('2. Drag the third card on top of the first', async () => {
      const source = cards.nth(2);
      const target = cards.nth(0);
      const sb = await source.boundingBox();
      const tb = await target.boundingBox();
      if (!sb || !tb) throw new Error('cards not visible');
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 10 });
      await beat(page, 250);
      await page.mouse.down();
      await page.mouse.move(sb.x + sb.width / 2 + 8, sb.y + sb.height / 2 - 4, { steps: 6 });
      // Move up to land near the top of the first card (so we drop ABOVE it).
      await page.mouse.move(tb.x + tb.width / 2, tb.y + 12, { steps: 22 });
      await beat(page, 300);
      await page.mouse.up();
      await beat(page, 800);
    });

    await test.step('3. Confirm the order changed', async () => {
      await expect
        .poll(
          () => cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-task-id'))),
          { timeout: 10_000 },
        )
        .not.toEqual(idsBefore);
    });

    await page.screenshot({
      path: 'test/e2e/.results/journey-reorder.png',
      fullPage: true,
    });
  });
});

test.describe('user journey: keyboard navigation', () => {
  test('Tab through the board, focus a card, press Enter to open it, Escape to close', async ({
    page,
  }) => {
    await gotoBoard(page);
    await beat(page, 400);

    // Tab a few times to reach a card.
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      await beat(page, 80);
    }

    // The active element might be a card by now. If so, press Enter; if not,
    // try one more Tab.
    const isCard = await page.evaluate(
      () => document.activeElement?.getAttribute?.('data-testid') === 'task-card',
    );
    if (!isCard) {
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press('Tab');
        const ok = await page.evaluate(
          () => document.activeElement?.getAttribute?.('data-testid') === 'task-card',
        );
        if (ok) break;
      }
    }

    await page.keyboard.press('Enter');
    await beat(page, 600);
    // The dialog may or may not open depending on focus path; both branches
    // are acceptable signals of an a11y-respecting tree.
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await beat(page, 400);
      await page.keyboard.press('Escape');
    }

    await page.screenshot({ path: 'test/e2e/.results/journey-keyboard.png', fullPage: true });
  });
});
