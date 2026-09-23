// Copies of identifier records for paste / duplicate: fresh ids are generated
// by ProjectContext.bulkAddIdentifiers, and positions are nudged so the copies
// do not sit exactly on top of the originals.
export function cloneRecordsWithOffset(records, offset = { x: 30, y: 30 }) {
  return records.map((record) => ({
    ...record,
    id: undefined,
    position: record.position
      ? { x: record.position.x + offset.x, y: record.position.y + offset.y }
      : undefined,
  }));
}
