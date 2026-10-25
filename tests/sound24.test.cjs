const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(
  path.join(root, "public/assets/fz-sound.js"),
  "utf8",
);
function harness(saved = "null", broken = false) {
  const dom = new JSDOM(
    '<body><div id="authScreen" style="display:none"></div><div id="serverScreen" style="display:flex"></div></body>',
    {
      url: "https://game.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  w.localStorage.setItem("fz_sound24", saved);
  w.setInterval = () => 0;
  const param = () => ({
    value: 0,
    cancelScheduledValues() {},
    setValueAtTime(v) {
      this.value = v;
    },
    setTargetAtTime(v) {
      this.value = v;
    },
    linearRampToValueAtTime(v) {
      this.value = v;
    },
    exponentialRampToValueAtTime(v) {
      this.value = v;
    },
  });
  const node = () => ({
    connect() {},
    disconnect() {},
    gain: param(),
    frequency: param(),
    Q: param(),
    start() {},
    stop(at) {
      if (at > 0 || this.stopped) return;
      this.stopped = true;
      this.onended?.();
    },
  });
  const ctx = {
    currentTime: 0,
    sampleRate: 22050,
    state: "running",
    destination: node(),
    createGain: node,
    createOscillator: node,
    createBufferSource: node,
    createBiquadFilter: node,
    createMediaElementSource: node,
    createDynamicsCompressor: () => ({
      ...node(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    }),
    createBuffer: (_, length) => ({
      getChannelData: () => new Float32Array(length),
    }),
    decodeAudioData: async () => ({ duration: 24 }),
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    },
    resume() {
      this.state = "running";
      return Promise.resolve();
    },
  };
  let getCount = 0,
    resolveFetch,
    fetchCount = 0;
  w.getAudioCtx = () => {
    getCount++;
    if (broken) throw Error("no audio hardware");
    return ctx;
  };
  w.fetch = () => {
    fetchCount++;
    return new Promise((r) => {
      resolveFetch = () =>
        r({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    });
  };
  w.Audio = class extends w.EventTarget {
    paused = true;
    currentTime = 0;
    play() {
      this.paused = false;
      this.dispatchEvent(new w.Event("playing"));
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      this.dispatchEvent(new w.Event("pause"));
    }
  };
  w.FZMetroAudio = { stop() {} };
  w.eval(code);
  return {
    w,
    dom,
    ctx,
    api: w.FZSound,
    counts: () => ({ getCount, fetchCount }),
    resolve: () => resolveFetch?.(),
  };
}
(async () => {
  for (const [name, seconds] of [
    ["neon-route", 24],
    ["above-clouds", 26.6666667],
    ["last-train", 20],
  ]) {
    const data = fs.readFileSync(
      path.join(root, "public/audio/music", name + ".wav"),
    );
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WAVE");
    assert.equal(data.readUInt16LE(22), 2);
    assert.equal(data.readUInt32LE(24), 22050);
    assert.equal(data.readUInt16LE(34), 16);
    assert(Math.abs((data.length - 44) / 4 / 22050 - seconds) < 0.001);
    let peak = 0,
      sum = 0,
      n = 0;
    for (let i = 44; i < data.length; i += 2) {
      const x = data.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(x));
      sum += x * x;
      n++;
    }
    assert(peak < 0.73 && peak > 0.7);
    assert(Math.sqrt(sum / n) > 0.08);
    // The cyclic score wraps reverb and note tails rather than inserting silent padding.
    for (let channel = 0; channel < 2; channel++)
      assert(
        Math.abs(
          data.readInt16LE(44 + channel * 2) -
            data.readInt16LE(data.length - 4 + channel * 2),
        ) < 500,
      );
  }
  for (const id of ["welcome", "sky", "city", "credit"])
    assert(
      fs.statSync(path.join(root, "public/audio/city", id + ".mp3")).size >
        10000,
    );
  const h = harness('{"music":99,"master":-2,"sfx":"1","enabled":"false"}');
  assert.equal(h.api.info().prefs.music, 1);
  assert.equal(h.api.info().prefs.master, 0);
  assert.equal(h.api.info().prefs.sfx, 0.65);
  assert.equal(h.api.info().prefs.enabled, true);
  assert.deepEqual(h.counts(), { getCount: 0, fetchCount: 0 });
  h.api.set({ master: 0.8, music: 0.4 });
  h.api.unlock();
  assert.equal(h.counts().fetchCount, 1);
  h.api.set({ enabled: false });
  h.resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(
    h.api.info().playing,
    false,
    "late buffer decode cannot revive a muted loop",
  );
  assert.equal(h.api.info().masterGain, 0);
  assert.equal(h.api.info().sources, 0);
  h.api.set({ enabled: true });
  await new Promise((r) => setImmediate(r));
  assert.equal(h.api.info().playing, true);
  assert(h.api.say("welcome"));
  assert(h.api.info().ducked);
  assert(h.api.info().gains.music < 0.11);
  h.api.stopVoice();
  assert.equal(h.api.info().ducked, false);
  assert.equal(h.api.say("../secret"), false);
  h.api.effect("doors");
  h.api.effect("chime");
  assert(h.api.info().sources <= 40);
  Object.defineProperty(h.w.document, "hidden", {
    configurable: true,
    get: () => true,
  });
  h.w.document.dispatchEvent(new h.w.Event("visibilitychange"));
  assert.equal(h.api.info().sources, 0);
  assert.equal(h.api.info().playing, false);
  assert.equal(h.ctx.state, "suspended");
  assert.equal(h.api.info().masterGain, 0);
  h.dom.window.close();
  const bad = harness("{broken", true);
  assert.equal(bad.api.info().prefs.music, 0.38);
  assert.doesNotThrow(() => {
    bad.api.unlock();
    bad.api.tick();
  });
  assert.equal(bad.api.info().blocked, true);
  bad.dom.window.close();
  console.log(
    "PASS sound24: finite/validated preferences, no eager context/network, three non-clipping exact PCM loops, four recorded voices, stale decode cancellation, bounded effects, priority/duck release, hidden cleanup and audio-unavailable fallback.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
