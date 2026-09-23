import { expect, test } from '@playwright/test';
import { readZipEntries } from '../src/utils/zip.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('osint-tool:tour-seen', '1');
  });
});

async function createProject(page, projectName = 'Case 0042', targetName = 'Jane Doe') {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill(projectName);
  if (targetName) await page.getByLabel('Target name').fill(targetName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(projectName)).toBeVisible();
}

test('user can create a project from the welcome flow', async ({ page }) => {
  await createProject(page, 'Case 0042', 'Jane Doe');
  await expect(page.getByRole('tab', { name: 'Information' })).toBeVisible();
});

test('a starter template seeds identifiers, and blank starts empty', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Templated');
  await page.getByRole('radio', { name: /Person investigation/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(5);

  await page.getByTestId('back-to-projects-button').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Empty');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(0);
});

test('user can add and remove a manual evidence note', async ({ page }) => {
  await createProject(page, 'Notes case', '');
  await page.getByRole('button', { name: '+ Note' }).click();
  await page.getByLabel('Note title').fill('Seen at cafe');
  await page.getByLabel('Note details').fill('Photo places subject at the cafe.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.locator('.evidence-item')).toHaveCount(1);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Remove evidence: Seen at cafe/ }).click();
  await expect(page.locator('.evidence-item')).toHaveCount(0);
});

test('unsaved indicator appears after edits and clears on save', async ({ page }) => {
  await createProject(page, 'Dirty case', '');
  await expect(page.getByTestId('unsaved-indicator')).toHaveCount(0);
  await page.getByRole('button', { name: '+ Note' }).click();
  await page.getByLabel('Note title').fill('Edit');
  await page.getByLabel('Note details').fill('Something changed.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByTestId('unsaved-indicator')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await download;
  await expect(page.getByTestId('unsaved-indicator')).toHaveCount(0);
});

test('keyboard shortcuts switch tabs, focus search, and open help', async ({ page }) => {
  await createProject(page, 'Keys case', '');
  await expect(page.getByLabel('Search identifiers')).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search identifiers')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByLabel('Search identifiers').blur();

  await page.keyboard.press('Alt+2');
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Search pins')).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search pins')).toBeFocused();
  await page.getByLabel('Search pins').blur();

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
});

test('tidy layout arranges connected nodes and can be undone', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Tidy');
  await page.getByRole('radio', { name: /Person investigation/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  const first = page.locator('.react-flow__node').first();
  await expect(first).toBeVisible();
  const transforms = () =>
    page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((n) => n.style.transform));
  const before = await transforms();
  await page.getByRole('button', { name: 'Tidy layout' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 500 } });
  await expect.poll(transforms).not.toEqual(before);
  await page.keyboard.press('Control+z');
  await expect.poll(transforms).toEqual(before);
});

test('connections can be given a relationship label and undone', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Edges');
  await page.getByRole('radio', { name: /Person investigation/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  const nodes = page.locator('.react-flow__node');
  await expect(nodes).toHaveCount(5);
  await nodes.nth(0).locator('.react-flow__handle-right').dragTo(
    nodes.nth(1).locator('.react-flow__handle-left'),
  );
  const edge = page.locator('.react-flow__edge').first();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await edge.locator('.react-flow__edge-interaction').dispatchEvent('dblclick');
  await page.getByLabel('Label', { exact: true }).fill('associate of');
  await page.getByRole('button', { name: 'Save label' }).click();
  await expect(page.locator('.react-flow__edge-text')).toHaveText('associate of');

  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 500 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__edge-text')).toHaveCount(0);
});

test('map can be filtered by search and re-fit to all pins', async ({ page }) => {
  await createProject(page, 'Pins case', '');
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.getByRole('button', { name: 'Show all pins' })).toHaveCount(0);

  const map = page.locator('.leaflet-container');
  for (const [x, y, label] of [[300, 250, 'Alpha depot'], [600, 400, 'Bravo harbour']]) {
    await map.click({ position: { x, y } });
    await page.locator('#pin-label').fill(label);
    await page.getByRole('button', { name: /Save pin|Save changes/i }).click();
    await expect(page.locator('#pin-label')).toHaveCount(0);
  }
  await expect(page.locator('.pin-list > li')).toHaveCount(2);

  await page.getByLabel('Search pins').fill('bravo');
  await expect(page.locator('.pin-list > li')).toHaveCount(1);
  await page.getByLabel('Search pins').fill('zzz');
  await expect(page.getByText('No matching pins.')).toBeVisible();
  await page.getByLabel('Search pins').fill('');

  await page.getByRole('button', { name: 'Show all pins' }).click();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
});

test('export menu downloads CSV data', async ({ page }) => {
  await createProject(page, 'Export case', '');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: 'Email' }).first().click();
  await page.locator('#field-address').fill('jane@example.com');
  await page.getByRole('button', { name: 'Add identifier' }).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(1);

  await page.getByTestId('export-case-report-button').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-identifiers-csv').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('export_case-identifiers.csv');
  const path = await file.path();
  const text = (await import('node:fs')).readFileSync(path, 'utf8');
  expect(text).toContain('Type,Label,Details');
  expect(text).toContain('jane@example.com');
  await expect(page.getByTestId('export-identifiers-csv')).toHaveCount(0);
});

test('adding a duplicate email shows a non-blocking warning', async ({ page }) => {
  await createProject(page, 'Dupes', '');
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: '+ Add' }).click();
    await page.getByRole('button', { name: 'Email' }).first().click();
    await page.locator('#field-address').fill('same@example.com');
    if (i === 1) await expect(page.getByTestId('duplicate-notice')).toBeVisible();
    else await expect(page.getByTestId('duplicate-notice')).toHaveCount(0);
    await page.getByRole('button', { name: 'Add identifier' }).click();
  }
  await expect(page.locator('.identifier-list > li')).toHaveCount(2);
});

test('evidence can be filtered once there are several entries', async ({ page }) => {
  await createProject(page, 'Evidence filter', '');
  await expect(page.getByLabel('Filter evidence')).toHaveCount(0);
  for (const [title, text] of [['Alpha', 'first thing'], ['Bravo', 'second thing'], ['Charlie', 'third thing']]) {
    await page.getByRole('button', { name: '+ Note' }).click();
    await page.getByLabel('Note title').fill(title);
    await page.getByLabel('Note details').fill(text);
    await page.getByRole('button', { name: 'Add note' }).click();
  }
  await expect(page.locator('.evidence-item')).toHaveCount(3);
  await page.getByLabel('Filter evidence').fill('bravo');
  await expect(page.locator('.evidence-item')).toHaveCount(1);
  await page.getByLabel('Filter evidence').fill('zzz');
  await expect(page.getByText('No matching evidence.')).toBeVisible();
});

test('identifiers can be imported from CSV, skipping duplicates, and undone', async ({ page }) => {
  await createProject(page, 'Import case', '');
  await expect(page.getByLabel('Search identifiers')).toBeVisible();
  const csv = [
    'Type,Value,Notes',
    'Email,jane@example.com,personal',
    'Phone,+1 555 010 2030,',
    'Instagram,@janedoe,',
    'Email,JANE@example.com,duplicate',
  ].join('\n');
  await page.getByTestId('identifier-csv-input').setInputFiles({
    name: 'people.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Imported 3 identifiers' })).toContainText('1 duplicate skipped');
  await expect(page.locator('.identifier-list > li')).toHaveCount(3);

  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 500 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('.identifier-list > li')).toHaveCount(0);
});

test('identifier rows link to related evidence', async ({ page }) => {
  await createProject(page, 'Evidence links', '');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).first().click();
  await page.locator('#field-fullName').fill('Jane Doe');
  await page.getByRole('button', { name: 'Add identifier' }).click();

  for (const [title, text] of [
    ['Registry hit', 'Jane Doe listed as a director'],
    ['Unrelated', 'Nothing relevant'],
    ['Another', 'Also nothing'],
  ]) {
    await page.getByRole('button', { name: '+ Note' }).click();
    await page.getByLabel('Note title').fill(title);
    await page.getByLabel('Note details').fill(text);
    await page.getByRole('button', { name: 'Add note' }).click();
  }
  await expect(page.locator('.evidence-item')).toHaveCount(3);

  await page.getByRole('button', { name: '1 evidence' }).click();
  await expect(page.locator('.evidence-item')).toHaveCount(1);
  await expect(page.getByText('Evidence for Jane Doe')).toBeVisible();
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.locator('.evidence-item')).toHaveCount(3);
});

test('pins can be reordered by dragging, sorted, and keep stable numbers when searching', async ({ page }) => {
  await createProject(page, 'Pin order', '');
  await page.getByRole('tab', { name: 'Map' }).click();
  const map = page.locator('.leaflet-container');
  for (const [x, y, label] of [[300, 250, 'Zulu depot'], [500, 350, 'Alpha harbour']]) {
    await map.click({ position: { x, y } });
    await page.locator('#pin-label').fill(label);
    await page.getByRole('button', { name: /Save pin|Save changes/i }).click();
    await expect(page.locator('#pin-label')).toHaveCount(0);
  }
  const labels = () => page.locator('.pin-list .pin-label').allTextContents();
  const numbers = () => page.locator('.pin-list .pin-index').allTextContents();
  expect(await labels()).toEqual(['Zulu depot', 'Alpha harbour']);

  await page.locator('.pin-list > li').nth(1).dragTo(page.locator('.pin-list > li').nth(0));
  await expect.poll(labels).toEqual(['Alpha harbour', 'Zulu depot']);
  expect(await numbers()).toEqual(['1', '2']);

  await page.getByLabel('Sort pins').selectOption('name');
  await page.getByLabel('Search pins').fill('zulu');
  await expect.poll(numbers).toEqual(['2']);
});

test('sidebar collapses on phone-width screens and expands on demand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await createProject(page, 'Phone case', '');
  await expect(page.getByLabel('Search identifiers')).toBeHidden();

  await page.getByRole('button', { name: 'Show identifiers list' }).click();
  await expect(page.getByLabel('Search identifiers')).toBeVisible();
  await page.getByRole('button', { name: 'Hide identifiers list' }).click();
  await expect(page.getByLabel('Search identifiers')).toBeHidden();

  await page.keyboard.press('/');
  await expect(page.getByLabel('Search identifiers')).toBeFocused();

  await page.getByRole('tab', { name: 'Map' }).click();
  const map = page.locator('.leaflet-container');
  await expect(map).toBeVisible();
  const collapsedHeight = (await map.boundingBox()).height;
  await page.getByRole('button', { name: 'Show locations list' }).click();
  await expect.poll(async () => (await map.boundingBox()).height).toBeLessThan(collapsedHeight);
});

test('a project file can be dropped onto the landing page to open it', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await expect(page.getByTestId('new-project-button')).toBeVisible();

  const makeTransfer = (name, content, type) =>
    page.evaluateHandle(
      ([fileName, body, mime]) => {
        const dt = new DataTransfer();
        dt.items.add(new File([body], fileName, { type: mime }));
        return dt;
      },
      [name, content, type],
    );

  const notProject = await makeTransfer('notes.txt', 'hello', 'text/plain');
  await page.dispatchEvent('.landing', 'dragenter', { dataTransfer: notProject });
  await expect(page.getByTestId('drop-overlay')).toBeVisible();
  await page.dispatchEvent('.landing', 'drop', { dataTransfer: notProject });
  await expect(page.getByTestId('drop-overlay')).toHaveCount(0);
  await expect(page.getByText(/drop a \.json project file/i)).toBeVisible();

  const project = await makeTransfer('dropped.osint.json', JSON.stringify({ name: 'Dropped case' }), 'application/json');
  await page.dispatchEvent('.landing', 'dragenter', { dataTransfer: project });
  await page.dispatchEvent('.landing', 'drop', { dataTransfer: project });
  await expect(page.getByText('Dropped case')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Information' })).toBeVisible();
});

test('case report can be exported as printable HTML with escaped content', async ({ page }) => {
  await createProject(page, 'Report <b>case</b>', '');
  await page.getByTestId('export-case-report-button').click();
  await expect(page.getByTestId('export-report-print')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-report-html').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-case-report\.html$/);
  const html = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(html).toContain('Report &lt;b&gt;case&lt;/b&gt;');
  expect(html).not.toContain('<b>case</b>');
  expect(html).toContain('@media print');

  await page.getByTestId('export-case-report-button').click();
  await page.getByTestId('export-report-print').click();
  await expect(page.locator('iframe[aria-hidden="true"]')).toHaveCount(1);
});

test('identifiers can be duplicated and deleted in bulk, with a single undo', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Bulk');
  await page.getByRole('radio', { name: /Person investigation/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  const rows = page.locator('.identifier-list > li');
  await expect(rows).toHaveCount(5);

  await page.getByTestId('select-mode-toggle').click();
  await rows.nth(0).click();
  await rows.nth(1).click();
  await expect(page.getByTestId('bulk-count')).toHaveText('2 selected');
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(rows).toHaveCount(7);
  await expect(page.getByTestId('bulk-count')).toHaveCount(0);

  await page.getByTestId('select-mode-toggle').click();
  await rows.nth(2).click();
  await rows.nth(3).click();
  await rows.nth(4).click();
  await expect(page.getByTestId('bulk-count')).toHaveText('3 selected');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(rows).toHaveCount(4);

  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 500 } });
  await page.keyboard.press('Control+z');
  await expect(rows).toHaveCount(7);
});

test('evidence source links can be copied to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await createProject(page, 'Copy link', '');
  await page.getByRole('button', { name: '+ Note' }).click();
  await page.getByLabel('Note title').fill('Story');
  await page.getByLabel('Note details').fill('Coverage of the case');
  await page.getByLabel('Note source URL').fill('https://example.com/story?id=7');
  await page.getByRole('button', { name: 'Add note' }).click();

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://example.com/story?id=7');
});

test('identifiers can carry tags and a colour label that persist and filter the list', async ({ page }) => {
  await createProject(page, 'Labels', '');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).first().click();
  await page.locator('#field-fullName').fill('Jane Doe');
  await page.locator('#field-tags').fill('family, Courier, family');
  await page.getByRole('radio', { name: 'Colour Blue' }).click();
  await page.getByRole('button', { name: 'Add identifier' }).click();

  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).first().click();
  await page.locator('#field-fullName').fill('Bob Smith');
  await page.getByRole('button', { name: 'Add identifier' }).click();

  const rows = page.locator('.identifier-list > li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.tag-chip')).toHaveText(['family', 'Courier']);
  await expect(page.locator('.react-flow__node').first().locator('.id-node')).toHaveCSS('border-left-width', '5px');

  await page.locator('.label-filter').getByRole('button', { name: /^family/ }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Filter by colour Blue').click();
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Filter by colour Blue').click();

  await page.getByLabel('Search identifiers').fill('courier');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Search identifiers').fill('');

  await rows.first().click();
  await expect(page.locator('#field-tags')).toHaveValue('family, Courier');
  await expect(page.getByRole('radio', { name: 'Colour Blue' })).toHaveAttribute('aria-checked', 'true');
});

test('a group can be tagged and coloured in bulk, filtered, and undone', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Groups');
  await page.getByRole('radio', { name: /Person investigation/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  const rows = page.locator('.identifier-list > li');
  await expect(rows).toHaveCount(5);

  await page.getByTestId('select-mode-toggle').click();
  for (const i of [0, 1, 2]) await rows.nth(i).click();
  await page.getByRole('button', { name: 'Label', exact: true }).click();
  await page.getByLabel('Tag name').fill('group-a');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await page.getByLabel('Set colour Red for selection').click();
  await expect(rows.first()).toHaveCSS('box-shadow', /rgb\(239, 68, 68\)/);
  await expect(page.locator('.label-filter').getByRole('button', { name: /^group-a 3/ })).toBeVisible();

  await page.locator('.label-filter').getByRole('button', { name: /^group-a 3/ }).click();
  await expect(rows).toHaveCount(3);
  await page.getByRole('button', { name: /^All shown/ }).click();
  await expect(page.getByTestId('bulk-count')).toHaveText('3 selected');

  await page.getByLabel('Tag name').fill('group-a');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.label-filter').getByRole('button', { name: /^group-a/ })).toHaveCount(0);
  await expect(rows).toHaveCount(5);

  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 500 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('.label-filter').getByRole('button', { name: /^group-a 3/ })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(rows.first()).not.toHaveCSS('box-shadow', /rgb\(239, 68, 68\)/);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.label-filter').getByRole('button', { name: /^group-a/ })).toHaveCount(0);
});

test('an identifier and its evidence can be saved as a dossier report', async ({ page }) => {
  await createProject(page, 'Dossier', '');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).first().click();
  await page.locator('#field-fullName').fill('Jane Doe');
  await page.getByRole('button', { name: 'Add identifier' }).click();
  for (const [title, text] of [['Registry hit', 'Jane Doe is a director'], ['Other', 'Unrelated news']]) {
    await page.getByRole('button', { name: '+ Note' }).click();
    await page.getByLabel('Note title').fill(title);
    await page.getByLabel('Note details').fill(text);
    await page.getByRole('button', { name: 'Add note' }).click();
  }

  await page.getByRole('button', { name: '1 evidence' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('save-dossier').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('dossier-jane_doe-dossier.md');
  const text = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(text).toContain('# Identifier dossier: Jane Doe (Name)');
  expect(text).toContain('Jane Doe is a director');
  expect(text).not.toContain('Unrelated news');

  await page.getByRole('button', { name: 'Print' }).click();
  await expect(page.locator('iframe[aria-hidden="true"]')).toHaveCount(1);
});

test('first-run tour walks through the app once and can be replayed', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem('osint-tool:tour-seen'));
  await createProject(page, 'Tour case', '');

  const tour = page.getByRole('dialog', { name: 'Quick tour' });
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('1 of 5');
  await expect(tour).toContainText('Your identifiers');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Connect the dots');
  await tour.getByRole('button', { name: 'Back' }).click();
  await expect(tour).toContainText('Your identifiers');

  // The page stays usable while the tour is open.
  await page.getByLabel('Search identifiers').fill('abc');
  await page.getByLabel('Search identifiers').fill('');

  for (let i = 0; i < 4; i += 1) await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('5 of 5');
  await tour.getByRole('button', { name: 'Finish' }).click();
  await expect(tour).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('osint-tool:tour-seen'))).toBe('1');

  await page.keyboard.press('?');
  await page.getByRole('button', { name: 'Replay tour' }).click();
  await expect(tour).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
});

test('the tour is skipped for good and adapts to phone-width screens', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem('osint-tool:tour-seen'));
  await page.setViewportSize({ width: 390, height: 780 });
  await createProject(page, 'Phone tour', '');
  const tour = page.getByRole('dialog', { name: 'Quick tour' });
  await expect(tour).toBeVisible();
  for (let i = 0; i < 4; i += 1) await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Shortcuts');
  const box = await tour.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await tour.getByRole('button', { name: 'Skip tour' }).click();
  await expect(tour).toHaveCount(0);

  await page.getByTestId('back-to-projects-button').click();
  await page.getByTestId('new-project-button').click();
  await page.getByLabel('Project name').fill('Second');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Search identifiers')).toBeAttached();
  await expect(page.getByRole('dialog', { name: 'Quick tour' })).toHaveCount(0);
});

async function importTagged(page, name) {
  await createProject(page, name, '');
  await expect(page.getByLabel('Search identifiers')).toBeVisible();
  const csv = ['Type,Value,Tags', 'Email,a@x.com,family', 'Email,b@x.com,work', 'Email,c@x.com,'].join('\n');
  await page.getByTestId('identifier-csv-input').setInputFiles({
    name: 'tagged.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.locator('.identifier-list > li')).toHaveCount(3);
}

test('canvas tag chips filter the list and dim non-matching nodes', async ({ page }) => {
  await importTagged(page, 'Dimming');
  const dimmed = page.locator('.id-node.dimmed');
  await expect(dimmed).toHaveCount(0);

  await page.locator('.id-node').getByRole('button', { name: 'family' }).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(1);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(dimmed).toHaveCount(2);

  await page.locator('.id-node').getByRole('button', { name: 'family' }).click();
  await expect(dimmed).toHaveCount(0);

  await page.getByLabel('Search identifiers').fill('b@x');
  await expect(dimmed).toHaveCount(2);
});

test('filters can be saved as views, stored in the project file, and deleted', async ({ page }) => {
  await importTagged(page, 'Views');
  await expect(page.getByRole('button', { name: 'Save view' })).toHaveCount(0);

  await page.locator('.label-filter').getByRole('button', { name: /^family/ }).click();
  await page.getByRole('button', { name: 'Save view' }).click();
  await page.getByLabel('View name').fill('Family only');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();

  const view = page.locator('.preset-chip', { hasText: 'Family only' });
  await expect(view).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(3);
  await expect(view).not.toHaveClass(/active/);

  await view.getByRole('button', { name: 'Family only', exact: true }).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(1);
  await expect(view).toHaveClass(/active/);

  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const file = await download;
  const saved = JSON.parse((await import('node:fs')).readFileSync(await file.path(), 'utf8'));
  expect(saved.filterPresets).toHaveLength(1);
  expect(saved.filterPresets[0]).toMatchObject({ name: 'Family only', tag: 'family', query: '' });

  await page.getByRole('button', { name: 'Delete view Family only' }).click();
  await expect(view).toHaveCount(0);
});

test('the identifier list can be grouped by tag with collapsible groups', async ({ page }) => {
  await importTagged(page, 'Groups');
  await page.getByRole('button', { name: 'Group by tag' }).click();
  const headers = page.locator('.identifier-group-header');
  await expect(headers).toHaveCount(3);
  await expect(headers.nth(0)).toContainText('family');
  await expect(headers.nth(2)).toContainText('Untagged');
  await expect(page.locator('.identifier-list > li')).toHaveCount(3);

  await headers.nth(0).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(2);
  await headers.nth(0).click();
  await expect(page.locator('.identifier-list > li')).toHaveCount(3);

  await page.getByRole('button', { name: 'Group by tag' }).click();
  await expect(headers).toHaveCount(0);
});

test('reports can be grouped by tag from the export menu', async ({ page }) => {
  await createProject(page, 'Plain', '');
  await page.getByTestId('export-case-report-button').click();
  await expect(page.getByLabel('Group reports by')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/');
  await importTagged(page, 'Grouped report');
  await page.getByTestId('export-case-report-button').click();
  await page.getByLabel('Group reports by').selectOption('tag');
  const download = page.waitForEvent('download');
  await page.getByTestId('export-report').click();
  const file = await download;
  const text = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(text).toContain('### family (1)');
  expect(text).toContain('### work (1)');
  expect(text).toContain('### Untagged (1)');
});

const NOW_ISO = '2025-01-15T12:00:00.000Z';

function labelledProject(name = 'Labelled') {
  const person = (id, fullName, tags, color) => ({
    id, type: 'name', fields: { fullName }, notes: '', tags, color, position: { x: 60, y: 60 },
    customIconId: null, createdAt: NOW_ISO, updatedAt: NOW_ISO,
  });
  const pin = (id, label, lat, lng) => ({
    id, label, address: label, lat, lng, placeId: null, visitedAt: '', withWho: '', notes: '',
    color: 'red', iconId: null, createdAt: NOW_ISO, updatedAt: NOW_ISO,
  });
  return {
    schemaVersion: 1, id: `proj-${name}`, name, createdAt: NOW_ISO, updatedAt: NOW_ISO,
    target: { name: '', notes: '' },
    identifiers: [person('a', 'Ann Lee', ['family'], 'blue'), person('b', 'Bob Roy', ['work'], 'orange')],
    connections: [],
    locations: [pin('p1', 'Dublin', 53.3498, -6.2603), pin('p2', 'Dubai', 25.2048, 55.2708), pin('p3', 'Oslo', 59.91, 10.75)],
    pinLinks: [
      { id: 'l1', pinId: 'p1', identifierId: 'a', context: '', createdAt: NOW_ISO },
      { id: 'l2', pinId: 'p2', identifierId: 'b', context: '', createdAt: NOW_ISO },
    ],
    evidence: [],
    mapDisplay: { showPinConnections: false, pinConnectionColor: '#ef4444' },
  };
}

async function openProjectObject(page, project) {
  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('project-file-input').setInputFiles({
    name: `${project.name}.osint.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel('Search identifiers')).toBeVisible();
}

test('map pins can be filtered by the labels of their linked identifiers', async ({ page }) => {
  await openProjectObject(page, labelledProject());
  await page.getByRole('tab', { name: 'Map' }).click();
  const list = page.locator('.pin-list > li');
  await expect(list).toHaveCount(3);

  const filter = page.locator('.pin-label-filter');
  await filter.getByRole('button', { name: /^family/ }).click();
  await expect(list).toHaveCount(1);
  await expect(list.first()).toContainText('Dublin');
  await expect(page.locator('.leaflet-marker-icon[style*="opacity: 0.25"]')).toHaveCount(2);

  await filter.getByRole('button', { name: 'Clear' }).click();
  await expect(list).toHaveCount(3);
  await filter.getByLabel('Show pins linked to Orange identifiers').click();
  await expect(list).toHaveCount(1);
  await expect(list.first()).toContainText('Dubai');

  await filter.getByLabel('Show pins linked to Orange identifiers').click();
  await filter.getByRole('button', { name: /^family/ }).click();
  await page.getByRole('button', { name: 'Show all pins' }).click();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
});

test('saved views can be exported and imported into another project', async ({ page }) => {
  const source = labelledProject('Source');
  source.filterPresets = [
    { id: 'v1', name: 'Family only', query: '', tag: 'family', color: null },
    { id: 'v2', name: 'Orange', query: 'roy', tag: null, color: 'orange' },
  ];
  await openProjectObject(page, source);
  await page.getByTestId('export-case-report-button').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-views-json').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('source-views.json');
  const exported = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(JSON.parse(exported).views).toHaveLength(2);

  await page.getByTestId('back-to-projects-button').click();
  await createProject(page, 'Target', '');
  await expect(page.locator('.preset-chip')).toHaveCount(0);
  await page.getByTestId('identifier-csv-input').setInputFiles({
    name: 'source-views.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Imported 2 saved views' })).toBeVisible();
  await expect(page.locator('.preset-chip')).toHaveCount(2);

  await page.getByTestId('identifier-csv-input').setInputFiles({
    name: 'source-views.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  });
  await expect(page.getByRole('status').filter({ hasText: '2 replaced' })).toBeVisible();
  await expect(page.locator('.preset-chip')).toHaveCount(2);

  await page.getByTestId('identifier-csv-input').setInputFiles({
    name: 'nope.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(page.getByRole('status').filter({ hasText: 'not a saved-views export' })).toBeVisible();
});

test('a report bundle zip can be downloaded and contains the report and data', async ({ page }) => {
  const project = labelledProject('Bundle case');
  project.evidence = [
    { id: 'e1', title: 'Registry hit', subtitle: '', text: 'Ann Lee is a director', source: 'Registry', sourceUrl: '', context: '', createdAt: NOW_ISO },
  ];
  await openProjectObject(page, project);

  await page.getByTestId('export-case-report-button').click();
  await page.getByTestId('export-bundle-zip').click();
  await expect(page.getByRole('dialog', { name: 'Report bundle' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('download-bundle').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('bundle_case-bundle.zip');

  const entries = readZipEntries(new Uint8Array((await import('node:fs')).readFileSync(await file.path())));
  const names = entries.map((e) => e.name);
  expect(names).toEqual(expect.arrayContaining([
    'README.txt', 'case-report.html', 'case-report.md', 'identifiers.csv', 'locations.csv',
    'evidence.csv', 'project.osint.json',
  ]));
  expect(names.some((n) => n.startsWith('dossiers/') && n.includes('ann_lee'))).toBe(true);
  const text = (name) => new TextDecoder().decode(entries.find((e) => e.name === name).data);
  expect(text('case-report.md')).toContain('Ann Lee');
  expect(JSON.parse(text('project.osint.json')).identifiers).toHaveLength(2);
});

test('two project files can be compared, swapped, and the diff downloaded', async ({ page }) => {
  const earlier = labelledProject('Case v1');
  const later = labelledProject('Case v2');
  later.identifiers = [
    { ...later.identifiers[0], notes: 'updated notes', tags: ['family', 'courier'] },
    later.identifiers[1],
    { id: 'c', type: 'name', fields: { fullName: 'Cy New' }, notes: '', tags: [], color: null, position: { x: 1, y: 1 }, customIconId: null, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  ];
  later.locations = later.locations.filter((l) => l.id !== 'p3');

  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('compare-projects-button').click();
  const dialog = page.getByRole('dialog', { name: 'Compare two projects' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Download comparison (.md)' })).toBeDisabled();

  const asFile = (project) => ({
    name: `${project.name}.osint.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByTestId('compare-file-before').setInputFiles(asFile(earlier));
  await expect(dialog).toContainText('Case v1');
  await page.getByTestId('compare-file-after').setInputFiles(asFile(later));

  const results = page.getByTestId('compare-results');
  await expect(results.getByTestId('compare-identifiers')).toContainText('Cy New');
  await expect(results.getByTestId('compare-identifiers')).toContainText('Tags: +courier');
  await expect(results.getByTestId('compare-identifiers')).toContainText('Notes changed');
  await expect(results.getByTestId('compare-locations')).toContainText('Oslo');
  await expect(results).toContainText('Project name: "Case v1" \u2192 "Case v2"');

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download comparison (.md)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('project-comparison.md');
  const md = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(md).toContain('## Identifiers');
  expect(md).toContain('+ Cy New (Name)');

  await dialog.getByRole('button', { name: 'Swap earlier and later' }).click();
  await expect(results.getByTestId('compare-identifiers')).toContainText('Cy New');
  await expect(results.locator('li.removed', { hasText: 'Cy New' })).toHaveCount(1);

  await page.getByTestId('compare-file-before').setInputFiles(asFile(earlier));
  await expect(results).toContainText('No differences found');

  await page.getByTestId('compare-file-after').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('[1,2]') });
  await expect(dialog).toContainText('Could not read bad.json');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('bundle contents can be chosen, and the choice is remembered', async ({ page }) => {
  const project = labelledProject('Pick case');
  project.evidence = [
    { id: 'e1', title: 'Registry hit', subtitle: '', text: 'Ann Lee is a director', source: 'Registry', sourceUrl: '', context: '', createdAt: NOW_ISO },
  ];
  await openProjectObject(page, project);

  const openBundle = async () => {
    await page.getByTestId('export-case-report-button').click();
    await page.getByTestId('export-bundle-zip').click();
    return page.getByRole('dialog', { name: 'Report bundle' });
  };
  let dialog = await openBundle();
  await expect(dialog.getByRole('checkbox', { name: /Saved views/ })).toBeDisabled();
  await expect(dialog.getByRole('checkbox', { name: /Identifier dossiers \(1\)/ })).toBeChecked();

  for (const name of [/Styled report/, /Identifiers spreadsheet/, /Locations spreadsheet/, /Identifier dossiers/, /Full project file/]) {
    await dialog.getByRole('checkbox', { name }).uncheck();
  }
  await expect(dialog.getByTestId('download-bundle')).toBeEnabled();
  const download = page.waitForEvent('download');
  await dialog.getByTestId('download-bundle').click();
  const file = await download;
  const entries = readZipEntries(new Uint8Array((await import('node:fs')).readFileSync(await file.path())));
  expect(entries.map((e) => e.name).sort()).toEqual(['README.txt', 'case-report.md', 'evidence.csv']);
  const readme = new TextDecoder().decode(entries.find((e) => e.name === 'README.txt').data);
  expect(readme).toContain('evidence.csv');
  expect(readme).not.toContain('project.osint.json');

  dialog = await openBundle();
  await expect(dialog.getByRole('checkbox', { name: /Styled report/ })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /Markdown report/ })).toBeChecked();
  for (const name of [/Markdown report/, /Evidence spreadsheet/]) await dialog.getByRole('checkbox', { name }).uncheck();
  await expect(dialog.getByTestId('download-bundle')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('a report bundle zip can be reopened as a project and compared', async ({ page }) => {
  const { buildReportBundleZip } = await import('../src/utils/bundle.js');
  const source = labelledProject('From bundle');
  const zip = Buffer.from(buildReportBundleZip(source));

  await page.goto('/');
  await page.getByTestId('welcome-provider-osm').click();
  await page.getByTestId('project-file-input').setInputFiles({ name: 'from-bundle-bundle.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByLabel('Search identifiers')).toBeVisible();
  await expect(page.locator('.identifier-list > li')).toHaveCount(2);

  await page.getByTestId('back-to-projects-button').click();
  await page.getByTestId('compare-projects-button').click();
  const dialog = page.getByRole('dialog', { name: 'Compare two projects' });
  await page.getByTestId('compare-file-before').setInputFiles({ name: 'bundle.zip', mimeType: 'application/zip', buffer: zip });
  await page.getByTestId('compare-file-after').setInputFiles({
    name: 'plain.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  });
  await expect(dialog.getByTestId('compare-results')).toContainText('No differences found');

  await page.getByTestId('compare-file-after').setInputFiles({
    name: 'other.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from((await import('../src/utils/zip.js')).createZip([{ name: 'note.txt', content: 'hi' }])),
  });
  await expect(dialog).toContainText('not a report bundle');
});

test('changes from a file can be merged into the open project, then undone', async ({ page }) => {
  const mine = labelledProject('Working copy');
  const theirs = labelledProject('Colleague copy');
  theirs.identifiers = [
    { ...theirs.identifiers[0], notes: 'colleague edit', tags: ['family', 'courier'] },
    theirs.identifiers[1],
    { id: 'c', type: 'name', fields: { fullName: 'Cy New' }, notes: '', tags: ['work'], color: null, position: { x: 1, y: 1 }, customIconId: null, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  ];
  theirs.evidence = [{ id: 'e9', title: 'Colleague note', subtitle: '', text: 'found something', source: 'Analyst', sourceUrl: '', context: '', createdAt: NOW_ISO }];
  theirs.connections = [{ id: 'cn1', source: 'a', target: 'c', label: 'works with' }];
  await openProjectObject(page, mine);
  await expect(page.locator('.identifier-list > li')).toHaveCount(2);

  await page.getByTestId('export-case-report-button').click();
  await page.getByTestId('export-compare').click();
  const dialog = page.getByRole('dialog', { name: 'Compare or merge with a file' });
  await expect(dialog.getByTestId('compare-open-project')).toContainText('Working copy');
  await expect(dialog.getByTestId('merge-panel')).toHaveCount(0);

  await dialog.getByTestId('compare-file-before').setInputFiles({
    name: 'colleague.osint.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(theirs)),
  });
  await expect(dialog.getByTestId('compare-identifiers')).toContainText('Cy New');
  await expect(dialog.getByLabel('Direction')).not.toContainText('\\u2192');
  await expect(dialog.getByTestId('compare-identifiers').locator('li.added', { hasText: 'Cy New' })).toHaveCount(1);
  await dialog.getByLabel('Direction').selectOption('fromFile');
  await expect(dialog.getByTestId('compare-identifiers').locator('li.removed', { hasText: 'Cy New' })).toHaveCount(1);
  await dialog.getByLabel('Direction').selectOption('toFile');
  const panel = dialog.getByTestId('merge-panel');
  await expect(panel).toContainText('Add new identifiers (1)');
  await expect(panel.getByRole('checkbox', { name: /Overwrite my copies/ })).not.toBeChecked();
  await expect(dialog.getByTestId('merge-button')).toHaveText('Merge 3 changes into open project');

  await panel.getByRole('checkbox', { name: /Add new evidence/ }).uncheck();
  await expect(dialog.getByTestId('merge-button')).toHaveText('Merge 2 changes into open project');
  await panel.getByRole('checkbox', { name: /Add new evidence/ }).check();

  await dialog.getByTestId('merge-button').click();
  await expect(dialog).toHaveCount(0);
  const banner = page.getByTestId('merge-banner');
  await expect(banner).toContainText('+1 identifier, +1 connection, +1 evidence entry');
  await expect(page.locator('.identifier-list > li')).toHaveCount(3);
  await expect(page.locator('.evidence-item')).toHaveCount(1);
  await expect(page.getByTestId('unsaved-indicator')).toBeVisible();

  await banner.getByRole('button', { name: 'Undo' }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.locator('.identifier-list > li')).toHaveCount(2);
  await expect(page.locator('.evidence-item')).toHaveCount(0);

  // A second merge, this time applying the colleague's edits, then a later edit removes the undo offer.
  await page.getByTestId('export-case-report-button').click();
  await page.getByTestId('export-compare').click();
  await page.getByTestId('compare-file-before').setInputFiles({
    name: 'colleague.osint.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(theirs)),
  });
  const again = page.getByRole('dialog', { name: 'Compare or merge with a file' });
  await again.getByRole('checkbox', { name: /Overwrite my copies/ }).check();
  await again.getByTestId('merge-button').click();
  await expect(page.locator('.identifier-list > li').first().locator('.tag-chip')).toHaveText(['family', 'courier']);
  await expect(page.getByTestId('merge-banner')).toBeVisible();
  await page.getByRole('button', { name: '+ Note' }).click();
  await page.getByLabel('Note title').fill('Later edit');
  await page.getByLabel('Note details').fill('made after the merge');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByTestId('merge-banner')).toHaveCount(0);
});

test('user can return from a project to the landing screen', async ({ page }) => {
  await createProject(page, 'Case 0050', 'John Doe');
  await page.getByTestId('back-to-projects-button').click();
  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
});

test('user can save, reopen, and resume a project', async ({ page }) => {
  const projectName = 'Case 0060';
  await createProject(page, projectName, 'Alice Smith');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-project-button').click(),
  ]);

  await expect(download.suggestedFilename()).toContain('.osint.json');

  await page.getByTestId('back-to-projects-button').click();
  await expect(page.getByText(projectName)).toBeVisible();

  const resumeButton = page
    .locator('.landing-recent-item')
    .filter({ has: page.getByText(projectName, { exact: true }) });

  await resumeButton.click();
  await expect(page.getByText(projectName)).toBeVisible();

  await page.getByTestId('back-to-projects-button').click();
  await page.getByTestId('open-project-button').click();

  const fileInput = page.getByTestId('project-file-input');
  await fileInput.setInputFiles({
    name: `${projectName}.osint.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      name: projectName,
      target: { name: 'Alice Smith', notes: '' },
      identifiers: [],
      connections: [],
      locations: [],
      pinLinks: [],
      mapDisplay: { showPinConnections: false, pinConnectionColor: '#ef4444' },
    })),
  });

  await expect(page.getByText(projectName)).toBeVisible();
});

test('user can create an identifier and connect it to a pin', async ({ page }) => {
  await createProject(page, 'Case 0070', 'Taylor Stone');

  await page.getByTestId('add-identifier-button').click();
  await page.getByRole('button', { name: /Instagram/i }).click();
  await page.getByLabel('Username').fill('@taylors');
  await page.getByRole('button', { name: 'Add identifier' }).click();

  await expect(page.locator('.identifier-item')).toContainText('@taylors');

  await page.getByRole('tab', { name: 'Map' }).click();
  await page.locator('.leaflet-container').click({ position: { x: 250, y: 250 } });

  await page.getByTestId('link-identifier-button').click();
  await page.getByRole('button', { name: /@taylors/i }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('save-pin-button').click();

  await expect(page.getByTestId('save-pin-button')).toHaveCount(0);
  await page.locator('.pin-item').first().click();
  await expect(page.locator('.modal')).toContainText('@taylors');
});
