#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔════════════════════════════════════════════════════════════════════════╗
║  🎬🎻 КИНО-САУНДТРЕК ТРЕЙЛЕРА v3 — «ОРКЕСТРОВЫЙ ХОРРОР» (альтернатива) ║
║                                                                        ║
║  Вторая версия — совсем другой характер:                               ║
║   - струнный ОСТИНАТО, который разгоняется как «В пещере горного       ║
║     короля» (52 BPM → 170 BPM) и становится ярче и громче              ║
║   - диссонанс малой секунды A–B♭ (классический хоррор)                 ║
║   - литавры, timpani-роллы, taiko-удары                                ║
║   - визжащие скрипки (высокие кластеры с биениями)                     ║
║   - оркестровые хиты на рубильнике и финале                            ║
║   - тихий луб-дуб сердца в титрах                                      ║
║                                                                        ║
║  Синхронизация с teaser.html: рубильник 15.5 · глюк 18.05 ·            ║
║  кресло 18.45 · грохот 20.85/21.15 · титры 24.8 · перечёркивание 28.2 · ║
║  SECRET 29.8 · SOON 32.0                                               ║
╚════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
from scipy.signal import fftconvolve, stft, istft
import wave

SR = 48000
DUR = 39.4
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(4242)

# ─────────────────────────────  реверберация ───────────────────────────
def make_ir(dur=2.2, tau=0.72, lp=3400, seed_l=11, seed_r=22):
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
        for off, g2 in ((0.011, 0.5), (0.019, 0.33), (0.031, 0.22), (0.048, 0.14), (0.068, 0.09)):
            j = int(off * SR)
            er[j:j + 300] += g2 * np.linspace(1, 0, 300)
        y = y * env * 2.0 + er * noise * 0.05
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

# ───────────────────────  инструменты оркестра ─────────────────────────
def strings(freq, dur, vol, attack=0.9, bright=0.55, tremolo=0.0, detune=7.0):
    """Струнная секция: 3 голоса с расстройкой, гармоники 1..14, тремоло."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0.0, detune):
        f = freq * 2 ** (d / 1200)
        ph = 2 * np.pi * f * t
        for k in range(1, 15):
            amp = (1.0 / k ** 1.15) * np.exp(-k * 0.05 * (1.6 - bright))
            out += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    att = np.minimum(1, t / attack)
    rel = np.clip((dur - t) / 1.6, 0, 1)
    out *= att * rel
    if tremolo > 0:
        out *= (1 + 0.55 * np.sin(2 * np.pi * tremolo * t)) * 0.72
    return out

def stab(freq, dur, vol, bright=0.55):
    """Короткий струнный стаккато-удар (для остинато и хитов)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-6.0, 0.0, 6.0):
        f = freq * 2 ** (d / 1200)
        ph = 2 * np.pi * f * t
        for k in range(1, 11):
            amp = (1.0 / k ** 1.3) * np.exp(-k * 0.03 * (1.7 - bright))
            out += amp * np.sin(k * ph)
    at = np.minimum(1, t / 0.006)
    out *= at * np.exp(-t / (dur * 0.42))
    return out

def taiko(t0, vol=0.3, f0=95, f1=42, dur=0.5, ring=True):
    """Литавра/тайко: свип с остаточным гулом."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.35))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * 0.5))
    if ring:  # лёгкий резонанс-обертон
        out += 0.25 * np.sin(2 * np.pi * f1 * 2.0 * t) * np.exp(-t / (dur * 0.3))
    c = rng.standard_normal(int(0.008 * SR))
    out[:len(c)] += c * 0.5
    place(out, t0, vol, rng.uniform(-0.2, 0.2))

def roll(t0, dur, vol0=0.06, vol1=0.3, f0=80, f1=45):
    """Timpani-ролл: учащающиеся удары + нарастание."""
    t = 0.0
    gap = 0.09
    i = 0
    while t < dur:
        k = t / dur
        taiko(t0 + t, vol0 + (vol1 - vol0) * k, f0 - (f0 - f1) * k, 40, 0.4)
        gap = max(0.028, 0.09 - k * 0.062)
        t += gap
        i += 1

def boom(t0, size=1.0):
    """Оркестровый удар: тайко + медный кластер + саб."""
    taiko(t0, 0.42 * size, 120, 30, 1.4)
    n = int(0.4 * SR)
    z = rng.standard_normal(n)
    z = np.diff(z, prepend=0)
    place(z * np.exp(-np.arange(n) / SR / 0.09), t0, 0.4 * size, -0.1)
    for f, v in ((55, 0.5), (58.3, 0.38), (62, 0.3), (82.4, 0.22), (110, 0.12)):
        place(strings(f, 3.2, v * 0.05 * size, attack=0.02, bright=0.35), t0, 1.0, 0.0)
    place(strings(41.2, 3.6, 0.5 * size, attack=0.02, bright=0.3), t0, 1.0, 0.2)

def scream(t0, dur=2.0, vol=0.014, f0=1568, f1=1760):
    """Визжащие скрипки: пара высоких тонов с биениями (малая секунда)."""
    place(strings(f0, dur, vol, attack=0.5, bright=0.9, tremolo=6.4, detune=10.0), t0, 1.0, 0.4)
    place(strings(f0 * 1.029, dur, vol * 0.8, attack=0.5, bright=0.9, tremolo=6.1, detune=10.0), t0 + 0.03, 1.0, -0.4)

def gliss(t0, f0, f1, dur, vol, bright=0.8, wtype='saw'):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph)
    if wtype == 'saw':
        s = 2 * (ph / (2 * np.pi) % 1.0) - 1.0
    for k in range(2, 8):
        if wtype == 'saw':
            s += (1 / k) * 2 * ((k * ph) / (2 * np.pi) % 1.0) - 1.0 / k
    out = s * np.minimum(1, t / 0.05) * np.exp(-t / (dur * 0.6))
    place(out, t0, vol, 0.1)

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
        env = (np.arange(n) / n) ** 1.7
    else:
        env = 0.7 + 0.3 * np.sin(2 * np.pi * 0.25 * np.arange(n) / SR)
    att = np.minimum(1, np.arange(n) / SR / 0.3)
    rel = np.clip(1 - (np.arange(n) / SR - dur + 0.8) / 0.8, 0, 1)
    place(x * env * att * rel, t0, vol, 0.0)

def subdrop(t0, f0, f1, dur, vol):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * 0.6))
    place(out, t0, vol, 0.0)

# ════════════════════════════ СКОР ════════════════════════════════════
# ── 0–15.5: ОСТИНАТО разгоняется 52→170 BPM ──
# низкий педальный диссонанс A + Bb
place(strings(55.0, 15.8, 0.035, attack=2.0, bright=0.3, detune=14.0), 0.0, 1.0, 0.0)
place(strings(58.27, 15.8, 0.02, attack=2.5, bright=0.3), 0.0, 1.0, -0.2)
place(strings(27.5, 15.8, 0.03, attack=2.0, bright=0.2, detune=8.0), 0.0, 1.0, 0.1)
# визг-настроение: тихая тревожная секунда A5/Bb5, вползает к 13с
place(strings(880, 15.0, 0.004, attack=9.0, bright=0.9, tremolo=5.0, detune=12.0), 0.5, 1.0, 0.3)
place(strings(932.3, 15.0, 0.003, attack=9.0, bright=0.9, tremolo=5.2), 0.5, 1.0, -0.3)
noise_sweep(0.6, 6.0, 500, 260, 0.014, 'wind')

# остинато: A–C–A–Bb с ускорением и ростом яркости/громкости
pat = [220.0, 261.63, 220.0, 233.08]
t = 0.35
i = 0
while t < 15.2:
    k = min(1.0, t / 15.2)
    gap = 0.52 - k * 0.35            # 0.52 → 0.17 с (~115 → ~170 bpm восьмых)
    vol = 0.055 + k * 0.075
    bright = 0.35 + k * 0.3
    f = pat[i % 4]
    # акцентные струнные
    place(stab(f, 0.16, vol, bright), t, 1.0, -0.25 if i % 2 else 0.25)
    # бас-октава на сильную долю
    if i % 4 == 0 and t > 1.2:
        place(stab(f / 2, 0.22, vol * 0.55, bright * 0.8), t, 1.0, 0.0)
    # литавра-акцент каждые 8 пульсов (с 3с)
    if i % 8 == 0 and t > 3.0:
        taiko(t, 0.16 + k * 0.1, 92, 44, 0.5)
    # тихое сердце за остинато (луб-дуб, ускоряется 60→100)
    if i % 2 == 0:
        hk = 0.5 + k * 0.5
        subdrop(t - 0.02, 88, 34, 0.22, 0.045 * hk)
        subdrop(t + 0.09, 80, 34, 0.18, 0.028 * hk)
    t += gap
    i += 1

# последний всплеск перед рубильником: ролл + райзер
roll(13.6, 1.9, 0.05, 0.34, 90, 42)
noise_sweep(13.5, 2.0, 300, 6500, 0.06, 'riser')
gliss(14.6, 120, 900, 1.0, 0.03, 0.9)

# ── 15.5 РУБИЛЬНИК ──
boom(15.5, 1.25)
scream(15.9, 1.5, 0.016, 1661, 1864)
gliss(15.5, 2500, 200, 1.2, 0.05, 0.9)
noise_sweep(15.5, 2.0, 7000, 800, 0.07, 'wind')

# ── 17–18.5: жуткая тишина (только хвост эха) ──

# ── 18.05 ГЛЮЧ ──
boom(18.05, 0.7)
for df in (0, 0.04, 0.09, 0.15):
    taiko(18.05 + df, 0.14, 300, 60, 0.25)
place(stab(311.1, 0.3, 0.12, 0.75), 18.05, 1.0, -0.4)  # D#/Eb диссонанс
boom(18.5, 0.45)

# ── 18.45 КРЕСЛО: скрип (глиссандо вниз) + шаги ──
gliss(18.45, 1200, 150, 1.3, 0.04, 0.85)
gliss(18.9, 1000, 140, 1.2, 0.028, 0.85)
noise_sweep(18.45, 1.5, 900, 150, 0.03, 'wind')
for st, v in ((19.05, 0.24), (19.7, 0.28), (20.35, 0.3)):
    taiko(st, v, 85, 36, 0.55)
roll(19.9, 0.95, 0.05, 0.3, 110, 60)

# ── 20.85 / 21.15 ГРОХОТ ──
boom(20.85, 1.8)
boom(21.15, 1.3)
scream(21.3, 2.6, 0.018, 1568, 1976)
roll(22.2, 1.0, 0.04, 0.2, 70, 35)
# ── 22.6–24.7: виолончельный диссонанс затихает ──
place(strings(110, 1.8, 0.02, attack=0.3, bright=0.35, detune=18.0), 22.8, 1.0, 0.2)
place(strings(116.5, 1.8, 0.014, attack=0.3, bright=0.35), 22.8, 1.0, -0.2)

# ── 24.8 ТИТРЫ: сердце + тремоло-воздух ──
place(strings(55, 3.6, 0.02, attack=0.8, bright=0.25), 24.9, 1.0, 0.0)
place(strings(880, 3.4, 0.0035, attack=1.0, bright=0.9, tremolo=4.6), 24.9, 1.0, 0.3)
for hb, v in ((25.6, 0.13), (25.9, 0.07), (26.9, 0.12), (27.2, 0.06)):
    subdrop(hb, 92, 34, 0.24, v)
    subdrop(hb + 0.09, 84, 34, 0.2, v * 0.55)

# ── 28.2 ПЕРЕЧЁРКИВАНИЕ ──
boom(28.2, 1.15)
gliss(28.2, 3000, 240, 1.1, 0.05, 0.9)
scream(28.3, 1.4, 0.009, 1760, 2093)
# деревянный тик-так (ускоряется) — ксилофон-стаккато
tt = 28.55
gap = 0.33
while tt < 29.75:
    k2 = (tt - 28.55) / 1.2
    place(stab(2350.0, 0.09, 0.035 + k2 * 0.02, 0.9), tt, 1.0, -0.4)
    gap *= 0.86
    tt += gap
roll(29.0, 0.8, 0.05, 0.32, 130, 60)

# ── 29.8 GRAND MALL SECRET: маршевый пульс струнных ──
for k in range(8):
    bt = 29.8 + k * 0.25
    place(stab(220 if k % 2 == 0 else 233.08, 0.14, 0.05 + (k % 2) * 0.02, 0.5), bt, 1.0, -0.2)
    taiko(29.8 + k * 0.5, 0.2 + (k % 2) * 0.06, 90, 40, 0.4)
place(strings(110, 2.4, 0.024, attack=0.3, bright=0.35, tremolo=5.0), 29.8, 1.0, 0.0)
place(strings(220, 2.4, 0.016, attack=0.3, bright=0.45, tremolo=5.0), 29.8, 1.0, 0.3)
gliss(31.2, 150, 900, 0.9, 0.04, 0.9)

# ── 32.0 SOON: ФИНАЛЬНЫЙ ОРКЕСТРОВЫЙ УДАР ──
boom(32.0, 2.2)
scream(32.05, 3.0, 0.02, 1661, 2093)
roll(32.1, 1.6, 0.08, 0.34, 80, 32)
# медные кластеры
place(strings(55, 5.0, 0.045, attack=0.05, bright=0.45), 32.0, 1.0, 0.0)
place(strings(58.27, 5.0, 0.035, attack=0.05, bright=0.45), 32.0, 1.0, -0.2)
place(strings(61.74, 4.6, 0.03, attack=0.05, bright=0.5), 32.0, 1.0, 0.2)
place(strings(123.47, 4.4, 0.02, attack=0.05, bright=0.55), 32.0, 1.0, -0.1)
# высокий тремоло-кластер на всё затухание
place(strings(1174.7, 4.0, 0.008, attack=0.2, bright=0.9, tremolo=8.0, detune=20.0), 32.2, 1.0, 0.4)
# колокол-набат
def belln(t0, f, vol, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in ((1, 1.0), (2.0, 0.4), (2.76, 0.22), (5.4, 0.08)):
        out += a * np.sin(2 * np.pi * f * k * t)
    out *= np.exp(-t / 1.1)
    place(out, t0, vol, 0.1)
for bt, f, v in ((33.0, 110.0, 0.05), (33.8, 146.83, 0.04), (34.6, 110.0, 0.035),
                 (35.6, 82.41, 0.03), (36.3, 110.0, 0.022)):
    belln(bt, f, v, 2.8)
# редкое сердце в самом конце
subdrop(34.8, 90, 34, 0.25, 0.05)
subdrop(37.0, 88, 34, 0.25, 0.04)

# ───────────────────────────  РЕВЕРБ + МАСТЕР ─────────────────────────
dryL = L.copy()
dryR = R.copy()
dry_peak = max(float(np.abs(dryL).max()), float(np.abs(dryR).max())) or 1.0
dryL *= 0.85 / dry_peak
dryR *= 0.85 / dry_peak

gains = [
    (0.0, 15.5, 1.0), (15.5, 17.0, 2.6), (17.0, 18.0, 0.9),
    (18.0, 18.9, 1.5), (18.9, 20.8, 1.05), (20.8, 22.8, 2.4),
    (22.8, 24.7, 1.0), (24.7, 28.2, 1.0), (28.2, 29.8, 1.2),
    (29.8, 32.0, 1.35), (32.0, 36.5, 2.7),
]
g = np.ones(N)
for a, b, v in gains:
    g[int(a * SR):int(b * SR)] = v
dryL *= g
dryR *= g

mid = (dryL + dryR) * 0.5
wetL = reverb(mid, IRL)
wetR = reverb(mid, IRR)
L = dryL + wetL * 0.55
R = dryR + wetR * 0.55
mix = np.stack([L, R])
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
peak = np.max(np.abs(mix)) or 1.0
mix *= 0.95 / peak

# драматический «обрыв» после рубильника: звук вырезается почти в ноль,
# затем глюк (18.05) врывается из тишины
env = np.ones(N)
e1, e2, e3 = 16.85, 17.7, 18.35
for i in range(N):
    t = i / SR
    if e1 <= t < e2:
        env[i] = 1 - 0.95 * (t - e1) / (e2 - e1)
    elif e2 <= t < e3:
        env[i] = 0.05 + 0.95 * ((t - e2) / (e3 - e2)) ** 1.5
mix *= env

fade_t = np.arange(N) / SR
fade = np.clip(1 - (fade_t - 36.3) / 2.5, 0, 1)
mix *= fade

pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
frames = pcm.tobytes()
with wave.open('trailer-cinematic2.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(frames)
print(f'trailer-cinematic2.wav: {DUR}s, peak={peak:.3f}')

try:
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(320)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    with open('trailer-cinematic2.mp3', 'wb') as f:
        f.write(enc.encode(frames) + enc.flush())
    print('trailer-cinematic2.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
