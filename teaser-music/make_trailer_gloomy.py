#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔════════════════════════════════════════════════════════════════════════╗
║  🕳️ СУПЕР-МРАЧНЫЙ САУНДТРЕК ТРЕЙЛЕРА v3 «БЕЗДНА»                       ║
║                                                                        ║
║  ДЛИНА = РОВНО СКОЛЬКО ИДЁТ ТИЗЕР: 24.8с показ + 11.5с титры           ║
║  (автозакрытие teaser.html через 11500мс после t=24.8) → ~36.5с        ║
║                                                                        ║
║  Характер — СУПЕР МРАЧНО:                                              ║
║   - подземный гул: A0 + Bb0 (малая секунда в суб-басе) — «бездна»      ║
║   - тяжёлое медленное сердце (луб-дуб 40→80 BPM)                       ║
║   - далёкие тёмные колокола (C#2)                                      ║
║   - стоны виолончели (медленные глиссандо вниз)                        ║
║   - глухие подземные удары с суб-свипом до 16 Гц                       ║
║   - почти мёртвая тишина в паузах (по-настоящему тихо)                 ║
║   - финал: тёмный минорный колокольный звон, медленно тонет            ║
╚════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
from scipy.signal import fftconvolve, stft, istft
import wave

SR = 48000
DUR = 36.6                      # ровно под тизер (24.8 + 11.5 + хвост)
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(1301)

# ─────────────────────────────  реверберация ───────────────────────────
def make_ir(dur=2.8, tau=0.85, lp=2200, seed_l=3, seed_r=4):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = []
    for seed in (seed_l, seed_r):
        g = np.random.default_rng(seed)
        noise = g.standard_normal(n)
        a = np.exp(-2 * np.pi * lp / SR)
        y = np.empty(n)
        acc = 0.0
        for i in range(n):
            acc += (noise[i] - acc) * a
            y[i] = acc
        env = np.exp(-t / tau)
        er = np.zeros(n)
        for off, g2 in ((0.012, 0.5), (0.021, 0.33), (0.034, 0.2), (0.052, 0.12), (0.075, 0.07)):
            j = int(off * SR)
            er[j:j + 400] += g2 * np.linspace(1, 0, 400)
        y = y * env * 2.2 + er * noise * 0.06
        y = y / np.sqrt(np.sum(y * y))
        out.append(y)
    return out

IRL, IRR = make_ir()

def reverb(mix, ir):
    return fftconvolve(mix, ir)[:N]

def place(arr, t0, vol, pan=0.0):
    s = int(t0 * SR)
    e = min(N, s + len(arr))
    if s >= N or e <= 0:
        return
    seg = arr[:e - s]
    gl = np.cos((pan + 1) * np.pi / 4)
    gr = np.sin((pan + 1) * np.pi / 4)
    L[s:e] += seg * vol * gl
    R[s:e] += seg * vol * gr

# ─────────────────────  мрачные инструменты ────────────────────────────
def drone(freq, dur, vol, attack=3.0, detune=12.0, dark=0.35):
    """Глубокий мрачный дрон: 3 голоса, гармоники, тёмный (мало верхов)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0.0, detune):
        f = freq * 2 ** (d / 1200)
        ph = 2 * np.pi * f * t
        for k in range(1, 10):
            amp = (1.0 / k ** 1.5) * np.exp(-k * (1.4 - dark))
            out += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    att = np.minimum(1, t / attack)
    rel = np.clip((dur - t) / 2.0, 0, 1)
    out *= att * rel
    return out

def cello(f0, f1, dur, vol, attack=0.4):
    """Стон виолончели: глиссандо вниз, широкий детюн, тёплый тёмный."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-14.0, 0.0, 14.0):
        f = (f0 + (f1 - f0) * (t / dur)) * 2 ** (d / 1200)
        ph = 2 * np.pi * np.cumsum(f) / SR
        for k in range(1, 9):
            amp = (1.0 / k ** 1.3) * np.exp(-k * 0.15)
            out += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    att = np.minimum(1, t / attack)
    rel = np.clip((dur - t) / 1.6, 0, 1)
    out *= att * rel
    return out

def sub(t0, f0, f1, dur, vol, at=0.004):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.45))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * 0.62))
    c = rng.standard_normal(int(0.01 * SR))
    out[:len(c)] += c * 0.3
    place(out, t0, vol, 0.0)

def heart(t, vol, dub=0.30):
    """Тяжёлое глухое сердце."""
    sub(t, 84, 32, 0.3, vol)
    n = int(0.03 * SR)
    c = rng.standard_normal(n)
    c = np.diff(c, prepend=0) * np.exp(-np.arange(n) / SR / 0.01)
    place(c, t, vol * 0.5, 0.0)
    sub(t + dub, 72, 30, 0.24, vol * 0.5)

def dark_bell(t0, f, dur, vol):
    """Тёмный колокол: негармоничные низкие частичные."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in ((1, 1.0), (1.19, 0.45), (2.0, 0.25), (2.83, 0.12), (5.01, 0.05)):
        out += a * np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28))
    out *= np.exp(-t / (dur * 0.42))
    out[:int(0.003 * SR)] += rng.standard_normal(int(0.003 * SR)) * 0.5
    return out

def rumb_noise(t0, dur, vol, lo=0.015):
    """Низкий гул-шум «земли»."""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    a = np.exp(-2 * np.pi * lo * SR / SR * 0.25)  # очень низкий
    # проще: однополюсный ФНЧ на 30 Гц
    a = np.exp(-2 * np.pi * 30 / SR)
    y = np.empty(n)
    acc = 0.0
    for i in range(n):
        acc += (noise[i] - acc) * a
        y[i] = acc
    env = np.ones(n)
    att = np.minimum(1, np.arange(n) / SR / 2.0)
    rel = np.clip(1 - (np.arange(n) / SR - dur + 2.0) / 2.0, 0, 1)
    place(y * att * rel * 2.5, t0, vol, 0.0)

def boom(t0, size=1.0):
    """Подземный удар: суб-свип до 16 Гц + низкий гул-кластер."""
    sub(t0, 60, 16, 3.4, 0.55 * size)
    n = int(0.5 * SR)
    z = rng.standard_normal(n)
    z = np.diff(z, prepend=0)
    envz = np.exp(-np.arange(n) / SR / 0.07)
    place(z * envz, t0, 0.18 * size, 0.0)
    for f, v in ((27.5, 0.5), (29.14, 0.4), (32.7, 0.3), (55, 0.18), (58.3, 0.12)):
        place(drone(f, 3.0, v * 0.03 * size, attack=0.02, dark=0.5), t0, 1.0, 0.0)

def noise_sweep(t0, dur, f0, f1, vol, kind='riser'):
    n = int(dur * SR)
    noise = rng.standard_normal(n + 2048)
    f, ts, Z = stft(noise, fs=SR, nperseg=2048, noverlap=1536)
    K = Z.shape[1]
    cents = np.linspace(0, 1, K)
    center = f0 * (f1 / f0) ** cents
    mask = np.exp(-(((f[:, None] - center[None, :]) / (center[None, :] * 0.5)) ** 2))
    Zf = Z * mask
    _, x = istft(Zf, fs=SR, nperseg=2048, noverlap=1536)
    x = x[:n]
    env = np.ones(n)
    if kind == 'riser':
        env = (np.arange(n) / n) ** 1.9
    elif kind == 'fall':
        env = (1 - np.arange(n) / n) ** 1.4
    att = np.minimum(1, np.arange(n) / SR / 0.4)
    rel = np.clip(1 - (np.arange(n) / SR - dur + 0.7) / 0.7, 0, 1)
    place(x * env * att * rel, t0, vol, 0.0)

def scrape(t0, dur, vol):
    """Скрежет вниз (для перечёркивания)."""
    noise_sweep(t0, dur, 2600, 120, vol, 'fall')

# ════════════════════════════ СКОР ════════════════════════════════════
# ── 0–15.5 «БЕЗДНА»: гул A0+Bb0 + сердце + колокола + стоны ──
place(drone(27.5, 15.8, 0.10, attack=2.5, detune=14.0, dark=0.45), 0.0, 1.0, 0.0)
place(drone(29.14, 15.8, 0.075, attack=3.0, detune=14.0, dark=0.45), 0.0, 1.0, -0.15)
place(drone(55.0, 15.8, 0.03, attack=3.0, detune=8.0, dark=0.35), 0.0, 1.0, 0.1)
place(drone(58.27, 15.8, 0.02, attack=4.0, detune=8.0, dark=0.35), 0.0, 1.0, 0.2)
rumb_noise(0.2, 15.4, 0.045)
# стоны виолончели — очень медленно и низко
place(cello(98.0, 73.4, 6.5, 0.045, attack=2.5), 2.2, 1.0, -0.35)
place(cello(87.3, 65.4, 6.8, 0.05, attack=2.5), 8.6, 1.0, 0.35)
place(cello(110, 55, 4.5, 0.05, attack=1.8), 12.4, 1.0, -0.2)
# далёкие тёмные колокола
for bt, f in ((4.6, 73.42), (9.3, 65.41), (13.1, 55.0)):
    place(dark_bell(bt, f, 6.0, 0.10 if bt < 10 else 0.12), bt, 1.0, 0.25)
# 💓 тяжёлое сердце 40→80 BPM
t = 1.0
while t < 15.1:
    k = min(1.0, t / 15.2)
    bpm = 40 + k * 40
    vol = 0.10 + k * 0.16
    heart(t, vol, dub=0.33)
    t += 60.0 / bpm
heart(14.9, 0.30, dub=0.3)
# медленный подъём к рубильнику
noise_sweep(12.6, 2.9, 60, 2400, 0.05, 'riser')
place(drone(110, 3.2, 0.014, attack=0.3, dark=0.5), 12.9, 1.0, 0.0)

# ── 15.5 РУБИЛЬНИК: провал в бездну ──
boom(15.5, 1.4)
place(drone(27.5, 4.2, 0.08, attack=0.05, dark=0.4), 15.5, 1.0, 0.0)
place(drone(29.14, 4.2, 0.06, attack=0.05, dark=0.4), 15.5, 1.0, -0.2)
noise_sweep(15.5, 2.2, 5000, 90, 0.05, 'fall')
# ── 16.8–18.4: почти МЁРТВАЯ тишина ──
place(drone(27.5, 1.6, 0.012, attack=0.4, dark=0.5), 17.0, 1.0, 0.0)

# ── 18.05 ГЛЮЧ: глухие толчки ──
for df in (0.0, 0.06, 0.12, 0.2):
    boom(18.05 + df, 0.5 - df * 0.6)
boom(18.5, 0.6)

# ── 18.45 КРЕСЛО: стон + тяжёлые шаги ──
place(cello(220, 61.7, 2.8, 0.06, attack=0.8), 18.45, 1.0, 0.3)
place(cello(196, 55.0, 2.4, 0.045, attack=0.8), 18.9, 1.0, -0.3)
for st, v in ((19.1, 0.3), (19.8, 0.34), (20.5, 0.38)):
    sub(st, 68, 24, 1.0, v)
    sub(st + 0.04, 60, 26, 0.8, v * 0.5)
noise_sweep(19.7, 1.15, 60, 900, 0.035, 'riser')

# ── 20.85 / 21.15: два провала ──
boom(20.85, 1.7)
boom(21.15, 1.25)
place(drone(55.0, 3.4, 0.05, attack=0.03, dark=0.35), 20.85, 1.0, 0.0)
place(drone(58.27, 3.2, 0.035, attack=0.03, dark=0.35), 21.15, 1.0, -0.15)
rumb_noise(21.3, 2.6, 0.06)
# стон-затихание 22.8–24.6
place(cello(82.4, 55.0, 2.2, 0.028, attack=1.0), 23.0, 1.0, 0.1)

# ── 24.8 ТИТРЫ: мёртвая тишина + редкое глухое сердце ──
for hb, v in ((25.7, 0.15), (26.0, 0.08), (27.0, 0.14), (27.3, 0.07)):
    heart(hb, v, dub=0.35)
place(drone(27.5, 2.6, 0.02, attack=1.2, dark=0.55), 25.4, 1.0, 0.0)
place(dark_bell(27.6, 55.0, 2.4, 0.05), 27.6, 1.0, -0.3)

# ── 28.2 ПЕРЕЧЁРКИВАНИЕ ──
boom(28.2, 1.2)
scrape(28.2, 1.2, 0.06)
place(drone(29.14, 1.8, 0.05, attack=0.04, dark=0.45), 28.2, 1.0, 0.2)
# глухие удары-тик (ксилофон внизу), ускоряются
tt = 28.6
gap = 0.34
while tt < 29.76:
    sub(tt, 110, 52, 0.18, 0.16)
    gap *= 0.86
    tt += gap
noise_sweep(29.0, 0.85, 50, 800, 0.04, 'riser')

# ── 29.8 GRAND MALL SECRET: тёмный пульс + минор ──
for k in range(6):
    bt = 29.8 + k * 0.5
    sub(bt, 72, 26, 0.7, 0.24 + (k % 2) * 0.06)
# тёмный минор: Am7b5 (A C Eb G) низко
place(drone(55.0, 2.8, 0.045, attack=0.3, dark=0.35), 29.8, 1.0, 0.0)
place(drone(65.41, 2.8, 0.032, attack=0.3, dark=0.35), 29.8, 1.0, 0.2)
place(drone(77.78, 2.8, 0.026, attack=0.3, dark=0.35), 29.8, 1.0, -0.2)
place(cello(55.0, 65.41, 2.3, 0.035, attack=0.5), 29.95, 1.0, 0.3)
place(cello(49.0, 55.0, 2.2, 0.032, attack=0.5), 30.6, 1.0, -0.3)
noise_sweep(31.3, 0.75, 40, 700, 0.035, 'riser')

# ── 32.0 SOON: БЕЗДНА РАЗВЕРЗАЕТСЯ ──
boom(32.0, 2.0)
sub(32.0, 50, 14, 4.5, 0.6)
place(drone(27.5, 4.6, 0.075, attack=0.04, dark=0.35), 32.0, 1.0, 0.0)
place(drone(29.14, 4.4, 0.055, attack=0.04, dark=0.35), 32.0, 1.0, -0.2)
place(drone(65.41, 4.0, 0.028, attack=0.04, dark=0.4), 32.0, 1.0, 0.25)
rumb_noise(32.0, 3.6, 0.1)
# мрачный колокольный перезвон (минор): A1 C2 Eb2 A1
for bt, f, v in ((33.0, 55.0, 0.09), (33.9, 65.41, 0.07), (34.8, 77.78, 0.055), (35.4, 55.0, 0.05)):
    place(dark_bell(bt, f, 3.0, v), bt, 1.0, 0.2)
# последнее сердце перед темнотой
heart(34.6, 0.12, dub=0.4)
heart(35.3, 0.10, dub=0.4)
# ── финал: всё медленно тонет к 36.3 (конец тизера) ──
place(drone(27.5, 3.4, 0.03, attack=1.0, dark=0.5), 33.4, 1.0, 0.0)

# ───────────────────────────  РЕВЕРБ + МАСТЕР ─────────────────────────
dryL = L.copy()
dryR = R.copy()
dry_peak = max(float(np.abs(dryL).max()), float(np.abs(dryR).max())) or 1.0
dryL *= 0.9 / dry_peak
dryR *= 0.9 / dry_peak

gains = [
    (0.0, 15.5, 1.0), (15.5, 16.9, 2.0), (16.9, 18.35, 0.10),
    (18.35, 18.9, 1.4), (18.9, 20.8, 0.8), (20.8, 22.6, 2.1),
    (22.6, 24.7, 0.14), (24.7, 28.2, 0.9), (28.2, 29.8, 1.15),
    (29.8, 32.0, 1.3), (32.0, 36.6, 2.4),
]
g = np.ones(N)
for a, b, v in gains:
    g[int(a * SR):int(b * SR)] = v
dryL *= g
dryR *= g

mid = (dryL + dryR) * 0.5
wetL = reverb(mid, IRL)
wetR = reverb(mid, IRR)
L = dryL + wetL * 0.6
R = dryR + wetR * 0.6
mix = np.stack([L, R])
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
peak = np.max(np.abs(mix)) or 1.0
mix *= 0.95 / peak

# тонет в тишину с 34.5 до 36.4 (конец тизера ~36.3)
fade_t = np.arange(N) / SR
fade = np.clip(1 - (fade_t - 34.5) / 1.9, 0, 1)
mix *= fade

# жёсткий «обрыв в бездну» после рубильника: резко к нулю за 0.4с,
# мёртвая тишина, затем глюк 18.05 врывается мгновенно
env = np.ones(N)
for i in range(N):
    t = i / SR
    if 16.55 <= t < 16.95:
        k = (t - 16.55) / 0.4
        env[i] = max(0.0, 1 - k ** 2)
    elif 16.95 <= t < 18.0:
        env[i] = 0.0
    elif 18.0 <= t < 18.12:
        env[i] = (t - 18.0) / 0.12
mix *= env

pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
frames = pcm.tobytes()
with wave.open('trailer-gloomy.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(frames)
print(f'trailer-gloomy.wav: {DUR}s (тизер ≈ 36.3с) peak={peak:.3f}')

try:
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(320)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    with open('trailer-gloomy.mp3', 'wb') as f:
        f.write(enc.encode(frames) + enc.flush())
    print('trailer-gloomy.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
