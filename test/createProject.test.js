import assert from 'node:assert/strict';
import test from 'node:test';
import { createProject } from '../src/utils/createProject.js';
import { buildProjectTemplate } from '../src/utils/projectTemplates.js';

test('creates an empty project when no identifiers are provided', () => {
  const project = createProject({ name: 'Case 1' });
  assert.deepEqual(project.identifiers, []);
  assert.equal(project.target.name, '');
});

test('seeds identifiers from a starter template with distinct, non-overlapping positions', () => {
  const template = buildProjectTemplate('person');
  const project = createProject({
    name: 'Case 1',
    targetName: template.targetName,
    notes: template.notes,
    identifiers: template.identifiers,
  });

  assert.equal(project.identifiers.length, template.identifiers.length);
  const positions = project.identifiers.map((id) => `${id.position.x},${id.position.y}`);
  assert.equal(new Set(positions).size, positions.length);
  for (const identifier of project.identifiers) {
    assert.ok(identifier.id);
    assert.equal(identifier.createdAt, project.createdAt);
  }
});
