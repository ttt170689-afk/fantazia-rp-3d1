/* v19: architectural garden on the existing deck. Uses its renderer, resources,
 * physics policy and frame. No duplicate world, download assets or extra RAF. */
(function (global) {
  "use strict";
  function create(root, resources, M, helpers) {
    const { box, rod, maps } = helpers,
      own = (r) => (resources.add(r), r),
      P = FZSkyPolicy;
    const group = new THREE.Group();
    group.name = "sky_garden_architecture";
    root.add(group);
    const mat = (opts) =>
      own(
        new THREE.MeshStandardMaterial({
          ...opts,
          envMap: M.brass.envMap,
          envMapIntensity: 0.45,
        }),
      );
    const ivory = mat({ color: 0x263251, metalness: 0.12, roughness: 0.34 }),
      soil = mat({ color: 0x252c20, roughness: 1 }),
      water = mat({ color: 0x29357a, metalness: 0.5, roughness: 0.19 });
    const cyan = own(
        new THREE.MeshBasicMaterial({ color: 0x51cfff, toneMapped: false }),
      ),
      leaf = own(
        new THREE.MeshLambertMaterial({
          color: 0x37662c,
          side: THREE.DoubleSide,
        }),
      );
    const pink = own(
      new THREE.MeshBasicMaterial({ color: 0xff52bd, toneMapped: false }),
    );
    const lettering = mat({
      color: 0xc8d8ff,
      emissive: 0x7062e9,
      emissiveIntensity: 0.7,
      roughness: 0.28,
      metalness: 0.16,
    });
    const blueHalo = own(
      new THREE.MeshBasicMaterial({
        color: 0x328aff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    const pinkHalo = own(
      new THREE.MeshBasicMaterial({
        color: 0xe043bd,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    for (const material of [cyan, pink, lettering, blueHalo, pinkHalo])
      material.userData.fzNeon = true;
    function mesh(g, m, x = 0, y = 0, z = 0) {
      own(g);
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.castShadow = true;
      o.receiveShadow = true;
      group.add(o);
      return o;
    }
    function tube(points, r, material) {
      const curve = new THREE.CatmullRomCurve3(points);
      return mesh(new THREE.TubeGeometry(curve, 80, r, 8, false), material);
    }
    function arch(rx, ry, y, z, r, material) {
      const points = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i * Math.PI) / 40;
        points.push(
          new THREE.Vector3(Math.cos(a) * rx, y + Math.sin(a) * ry, z),
        );
      }
      return tube(points, r, material);
    }
    // Open elliptical conservatory ribs, with supports represented in shared collision data.
    for (const z of [-6, -3]) {
      arch(25, 13, 0, z, 0.2, ivory);
      arch(24.77, 12.84, 0, z, 0.035, z === -6 ? pink : cyan);
      const halo = arch(
        24.77,
        12.84,
        0,
        z,
        0.14,
        z === -6 ? pinkHalo : blueHalo,
      );
      halo.castShadow = false;
    }
    for (let i = 1; i < 18; i++) {
      const a = (i * Math.PI) / 18,
        x = Math.cos(a) * 25,
        y = Math.sin(a) * 13;
      rod([x, y, -6], [x, y, -3], 0.045, M.brass);
    }
    for (const p of P.gardenSupports) {
      mesh(
        new THREE.CylinderGeometry(0.43, 0.55, 0.22, 20),
        M.dark,
        p.x,
        0.11,
        p.z,
      );
    }
    // Sculpted shell over the existing protected performance stage, not a second stage.
    for (const z of [-22, -17, -12]) {
      arch(7.1, 3.7, 7.9, z, 0.13, ivory);
      arch(7.02, 3.6, 7.9, z, 0.04, z === -12 ? pink : cyan);
    }
    for (let i = 0; i <= 18; i++) {
      const a = (i * Math.PI) / 18,
        x = Math.cos(a) * 7.1,
        y = 7.9 + Math.sin(a) * 3.7;
      rod(
        [x, y, -22],
        [x, y, -12],
        i % 3 === 0 ? 0.06 : 0.035,
        i % 3 === 0 ? M.brass : M.wood,
      );
    }
    // Blue-grey stone promenade and circular arrival medallion, flush with the deck.
    const pathMap = own(M.stone.map.clone());
    pathMap.repeat.set(1.8, 4.75);
    pathMap.needsUpdate = true;
    const pathMat = mat({
      color: 0x697f94,
      map: pathMap,
      roughness: 0.83,
      metalness: 0.02,
    });
    const promenade = mesh(
      new THREE.PlaneGeometry(7.2, 19),
      pathMat,
      0,
      0.01,
      -2,
    );
    promenade.rotation.x = -Math.PI / 2;
    promenade.castShadow = false;
    const medallion = mesh(
      new THREE.CircleGeometry(4, 80),
      mat({ color: 0x566f88, roughness: 0.76, metalness: 0.12 }),
      0,
      0.012,
      10,
    );
    medallion.rotation.x = -Math.PI / 2;
    medallion.castShadow = false;
    const medallionEdge = mesh(
      new THREE.TorusGeometry(3.94, 0.032, 6, 80),
      cyan,
      0,
      0.022,
      10,
    );
    medallionEdge.rotation.x = Math.PI / 2;
    medallionEdge.castShadow = false;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      const tick = box(
        Math.sin(a) * 3.65,
        0.025,
        10 + Math.cos(a) * 3.65,
        0.035,
        0.02,
        i % 6 === 0 ? 0.42 : 0.18,
        M.brass,
      );
      tick.rotation.y = a;
    }
    // Inlaid route to the stage; all flush with the deck, not invisible obstacles.
    for (const x of [-3.7, 3.7]) {
      box(x, 0.012, -1.5, 0.055, 0.018, 18, M.brass);
      box(x + 0.12, 0.012, -1.5, 0.05, 0.018, 18, x < 0 ? cyan : pink);
    }
    const ripples = [];
    for (const p of P.gardenPools) {
      mesh(
        new THREE.CylinderGeometry(p.r, p.r, 0.42, 64),
        ivory,
        p.x,
        0.21,
        p.z,
      );
      const w = mesh(
        new THREE.CircleGeometry(p.r - 0.22, 64),
        water,
        p.x,
        0.432,
        p.z,
      );
      w.rotation.x = -Math.PI / 2;
      w.castShadow = false;
      const rim = mesh(
        new THREE.TorusGeometry(p.r - 0.1, 0.13, 8, 64),
        M.brass,
        p.x,
        0.45,
        p.z,
      );
      rim.rotation.x = Math.PI / 2;
      const foot = mesh(
        new THREE.TorusGeometry(p.r - 0.03, 0.025, 6, 64),
        p.x < 0 ? cyan : pink,
        p.x,
        0.12,
        p.z,
      );
      foot.rotation.x = Math.PI / 2;
      const stem = mesh(
        new THREE.CylinderGeometry(0.09, 0.17, 0.7, 12),
        M.steel,
        p.x,
        0.75,
        p.z,
      );
      for (let k = 0; k < 3; k++) {
        const rm = own(
          new THREE.MeshBasicMaterial({
            color: 0xa9efff,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          }),
        );
        const ripple = mesh(
          new THREE.RingGeometry(0.97, 1, 64),
          rm,
          p.x,
          0.447 + k * 0.001,
          p.z,
        );
        ripple.rotation.x = -Math.PI / 2;
        ripple.castShadow = false;
        ripple.userData.phase = k / 3;
        rup(ripple, 0, p.r);
        ripples.push({ ripple, r: p.r });
      }
      const jet = mesh(
        new THREE.CylinderGeometry(0.028, 0.09, 1.15, 10),
        cyan,
        p.x,
        1.45,
        p.z,
      );
      jet.castShadow = false;
    }
    function rup(o, t, r) {
      const k = (t * 0.18 + o.userData.phase) % 1;
      o.scale.setScalar(0.2 + k * (r - 0.4));
      o.material.opacity = 0.26 * Math.sin(k * Math.PI);
    }
    // Shaped individual leaves instead of clusters of low-poly balls.
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5);
    shape.quadraticCurveTo(0.33, -0.12, 0, 0.5);
    shape.quadraticCurveTo(-0.33, -0.12, 0, -0.5);
    const leafGeo = own(new THREE.ShapeGeometry(shape, 3)),
      count = P.gardenTrees.length * 280;
    const leaves = new THREE.InstancedMesh(leafGeo, leaf, count);
    resources.add(leaves);
    leaves.name = "sky_garden_leaves";
    leaves.castShadow = true;
    group.add(leaves);
    const dummy = new THREE.Object3D(),
      color = new THREE.Color();
    let index = 0;
    for (const [ti, p] of P.gardenTrees.entries()) {
      mesh(
        new THREE.CylinderGeometry(p.r, p.r, 0.65, 48),
        ivory,
        p.x,
        0.325,
        p.z,
      );
      const earth = mesh(
        new THREE.CircleGeometry(p.r - 0.12, 48),
        soil,
        p.x,
        0.655,
        p.z,
      );
      earth.rotation.x = -Math.PI / 2;
      const lip = mesh(
        new THREE.TorusGeometry(p.r - 0.04, 0.04, 6, 48),
        M.brass,
        p.x,
        0.67,
        p.z,
      );
      lip.rotation.x = Math.PI / 2;
      rod([p.x, 0.65, p.z], [p.x + 0.25, 4.6, p.z + 0.12], 0.14, M.wood);
      for (let b = 0; b < 7; b++) {
        const a = b * 2.39996;
        rod(
          [p.x + 0.15, 2.2 + b * 0.24, p.z],
          [
            p.x + Math.cos(a) * 1.35,
            4.4 + Math.sin(b) * 0.5,
            p.z + Math.sin(a) * 1.35,
          ],
          0.045,
          M.wood,
        );
      }
      for (let k = 0; k < 280; k++) {
        const a = k * 2.39996,
          r = 1.7 * Math.sqrt((k + 0.5) / 280),
          h = Math.sin(k * 11.78 + ti) * 0.78;
        dummy.position.set(
          p.x + Math.cos(a) * r,
          4.25 + h + 0.65 * (1 - r / 1.7),
          p.z + Math.sin(a) * r,
        );
        dummy.rotation.set(k * 0.71, a, k * 0.29);
        dummy.scale.setScalar(0.5 + (k % 4) * 0.12);
        dummy.updateMatrix();
        leaves.setMatrixAt(index, dummy.matrix);
        color.setHSL(0.24 + (k % 7) * 0.009, 0.35, 0.26 + (k % 5) * 0.025);
        leaves.setColorAt(index++, color);
      }
      // Low ornamental grasses are contained within the same planter footprint.
      for (let k = 0; k < 14; k++) {
        const a = k * 2.39996;
        rod(
          [
            p.x + Math.cos(a) * (p.r - 0.35),
            0.66,
            p.z + Math.sin(a) * (p.r - 0.35),
          ],
          [
            p.x + Math.cos(a) * (p.r - 0.25),
            1.05 + (k % 3) * 0.1,
            p.z + Math.sin(a) * (p.r - 0.25),
          ],
          0.018,
          leaf,
        );
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    // Suspended observatory ornament leaves the entire centre route walkable.
    const sculpture = new THREE.Group();
    sculpture.position.set(0, 6.5, -3);
    sculpture.name = "sky_orbit_sculpture";
    group.add(sculpture);
    const gem = mesh(
      new THREE.OctahedronGeometry(0.68, 0),
      mat({ color: 0x617fff, metalness: 0.7, roughness: 0.17 }),
    );
    group.remove(gem);
    sculpture.add(gem);
    gem.material.userData.fzNeon = true;
    for (let i = 0; i < 2; i++) {
      const ring = mesh(
        new THREE.TorusGeometry(1.65 + i * 0.15, 0.028, 8, 72),
        i ? cyan : pink,
      );
      group.remove(ring);
      sculpture.add(ring);
      ring.rotation.set(0.5 + i * 0.8, 0.3 + i * 0.5, 0.2);
    }
    // Baked-look coloured light spill stays on visible surfaces and cannot block input.
    if (maps?.glow)
      for (const [x, z, w, d, color] of [
        [-3.8, -1.5, 4, 19, 0x2e85ff],
        [3.8, -1.5, 4, 19, 0xc23bcd],
        [-11, -4, 9, 9, 0x426eff],
        [12, 1, 9, 9, 0xe342bc],
      ]) {
        const gm = own(
          new THREE.MeshBasicMaterial({
            map: maps.glow,
            color,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        gm.userData.fzNeon = true;
        const g = mesh(new THREE.PlaneGeometry(w, d), gm, x, 0.035, z);
        g.rotation.x = -Math.PI / 2;
        g.castShadow = false;
        g.name = "sky_neon_light_pool";
      }
    let disposed = false,
      brand = null;
    if (global.FZLetterPortal)
      FZLetterPortal.load()
        .then((font) => {
          if (disposed) return;
          const g = own(
            new THREE.ExtrudeBufferGeometry(
              font.generateShapes("FANTAZIA", 1.12),
              {
                depth: 0.16,
                bevelEnabled: true,
                bevelSize: 0.016,
                bevelThickness: 0.02,
                bevelSegments: 2,
                curveSegments: 4,
              },
            ),
          );
          g.computeBoundingBox();
          g.translate(-g.boundingBox.getCenter(new THREE.Vector3()).x, 0, 0);
          brand = new THREE.Mesh(g, [lettering, M.brass]);
          brand.position.set(0, 8.25, -11.9);
          brand.name = "sky_FANTAZIA_3D";
          brand.castShadow = true;
          brand.layers.set(2);
          group.add(brand);
        })
        .catch(() => {}); // Existing readable stage sign remains if local font cannot load.
    group.traverse((o) => o.layers.set(2));
    return {
      update(t, reduced) {
        sculpture.rotation.y = reduced ? 0.3 : t * 0.13;
        gem.rotation.z = reduced ? 0.2 : Math.sin(t * 0.4) * 0.2;
        for (const { ripple, r } of ripples) rup(ripple, reduced ? 1 : t, r);
      },
      dispose() {
        disposed = true;
      },
      info: () => ({
        trees: P.gardenTrees.length,
        pools: P.gardenPools.length,
        leafInstances: count,
        brand: !!brand,
        architecture: true,
        theme: "neon-cyan-magenta",
      }),
    };
  }
  global.FZSkyGarden = { create };
})(typeof window === "undefined" ? globalThis : window);
