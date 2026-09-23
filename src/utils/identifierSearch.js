export function flattenIdentifierValues(identifier) {
  const values = [];

  if (!identifier || typeof identifier !== 'object') {
    return values;
  }

  const typeName = typeof identifier.type === 'string' ? identifier.type : '';
  if (typeName) values.push(typeName);

  const fields = identifier.fields && typeof identifier.fields === 'object' ? identifier.fields : {};
  for (const value of Object.values(fields)) {
    if (typeof value === 'string') values.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') values.push(item);
      }
    }
  }

  if (typeof identifier.notes === 'string') values.push(identifier.notes);
  if (Array.isArray(identifier.tags)) values.push(...identifier.tags.filter((t) => typeof t === 'string'));
  return values;
}

export function matchIdentifierQuery(identifier, query) {
  const trimmed = (query ?? '').trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = flattenIdentifierValues(identifier)
    .join(' ')
    .toLowerCase();

  return haystack.includes(trimmed);
}

export function filterIdentifiersForQuery(identifiers = [], query = '') {
  if (!Array.isArray(identifiers)) return [];
  return identifiers.filter((identifier) => matchIdentifierQuery(identifier, query));
}
