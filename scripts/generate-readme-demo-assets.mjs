import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../readme_images', import.meta.url));
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

async function goToLanding() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const backButton = page.getByRole('button', { name: /back to projects/i });
  if (await backButton.count()) {
    await backButton.first().click();
    await page.waitForTimeout(500);
  }

  const providerChoice = page.getByTestId('welcome-provider-osm');
  if (await providerChoice.count()) {
    await providerChoice.click();
    await page.waitForTimeout(500);
  }
}

async function openProjectCreator() {
  await goToLanding();
  const newProjectButton = page.getByRole('button', { name: /new project/i });
  if (await newProjectButton.count()) {
    await newProjectButton.first().click();
  }

  await page.getByRole('dialog', { name: /new project/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByLabel('Project name').waitFor({ state: 'visible', timeout: 20000 });
}

async function createProject(name, targetName) {
  await openProjectCreator();
  await page.getByLabel('Project name').fill(name);
  await page.getByLabel('Target name (optional)').fill(targetName);
  await page.getByRole('button', { name: /^Create$/i }).click();
  await page.waitForTimeout(1500);
}

async function addIdentifier(fullName, aliases) {
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).first().click();
  await page.locator('#field-fullName').fill(fullName);
  await page.locator('#field-aliases').fill(aliases);
  await page.getByRole('button', { name: 'Add identifier' }).click();
  await page.waitForTimeout(700);
}

async function placePin(x, y, label, address, notes) {
  const map = page.locator('.leaflet-container');
  await map.click({ position: { x, y } });
  await page.locator('#pin-label').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#pin-label').fill(label);
  await page.locator('#pin-address').fill(address);
  await page.locator('#pin-notes').fill(notes);
  await page.getByRole('button', { name: /Save pin|Save changes/i }).click();
  await page.waitForTimeout(700);
}

async function focusMapTab() {
  await page.locator('#map-tab').click({ force: true });
  await page.waitForTimeout(1200);
}

await createProject('Kinahan Family Demo', 'Kinahan network — Dublin / Dubai / Marbella / Liverpool');
await addIdentifier('Christy Kinahan', 'Kinahan family leadership');
await addIdentifier('Daniel Kinahan', 'Boxing and logistics');
await addIdentifier('Sean McGovern', 'Communications / facilitators');
await addIdentifier('Johnny Morrissey', 'Marbella / laundering');
await addIdentifier('Thomas McMahon', 'UK logistics and pressure points');
await page.screenshot({ path: `${outDir}/Example3.png`, fullPage: true });
await focusMapTab();
await placePin(320, 250, 'Dublin — Kinahan network hub', 'Dublin, County Dublin, Ireland', 'Irish operational base used by family-linked logistics and communications.');
await placePin(440, 350, 'Dubai — transit and logistics hub', 'Dubai, United Arab Emirates', 'Movement and business hub used in international logistics and network mobility.');
await placePin(540, 255, 'Marbella — laundering and business node', 'Marbella, Andalusia, Spain', 'Property and business interests tied to laundering and network operations.');
await placePin(210, 315, 'Liverpool — UK corridor', 'Liverpool, Merseyside, England', 'UK transit corridor linked to supply, money movement, and wider network reach.');
await page.screenshot({ path: `${outDir}/Example2.png`, fullPage: true });

await createProject('El Chapo Family Map', 'Sinaloa network — Culiacán / Guadalajara / Mexico City / Mazatlán');
await addIdentifier('Joaquín Guzmán Loera', 'El Chapo');
await addIdentifier('Ovidio Guzmán López', 'Sons network');
await addIdentifier('Iván Archivaldo Guzmán Salazar', 'Logistics');
await addIdentifier('Jesús Alfredo Guzmán Salazar', 'Finance');
await page.screenshot({ path: `${outDir}/Example5.png`, fullPage: true });
await focusMapTab();
await placePin(330, 250, 'Culiacán — family power base', 'Culiacán, Sinaloa, Mexico', 'Historic Sinaloa stronghold tied to the Guzmán family and cartel leadership.');
await placePin(470, 300, 'Guadalajara — logistics node', 'Guadalajara, Jalisco, Mexico', 'Regional logistics and business corridor linked to wider family operations.');
await placePin(560, 220, 'Mexico City — political and financial access', 'Mexico City, Mexico', 'Capital hub tied to finance, politics, and administrative pressure points.');
await placePin(260, 340, 'Mazatlán — port corridor', 'Mazatlán, Sinaloa, Mexico', 'Maritime route connected to movement and trafficking logistics.');
await page.screenshot({ path: `${outDir}/Example4.png`, fullPage: true });

await browser.close();
console.log('Generated Example2.png, Example3.png, Example4.png, Example5.png');
