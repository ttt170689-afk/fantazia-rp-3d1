/* v26: local, softly lit cloud bank swallowing the last stair treads.
 * Uses the plaza's existing maps and render loop; no white wall or full-screen flash. */
(function (root) {
  "use strict";
  function create(parent, resources, maps) {
    const group = new THREE.Group();
    group.name = "sky_stair_clouds";
    parent.add(group);
    const own = (r) => (resources.add(r), r);
    const cloud = own(
      new THREE.SpriteMaterial({
        map: maps.cloud,
        color: 0xf4f8ff,
        transparent: true,
        opacity: 0.91,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    const glow = own(
      new THREE.SpriteMaterial({
        map: maps.glow,
        color: 0xe6f4ff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    );
    const puffs = [];
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Sprite(cloud),
        row = Math.floor(i / 3),
        col = i % 3;
      p.position.set(
        18 + (col - 1) * (1.4 + row * 0.3),
        -0.65 + row * 0.45,
        15.8 + row * 1.35,
      );
      p.scale.set(7.8 + row * 0.65, 6.0 + row * 0.55, 1);
      p.name = "stair_mist_" + i;
      p.userData.home = p.position.clone();
      group.add(p);
      puffs.push(p);
    }
    const core = new THREE.Sprite(glow);
    core.name = "stair_white_light";
    core.position.set(18, 1.25, 18.1);
    core.scale.set(10, 11, 1);
    group.add(core);
    const halo = new THREE.Sprite(glow);
    halo.position.set(18, 0.2, 16.4);
    halo.scale.set(11, 7, 1);
    group.add(halo);
    const lamp = new THREE.PointLight(0xe5f3ff, 3.2, 18, 1.5);
    lamp.name = "stair_light_spill";
    lamp.position.set(18, 2.4, 16);
    lamp.castShadow = false;
    group.add(lamp);
    let disposed = false;
    function update(time, reduced = false, battery = false) {
      if (disposed) return;
      const t = Number.isFinite(time) ? time : 0;
      puffs.forEach((p, i) => {
        p.visible = !battery || i < 9;
        p.position.copy(p.userData.home);
        if (!reduced && !battery) {
          p.position.x += Math.sin(t * 0.12 + i * 1.7) * 0.12;
          p.position.y += Math.sin(t * 0.16 + i) * 0.06;
        }
      });
      lamp.intensity = 3.2; // Constant light: no pulse/strobe even with reduced-motion off.
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      group.parent?.remove(group);
      cloud.dispose();
      glow.dispose();
      resources.delete(cloud);
      resources.delete(glow);
    }
    return {
      update,
      dispose,
      info: () => ({
        clouds: puffs.filter((p) => p.visible).length,
        light: lamp.intensity,
        wall: false,
      }),
    };
  }
  root.FZSkyDescent = { create };
  if (typeof module !== "undefined" && module.exports)
    module.exports = root.FZSkyDescent;
})(typeof window === "undefined" ? globalThis : window);
