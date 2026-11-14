/* Bounded floor-plan routing. Produces a drawing, never input, teleportation or door commands. */
(function (root) {
  "use strict";
  const bounds = { minX: -25, maxX: 25, minZ: -24, maxZ: 24 };
  const width = bounds.maxX - bounds.minX + 1;
  const depth = bounds.maxZ - bounds.minZ + 1;
  const size = width * depth;
  const radius = 0.43;
  const key = (x, z) => (z - bounds.minZ) * width + x - bounds.minX;
  const point = (index) => ({
    x: (index % width) + bounds.minX,
    z: Math.floor(index / width) + bounds.minZ,
  });
  function inBounds(x, z) {
    return (
      x >= bounds.minX &&
      x <= bounds.maxX &&
      z >= bounds.minZ &&
      z <= bounds.maxZ
    );
  }
  function blocked(k, floor, x, z) {
    const y = floor * k.FH;
    if (k.lift && x > 15 && x < 23.5 && z > 13.5 && z < 23.5) return true;
    // Stairwell voids are not a shortcut across a floor. Their landing stays routable.
    if (k.ramps.length && x > -23 && x < -15 && z >= 10 && z < 23) return true;
    for (const collider of k.colliders) {
      if (y >= collider.maxY - 0.1 || y + 2.7 <= collider.minY) continue;
      // Ordinary doors can be opened on both sides with the normal action.
      // Locked bank doors are solid geometry, not this flag, and remain blocked.
      if (collider.door) continue;
      if (
        x + radius > collider.minX &&
        x - radius < collider.maxX &&
        z + radius > collider.minZ &&
        z - radius < collider.maxZ
      )
        return true;
    }
    return false;
  }
  function build(k, floor) {
    if (!Number.isInteger(floor) || floor < 0 || floor >= k.floors) return null;
    const cells = new Uint8Array(size);
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        cells[key(x, z)] = blocked(k, floor, x, z) ? 0 : 1;
      }
    }
    return { floor, cells };
  }
  function nearest(grid, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return -1;
    if (
      p.x < bounds.minX - 1 ||
      p.x > bounds.maxX + 1 ||
      p.z < bounds.minZ - 1 ||
      p.z > bounds.maxZ + 1
    )
      return -1;
    const cx = Math.round(p.x);
    const cz = Math.round(p.z);
    let best = -1;
    let distance = Infinity;
    for (let z = cz - 2; z <= cz + 2; z++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (!inBounds(x, z) || !grid.cells[key(x, z)]) continue;
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < distance && d <= 1.5) {
          best = key(x, z);
          distance = d;
        }
      }
    }
    return best;
  }
  function simplify(points) {
    if (points.length < 3) return points;
    const result = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const next = points[i + 1];
      if (
        (current.x - previous.x) * (next.z - current.z) !==
        (current.z - previous.z) * (next.x - current.x)
      )
        result.push(current);
    }
    result.push(points[points.length - 1]);
    return result;
  }
  function find(grid, start, end) {
    if (!grid || grid.cells.length !== size) return null;
    const source = nearest(grid, start);
    const destination = nearest(grid, end);
    if (source < 0 || destination < 0) return null;
    const queue = new Int32Array(size);
    const parents = new Int32Array(size);
    parents.fill(-1);
    parents[source] = source;
    queue[0] = source;
    let read = 0;
    let write = 1;
    while (read < write && parents[destination] === -1) {
      const current = queue[read++];
      const p = point(current);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = p.x + dx;
        const z = p.z + dz;
        if (!inBounds(x, z)) continue;
        const neighbor = key(x, z);
        if (!grid.cells[neighbor] || parents[neighbor] !== -1) continue;
        parents[neighbor] = current;
        queue[write++] = neighbor;
      }
    }
    if (parents[destination] === -1) return null;
    const points = [];
    let current = destination;
    // The hard cap also guarantees bounded work for a malformed parent chain.
    for (let guard = 0; guard < size; guard++) {
      points.push(point(current));
      if (current === source) break;
      current = parents[current];
    }
    points.reverse();
    return {
      points: simplify(points),
      steps: points.length - 1,
      visited: write,
    };
  }
  const api = { bounds, size, build, find, blocked };
  root.FZInterior50Route = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
