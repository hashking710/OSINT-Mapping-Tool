import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('readme_images');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const baseUrl = 'http://127.0.0.1:5175';

async function ensureLanding() {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const osmButton = page.getByTestId('welcome-provider-osm');
  if ((await osmButton.count()) > 0) {
    await osmButton.click();
    await page.getByRole('button', { name: /new project/i }).waitFor({ state: 'visible', timeout: 20000 });
    return;
  }

  const newProjectButton = page.getByRole('button', { name: /new project/i });
  if ((await newProjectButton.count()) > 0) {
    await newProjectButton.click();
    await page.getByLabel('Project name').waitFor({ state: 'visible', timeout: 20000 });
    return;
  }

  await page.getByLabel('Project name').waitFor({ state: 'visible', timeout: 20000 });
}

async function createProject(projectName, targetName) {
  await ensureLanding();
  await page.getByLabel('Project name').fill(projectName);
  await page.getByLabel('Target name').fill(targetName);
  await page.getByRole('button', { name: /^Create$/i }).click();
  await page.waitForTimeout(1600);
}

async function addIdentifier(fullName, aliases) {
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: /Name/i }).first().click();
  await page.locator('#field-fullName').fill(fullName);
  await page.locator('#field-aliases').fill(aliases);
  await page.getByRole('button', { name: 'Add identifier' }).click();
  await page.waitForTimeout(800);
}

async function addPinAt(x, y, label, address, notes) {
  const map = page.locator('.leaflet-container');
  await map.click({ position: { x, y } });
  await page.locator('#pin-label').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#pin-label').fill(label);
  await page.locator('#pin-address').fill(address);
  await page.locator('#pin-notes').fill(notes);
  await page.getByRole('button', { name: /Save pin|Save changes/i }).click();
  await page.waitForTimeout(900);
}

async function goToMap() {
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.waitForTimeout(1200);
}

await createProject('Kinahan Family Demo', 'Kinahan network — Dublin / Dubai / Marbella / Liverpool');
await addIdentifier('Christy Kinahan', 'Kinahan family leadership');
await addIdentifier('Daniel Kinahan', 'Boxing and logistics');
await addIdentifier('Sean McGovern', 'Communications / facilitators');
await addIdentifier('Johnny Morrissey', 'Marbella / laundering');
await addIdentifier('Thomas McMahon', 'UK logistics and pressure points');
await page.screenshot({ path: path.join(outDir, 'Example3.png'), fullPage: true });

await goToMap();
await addPinAt(320, 260, 'Dublin — Kinahan network hub', 'Dublin, County Dublin, Ireland', 'Irish operational base used by family-linked logistics and communications.');
await addPinAt(470, 390, 'Dubai — transit and logistics hub', 'Dubai, United Arab Emirates', 'Movement and business hub used in international logistics and network mobility.');
await addPinAt(560, 260, 'Marbella — laundering and business node', 'Marbella, Andalusia, Spain', 'Property and business interests tied to laundering and network operations.');
await addPinAt(240, 335, 'Liverpool — UK corridor', 'Liverpool, Merseyside, England', 'UK transit corridor linked to supply, money movement, and wider network reach.');
await page.screenshot({ path: path.join(outDir, 'Example2.png'), fullPage: true });

await page.getByRole('button', { name: /back to projects/i }).click();
await page.getByRole('button', { name: /new project/i }).waitFor({ state: 'visible', timeout: 20000 });
await page.getByRole('button', { name: /new project/i }).click();
await page.getByLabel('Project name').fill('El Chapo Family Map');
await page.getByLabel('Target name').fill('Sinaloa network — Culiacán / Guadalajara / Mexico City / Mazatlán');
await page.getByRole('button', { name: /^Create$/i }).click();
await page.waitForTimeout(1600);
await addIdentifier('Joaquín Guzmán Loera', 'El Chapo');
await addIdentifier('Ovidio Guzmán López', 'Sons network');
await addIdentifier('Iván Archivaldo Guzmán Salazar', 'Logistics');
await addIdentifier('Jesús Alfredo Guzmán Salazar', 'Finance');
await page.screenshot({ path: path.join(outDir, 'Example5.png'), fullPage: true });

await goToMap();
await addPinAt(360, 270, 'Culiacán — family power base', 'Culiacán, Sinaloa, Mexico', 'Historic Sinaloa stronghold tied to the Guzmán family and cartel leadership.');
await addPinAt(510, 320, 'Guadalajara — logistics node', 'Guadalajara, Jalisco, Mexico', 'Regional logistics and business corridor linked to wider family operations.');
await addPinAt(610, 250, 'Mexico City — political and financial access', 'Mexico City, Mexico', 'Capital hub tied to finance, politics, and administrative pressure points.');
await addPinAt(290, 355, 'Mazatlán — port corridor', 'Mazatlán, Sinaloa, Mexico', 'Maritime route connected to movement and trafficking logistics.');
await page.screenshot({ path: path.join(outDir, 'Example4.png'), fullPage: true });

console.log('Generated: Example2.png, Example3.png, Example4.png, Example5.png');
await browser.close();
