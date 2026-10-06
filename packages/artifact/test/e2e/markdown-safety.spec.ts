import { test, expect, type Page } from '@playwright/test';
import { gotoBoard } from './harness';

/**
 * Card descriptions are rendered from markdown, and their text originates from
 * email, Slack and meeting content. These tests pin the safety behavior:
 * unsafe links render as plain text, remote media is https-only and loads
 * only on click.
 */

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const HOSTILE_MARKDOWN = [
  '[safe link](https://example.com/ok)',
  '[js link](javascript:alert(1))',
  '[data link](data:text/html,hello)',
  '![tracker](https://cdn.example.com/pixel.png)',
  '![insecure](http://cdn.example.com/insecure.png)',
  '![inline](data:image/png;base64,AAAA)',
].join('\n\n');

/** Opens the first card and replaces its description, ending in preview mode. */
async function renderDescription(page: Page, markdown: string) {
  await gotoBoard(page);
  await page.getByTestId('task-card').first().click();
  const panel = page.getByTestId('side-panel');
  await panel.getByTestId('side-panel-description-preview').click();
  const textarea = panel.getByTestId('side-panel-description');
  await textarea.fill(markdown);
  // Leave edit mode the way a click-away does. (Escape also closes the panel.)
  await textarea.evaluate((el) => (el as HTMLTextAreaElement).blur());
  const preview = panel.getByTestId('side-panel-description-preview');
  await expect(preview).toBeVisible();
  return { panel, preview };
}

test.describe('markdown safety in card descriptions', () => {
  test('unsafe links render as plain text, safe links stay clickable', async ({ page }) => {
    const { preview } = await renderDescription(page, HOSTILE_MARKDOWN);

    await expect(preview.locator('a[href^="javascript:" i]')).toHaveCount(0);
    await expect(preview.locator('a[href^="data:" i]')).toHaveCount(0);

    const safe = preview.getByRole('link', { name: 'safe link' });
    await expect(safe).toHaveAttribute('href', 'https://example.com/ok');
    await expect(safe).toHaveAttribute('target', '_blank');
    await expect(safe).toHaveAttribute('rel', /noopener/);

    // The text survives, just without a link.
    await expect(preview.getByText('js link')).toBeVisible();
    await expect(preview.getByRole('link', { name: 'js link' })).toHaveCount(0);
    await expect(preview.getByRole('link', { name: 'data link' })).toHaveCount(0);
  });

  test('remote images do not load until clicked, and http or data images never do', async ({ page }) => {
    const remoteHits: string[] = [];
    await page.route('https://cdn.example.com/**', (route) => {
      remoteHits.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    });
    await page.route('http://cdn.example.com/**', (route) => {
      remoteHits.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    });

    const { panel, preview } = await renderDescription(page, HOSTILE_MARKDOWN);

    // Nothing fetched, no <img> in the preview yet.
    await page.waitForTimeout(400);
    expect(remoteHits).toEqual([]);
    await expect(preview.locator('img')).toHaveCount(0);

    // https image becomes a click-to-load button naming the host.
    const load = preview.getByRole('button', { name: /Load remote image from cdn\.example\.com/ });
    await expect(load).toBeVisible();

    // http and data images are blocked outright: alt text only, no button.
    await expect(preview.locator('.md-blocked-media')).toHaveText(['insecure', 'inline']);
    await expect(preview.getByRole('button', { name: /Load remote image/ })).toHaveCount(1);

    await load.click();

    // Loading must not bounce the panel into edit mode (the preview is itself
    // a click target), and only the https image is fetched.
    await expect(panel.getByTestId('side-panel-description')).toHaveCount(0);
    const img = preview.locator('img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', 'https://cdn.example.com/pixel.png');
    await expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(remoteHits).toEqual(['https://cdn.example.com/pixel.png']);
  });

  test('the load button works from the keyboard without entering edit mode', async ({ page }) => {
    await page.route('https://cdn.example.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }),
    );
    const { panel, preview } = await renderDescription(
      page,
      '![tracker](https://cdn.example.com/pixel.png)',
    );

    const load = preview.getByRole('button', { name: /Load remote image/ });
    await load.focus();
    await page.keyboard.press('Enter');

    await expect(preview.locator('img')).toHaveCount(1);
    await expect(panel.getByTestId('side-panel-description')).toHaveCount(0);
  });

  test('remote https video is also click-to-load', async ({ page }) => {
    const { preview } = await renderDescription(page, '[demo](https://cdn.example.com/demo.mp4)');
    await expect(preview.locator('video')).toHaveCount(0);
    await expect(
      preview.getByRole('button', { name: /Load remote video from cdn\.example\.com/ }),
    ).toBeVisible();
  });
});
