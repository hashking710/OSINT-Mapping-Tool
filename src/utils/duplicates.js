import { getDisplayLabel, getTypeDef } from '../identifierTypes.js';

export function normalizeIdentityValue(value, fieldType) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (fieldType === 'tel') {
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 6 ? digits : '';
  }
  if (fieldType === 'email') return raw;
  return raw.replace(/^@/, '').replace(/^u\//, '');
}

// Primary values only collide within the same type (the same handle on two
// platforms is a link, not a duplicate); emails and phone numbers collide
// across every type.
function identityKeys(identifier) {
  const def = getTypeDef(identifier?.type);
  const keys = [];
  for (const field of def.fields) {
    const value = identifier?.fields?.[field.key];
    const shared = field.type === 'email' || field.type === 'tel';
    if (!shared && !field.primary) continue;
    const normalized = normalizeIdentityValue(value, field.type);
    if (!normalized) continue;
    const scope = shared ? field.type : `${identifier.type}:${field.key}`;
    keys.push({ key: `${scope}|${normalized}`, fieldLabel: field.label, value: String(value).trim() });
  }
  return keys;
}

export function findDuplicateIdentifiers(identifiers = [], candidate, { ignoreId } = {}) {
  const wanted = new Map(identityKeys(candidate).map((k) => [k.key, k]));
  if (wanted.size === 0) return [];

  const matches = [];
  for (const existing of identifiers) {
    if (existing.id === ignoreId) continue;
    const hit = identityKeys(existing).find((k) => wanted.has(k.key));
    if (!hit) continue;
    matches.push({
      identifier: existing,
      label: getDisplayLabel(existing),
      fieldLabel: hit.fieldLabel,
      value: hit.value,
    });
  }
  return matches;
}
