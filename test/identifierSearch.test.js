import assert from 'node:assert/strict';
import test from 'node:test';
import { filterIdentifiersForQuery, matchIdentifierQuery } from '../src/utils/identifierSearch.js';

test('matches identifier text across type, label, field values, and notes', () => {
  const identifier = {
    id: '1',
    type: 'person',
    fields: {
      fullName: 'Alicia Morgan',
      aliases: 'Ali',
      email: 'alicia@example.com',
    },
    notes: 'Linked to the Dublin warehouse network',
  };

  assert.equal(matchIdentifierQuery(identifier, 'alicia'), true);
  assert.equal(matchIdentifierQuery(identifier, 'dublin'), true);
  assert.equal(matchIdentifierQuery(identifier, 'warehouse'), true);
  assert.equal(matchIdentifierQuery(identifier, 'crypto'), false);
});

test('filters identifiers by query while preserving all records when the query is empty', () => {
  const identifiers = [
    {
      id: '1',
      type: 'person',
      fields: { fullName: 'Alicia Morgan' },
      notes: 'Dublin network',
    },
    {
      id: '2',
      type: 'vehicle',
      fields: { plate: '09-DUB-123' },
      notes: 'Seen near the port',
    },
    {
      id: '3',
      type: 'company',
      fields: { name: 'Old Street Logistics' },
      notes: 'No relation',
    },
  ];

  assert.deepEqual(filterIdentifiersForQuery(identifiers, ''), identifiers);
  assert.deepEqual(filterIdentifiersForQuery(identifiers, 'dublin'), [identifiers[0]]);
  assert.deepEqual(filterIdentifiersForQuery(identifiers, 'port'), [identifiers[1]]);
  assert.deepEqual(filterIdentifiersForQuery(identifiers, 'old street'), [identifiers[2]]);
});
