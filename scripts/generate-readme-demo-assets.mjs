// Regenerates readme_images/Example1-5.png.
//
//   npm run dev -- --host 127.0.0.1 --port 5175      (in one terminal)
//   node scripts/generate-readme-demo-assets.mjs     (in another)
//
// Each demo case is built as a project file with real coordinates and opened
// through the app's own "Open Project" flow, so pins land where their labels say.
// Demo content only references people named in public reporting; the notes
// deliberately avoid asserting anything beyond that.
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../readme_images', import.meta.url));
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5175';
const NOW = '2025-01-15T12:00:00.000Z';
const VERIFY = 'Named in public reporting; verify details against primary sources.';

const person = (id, fullName, aliases, notes, x, y) => ({
  id, type: 'name', fields: { fullName, aliases }, notes, position: { x, y },
  customIconId: null, createdAt: NOW, updatedAt: NOW,
});
const link = (id, source, target, label) => ({
  id, source, target, sourceHandle: 'right', targetHandle: 'left', label,
});
const pin = (id, label, address, lat, lng, notes, color) => ({
  id, label, address, lat, lng, placeId: null, visitedAt: '', withWho: '', notes,
  color, iconId: null, createdAt: NOW, updatedAt: NOW,
});
const pinLink = (id, pinId, identifierId, context) => ({
  id, pinId, identifierId, context, createdAt: NOW,
});
const note = (id, title, text, offsetDays) => ({
  id, title, subtitle: 'Manual note', text, source: 'Analyst note', sourceUrl: '', context: '',
  createdAt: new Date(Date.parse(NOW) + offsetDays * 86400000).toISOString(),
});

const CASES = [
  {
    graphImage: 'Example3.png',
    mapImage: 'Example2.png',
    project: {
      schemaVersion: 1, id: 'demo-kinahan', name: 'Kinahan Group Demo',
      createdAt: NOW, updatedAt: NOW,
      target: {
        name: 'Kinahan group - Dublin / Dubai / Marbella',
        notes: 'Demo case built from public reporting only.',
      },
      identifiers: [
        person('k1', 'Christy Kinahan', 'Christopher Kinahan Sr.', VERIFY, 60, 60),
        person('k2', 'Daniel Kinahan', '', `Son of Christy Kinahan. ${VERIFY}`, 60, 210),
        person('k3', 'Sean McGovern', '', VERIFY, 60, 360),
        person('k4', 'Johnny Morrissey', '', VERIFY, 60, 510),
      ],
      connections: [
        link('kc1', 'k1', 'k2', 'family member of'),
        link('kc2', 'k1', 'k3', 'reported associate of'),
        link('kc3', 'k2', 'k4', 'reported associate of'),
      ],
      locations: [
        pin('kp1', 'Dublin', 'Dublin, Ireland', 53.3498, -6.2603, `Referenced in public reporting. ${VERIFY}`, 'red'),
        pin('kp2', 'Dubai', 'Dubai, United Arab Emirates', 25.2048, 55.2708, `Referenced in public reporting. ${VERIFY}`, 'orange'),
        pin('kp3', 'Marbella', 'Marbella, Spain', 36.5101, -4.8825, `Referenced in public reporting. ${VERIFY}`, 'blue'),
      ],
      pinLinks: [
        pinLink('kl1', 'kp1', 'k1', 'reported connection'),
        pinLink('kl2', 'kp2', 'k2', 'reported connection'),
      ],
      evidence: [
        note('ke1', 'Open-source coverage reviewed', 'Compiled from news coverage and official announcements. Cross-check each claim against primary documents.', 0),
        note('ke2', 'Open question', 'Confirm the relationships shown against court or sanctions documents before relying on them.', 1),
      ],
      mapDisplay: { showPinConnections: true, pinConnectionColor: '#ef4444' },
    },
  },
  {
    graphImage: 'Example5.png',
    mapImage: 'Example4.png',
    project: {
      schemaVersion: 1, id: 'demo-sinaloa', name: 'Sinaloa Cartel Demo',
      createdAt: NOW, updatedAt: NOW,
      target: {
        name: 'Guzman family - Culiacan / Guadalajara / Mexico City / Mazatlan',
        notes: 'Demo case built from public reporting only.',
      },
      identifiers: [
        person('s1', 'Joaquin Guzman Loera', 'El Chapo', 'Convicted in a US federal court in 2019 (public record).', 60, 60),
        person('s2', 'Ovidio Guzman Lopez', '', 'Son of Joaquin Guzman Loera per public reporting.', 60, 210),
        person('s3', 'Ivan Archivaldo Guzman Salazar', '', 'Son of Joaquin Guzman Loera per public reporting.', 60, 360),
        person('s4', 'Jesus Alfredo Guzman Salazar', '', 'Son of Joaquin Guzman Loera per public reporting.', 60, 510),
      ],
      connections: [
        link('sc1', 's1', 's2', 'family member of'),
        link('sc2', 's1', 's3', 'family member of'),
        link('sc3', 's1', 's4', 'family member of'),
      ],
      locations: [
        pin('sp1', 'Culiacan', 'Culiacan, Sinaloa, Mexico', 24.8091, -107.394, `Referenced in public reporting. ${VERIFY}`, 'red'),
        pin('sp2', 'Guadalajara', 'Guadalajara, Jalisco, Mexico', 20.6597, -103.3496, `Referenced in public reporting. ${VERIFY}`, 'green'),
        pin('sp3', 'Mexico City', 'Mexico City, Mexico', 19.4326, -99.1332, `Referenced in public reporting. ${VERIFY}`, 'purple'),
        pin('sp4', 'Mazatlan', 'Mazatlan, Sinaloa, Mexico', 23.2494, -106.4111, `Referenced in public reporting. ${VERIFY}`, 'teal'),
      ],
      pinLinks: [pinLink('sl1', 'sp1', 's1', 'reported connection')],
      evidence: [
        note('se1', 'Open-source coverage reviewed', 'Compiled from news coverage and court records. Cross-check each claim against primary documents.', 0),
        note('se2', 'Open question', 'Confirm family relationships and locations against court records before relying on them.', 1),
      ],
      mapDisplay: { showPinConnections: true, pinConnectionColor: '#3b82f6' },
    },
  },
];

const tmp = mkdtempSync(join(tmpdir(), 'osint-demo-'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function toLanding() {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const provider = page.getByTestId('welcome-provider-osm');
  if (await provider.count()) await provider.click();
  await page.getByTestId('new-project-button').waitFor();
}

async function openCase({ project }) {
  const file = join(tmp, `${project.id}.osint.json`);
  writeFileSync(file, JSON.stringify(project, null, 2));
  await page.getByTestId('project-file-input').setInputFiles(file);
  await page.getByText(project.name).first().waitFor();
  await page.getByLabel('Search identifiers').waitFor();
}

await toLanding();
for (const demo of CASES) {
  await openCase(demo);

  await page.getByRole('button', { name: 'Tidy layout' }).click();
  await page.waitForTimeout(1200);
  // Saving clears the "unsaved" dot so it doesn't appear in the screenshots.
  await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${demo.graphImage}` });

  await page.locator('#map-tab').click();
  await page.getByRole('button', { name: 'Show all pins' }).waitFor();
  await page.getByRole('button', { name: 'Show all pins' }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${outDir}/${demo.mapImage}` });

  await page.getByTestId('back-to-projects-button').click();
  await page.getByTestId('new-project-button').waitFor();
}

await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/Example1.png` });

await browser.close();
console.log('Generated Example1.png through Example5.png');
