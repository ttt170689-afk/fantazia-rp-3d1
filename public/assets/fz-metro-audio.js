/* Local selected-voice recordings. One player; no overlapping announcements or prelogin autoplay. */
(function () {
  "use strict";
  let enabled = true,
    volume = 0.7,
    active = false,
    last = "",
    audio = null,
    subtitle = null,
    blocked = false,
    generation = 0,
    subtitleTimer;
  try {
    const p = JSON.parse(localStorage.getItem("fz_metro_audio23"));
    if (typeof p?.enabled === "boolean") enabled = p.enabled;
    if (Number.isFinite(p?.volume)) volume = Math.max(0, Math.min(1, p.volume));
  } catch {}
  const captions = {
    arrival:
      "К платформе прибывает поезд Кольцевой линии. Отойдите от края платформы.",
    close: "Осторожно, двери закрываются. Следующая станция указана на табло.",
    ...Object.fromEntries(
      FZMetroPolicy.stations.map((s) => [
        s.id,
        "Станция «" + s.name + "». " + s.exit + ".",
      ]),
    ),
  };
  function expireSubtitle(delay) {
    clearTimeout(subtitleTimer);
    subtitleTimer = setTimeout(() => { if (subtitle) subtitle.hidden = true; }, delay);
  }
  function stop() {
    generation++;
    clearTimeout(subtitleTimer);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    last = "";
    if (subtitle) subtitle.hidden = true;
  }
  function say(id) {
    if (!active || !captions[id] || document.hidden) return;
    stop();
    last = id;
    if (!subtitle) {
      subtitle = document.createElement("div");
      subtitle.id = "fzMetroSubtitle";
      subtitle.setAttribute("role", "status");
      document.body.append(subtitle);
    }
    subtitle.textContent = captions[id];
    subtitle.hidden = false;
    blocked = false;
    const readingTime = () => Math.max(4000, Math.min(20000, subtitle.textContent.length * 65 + 2000));
    expireSubtitle(readingTime());
    const mix = window.FZSound?.info();
    if (
      !enabled ||
      (mix &&
        (!mix.unlocked ||
          !mix.prefs.enabled ||
          !mix.prefs.master ||
          !mix.prefs.voice))
    )
      return;
    window.FZSound?.stopVoice();
    if (!audio) {
      audio = new Audio();
      audio.preload = "none";
      window.FZSound?.pipeVoice(audio);
      audio.onplaying = () => { clearTimeout(subtitleTimer); if (active && last && subtitle) subtitle.hidden = false; };
      audio.onwaiting = () => expireSubtitle(readingTime());
      audio.onended = () => expireSubtitle(1500);
      audio.onerror = () => { blocked = true; expireSubtitle(readingTime()); };
    }
    const recorded=["arrival","close","center","factory","park","port","business"];
    if(!recorded.includes(id))return; // New station names have honest text announcements, no missing audio requests.
    audio.src = "audio/metro/" + id + ".mp3";
    audio.volume = volume;
    const token = generation;
    audio
      .play()
      .then(() => {
        if (token === generation) blocked = false;
      })
      .catch(() => {
        if (token === generation) { blocked = true; expireSubtitle(readingTime()); }
      });
  }
  function set(v, on = enabled) {
    volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : volume;
    enabled = !!on;
    if (audio) audio.volume = volume;
    if (!enabled && audio) { audio.pause(); expireSubtitle(6000); }
    try {
      localStorage.setItem(
        "fz_metro_audio23",
        JSON.stringify({ volume, enabled }),
      );
    } catch {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  window.FZMetroAudio = {
    say,
    stop,
    set,
    activate(v) {
      active = !!v;
      if (!active) stop();
    },
    info: () => ({
      enabled,
      volume,
      active,
      last,
      blocked,
      playing: !!audio && !audio.paused,
    }),
  };
})();
