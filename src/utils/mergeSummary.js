const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// One-line description of what a merge did, e.g. "+1 identifier, 2 updated".
// Kept apart from the merge engine so always-loaded code can show it without
// pulling in the engine.
export function describeMergeSummary({ added, updated }) {
  const parts = [];
  if (added.identifiers) parts.push(`+${plural(added.identifiers, 'identifier')}`);
  if (added.connections) parts.push(`+${plural(added.connections, 'connection')}`);
  if (added.locations) parts.push(`+${plural(added.locations, 'location')}`);
  if (added.pinLinks) parts.push(`+${plural(added.pinLinks, 'pin link')}`);
  if (added.evidence) parts.push(`+${plural(added.evidence, 'evidence entry', 'evidence entries')}`);
  if (added.views) parts.push(`+${plural(added.views, 'saved view')}`);
  const changed = updated.identifiers + updated.connections + updated.locations;
  if (changed) parts.push(`${changed} updated`);
  return parts.length ? parts.join(', ') : 'nothing to merge';
}
