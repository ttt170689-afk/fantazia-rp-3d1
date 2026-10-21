/* Real beveled type geometry. The lens crosses the EMPTY counter of A, not a CSS zoom.
 * Layer 1 is a depth-isolated title pass over the SAME native scene. No second city.
 * Font is local, licensed and cached; every GPU resource below is owned/disposed here. */
(function (root) {
  "use strict";
  const TEXT = "TEMKA_PLAY_OFFICIAL",
    SIZE = 3,
    DEPTH = 2.8;
  let font = null,
    loading = null;
  function load() {
    if (font) return Promise.resolve(font);
    if (!loading)
      loading = fetch("fonts/helvetiker_bold.typeface.json")
        .then((r) => {
          if (!r.ok) throw Error("Opening font unavailable");
          return r.json();
        })
        .then((data) => (font = new THREE.FontLoader().parse(data)));
    return loading;
  }
  function create(anchors, providedFont = font) {
    if (!providedFont) throw Error("Opening font not loaded");
    const P = FZOpeningPlan,
      group = new THREE.Group();
    group.name = "fz_letter_portal";
    group.userData.openingOnly = true;
    const aShape = providedFont.generateShapes("A", SIZE)[0],
      hole = aShape.holes[0];
    if (!hole) throw Error("A must contain a real aperture");
    const points = hole.getPoints(8),
      unique = points.filter((p, i) => i === 0 || !p.equals(points[0]));
    const center = unique
      .reduce((v, p) => v.add(p), new THREE.Vector2())
      .divideScalar(unique.length);
    const prefix = [..."TEMK"].reduce(
      (x, ch) =>
        x +
        (providedFont.data.glyphs[ch].ha * SIZE) / providedFont.data.resolution,
      0,
    );
    const holeInText = new THREE.Vector3(prefix + center.x, center.y, 0);
    const geometry = new THREE.ExtrudeBufferGeometry(
      providedFont.generateShapes(TEXT, SIZE),
      {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.055,
        bevelSize: 0.025,
        bevelSegments: 3,
        curveSegments: 6,
        steps: 1,
      },
    );
    geometry.translate(-holeInText.x, -holeInText.y, -DEPTH / 2);
    geometry.computeBoundingBox();
    const face = new THREE.MeshStandardMaterial({
      color: 0xc7d6ff,
      metalness: 0.5,
      roughness: 0.28,
      emissive: 0x33308c,
      emissiveIntensity: 0.18,
      fog: false,
    });
    const side = new THREE.MeshStandardMaterial({
      color: 0x35176e,
      metalness: 0.45,
      roughness: 0.24,
      fog: false,
    });
    const text = new THREE.Mesh(geometry, [face, side]);
    text.name = "TEMKA_PLAY_OFFICIAL_3D";
    group.add(text);
    const edgeGeo = new THREE.EdgesGeometry(geometry, 28),
      edgeMat = new THREE.LineBasicMaterial({
        color: 0x8ce6ff,
        transparent: true,
        opacity: 0.24,
        fog: false,
      });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));
    const hemi = new THREE.HemisphereLight(0xe4f1ff, 0x324158, 1.3);
    group.add(hemi);
    const key = new THREE.DirectionalLight(0xffe9c6, 2);
    key.position.set(-9, 14, 15);
    group.add(key);
    group.add(key.target);
    const rim = new THREE.DirectionalLight(0x8abaff, 1.4);
    rim.position.set(16, 3, 8);
    group.add(rim);
    group.add(rim.target);
    // Lit outlines inside the real A counter make the depth readable during passage.
    const extra = new Set(),
      ribs = new THREE.Group();
    ribs.name = "A_counter_light_ribs";
    const pathPoints = hole
      .getPoints(3)
      .map(
        (p) =>
          new THREE.Vector3(
            (p.x - center.x) * 0.94,
            (p.y - center.y) * 0.94,
            0,
          ),
      );
    const glow = new THREE.MeshBasicMaterial({
      color: 0x58cbff,
      fog: false,
      toneMapped: false,
    });
    extra.add(glow);
    const lineCurve = new THREE.CurvePath();
    for (let i = 1; i < pathPoints.length; i++)
      lineCurve.add(new THREE.LineCurve3(pathPoints[i - 1], pathPoints[i]));
    if (!pathPoints[0].equals(pathPoints[pathPoints.length - 1]))
      lineCurve.add(
        new THREE.LineCurve3(pathPoints[pathPoints.length - 1], pathPoints[0]),
      );
    const ribGeo = new THREE.TubeGeometry(lineCurve, 24, 0.009, 5, true);
    extra.add(ribGeo);
    for (let i = 0; i < 7; i++) {
      const rib = new THREE.Mesh(ribGeo, glow);
      rib.position.z = -DEPTH / 2 + 0.1 + (i * (DEPTH - 0.2)) / 6;
      ribs.add(rib);
    }
    group.add(ribs);
    // A quiet title chamber fades away BEFORE entering the letter: the view through A
    // then shows the actual playable city, never a prerecorded video or another world.
    const bgGeo = new THREE.PlaneGeometry(900, 900),
      bgMat = new THREE.MeshBasicMaterial({
        color: 0x080e22,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      });
    const backdrop = new THREE.Mesh(bgGeo, bgMat);
    backdrop.position.z = -8;
    backdrop.renderOrder = -10;
    group.add(backdrop);
    extra.add(bgGeo);
    extra.add(bgMat);
    const dustGeo = new THREE.BufferGeometry(),
      dustPositions = [];
    for (let i = 0; i < 100; i++)
      dustPositions.push(
        Math.sin(i * 32.71) * 36,
        Math.cos(i * 17.31) * 14,
        -2 - Math.abs(Math.sin(i * 4.3)) * 4,
      );
    dustGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(dustPositions, 3),
    );
    const dustMat = new THREE.PointsMaterial({
      color: 0x8fafff,
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    group.add(dust);
    extra.add(dustGeo);
    extra.add(dustMat);
    group.traverse((o) => o.layers.set(1));
    scene.add(group);
    const centerText = geometry.boundingBox.getCenter(new THREE.Vector3()),
      dimensions = geometry.boundingBox.getSize(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0),
      normal = new THREE.Vector3(),
      end = new THREE.Vector3(),
      look = new THREE.Vector3(),
      matrix = new THREE.Matrix4(),
      local = new THREE.Vector3();
    let z = 0,
      crossed = false,
      disposed = false;
    function configure(aspect, portrait) {
      const frame = P.framedSample(9, anchors, false, portrait);
      end.fromArray(frame.position);
      look.fromArray(frame.look);
      normal.copy(end).sub(look).normalize();
      group.position.copy(end).addScaledVector(normal, 4);
      matrix.lookAt(group.position, look, up);
      group.quaternion.setFromRotationMatrix(matrix);
      group.updateMatrixWorld(true);
      // Fit the WHOLE credit in either orientation before selecting A.
      const tangent = Math.tan(
        THREE.MathUtils.degToRad(portrait ? 60 : 52) / 2,
      );
      return (
        Math.max(
          dimensions.x / (2 * tangent * aspect),
          dimensions.y / (2 * tangent),
        ) * 1.32
      );
    }
    function pose(time, camera, reduced = false) {
      const portrait = camera.aspect < 0.9,
        far = configure(camera.aspect, portrait),
        q = Math.max(0, Math.min(1, (time - 3) / 6));
      group.visible = time < (reduced ? 3 : 9);
      if (!group.visible) return false;
      let x = centerText.x,
        y = centerText.y;
      z = far;
      let yaw = reduced
        ? 0
        : 0.16 * (1 - P.smooth(Math.max(0, time - 3) / 1.8));
      if (!reduced && q > 0) {
        if (q < 1 / 3) {
          const k = P.smooth(q * 3);
          x *= 1 - k;
          y *= 1 - k;
          z = far + (1.8 - far) * k;
        } else if (q < 0.86) {
          // Spend about 2.5 seconds INSIDE the 2.8 m letter, not one invisible frame.
          x = y = 0;
          z = 1.8 + (-1.8 - 1.8) * ((q - 1 / 3) / (0.86 - 1 / 3));
        } else {
          x = y = 0;
          z = -1.8 + (-4 + 1.8) * P.smooth((q - 0.86) / 0.14);
        }
      }
      const lateral = Math.sin(yaw) * z;
      local.set(
        x + lateral,
        y + (reduced ? 0 : Math.sin(time * 0.8) * 0.08 * (1 - P.smooth(q * 3))),
        z,
      );
      camera.position
        .copy(local)
        .applyQuaternion(group.quaternion)
        .add(group.position);
      camera.quaternion.copy(group.quaternion);
      if (yaw) camera.rotateY(yaw);
      bgMat.opacity = 1 - P.smooth((time - 3.1) / 1.3);
      backdrop.visible = bgMat.opacity > 0.001;
      dustMat.opacity = reduced ? 0 : 0.45 * (1 - P.smooth((time - 3) / 2));
      dust.rotation.z = reduced ? 0 : time * 0.008;
      glow.color.setHSL(0.57 + 0.025 * Math.sin(time * 1.4), 0.7, 0.72);
      camera.near = 0.018;
      camera.updateProjectionMatrix();
      crossed = z < -DEPTH / 2;
      return true;
    }
    function render(renderer, world, camera) {
      // Keep city/depth out of the lettering pass so a distant foreground building
      // cannot cover the credit. The actual glyph hole remains unfilled and ray-testable.
      const mask = camera.layers.mask,
        background = world.background,
        auto = renderer.autoClear;
      try {
        camera.layers.set(0);
        renderer.render(world, camera);
        if (group.visible) {
          renderer.clearDepth();
          renderer.autoClear = false;
          world.background = null;
          camera.layers.set(1);
          renderer.render(world, camera);
        }
      } finally {
        camera.layers.mask = mask;
        world.background = background;
        renderer.autoClear = auto;
      }
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      group.parent?.remove(group);
      geometry.dispose();
      edgeGeo.dispose();
      face.dispose();
      side.dispose();
      edgeMat.dispose();
      extra.forEach((r) => r.dispose());
    }
    function info() {
      return {
        letter: "A",
        text: TEXT,
        depth: DEPTH,
        cameraLocalZ: z,
        inside: Math.abs(z) < DEPTH / 2,
        counterRibs: ribs.children.length,
        passageSeconds: 2.47,
        crossed,
        visible: group.visible,
        holeLocal: [0, 0, 0],
        holeWorld: group.position.toArray(),
        meshUUID: text.uuid,
        geometry: "extruded-font-with-counter",
      };
    }
    return { root: group, text, pose, render, dispose, info };
  }
  const api = { load, create, TEXT, SIZE, DEPTH };
  root.FZLetterPortal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
