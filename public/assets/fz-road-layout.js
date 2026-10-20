/* Shared world-space reservations. Plan before constructing meshes, entrances or colliders.
 * No scene deletion, mesh-only translations, or unsafe fallback placements. */
(function (root) {
  "use strict";
  const roads = [];
  for (const axis of ["x", "z"])
    for (const center of [-60, 0, 60])
      roads.push({
        axis,
        center,
        half: center === 0 ? 6 : 4,
        walk: 3.7,
        length: 1200,
      });
  // The perimeter bypass goes around the farm/lake, not through their centres.
  for (const center of [-370, 370])
    roads.push({ axis: "x", center, half: 5, walk: 0, length: 630 });
  for (const center of [-310, 310])
    roads.push({ axis: "z", center, half: 5, walk: 0, length: 750 });
  // Connected streets through the new eastern residential/retail quarter.
  roads.push({
    axis: "z",
    center: 156,
    half: 5,
    walk: 3.7,
    length: 310,
    along: 215,
    district: true,
  });
  roads.push({
    axis: "x",
    center: 260,
    half: 5,
    walk: 3.7,
    length: 182,
    along: 151,
    district: true,
  });
  const spawn = { x: 131, z: -30 };
  const plots = [],
    props = [],
    observations = [];
  let owner = null;
  const rect = (x, z, w, d) => ({
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  });
  const overlaps = (a, b) =>
    a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  function hit(bounds, pedestrian = true, margin = 0) {
    return roads.some((r) => {
      const h = r.half + (pedestrian ? r.walk : 0) + margin;
      return overlaps(
        bounds,
        r.axis === "x"
          ? rect(r.center, r.along || 0, h * 2, r.length)
          : rect(r.along || 0, r.center, r.length, h * 2),
      );
    });
  }
  function free(x, z, w, d, ignore = owner, checkProps = false) {
    const b = rect(x, z, w, d);
    if (hit(b, true, 0.4)) return false;
    // River banks (bridges are built separately).
    if ([-260, 260].some((c) => b.minZ < c + 15 && b.maxZ > c - 15))
      return false;
    if (plots.some((p) => p.id !== ignore && overlaps(b, p.bounds)))
      return false;
    return (
      !checkProps ||
      !props.some((p) => p.owner !== ignore && overlaps(b, p.bounds))
    );
  }
  function find(x, z, w, d, options = {}) {
    const ox = options.ox || 0,
      oz = options.oz || 0;
    const ok = (a, b) =>
      (!options.walkway ||
        !overlaps(rect(a + ox, b + oz, w, d), rect(spawn.x, -54, 8, 50))) &&
      free(
        a + ox,
        b + oz,
        w,
        d,
        options.ignore === undefined ? owner : options.ignore,
        !!options.props,
      );
    if (ok(x, z)) return { x, z };
    const step = options.step || 2,
      limit = options.limit === undefined ? 320 : options.limit;
    for (let r = step; r <= limit; r += step) {
      // Cardinal choices first, then the full ring: diagonal sites must not be missed.
      const candidates = [
        [x, z + r],
        [x, z - r],
        [x + r, z],
        [x - r, z],
      ];
      for (let d0 = step; d0 <= r; d0 += step)
        for (const s of [-1, 1])
          for (const t of [-1, 1]) {
            candidates.push([x + s * d0, z + t * r]);
            if (d0 !== r) candidates.push([x + s * r, z + t * d0]);
          }
      for (const [a, b] of candidates) if (ok(a, b)) return { x: a, z: b };
    }
    return null;
  }
  function reserve(id, x, z, w, d, options = {}) {
    const p = find(x, z, w, d, { ...options, props: true });
    if (!p) throw new Error("No safe parcel: " + id);
    const plot = {
      id,
      ...p,
      w,
      d,
      bounds: rect(p.x + (options.ox || 0), p.z + (options.oz || 0), w, d),
    };
    plots.push(plot);
    return plot;
  }
  function prop(x, z, w, d, label, rotation = 0) {
    const c = Math.abs(Math.cos(rotation)),
      s = Math.abs(Math.sin(rotation));
    const rw = c * w + s * d,
      rd = s * w + c * d;
    const p = find(x, z, rw, rd, { limit: 24, walkway: true });
    if (p) props.push({ ...p, label, owner, bounds: rect(p.x, p.z, rw, rd) });
    return p;
  }
  function building(x, z, w, d, name) {
    // A compound (business + lamps + launchpad) is reserved as ONE parcel.
    const parent = plots.find((p) => p.id === owner);
    const b = rect(x, z + 2, w + 4, d + 8);
    if (
      parent &&
      b.minX >= parent.bounds.minX &&
      b.maxX <= parent.bounds.maxX &&
      b.minZ >= parent.bounds.minZ &&
      b.maxZ <= parent.bounds.maxZ
    )
      return { x, z };
    return reserve(
      "building:" + plots.length + ":" + name,
      x,
      z,
      w + 4,
      d + 8,
      { oz: 2 },
    );
  }
  function withOwner(id, fn) {
    const prev = owner;
    owner = id;
    try {
      return fn();
    } finally {
      owner = prev;
    }
  }
  function begin(worldSize = 1200) {
    for (const r of roads) if (r.walk && !r.district) r.length = worldSize;
    plots.length = props.length = observations.length = 0;
    owner = null;
    plots.push({ id: "park", bounds: rect(30, 30, 38, 38) });
    plots.push({ id: "spawn", bounds: rect(spawn.x, spawn.z, 44, 34) });
    api.mall = reserve("mall", 85, -85, 168, 112, { ox: 22, oz: 3 });
    api.lab = reserve("lab", -430, 0, 44, 38, { ox: 2, oz: 2 });
    api.stadium = reserve("stadium", 130, 210, 48, 48);
    api.businesses = [
      [-30, 30],
      [30, -30],
      [-30, -30],
      [90, 28],
    ].map(([x, z], i) =>
      reserve("business:" + i, x, z, i === 3 ? 56 : 30, i === 3 ? 38 : 30, {
        ox: i === 3 ? 12 : 0,
        oz: 3,
      }),
    );
    api.quarter = [];
    for (const z of [100, 128, 184, 218])
      for (const x of [190, 229, 291, 330])
        api.quarter.push(
          reserve("quarter:" + api.quarter.length, x, z, 30, 28, { oz: 2 }),
        );
    api.shops = [-90, -114, -138, -162, -186].map((x, i) =>
      reserve("extra-shop:" + i, x, 30, 22, 26, { oz: 2 }),
    );
  }
  // Audit actual unmerged mesh bounds, not only the placement planner's declarations.
  function observe(roots, label) {
    if (!root.FZ_LAYOUT_AUDIT || !root.THREE) return;
    for (const object of roots) {
      object.updateMatrixWorld(true);
      object.traverse((o) => {
        if (
          !o.isMesh ||
          !o.visible ||
          !o.geometry ||
          !o.geometry.attributes.position
        )
          return;
        o.geometry.computeBoundingBox();
        const transforms = [];
        if (o.isInstancedMesh) {
          for (let i = 0; i < o.count; i++) {
            const m = new root.THREE.Matrix4();
            o.getMatrixAt(i, m);
            transforms.push(
              new root.THREE.Matrix4().multiplyMatrices(o.matrixWorld, m),
            );
          }
        } else transforms.push(o.matrixWorld);
        for (const transform of transforms) {
          const b = o.geometry.boundingBox.clone().applyMatrix4(transform);
          if (b.min.y > 15 || b.max.y < 0.26) continue; // sky and flat paving
          const bounds = {
            minX: b.min.x,
            maxX: b.max.x,
            minZ: b.min.z,
            maxZ: b.max.z,
          };
          if (hit(bounds, false, 0))
            observations.push({
              label,
              name: o.name,
              geometry: o.geometry.type,
              bounds,
              minY: b.min.y,
              maxY: b.max.y,
            });
        }
      });
    }
  }
  // Interruption of roadside kerbs/sidewalks at every perpendicular carriageway.
  function segments(horiz, off, length, along = 0) {
    const cuts = roads
      .filter(
        (r) =>
          r.axis === (horiz ? "x" : "z") &&
          Math.abs(off - (r.along || 0)) <= r.length / 2,
      )
      .map((r) => [r.center - r.half - 0.4, r.center + r.half + 0.4])
      .sort((a, b) => a[0] - b[0]);
    const out = [];
    let start = along - length / 2;
    const end = along + length / 2;
    for (const [a, b] of cuts) {
      if (b <= start) continue;
      if (a >= end) break;
      if (a > start) out.push([start, a]);
      start = Math.max(start, b);
    }
    if (start < end) out.push([start, end]);
    return out;
  }
  const api = {
    roads,
    spawn,
    plots,
    props,
    observations,
    rect,
    overlaps,
    hit,
    free,
    find,
    reserve,
    prop,
    building,
    withOwner,
    begin,
    observe,
    segments,
  };
  root.FZRoads = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
