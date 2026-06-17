import { expect, test } from '@playwright/test';

async function waitForPollHarness(page) {
  await page.goto('/e2e/fixtures/poll-harness.html');
  await page.waitForFunction(() => window.__rpjsPollHarness !== undefined);
}

test.describe('Hub poll options and visualization', () => {
  test('hub can configure duration, multiple-answer voting, and private results before publishing', async ({ page }) => {
    await waitForPollHarness(page);

    await page.locator('#rpjs-hub-poll').click();
    await page.locator('#rpjs-poll-question').fill('Which topics need a deeper pass?');
    await page.locator('.rpjs-poll-answer-input').nth(0).fill('Architecture');
    await page.locator('.rpjs-poll-answer-input').nth(1).fill('Testing');
    await page.locator('#rpjs-poll-timeout').selectOption('30');
    await page.locator('#rpjs-poll-mode-multiple').check();
    await page.locator('#rpjs-poll-share-results').uncheck();

    await page.locator('#rpjs-poll-publish').click();

    const poll = await page.evaluate(() => window.__rpjsPollHarness.calls.find(call => call.type === 'startPoll')?.poll);
    expect(poll).toMatchObject({
      question: 'Which topics need a deeper pass?',
      answers: ['Architecture', 'Testing'],
      timeout: 30,
      mode: 'multiple',
      shareResults: false,
    });
  });

  test('hub aggregates multiple-answer responses and keeps private results local when sharing is disabled', async ({ page }) => {
    await waitForPollHarness(page);

    await page.evaluate(() => {
      window.__rpjsPollHarness.showResults({
        pollId: 'poll-test',
        question: 'Pick improvements',
        answers: ['Visuals', 'Options', 'Speed'],
        mode: 'multiple',
        shareResults: false,
      }, [
        ['peer-1', ['Visuals', 'Options']],
        ['peer-2', ['Visuals']],
      ]);
    });

    await expect(page.locator('.rpjs-poll-results-card')).toBeVisible();
    await expect(page.locator('.rpjs-poll-results-summary')).toContainText('2 voters');
    await expect(page.locator('.rpjs-poll-results-summary')).toContainText('3 selections');
    await expect(page.locator('.rpjs-poll-result-row').nth(0)).toContainText('#1');
    await expect(page.locator('.rpjs-poll-result-row').nth(0)).toContainText('Visuals');
    await expect(page.locator('.rpjs-poll-result-row').nth(0)).toContainText('2 votes');
    await expect(page.locator('.rpjs-poll-result-row').nth(1)).toContainText('Options');
    await expect(page.locator('.rpjs-poll-result-row').nth(1)).toContainText('1 vote');

    const sentResults = await page.evaluate(() => window.__rpjsPollHarness.calls.filter(call => call.type === 'sendPollResults'));
    expect(sentResults).toEqual([]);
  });

  test('result cards expose ranked bars and winner markers for clearer visualization', async ({ page }) => {
    await waitForPollHarness(page);

    await page.evaluate(() => {
      window.__rpjsPollHarness.renderResults({
        pollId: 'poll-results',
        question: 'Best next step?',
        mode: 'single',
        totalResponses: 4,
        totalSelections: 4,
        answers: [
          { text: 'Polish UI', count: 3, percentage: 75, isWinner: true, rank: 1 },
          { text: 'More docs', count: 1, percentage: 25, isWinner: false, rank: 2 },
        ],
      });
    });

    const rows = page.locator('.rpjs-poll-result-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-leading', 'true');
    await expect(rows.nth(0).locator('.rpjs-poll-result-rank')).toHaveText('#1');
    await expect(rows.nth(0).locator('.rpjs-poll-result-winner')).toContainText('Top choice');
    await expect(rows.nth(0).locator('.rpjs-poll-result-bar-fill')).toHaveAttribute('aria-valuenow', '75');
    await expect(rows.nth(0).locator('.rpjs-poll-result-bar-fill')).toHaveCSS('width', /.+/);
  });
});
