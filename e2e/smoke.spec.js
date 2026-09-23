import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
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
