import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../readme_images', import.meta.url));
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

async function createProject(projectName, targetName) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  try {
    await page.getByTestId('welcome-provider-osm').click({ timeout: 4000 });
  } catch {
    // already selected or app is in project mode
  }

  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project name').fill(projectName);
  await page.getByLabel('Target name').fill(targetName);
  await page.getByRole('button', { name: /^Create$/i }).click();
  await page.waitForTimeout(1200);
}

async function addIdentifier(fullName, aliases) {
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).click();
  await page.locator('#field-fullName').fill(fullName);
  await page.locator('#field-aliases').fill(aliases);
  await page.getByRole('button', { name: 'Add identifier' }).click();
  await page.waitForTimeout(500);
}

async function addPinAt(x, y, label, address, notes) {
  const map = page.locator('.leaflet-container');
  await map.click({ position: { x, y } });
  await page.locator('#pin-label').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#pin-label').fill(label);
  await page.locator('#pin-address').fill(address);
  await page.locator('#pin-notes').fill(notes);
  await page.getByRole('button', { name: 'Save pin' }).click();
  await page.waitForTimeout(700);
}

await createProject('Kinahan Family Demo', 'Kinahan network — Dublin / Dubai / Marbella / Liverpool');

await addIdentifier('Christy Kinahan', 'Kinahan family leadership');
await addIdentifier('Daniel Kinahan', 'Boxing, logistics, and influence');
await addIdentifier('Sean McGovern', 'Communications and facilitation');
await addIdentifier('Johnny Morrissey', 'Marbella network and laundering');
await addIdentifier('Thomas McMahon', 'UK enforcer and logistics conduit');

await page.screenshot({ path: `${outDir}/Example3.png`, fullPage: true });

await page.getByRole('tab', { name: 'Map' }).click();
await page.waitForTimeout(1200);

await addPinAt(640, 310, 'Dublin — Irish logistics base', 'Dublin, County Dublin, Ireland', 'Irish legal and operational hub linked to family logistics and communications.');
await addPinAt(960, 420, 'Dubai — international transit hub', 'Dubai, United Arab Emirates', 'Regional relocation and business nexus tied to mobility and financial operations.');
await addPinAt(805, 535, 'Marbella — property and laundering node', 'Marbella, Andalusia, Spain', 'Property and business interests aligned with laundering, mobility, and strategic network layering.');
await addPinAt(565, 515, 'Liverpool — UK corridor', 'Liverpool, Merseyside, England', 'Transit corridor linked to wider UK movement and supply relationships.');
await addPinAt(705, 660, 'Madrid — connective legal and business layer', 'Madrid, Spain', 'Spanish corporate and legal layer used to coordinate business movement and broader network access.');

await page.screenshot({ path: `${outDir}/Example2.png`, fullPage: true });
await page.locator('.leaflet-container').screenshot({ path: `${outDir}/Example6.png` });

await browser.close();
console.log('Generated deep screenshots: Example2.png, Example3.png, Example6.png');
