import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEvidenceNote,
  buildNearbyPlaceSummary,
  buildPublicEntitySummary,
  pickBestWikidataResult,
  summarizeOverpassMatches,
} from '../src/utils/publicData.js';

test('picks the most relevant Wikidata result from a search payload', () => {
  const result = pickBestWikidataResult({
    search: [
      { id: 'Q12345', label: 'Example City', description: 'fictional place' },
      { id: 'Q42', label: 'Paris', description: 'capital city of France' },
    ],
  }, 'Paris');

  assert.ok(result);
  assert.equal(result.label, 'Paris');
  assert.equal(result.id, 'Q42');
});

test('summarizes nearby Overpass matches into useful labels', () => {
  const summary = summarizeOverpassMatches([
    { tags: { name: 'Central Library', amenity: 'library' } },
    { tags: { name: 'Old Town Square', tourism: 'attraction' } },
  ]);

  assert.deepEqual(summary, [
    { name: 'Central Library', kind: 'library' },
    { name: 'Old Town Square', kind: 'attraction' },
  ]);
});

test('builds a readable public record summary with attribution metadata', () => {
  const summary = buildPublicEntitySummary({
    label: 'Paris',
    description: 'capital city of France',
    summary: 'Paris is the capital and most populous city of France.',
    url: 'https://www.wikidata.org/wiki/Q90',
  }, 'paris');

  assert.equal(summary.title, 'Paris');
  assert.equal(summary.subtitle, 'capital city of France');
  assert.match(summary.text, /capital and most populous city/i);
  assert.equal(summary.source, 'Wikidata / Wikipedia');
  assert.equal(summary.sourceUrl, 'https://www.wikidata.org/wiki/Q90');
});

test('builds a clear nearby place summary with map attribution', () => {
  const summary = buildNearbyPlaceSummary({ name: 'Central Library', kind: 'library' }, { lat: 48.8566, lng: 2.3522 });

  assert.equal(summary.title, 'Central Library');
  assert.equal(summary.subtitle, 'library');
  assert.match(summary.text, /nearby library/i);
  assert.equal(summary.source, 'OpenStreetMap / Overpass');
  assert.match(summary.sourceUrl, /openstreetmap.org/i);
});

test('builds a concise evidence note from a public lookup result', () => {
  const note = buildEvidenceNote({
    title: 'Paris',
    subtitle: 'capital city of France',
    text: 'Paris is the capital and most populous city of France.',
    source: 'Wikidata / Wikipedia',
    sourceUrl: 'https://www.wikidata.org/wiki/Q90',
  }, 'person');

  assert.match(note, /Paris/i);
  assert.match(note, /Wikidata \/ Wikipedia/i);
  assert.match(note, /capital and most populous city/i);
  assert.match(note, /person/i);
});
