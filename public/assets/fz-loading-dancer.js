/* A real gameplay GLB + dance clip, scoped to the Play loading card. */
(function () {
  "use strict";
  let active = null,
    generation = 0;
  function stop() {
    generation++;
    if (!active) return;
    cancelAnimationFrame(active.raf);
    active.mixer?.stopAllAction();
    active.mixer?.uncacheRoot(active.model);
    const textures = new Set();
    active.model?.traverse((o) => {
      if (o.skeleton?.boneTexture) textures.add(o.skeleton.boneTexture);
    });
    textures.forEach((t) => t.dispose());
    active.renderer.dispose();
    active.renderer.forceContextLoss();
    const cv = active.renderer.domElement;
    if (cv.isConnected) cv.replaceWith(cv.cloneNode(false));
    active = null;
  }
  async function start(canvas) {
    stop();
    if (!canvas) return;
    canvas = document.getElementById(canvas.id) || canvas;
    const token = generation;
    try {
      await SuperRig.sourceReady;
      if (
        token !== generation ||
        window._playLoadDanceStop ||
        !canvas.isConnected
      )
        return;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setSize(180, 200);
      renderer.outputEncoding = THREE.sRGBEncoding;
      const world = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(38, 0.9, 0.1, 30);
      camera.position.set(4, 2.5, 7);
      camera.lookAt(0, 1.5, 0);
      world.add(new THREE.HemisphereLight(0xe0efff, 0x4c3867, 1.3));
      const sun = new THREE.DirectionalLight(0xffffff, 1.5);
      sun.position.set(3, 5, 4);
      world.add(sun);
      const model = THREE.SkeletonUtils.clone(SuperRig.src.scene);
      world.add(model);
      const mixer = new THREE.AnimationMixer(model),
        clip = SuperRig.src.animations.find(
          (c) => c.name === "ANIM_Dance_Loop",
        );
      if (clip) mixer.clipAction(clip).play();
      const item = { renderer, model, mixer, clip, raf: 0, last: 0 };
      active = item;
      canvas.setAttribute("aria-label", "Игровой 3D-персонаж танцует");
      canvas.dataset.model = "player_super.glb";
      function frame(now) {
        if (active !== item) return;
        if (window._playLoadDanceStop || !canvas.isConnected) {
          stop();
          return;
        }
        const dt = item.last ? Math.min(0.05, (now - item.last) / 1000) : 0;
        item.last = now;
        if (!document.hidden) {
          mixer.update(
            matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : dt,
          );
          renderer.render(world, camera);
        }
        item.raf = requestAnimationFrame(frame);
      }
      item.raf = requestAnimationFrame(frame);
    } catch (error) {
      console.warn("Loading dancer unavailable:", error.message);
      stop();
    }
  }
  window.FZLoadingDancer = {
    start,
    stop,
    info: () => ({
      active: !!active,
      clip: active?.clip?.name,
      time: active?.mixer.time || 0,
      draws: active?.renderer.info.render.calls || 0,
      model: active ? "player_super.glb" : null,
    }),
  };
})();
