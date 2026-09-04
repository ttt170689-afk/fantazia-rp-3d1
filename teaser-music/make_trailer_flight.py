#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔════════════════════════════════════════════════════════════════════════╗
║  👁️ САУНДТРЕК v4 «ПОЛЁТ К БОССУ» — ровно по сюжету тизера (36.6с)      ║
║                                                                        ║
║  0.0–15.5  ПОЛЁТ К БОССУ: от шёпота к ИМБЕ — струны, пульс, тайко,     ║
║            литавры, райзеры, мотив взбирается (Dm→Bb→F→C)              ║
║  15.5      💡 СВЕТ ВЫКЛЮЧАЕТСЯ: мега-удар → АБСОЛЮТНЫЙ ОБРЫВ           ║
║  16.0–18.4 мёртвая тишина (только шёпот-воздух)                        ║
║  18.45–20.8 😈 БОСС СМЕЁТСЯ: зловещий гул + глухие удары (кресло едет) ║
║  20.85/21.15 👀 ГЛАЗА СВЕРКАЮТ: вспышка-удар + сияющий кластер ×2      ║
║  21.5–23.9  глаза горят в темноте: высокий тремоло-пульс               ║
║  24.8–28.2  FANTAZIA RP мигает (пульс дрона в такт миганию)            ║
║  28.2      ✂️ ПЕРЕЧЁРКИВАНИЕ: удар + скрежет вниз + тиканье            ║
║  29.8      🏬 GRAND MALL SECRET: тёмный «гранд»-аккорд + пульс          ║
║  32.0      🚀 SOON: финальный МЕГА-аккорд + колокола, тонет к 36.3     ║
╚════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
from scipy.signal import fftconvolve, stft, istft
import wave

SR = 48000
DUR = 36.6
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(5150)

# ─────────────────────────────  реверберация ───────────────────────────
def make_ir(dur=2.5, tau=0.9, lp=3500, seed_l=5, seed_r=6):
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
            er[j:j + 350] += g2 * np.linspace(1, 0, 350)
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

# ───────────────────────  инструменты ──────────────────────────────────
def strings(freq, dur, vol, attack=0.8, bright=0.55, tremolo=0.0, detune=8.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0.0, detune):
        f = freq * 2 ** (d / 1200)
        ph = 2 * np.pi * f * t
        for k in range(1, 14):
            amp = (1.0 / k ** 1.12) * np.exp(-k * 0.06 * (1.6 - bright))
            out += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    att = np.minimum(1, t / attack)
    rel = np.clip((dur - t) / 1.4, 0, 1)
    out *= att * rel
    if tremolo > 0:
        out *= (1 + 0.5 * np.sin(2 * np.pi * tremolo * t)) * 0.72
    return out

def stab(freq, dur, vol, bright=0.55):
    """Струнный стаккато (для остинато-пульса)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-6.0, 0.0, 6.0):
        f = freq * 2 ** (d / 1200)
        ph = 2 * np.pi * f * t
        for k in range(1, 11):
            amp = (1.0 / k ** 1.25) * np.exp(-k * 0.035 * (1.7 - bright))
            out += amp * np.sin(k * ph)
    at = np.minimum(1, t / 0.004)
    out *= at * np.exp(-t / (dur * 0.4))
    return out

def brass(freqs, dur, vol, attack=0.06, bright=0.4):
    """Медный аккорд (стек пилообразных + ФНЧ-подобный спад гармоник)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f0 in freqs:
        for d in (-9.0, 0.0, 9.0):
            f = f0 * 2 ** (d / 1200)
            ph = 2 * np.pi * f * t
            for k in range(1, 9):
                amp = (1.0 / k ** 1.35) * np.exp(-k * 0.12 * (1.3 - bright))
                out += amp * np.sin(k * ph)
    att = np.minimum(1, t / attack)
    rel = np.clip((dur - t) / 0.9, 0, 1)
    out *= att * rel
    return out

def taiko(t0, vol=0.3, f0=95, f1=42, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.35))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * 0.5))
    out += 0.2 * np.sin(2 * np.pi * f1 * 2 * t) * np.exp(-t / (dur * 0.3))
    c = rng.standard_normal(int(0.008 * SR))
    out[:len(c)] += c * 0.5
    place(out, t0, vol, rng.uniform(-0.15, 0.15))

def sub(t0, f0, f1, dur, vol, at=0.004):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * 0.6))
    c = rng.standard_normal(int(0.01 * SR))
    out[:len(c)] += c * 0.3
    place(out, t0, vol, 0.0)

def boom(t0, size=1.0, with_cluster=True):
    taiko(t0, 0.42 * size, 120, 28, 1.3)
    n = int(0.45 * SR)
    z = rng.standard_normal(n)
    z = np.diff(z, prepend=0)
    place(z * np.exp(-np.arange(n) / SR / 0.08), t0, 0.35 * size, 0.0)
    if with_cluster:
        for f, v in ((55, 0.4), (58.3, 0.3), (65.4, 0.2), (82.4, 0.12), (110, 0.07)):
            place(strings(f, 2.6, v * 0.03 * size, attack=0.015, bright=0.4), t0, 1.0, 0.0)
    sub(t0, 60, 18, 3.0, 0.5 * size)

def roll(t0, dur, vol0=0.05, vol1=0.3):
    t = 0.0
    gap = 0.085
    while t < dur:
        k = t / dur
        taiko(t0 + t, vol0 + (vol1 - vol0) * k, 85 - 40 * k, 40, 0.4)
        gap = max(0.03, 0.085 - k * 0.055)
        t += gap

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
    elif kind == 'fall':
        env = (1 - np.arange(n) / n) ** 1.5
    att = np.minimum(1, np.arange(n) / SR / 0.3)
    rel = np.clip(1 - (np.arange(n) / SR - dur + 0.7) / 0.7, 0, 1)
    place(x * env * att * rel, t0, vol, 0.0)

def whisper(t0, dur, vol):
    """Шёпот-воздух (после обрыва света)."""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    a = np.exp(-2 * np.pi * 1200 / SR)
    y = np.empty(n)
    acc = 0.0
    for i in range(n):
        acc += (noise[i] - acc) * a
        y[i] = acc
    # амплитудная модуляция — «дыхание шёпота»
    t = np.arange(n) / SR
    y *= (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.7 * t + 1.3))
    att = np.minimum(1, t / 0.8)
    rel = np.clip(1 - (t - dur + 1.0) / 1.0, 0, 1)
    place(y * att * rel, t0, vol, 0.4)

def bell(t0, f, dur, vol):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in ((1, 1.0), (2.0, 0.4), (2.76, 0.22), (5.4, 0.08)):
        out += a * np.sin(2 * np.pi * f * k * t)
    out *= np.exp(-t / 1.05)
    place(out, t0, vol, 0.15)

def heartbeat(t, vol, dub=0.3):
    sub(t, 90, 34, 0.28, vol)
    n = int(0.025 * SR)
    c = rng.standard_normal(n)
    c = np.diff(c, prepend=0) * np.exp(-np.arange(n) / SR / 0.009)
    place(c, t, vol * 0.5, 0.0)
    sub(t + dub, 80, 32, 0.22, vol * 0.5)

# ════════════════════════════ СКОР ════════════════════════════════════
# ── 0–15.5 ПОЛЁТ К БОССУ ──
# фундамент: мрачный дрон D + дыхание
place(strings(73.42, 15.8, 0.028, attack=2.5, bright=0.3, detune=12.0), 0.0, 1.0, 0.0)
place(strings(146.83, 15.8, 0.016, attack=2.5, bright=0.35), 0.0, 1.0, -0.2)
sub(0.0, 36.7, 36.7, 15.8, 0.02)
noise_sweep(0.3, 6.5, 350, 180, 0.012, 'wind')

# сердце-полёт: 42 → 108 bpm (луб-дуб) — «летим всё ближе»
t = 0.9
while t < 15.1:
    k = min(1.0, t / 15.3)
    bpm = 42 + k * 66
    heartbeat(t, 0.07 + k * 0.12, dub=0.3)
    t += 60.0 / bpm

# таинственный мотив (2.5с и 6.0с) — струнные соло
for tm, f, v in ((2.4, 293.66, 0.045), (3.6, 349.23, 0.04), (5.0, 293.66, 0.042)):
    place(strings(f, 2.2, v, attack=0.6, bright=0.7), tm, 1.0, 0.3)
for tm, f, v in ((6.2, 220.0, 0.05), (7.6, 261.63, 0.046), (8.8, 329.63, 0.05)):
    place(strings(f, 2.4, v, attack=0.5, bright=0.7), tm, 1.0, -0.3)

# пульс-остинато восьмыми: начинается тихо с 5.0, растёт
PATS = [73.42, 146.83, 73.42, 146.83, 73.42, 146.83, 220.0, 146.83]  # D2-D3 остинато
t = 5.0
i = 0
while t < 15.45:
    k = min(1.0, (t - 5.0) / 10.5)
    gap = 0.5 - k * 0.28          # 120 → ~270 bpm восьмых — РАЗГОН
    vol = 0.05 + k * 0.09
    bright = 0.4 + k * 0.35
    # аккорд поверх: Dm→Bb→F→C каждые ~3.8с
    chord_i = int((t - 5.0) / 3.9) % 4
    CH = {0: [146.83, 174.61, 220.0, 293.66],   # Dm
          1: [116.54, 146.83, 174.61, 233.08],  # Bb
          2: [87.31, 110.0, 174.61, 220.0],     # F
          3: [65.41, 130.81, 196.0, 261.63]}[chord_i]  # C
    if abs(t - round(t / 3.9) * 3.9) < gap * 0.6:
        # долгий аккорд на начало фразы
        if i % 2 == 0:
            place(strings(CH[0], 3.4, 0.02 + k * 0.03, attack=0.5, bright=0.45), t, 1.0, 0.0)
            place(strings(CH[2], 3.4, 0.014 + k * 0.02, attack=0.5, bright=0.45), t, 1.0, 0.15)
    place(stab(PATS[i % 8], 0.14, vol * (1.6 if i % 4 == 0 else 1.0), bright), t, 1.0,
          -0.2 if i % 2 == 0 else 0.2)
    # тайко-акценты с 8.5с
    if t > 8.5 and i % 4 == 0:
        taiko(t, 0.12 + k * 0.2, 90, 44, 0.45)
    t += gap
    i += 1

# литавры-нагнетание с 11.5
roll(11.4, 1.3, 0.06, 0.26)
noise_sweep(11.6, 1.6, 400, 7000, 0.06, 'riser')
roll(13.1, 1.6, 0.08, 0.42)
noise_sweep(13.2, 2.3, 500, 9000, 0.085, 'riser')
# оркестровые хиты перед рубильником (14.3, 14.95)
boom(14.3, 0.7)
place(brass([73.42, 110.0, 146.83, 220.0], 1.8, 0.035, attack=0.02), 14.3, 1.0, 0.0)
boom(14.95, 0.9)
place(brass([73.42, 110.0, 146.83, 220.0], 0.9, 0.045, attack=0.01), 14.95, 1.0, 0.0)

# ── 15.5 💡 СВЕТ ВЫКЛЮЧАЕТСЯ ──
boom(15.5, 2.0)
noise_sweep(15.5, 1.2, 9000, 300, 0.16, 'fall')

# ── 16.2–18.3 мёртвая тишина + шёпот ──
whisper(16.4, 1.9, 0.02)
whisper(17.6, 1.6, 0.012)
# ── 18.05 глюк ──
boom(18.05, 0.5)
for df in (0.05, 0.1):
    taiko(18.05 + df, 0.12, 300, 70, 0.2)
boom(18.45, 0.4)

# ── 18.45–20.8 😈 БОСС СМЕЁТСЯ (зловещий гул + кресло едет) ──
place(strings(36.71, 2.6, 0.05, attack=0.5, bright=0.25, detune=25.0), 18.5, 1.0, 0.0)
place(strings(38.89, 2.4, 0.035, attack=0.5, bright=0.25), 18.5, 1.0, -0.3)
place(strings(73.42, 2.6, 0.02, attack=0.5, bright=0.3, tremolo=4.5), 18.6, 1.0, 0.25)
# «хохот»-колокольчики-стаккато (сухие, как смешки) — низкие удары
for lf in (19.05, 19.35, 19.75, 20.05, 20.5):
    sub(lf, 66, 28, 0.7, 0.13 + (lf - 19.05) * 0.03)
    taiko(lf, 0.1, 70, 36, 0.4)
noise_sweep(19.6, 1.1, 150, 1800, 0.04, 'riser')
noise_sweep(20.55, 0.4, 1000, 6000, 0.03, 'riser')

# ── 20.85 / 21.15 👀 ГЛАЗА СВЕРКАЮТ ×2 ──
def eye_flash(tt, size):
    boom(tt, size)
    # сияющий кластер — вспышка
    for f, v in ((1318.5, 0.02), (1396.9, 0.014), (1567.98, 0.016), (1760.0, 0.01)):
        place(strings(f, 1.6, v * size, attack=0.008, bright=0.95, tremolo=7.0), tt + 0.02, 1.0,
              0.4 if f < 1500 else -0.4)
    noise_sweep(tt, 0.5, 3000, 12000, 0.09 * size, 'riser')
    sub(tt, 70, 20, 2.2, 0.4 * size)

eye_flash(20.85, 1.3)
eye_flash(21.15, 0.95)

# ── 21.5–23.9 глаза горят: высокий пульс-дрон ──
place(strings(1318.5, 2.5, 0.007, attack=1.0, bright=0.9, tremolo=6.2, detune=14.0), 21.5, 1.0, 0.35)
place(strings(1244.5, 2.5, 0.005, attack=1.0, bright=0.9, tremolo=6.0), 21.5, 1.0, -0.35)
place(strings(55.0, 2.5, 0.02, attack=0.6, bright=0.25), 21.6, 1.0, 0.0)
for pb in (21.9, 22.5, 23.1):
    sub(pb, 64, 26, 0.6, 0.09)

# ── 24.8 ТИТРЫ: FANTAZIA RP мигает ──
place(strings(55.0, 3.8, 0.02, attack=1.0, bright=0.3), 24.9, 1.0, 0.0)
place(strings(110.0, 3.8, 0.012, attack=1.0, bright=0.4, tremolo=4.0), 24.9, 1.0, 0.2)
# пульс в такт миганию (~0.75с)
for bl in (25.3, 26.05, 26.8, 27.55):
    sub(bl, 84, 30, 0.5, 0.16)
    place(strings(220.0, 0.4, 0.012, attack=0.02, bright=0.6), bl, 1.0, -0.2)

# ── 28.2 ✂️ ПЕРЕЧЁРКИВАНИЕ ──
boom(28.2, 1.1)
noise_sweep(28.2, 1.1, 6000, 150, 0.08, 'fall')   # скрежет-зачёркивание вниз
place(strings(58.27, 1.5, 0.03, attack=0.03, bright=0.3), 28.2, 1.0, 0.2)
# тиканье ускоряется к SECRET
tt = 28.55
gap = 0.33
while tt < 29.75:
    place(stab(2350.0, 0.08, 0.03 + (tt - 28.55) * 0.02, 0.9), tt, 1.0, -0.5)
    gap *= 0.86
    tt += gap
noise_sweep(29.0, 0.85, 300, 6000, 0.05, 'riser')
sub(29.78, 100, 26, 0.6, 0.3)

# ── 29.8 🏬 GRAND MALL SECRET: тёмный гранд-аккорд + пульс ──
place(brass([110.0, 130.81, 164.81, 220.0], 2.6, 0.05, attack=0.05, bright=0.3), 29.8, 1.0, 0.0)
place(brass([55.0, 65.41, 82.41], 2.6, 0.04, attack=0.05, bright=0.25), 29.8, 1.0, -0.2)
for k in range(6):
    bt = 29.8 + k * 0.5
    taiko(bt, 0.2 + (k % 2) * 0.08, 88, 40, 0.4)
    place(stab(220.0 if k % 2 == 0 else 233.08, 0.13, 0.03, 0.5), bt, 1.0, 0.15)
noise_sweep(31.2, 0.8, 400, 7000, 0.05, 'riser')

# ── 32.0 🚀 SOON: финальный МЕГА-аккорд ──
boom(32.0, 2.3)
place(brass([73.42, 110.0, 146.83, 220.0, 293.66], 4.6, 0.07, attack=0.02, bright=0.4), 32.0, 1.0, 0.0)
place(brass([55.0, 58.27, 65.41], 4.4, 0.05, attack=0.02, bright=0.3), 32.0, 1.0, -0.25)
place(strings(1318.5, 3.6, 0.01, attack=0.1, bright=0.95, tremolo=7.5, detune=16.0), 32.2, 1.0, 0.4)
roll(32.1, 1.4, 0.07, 0.3)
for bt, f, v in ((33.1, 440.0, 0.045), (33.9, 293.66, 0.04), (34.7, 220.0, 0.035), (35.5, 146.83, 0.028)):
    bell(bt, f, 2.8, v)
# сердце-последний удар
heartbeat(34.5, 0.12, dub=0.4)
heartbeat(35.1, 0.1, dub=0.4)

# ───────────────────────────  РЕВЕРБ + МАСТЕР ─────────────────────────
dryL = L.copy()
dryR = R.copy()
dry_peak = max(float(np.abs(dryL).max()), float(np.abs(dryR).max())) or 1.0
dryL *= 0.88 / dry_peak
dryR *= 0.88 / dry_peak

gains = [
    (0.0, 15.5, 1.0), (15.5, 16.3, 2.2), (16.3, 18.35, 0.08),
    (18.35, 18.9, 1.1), (18.9, 20.8, 0.8), (20.8, 21.6, 1.9),
    (21.6, 24.7, 0.55), (24.7, 28.2, 0.95), (28.2, 29.8, 1.2),
    (29.8, 32.0, 1.4), (32.0, 36.6, 2.6),
]
g = np.ones(N)
for a, b, v in gains:
    g[int(a * SR):int(b * SR)] = v
dryL *= g
dryR *= g

mid = (dryL + dryR) * 0.5
wetL = reverb(mid, IRL)
wetR = reverb(mid, IRR)
L = dryL + wetL * 0.62
R = dryR + wetR * 0.62
mix = np.stack([L, R])
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
peak = np.max(np.abs(mix)) or 1.0
mix *= 0.95 / peak

# жёсткий обрыв света: 16.2 → ноль, глюк врывается
env = np.ones(N)
for i in range(N):
    t = i / SR
    if 16.2 <= t < 16.55:
        env[i] = 1 - ((t - 16.2) / 0.35) ** 2
    elif 16.55 <= t < 17.95:
        env[i] = 0.0
    elif 17.95 <= t < 18.07:
        env[i] = (t - 17.95) / 0.12
mix *= env

# тонет в тишину к концу тизера
fade_t = np.arange(N) / SR
fade = np.clip(1 - (fade_t - 34.6) / 1.9, 0, 1)
mix *= fade

pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
frames = pcm.tobytes()
with wave.open('trailer-flight.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(frames)
print(f'trailer-flight.wav: {DUR}s peak={peak:.3f}')

try:
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(320)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    with open('trailer-flight.mp3', 'wb') as f:
        f.write(enc.encode(frames) + enc.flush())
    print('trailer-flight.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
