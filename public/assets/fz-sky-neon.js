/* v21: scoped, adjustable neon, public wayfinding and a slow stage light wave.
 * Owned resources, one instanced stage draw, no audio claims, RAF or input overlay. */
(function (global) {
  "use strict";
  const routes = [
    {
      id: "news",
      label: "НОВОСТИ",
      color: 0xff52bd,
      points: [
        [4.6, 6],
        [6.6, 2],
        [7.8, -3],
        [10, -7],
        [13.5, -10.5],
      ],
      labelAt: [6, 5.4],
      end: [14, -11],
    },
    {
      id: "city",
      label: "В ГОРОД",
      color: 0x51cfff,
      points: [
        [4.6, 11.2],
        [8, 11.2],
        [11.5, 10],
        [13.5, 7.2],
        [16, 7.2],
        [18, 7.2],
        [18, 8.4],
        [18, 10.8],
      ],
      labelAt: [6, 12.6],
      end: [18, 12],
    },
  ];
  function settings(prefs = {}, reduced = false, battery = false) {
    prefs = prefs && typeof prefs === "object" ? prefs : {};
    return {
      strength: Number.isFinite(prefs.neonBrightness)
        ? Math.max(0.35, Math.min(1.3, prefs.neonBrightness))
        : 1,
      motion: prefs.neonMotion !== false && !reduced && !battery,
    };
  }
  function height(time, index) {
    const t = Number.isFinite(time) ? time : 0;
    index = Number.isFinite(index) ? index : 0;
    return (
      0.3 +
      (0.5 + 0.5 * Math.sin(t * 0.65 + index * 0.38)) *
        (0.65 + 0.35 * Math.cos(t * 0.27 - index * 0.42))
    );
  }
  function create(root, resources, policy) {
    const own = (r) => (resources.add(r), r),
      group = new THREE.Group(),
      saved = new Map();
    group.name = "sky_neon_guidance";
    root.add(group);
    let disposed = false,
      lastStrength = null,
      lastTick = -Infinity,
      lastMotion = null,
      selected = null;
    const marker = (color) => {
      const m = own(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      );
      m.userData.fzNeon = true;
      return m;
    };
    function add(g, m, x, y, z) {
      own(g);
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      group.add(o);
      return o;
    }
    const arrow = new THREE.Shape();
    arrow.moveTo(0, 0.45);
    arrow.lineTo(0.4, -0.2);
    arrow.lineTo(0.22, -0.32);
    arrow.lineTo(0, 0.05);
    arrow.lineTo(-0.22, -0.32);
    arrow.lineTo(-0.4, -0.2);
    arrow.closePath();
    const arrowGeo = own(new THREE.ShapeGeometry(arrow)),
      routeObjects = [];
    for (const route of routes) {
      const material = marker(route.color),
        objects = [];
      for (let i = 0; i < route.points.length; i++) {
        const [x, z] = route.points[i],
          next = route.points[i + 1] || route.end;
        const o = add(
          arrowGeo,
          material,
          x,
          policy.ground(x, policy.deck.z + z, false) - policy.deck.y + 0.045,
          z,
        );
        o.rotation.set(
          -Math.PI / 2,
          0,
          Math.atan2(-(next[0] - x), -(next[1] - z)),
        );
        o.name = "sky_route_" + route.id;
        objects.push(o);
      }
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#10162d";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#" + route.color.toString(16).padStart(6, "0");
      ctx.fillRect(0, 0, 8, 128);
      ctx.fillStyle = "#eef5ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 48px Arial";
      ctx.fillText(route.label + " →", 256, 64, 470);
      const tex = own(new THREE.CanvasTexture(c));
      tex.encoding = THREE.sRGBEncoding;
      const labelMat = own(
        new THREE.MeshBasicMaterial({
          map: tex,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      );
      const label = add(
        new THREE.PlaneGeometry(2.7, 0.68),
        labelMat,
        route.labelAt[0],
        0.04,
        route.labelAt[1],
      );
      label.rotation.x = -Math.PI / 2;
      label.name = "sky_route_label_" + route.id;
      routeObjects.push({ route, material, objects });
    }
    const barMat = own(
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    barMat.userData.fzNeon = true;
    const barGeo = own(new THREE.BoxGeometry(0.24, 1, 0.045)),
      bars = new THREE.InstancedMesh(barGeo, barMat, 24);
    bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    resources.add(bars);
    bars.name = "sky_stage_light_wave";
    group.add(bars);
    const dummy = new THREE.Object3D(),
      color = new THREE.Color();
    for (let i = 0; i < 24; i++) {
      color.setHSL(0.55 + (i / 23) * 0.32, 0.72, 0.65);
      bars.setColorAt(i, color);
    }
    bars.instanceColor.needsUpdate = true;
    function wave(t) {
      for (let i = 0; i < 24; i++) {
        const h = height(t, i);
        dummy.position.set(-5.4 + i * 0.47, 2.25 + h / 2, -21.6);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        bars.setMatrixAt(i, dummy.matrix);
      }
      bars.instanceMatrix.needsUpdate = true;
    }
    function discover() {
      for (const m of resources)
        if (m.isMaterial && m.userData?.fzNeon && !saved.has(m))
          saved.set(m, {
            color: m.color?.clone(),
            emissive: m.emissiveIntensity,
            opacity: m.opacity,
          });
    }
    function apply(strength) {
      for (const [m, base] of saved) {
        if (m.isMeshStandardMaterial)
          m.emissiveIntensity = base.emissive * strength;
        else if (m.transparent)
          m.opacity = Math.min(1, base.opacity * strength);
        else if (base.color) m.color.copy(base.color).multiplyScalar(strength);
      }
    }
    function update(
      time,
      prefs = {},
      reduced = false,
      battery = false,
      position = null,
    ) {
      if (disposed) return;
      const t = Number.isFinite(time) ? time : 0,
        q = settings(prefs, reduced, battery);
      const before = saved.size;
      discover();
      if (q.strength !== lastStrength || before !== saved.size) {
        apply(q.strength);
        lastStrength = q.strength;
      }
      if (
        lastMotion !== q.motion ||
        (q.motion && (t - lastTick >= 1 / 30 || t < lastTick))
      ) {
        wave(q.motion ? t : 0);
        lastTick = t;
        lastMotion = q.motion;
      }
      selected = null;
      for (const r of routeObjects) {
        const distance = position
          ? Math.hypot(
              position.x - policy.deck.x - r.route.end[0],
              position.z - policy.deck.z - r.route.end[1],
            )
          : Infinity;
        if (distance < 4) selected = r.route.id;
        const near = Math.max(0, Math.min(1, (8 - distance) / 4));
        r.material.opacity = Math.min(1, (0.5 + 0.45 * near) * q.strength);
      }
      return q;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      for (const [m, b] of saved) {
        if (b.color) m.color.copy(b.color);
        m.opacity = b.opacity;
        if (m.isMeshStandardMaterial) m.emissiveIntensity = b.emissive;
      }
      saved.clear();
      group.parent?.remove(group);
    }
    group.traverse((o) => o.layers.set(2));
    wave(0);
    return {
      root: group,
      update,
      dispose,
      info: () => ({
        strength: lastStrength,
        motion: !!lastMotion,
        trackedMaterials: saved.size,
        stageBars: 24,
        routeArrows: routes.reduce((n, r) => n + r.points.length, 0),
        selected,
        disposed,
      }),
    };
  }
  const api = { routes, settings, height, create };
  global.FZSkyNeon = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
