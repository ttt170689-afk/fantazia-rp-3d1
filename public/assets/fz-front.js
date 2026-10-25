/* v17 opening: render the ACTUAL gameplay scene, not a reconstructed city.
 * Its scene/renderer/landmarks survive into Play. Only the cast/camera belong to
 * this director. Native city construction yields between districts before login.
 */
(function () {
  "use strict";
  const P = FZOpeningPlan;
  let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    reduced ||= !!JSON.parse(localStorage.getItem("fz_play_v13"))?.reduceMotion;
  } catch {}
  let intro = false,
    phase = "",
    elapsed = 0,
    last = 0,
    raf = 0,
    bootTimer = 0,
    generation = 0;
  let bootPromise = null,
    borrowed = null,
    openingCamera = null,
    cast = null,
    portal = null,
    anchors = null,
    saved = null;
  let failed = false,
    disposed = 0,
    oldFocus = null,
    ready = false,
    renderedFrames = 0;
  const host = document.createElement("div");
  host.id = "fzFrontWorld";
  host.hidden = true;
  host.setAttribute("aria-hidden", "true");
  document.body.prepend(host);
  const root = () => document.getElementById("fzIntro");
  const shown = (id) => {
    const el = document.getElementById(id);
    return el && getComputedStyle(el).display !== "none";
  };
  const startMenu = window.START_MENU_BG,
    stopMenu = window.STOP_MENU_BG;
  function syncMenu() {
    if (
      !intro &&
      !document.hidden &&
      shown("serverScreen") &&
      !document.body.classList.contains("game-active") &&
      !window._loadingGate
    )
      startMenu?.();
    else stopMenu?.();
  }
  function ensureWorld() {
    if (bootPromise) return bootPromise;
    bootPromise = Promise.resolve().then(() => {
      if (renderer && cityWorldReady()) return;
      return initThreeJS(true);
    });
    return bootPromise;
  }
  function findAnchors() {
    const square = { ...FZRoads.spawn };
    const nativeMall = buildings.find((b) => b.type === "mall");
    const entrance = interactables.find((e) => e.type === "mall");
    const bench = sitSpots
      .filter((s) => s.type === "bench")
      .sort(
        (a, b) =>
          Math.hypot(a.x - square.x, a.z - square.z) -
          Math.hypot(b.x - square.x, b.z - square.z),
      )[0];
    if (!nativeMall?.mesh || !entrance || !bench)
      throw Error("Native city anchors unavailable");
    return {
      square,
      bench: { ...bench },
      mall: { x: nativeMall.x, z: nativeMall.z, uuid: nativeMall.mesh.uuid },
      entrance: { ...entrance.position },
    };
  }
  function borrowWorld() {
    if (borrowed) return;
    if (!renderer || !cityWorldReady()) throw Error("Native city is not ready");
    if (renderer.getContext().isContextLost())
      throw Error("WebGL context lost");
    anchors = findAnchors();
    borrowed = renderer;
    saved = {
      scene,
      sceneUUID: scene.uuid,
      fog: scene.fog,
      ratio: renderer.getPixelRatio(),
      shadows: renderer.shadowMap.enabled,
      tone: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      encoding: renderer.outputEncoding,
      lights: [window.sunLight, window.ambientLight, window.hemiLight]
        .filter(Boolean)
        .map((light) => ({
          light,
          color: light.color.clone(),
          intensity: light.intensity,
          ground: light.groundColor?.clone(),
        })),
    };
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    if (window.sunLight) {
      sunLight.color.setHex(0xffdfae);
      sunLight.intensity = 1.35;
    }
    if (window.ambientLight) {
      ambientLight.color.setHex(0xb5c3d8);
      ambientLight.intensity = 0.65;
    }
    if (window.hemiLight) {
      hemiLight.color.setHex(0xaec9ed);
      hemiLight.groundColor.setHex(0x5b5148);
      hemiLight.intensity = 0.6;
    }
    scene.fog = new THREE.Fog(
      scene.background?.isColor ? scene.background : 0x87ceeb,
      95,
      340,
    );
    openingCamera = new THREE.PerspectiveCamera(
      52,
      innerWidth / innerHeight,
      0.12,
      360,
    );
    openingCamera.userData.fzOpeningPass = true;
    cast = FZOpeningCast.create(anchors);
    portal = FZLetterPortal.create(anchors);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    ready = true;
    elapsed = 0;
    last = 0;
    renderedFrames = 0;
    root().dataset.ready = "true";
    root().dataset.letter = "true";
    root().dataset.reduced = String(reduced);
    root().querySelector(".front-loading").textContent = "";
    resize();
  }
  function releaseWorld() {
    portal?.dispose();
    portal = null;
    cast?.dispose();
    cast = null;
    if (borrowed && saved) {
      borrowed.domElement.removeEventListener("webglcontextlost", contextLost);
      saved.scene.fog = saved.fog;
      for (const entry of saved.lights) {
        entry.light.color.copy(entry.color);
        entry.light.intensity = entry.intensity;
        if (entry.ground) entry.light.groundColor.copy(entry.ground);
      }
      borrowed.setPixelRatio(saved.ratio);
      borrowed.shadowMap.enabled = saved.shadows;
      borrowed.toneMapping = saved.tone;
      borrowed.toneMappingExposure = saved.exposure;
      borrowed.outputEncoding = saved.encoding;
      disposed++;
    }
    borrowed = null;
    saved = null;
    openingCamera = null;
    ready = false;
  }
  function failure(error) {
    console.warn(
      "[FZFront] native opening unavailable:",
      error?.message || "WebGL context lost",
    );
    failed = true;
    releaseWorld();
    host.classList.add("front-fallback");
    if (root()) {
      root().dataset.ready = "false";
      root().dataset.letter = "false";
      root().style.setProperty("--opening-cut", "0");
      root().querySelector(".front-loading").textContent =
        "3D-заставка недоступна. Можно перейти ко входу.";
    }
    elapsed = 0;
    last = 0;
  }
  function contextLost() {
    if (intro) failure(new Error("WebGL context lost"));
  }
  function resize() {
    if (!openingCamera || !borrowed) return;
    openingCamera.aspect = innerWidth / innerHeight;
    openingCamera.fov = openingCamera.aspect < 1 ? 60 : 52;
    openingCamera.updateProjectionMatrix();
    borrowed.setSize(innerWidth, innerHeight);
  }
  function setPhase(next) {
    if (phase === next) return;
    phase = next;
    const el = root();
    if (!el) return;
    const p = P.phases.find((p) => p.id === phase) || P.phases[0];
    el.dataset.phase = phase;
    el.querySelector(".front-chapter").textContent = p.label;
    el.querySelector(".front-caption").textContent = p.caption;
  }
  const cameraPosition = new THREE.Vector3(),
    cameraLook = new THREE.Vector3(),
    offset = new THREE.Vector3();
  function pose(time) {
    if (!ready || !openingCamera) return;
    const frame = P.framedSample(
      time,
      anchors,
      reduced,
      openingCamera.aspect < 1,
    );
    cameraPosition.fromArray(frame.position);
    cameraLook.fromArray(frame.look);
    openingCamera.position.copy(cameraPosition);
    openingCamera.lookAt(cameraLook);
    if (!portal.pose(P.virtualTime(time), openingCamera, reduced)) {
      openingCamera.near = 0.12;
      openingCamera.updateProjectionMatrix();
    }
    cast.update(P.virtualTime(time), reduced);
    const el = root();
    // Gentle dark edit, not a white flash; disabled for reduced-motion viewers.
    const p = P.at(time, reduced),
      cut = ["neighbors", "mall", "flight"].includes(p.id) && !reduced;
    el.style.setProperty(
      "--opening-cut",
      String(cut ? Math.max(0, 1 - (time - p.start) / 0.32) * 0.45 : 0),
    );
    portal.render(borrowed, saved.scene, openingCamera, time >= 1.2);
    renderedFrames++;
  }
  function frame(now) {
    raf = 0;
    if (!intro || document.hidden) {
      last = 0;
      return;
    }
    if (last && now - last < 1000 / 30 - 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    if (ready || failed) elapsed += dt;
    if (failed) setPhase(elapsed < 2.8 ? "credit" : "title");
    else setPhase(P.at(elapsed, reduced).id);
    const duration = P.duration;
    const el = root();
    if (!el) return;
    el.querySelector(".front-progress i").style.transform =
      "scaleX(" + Math.min(1, elapsed / duration) + ")";
    if (!ready && !failed) {
      const message =
        "Готовим игровой город" +
        (window._worldBuildStep
          ? " · " +
            ({
              roads: "улицы",
              arrival: "площадь",
              quarter: "кварталы",
              shopping: "GRAND MALL",
              forest: "лес",
              lab: "лаборатория",
            }[window._worldBuildStep] || "районы")
          : "…");
      const label = el.querySelector(".front-loading");
      if (label.textContent !== message) label.textContent = message;
    }
    if (elapsed >= duration) {
      finish();
      return;
    }
    try {
      pose(elapsed);
    } catch (error) {
      failure(error);
    }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    syncMenu();
    host.hidden = !intro;
    if (!intro || document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function finish() {
    if (!intro && !root()) return;
    intro = false;
    generation++;
    clearTimeout(bootTimer);
    bootTimer = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    releaseWorld();
    root()?.remove();
    host.hidden = true;
    document.body.classList.remove("fz-intro-active");
    for (const id of ["authScreen", "serverScreen"]) {
      const node = document.getElementById(id);
      if (node) node.inert = false;
    }
    if (oldFocus?.isConnected) oldFocus.focus();
    oldFocus = null;
    phase = "menu";
    syncMenu();
  }
  function start() {
    if (document.body.classList.contains("game-active") || window._loadingGate)
      return false;
    if (intro) return true;
    const token = ++generation;
    const el = root() || document.createElement("section");
    el.id = "fzIntro";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute(
      "aria-label",
      "Заставка Fantazia RP 3D. Создано при помощи TEMKA_PLAY_OFFICIAL",
    );
    el.dataset.ready = "false";
    el.dataset.build = "22";
    el.dataset.letter = "false";
    el.innerHTML =
      '<div class="front-credit"><div class="front-credit-type"><span>Создано при помощи</span><strong>TEMKA_PLAY_OFFICIAL</strong><small class="front-build-note">ОБНОВЛЕНИЕ 28 · 3D-ПРОЛЁТ</small><i aria-hidden="true"></i></div></div><div class="front-letterbox"></div><div class="front-identity">FANTAZIA / ОБНОВЛЕНИЕ 28</div><button id="fzIntroSkip" type="button">Пропустить ↗</button><div class="front-loading" role="status" aria-live="polite">Готовим игровой город…</div><div class="front-chapter"></div><div class="front-caption"></div><div class="front-cut" aria-hidden="true"></div><div class="front-title"><span>ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ ЗДЕСЬ</span><h1>FANTAZIA</h1><strong>RP 3D</strong><small>Создано при помощи TEMKA_PLAY_OFFICIAL</small></div><div class="front-progress"><i></i></div>';
    document.body.appendChild(el);
    oldFocus = document.activeElement;
    el.querySelector("button").onclick = finish;
    el.querySelector("button").focus();
    for (const id of ["authScreen", "serverScreen"]) {
      const node = document.getElementById(id);
      if (node) node.inert = true;
    }
    intro = true;
    failed = false;
    phase = "";
    elapsed = 0;
    last = 0;
    host.classList.remove("front-fallback");
    document.body.classList.add("fz-intro-active");
    setPhase("credit");
    sync();
    // Deferred until all modules and the first credit paint exist. Skip can cancel this.
    bootTimer = setTimeout(() => {
      bootTimer = 0;
      if (!intro || token !== generation) return;
      Promise.all([
        ensureWorld(),
        FZLetterPortal.load(),
        FZOpeningAvatar.load(),
      ])
        .then(() => {
          if (intro && token === generation) {
            try {
              borrowWorld();
            } catch (error) {
              failure(error);
            }
          }
        })
        .catch((error) => {
          if (intro && token === generation) failure(error);
        });
    }, 80);
    return true;
  }
  async function prepareGame() {
    finish();
    await ensureWorld();
    if (!renderer || !cityWorldReady() || renderer.getContext().isContextLost())
      throw Error("Native world did not finish or WebGL is unavailable");
  }
  window.fzIntroEnd = finish;
  window.fziClick = finish;
  window.FZFront = {
    start,
    finish,
    prepareGame,
    active: () => intro,
    info: () => ({
      phase,
      build: 28,
      citySource: "live-gameplay-scene",
      credit: "TEMKA_PLAY_OFFICIAL",
      autoplay: "page-load",
      duration: reduced ? 9 : P.duration,
      elapsed,
      renderer: !!borrowed,
      ready,
      failed,
      disposed,
      actors: cast?.info().length || 0,
      cast: cast?.info() || [],
      acting: cast?.acting() || null,
      portal: portal?.info() || null,
      anchors: anchors ? JSON.parse(JSON.stringify(anchors)) : null,
      sceneUUID:
        saved?.sceneUUID || (typeof scene !== "undefined" ? scene?.uuid : null),
      camera: openingCamera?.position.toArray() || null,
      renderedFrames,
      drawCalls: borrowed?.info.render.calls || 0,
      reducedMotion: reduced,
    }),
  };
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener(
    "keydown",
    (e) => {
      if (!intro) return;
      if (["Escape", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        finish();
      } else if (e.key === "Tab") {
        e.preventDefault();
        root()?.querySelector("button")?.focus();
      }
    },
    true,
  );
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  for (const id of ["authScreen", "serverScreen", "playLoadOv"]) {
    const el = document.getElementById(id);
    if (el)
      observer.observe(el, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
  }
  // Seen flags never suppress the opening. No login/socket is created by this module.
  start();
})();
