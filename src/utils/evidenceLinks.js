import { getDisplayLabel, getTypeDef } from '../identifierTypes.js';

// Evidence counts for an identifier: entries created from its lookup, plus any
// entry whose title/subtitle/text mentions its value (values shorter than three
// characters, and the bare type label, are too noisy to match on).
export function evidenceForIdentifier(evidence = [], identifier) {
  if (!identifier) return [];
  const label = getDisplayLabel(identifier).trim().toLowerCase();
  const typeLabel = getTypeDef(identifier.type).label.toLowerCase();
  const matchText = label.length >= 3 && label !== typeLabel;

  return evidence.filter((entry) => {
    if (entry.context === `identifier:${identifier.id}`) return true;
    if (!matchText) return false;
    return [entry.title, entry.subtitle, entry.text].join(' ').toLowerCase().includes(label);
  });
}
