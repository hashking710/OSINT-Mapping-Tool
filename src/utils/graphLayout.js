const X_STEP = 400;
const Y_STEP = 110;
const ORIGIN = 60;
const GRID_COLUMNS = 4;
const GRID_X_STEP = 240;

/**
 * Lay identifiers out as layered trees per connected component (left to right,
 * rooted at the best-connected node). Unconnected identifiers go in a grid
 * below. Returns a Map of identifier id -> { x, y }.
 */
export function computeLayout(identifiers = [], connections = []) {
  const ids = identifiers.map((identifier) => identifier.id);
  const known = new Set(ids);
  const adjacency = new Map(ids.map((id) => [id, []]));

  for (const connection of connections) {
    if (!known.has(connection.source) || !known.has(connection.target)) continue;
    adjacency.get(connection.source).push(connection.target);
    adjacency.get(connection.target).push(connection.source);
  }

  const positions = new Map();
  const visited = new Set();
  const components = [];

  const byDegree = [...ids].sort((a, b) => adjacency.get(b).length - adjacency.get(a).length);
  for (const start of byDegree) {
    if (visited.has(start) || adjacency.get(start).length === 0) continue;
    const levels = [];
    let frontier = [start];
    visited.add(start);
    while (frontier.length) {
      levels.push(frontier);
      const next = [];
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id)) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
    components.push(levels);
  }

  let cursorY = ORIGIN;
  for (const levels of components) {
    const height = Math.max(...levels.map((level) => level.length));
    levels.forEach((level, levelIndex) => {
      const offset = ((height - level.length) * Y_STEP) / 2;
      level.forEach((id, row) => {
        positions.set(id, {
          x: ORIGIN + levelIndex * X_STEP,
          y: cursorY + offset + row * Y_STEP,
        });
      });
    });
    cursorY += height * Y_STEP + 40;
  }

  const loose = ids.filter((id) => !visited.has(id));
  loose.forEach((id, index) => {
    positions.set(id, {
      x: ORIGIN + (index % GRID_COLUMNS) * GRID_X_STEP,
      y: cursorY + Math.floor(index / GRID_COLUMNS) * Y_STEP,
    });
  });

  return positions;
}
