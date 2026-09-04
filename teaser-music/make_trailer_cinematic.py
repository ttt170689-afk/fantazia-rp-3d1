#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔════════════════════════════════════════════════════════════════════════╗
║  🎬 КИНЕМАТОГРАФИЧНЫЙ САУНДТРЕК ТРЕЙЛЕРА v2 — «НЕ 8-БИТ»              ║
║                                                                        ║
║  - СТЕРЕО 48 кГц                                                       ║
║  - Свёрточная реверберация «каменный зал» (2.4 с, стерео IR)          ║
║  - Тёплые струнные пэды: 3 расстроенных голоса × 12 гармоник, вибрато ║
║  - Калимба/колокола с негармоничными обертонами                        ║
║  - Живое СЕРДЦЕБИЕНИЕ: суб-свип 96→36 Гц + шумовой щелчок,             ║
║    разгоняется 52→115 BPM и усиливается по мере приближения к 15.5     ║
║  - Кинематографичные удары: саб-свип + шум + низкий кластер + хвост    ║
║                                                                        ║
║  Структура: Am(add9) → Fmaj7/A → Cmaj9/G → Em(add9) — мелодия          ║
║  калимбы на пентатонике; с 15.5 — удары по таймлайну тизера            ║
╚════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
from scipy.signal import fftconvolve, stft, istft
import wave, struct, math

SR = 48000
DUR = 39.4
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)

rng = np.random.default_rng(777)

# ─────────────────────────────  реверберация ───────────────────────────
def make_ir(dur=2.4, tau=0.9, lp=3600, seed_l=1, seed_r=2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = []
    for seed in (seed_l, seed_r):
        g = np.random.default_rng(seed)
        noise = g.standard_normal(n)
        # однополюсный ФНЧ
        a = np.exp(-2 * np.pi * lp / SR)
        y = np.empty(n)
        acc = 0.0
        for i in range(n):            # ~115k итераций — терпимо
            acc += (noise[i] - acc) * a
            y[i] = acc
        env = np.exp(-t / tau)
        # ранние отражения
        er = np.zeros(n)
        for off, g2 in ((0.011, 0.5), (0.019, 0.33), (0.031, 0.22), (0.048, 0.14), (0.068, 0.09)):
            j = int(off * SR)
            er[j:j + 300] += g2 * np.linspace(1, 0, 300)
        y = y * env * 2.0 + er * noise * 0.05
        # нормируем энергию IR ≈ 1 — уровень свёртки будет честным
        y = y / np.sqrt(np.sum(y * y))
        out.append(y)
    return out

IRL, IRR = make_ir()
def reverb(mix, ir):
    full = fftconvolve(mix, ir)
    return full[:N]

# ─────────────────────────────  базовые звуки ──────────────────────────
def place(arr, t0, vol, pan=0.0):
    """Добавить моно-массив в стерео с панорамой pan ∈ [-1,1]."""
    s = int(t0 * SR)
    e = min(N, s + len(arr))
    if s >= N or e <= 0:
        return
    seg = arr[: e - s]
    gl = math.cos((pan + 1) * math.pi / 4)
    gr = math.sin((pan + 1) * math.pi / 4)
    L[s:e] += seg * vol * gl
    R[s:e] += seg * vol * gr

def pad(freq, dur, vol, attack=1.6, bright=0.55, vib=0.16):
    """Тёплый струнный пэд: 3 расстроенных голоса × гармоники 1..12."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    detunes = (-6.0, 0.0, 6.0) if freq > 130 else (-9.0, 0.0, 9.0)
    for d in detunes:
        f = freq * 2 ** (d / 1200)
        ph = 2 * np.pi * f * t
        for k in range(1, 13):
            amp = (1.0 / k ** 1.1) * np.exp(-k * 0.14 * (1.6 - bright))
            out += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    # огибающая: медленная атака, релиз
    att = np.minimum(1, t / attack)
    rel = np.minimum(1, (dur - t) / 1.8)
    rel = np.clip(rel, 0, 1)
    # дыхание
    breath = 1 + 0.03 * np.sin(2 * np.pi * vib * t + rng.uniform(0, 6.28))
    out *= att * rel * breath
    return out

def pluck(freq, dur, vol, tau=0.8):
    """Калимба/челеста: негармоничные обертоны с экспоненциальным спадом."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.42), (3, 0.18), (4, 0.07)):
        f = freq * k * (1 + 0.0009 * k * k)
        out += a * np.sin(2 * np.pi * f * t)
    out *= np.exp(-t / tau)
    # лёгкий шумовой щипок
    click = rng.standard_normal(int(0.004 * SR))
    out[:len(click)] += click * 0.12
    return out

def bell(freq, dur, vol):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in ((1, 1.0), (2.0, 0.32), (2.76, 0.18), (5.4, 0.07)):
        f = freq * k
        out += a * np.sin(2 * np.pi * f * t)
    out *= np.exp(-t / 1.1)
    return out

def subdrop(t0, f0, f1, dur, vol, click=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * 0.55))
    if click > 0:
        c = rng.standard_normal(int(0.006 * SR))
        out[:len(c)] += c * click
    place(out, t0, vol)

def impact(t0, size=1.0):
    """Кинематографичный удар."""
    subdrop(t0, 74, 26, 1.6, 0.42 * size)
    # шумовой транзиент
    n = int(0.4 * SR)
    noise = rng.standard_normal(n)
    hp = np.diff(noise, prepend=0.0)
    env = np.exp(-np.arange(n) / SR / 0.08)
    place(hp * env * 0.5, t0, 0.5 * size, -0.1)
    # низкий гул-кластер
    for f, a in ((52, 0.9), (55, 0.7), (58.3, 0.55), (49.5, 0.5), (62.5, 0.3)):
        place(pad(f, 2.6, a * 0.12, attack=0.02, bright=0.3), t0, 0.5 * size)
    # саб-хвост
    subdrop(t0, 44, 24, 3.2, 0.30 * size)

def heartbeat(t, vol, dub=0.28):
    """Луб-дуб: 96→36 Гц + щелчок, затем мягкий второй толчок."""
    subdrop(t, 98, 36, 0.26, vol)
    n = int(0.02 * SR)
    c = rng.standard_normal(n)
    c = np.diff(c, prepend=0)
    place(c * np.exp(-np.arange(n) / SR / 0.006), t, vol * 0.9, 0.0)
    if dub > 0:
        subdrop(t + dub, 84, 34, 0.22, vol * 0.55)
        place(c * np.exp(-np.arange(n) / SR / 0.007), t + dub, vol * 0.5, 0.0)

def noise_sweep(t0, dur, f0, f1, vol, kind='riser', q=0.45):
    """Шум с полосой, плывущей f0→f1 (stft-фильтр)."""
    n = int(dur * SR)
    noise = rng.standard_normal(n + 2048)
    f, ts, Z = stft(noise, fs=SR, nperseg=2048, noverlap=1536)
    K = Z.shape[1]
    cents = np.linspace(0, 1, K)
    center = f0 * (f1 / f0) ** cents
    mask = np.exp(-(((f[:, None] - center[None, :]) / (center[None, :] * q)) ** 2))
    Zf = Z * mask
    _, x = istft(Zf, fs=SR, nperseg=2048, noverlap=1536)
    x = x[:n]
    env = np.ones(n)
    if kind == 'riser':
        env = (np.arange(n) / n) ** 1.8
    elif kind == 'wind':
        env = 0.6 + 0.4 * np.sin(2 * np.pi * 0.22 * np.arange(n) / SR + 1)
    att = np.minimum(1, np.arange(n) / SR / 0.4)
    rel = np.clip(1 - (np.arange(n) / SR - dur + 0.6) / 0.6, 0, 1)
    place(x * env * att * rel, t0, vol)

# ───────────────────────  СКОР: подход 0–15.5 ─────────────────────────
#  Красивая печальная гармония: Am(add9) → Fmaj7/A → Cmaj9/G → Em(add9)
#  (numpy-пэды с перекрытием 0.6 с для плавных переходов)
chords = [
    # (старт, длительность, [(частота, громкость), ...], бас, усиление секции)
    (0.0,  4.2, [(220, .055), (261.63, .042), (329.63, .045), (493.88, .012), (587.33, .008)], 55.0, 0.55),
    (3.9,  4.2, [(174.61, .065), (220, .06), (261.63, .042), (329.63, .042), (440, .01)], 55.0, 0.75),
    (7.8,  4.2, [(196, .06), (261.63, .06), (329.63, .055), (493.88, .014), (587.33, .009)], 49.0, 0.9),
    (11.6, 4.4, [(164.81, .075), (246.94, .05), (329.63, .085), (369.99, .025), (440, .012)], 41.2, 1.2),
]
for (t0, d, voices, bass, gch) in chords:
    pan = -0.25
    for f, v in voices:
        place(pad(f, d + 1.2, v * gch, attack=1.5, bright=0.6, vib=0.15 + (f % 3) * 0.02), t0, 1.0, pan)
        pan = -pan
    place(pad(bass * 2, d + 1.2, 0.05 * gch, attack=1.2, bright=0.35), t0, 1.0, 0.0)
    subdrop(t0, bass, bass, d, 0.075 * math.sqrt(gch))
# басовый педальный тон A на весь подход
subdrop(0.0, 55, 55, 15.8, 0.028)

# мелодия калимбы (тихая, с эхом зала)
melody = [
    (0.9, 659.26), (2.7, 587.33), (4.5, 523.25), (6.2, 659.26),
    (8.0, 587.33), (9.8, 493.88), (11.6, 523.25), (13.2, 587.33),
    (13.95, 659.26), (10.4, 1318.5),
]
for t, f in melody:
    place(pluck(f, 2.0, 1.0, tau=0.9), t, 0.10 if f > 1000 else 0.11,
          pan=0.35 if t % 2 < 1 else -0.35)
# лёгкий ветер-воздух
noise_sweep(0.5, 5.0, 420, 240, 0.02, 'wind')
noise_sweep(7.0, 4.5, 300, 180, 0.02, 'wind')

# 💓 СЕРДЦЕБИЕНИЕ: разгон по мере приближения камеры
t = 1.2
while t < 15.15:
    prog = max(0.0, min(1.0, t / 15.2))
    bpm = 52 + prog * 63          # 52 → 115
    vol = 0.11 + prog * 0.19      # тише → громче
    heartbeat(t, vol, dub=0.27)
    t += 60.0 / bpm
# последний мощный удар прямо перед рубильником
heartbeat(15.05, 0.32, dub=0.24)

# райзер к рубильнику (последние 2.2 с)
noise_sweep(13.3, 2.25, 300, 5200, 0.055, 'riser')
noise_sweep(14.2, 1.35, 500, 7000, 0.05, 'riser')

# ───────────────────────  15.5 РУБИЛЬНИК ──────────────────────────────
impact(15.5, 1.35)
noise_sweep(15.5, 1.6, 6000, 700, 0.10, 'wind')
# завывание после удара (тонкая пара с тремоло)
for f, v in ((987.77, 0.006), (988.7, 0.004), (1975.5, 0.002)):
    place(pad(f, 2.4, v, attack=0.5, bright=0.8, vib=6.0), 16.2, 1.0, 0.4)

# ───────────────────────  18.05 ГЛЮЧ ──────────────────────────────────
impact(18.05, 0.8)
n = int(0.2 * SR)
z = rng.standard_normal(n)
z = np.diff(z, prepend=0)
place(z * np.exp(-np.arange(n) / SR / 0.05), 18.05, 0.5, 0.2)
impact(18.17, 0.55)
place(z * np.exp(-np.arange(n) / SR / 0.06), 18.17, 0.35, -0.3)
impact(18.5, 0.4)

# ───────────────────────  18.45 КРЕСЛО ────────────────────────────────
noise_sweep(18.45, 1.5, 950, 150, 0.05, 'wind', q=0.5)     # скрип вниз
noise_sweep(18.9, 1.3, 800, 140, 0.035, 'wind', q=0.5)
for st, v in ((19.05, 0.30), (19.7, 0.32), (20.35, 0.34)):  # тяжёлые шаги
    subdrop(st, 72, 34, 0.5, v)
    place(z[:int(0.02 * SR)] * np.exp(-np.arange(int(0.02 * SR)) / SR / 0.01), st, 0.2, -0.1)
noise_sweep(19.95, 0.95, 400, 6000, 0.05, 'riser')

# ───────────────────────  20.85 / 21.15 ГРОХОТ ────────────────────────
impact(20.85, 1.5)
impact(21.15, 1.1)
place(pad(987.77, 2.6, 0.004, attack=0.6, vib=6.2, bright=0.9), 21.5, 1.0, 0.5)
place(pad(1046.5, 2.4, 0.003, attack=0.6, vib=6.0, bright=0.9), 21.55, 1.0, -0.4)
bell(110.0, 3.0, 0.05).shape and place(bell(110.0, 3.0, 1.0), 22.6, 0.06, 0.0)

# ───────────────────────  24.8 ТИТРЫ (тихо) ───────────────────────────
place(pad(110.0, 4.0, 0.020, attack=1.0, bright=0.4, vib=0.14), 25.0, 1.0, 0.0)
place(pad(220.0, 4.0, 0.012, attack=1.0, bright=0.5), 25.0, 1.0, 0.2)
for hb, v in ((25.7, 0.14), (27.0, 0.13)):
    heartbeat(hb, v, dub=0.3)
noise_sweep(25.2, 2.6, 500, 200, 0.008, 'wind')

# ───────────────────────  28.2 ПЕРЕЧЁРКИВАНИЕ ─────────────────────────
impact(28.2, 1.0)
place(z[:int(0.03 * SR)] * np.exp(-np.arange(int(0.03 * SR)) / SR / 0.012), 28.2, 0.25, 0.1)
noise_sweep(28.2, 0.9, 5200, 600, 0.07, 'wind', q=0.35)
# тиканье, ускоряющееся к SECRET
tt = 28.6
gap = 0.33
while tt < 29.75:
    place(pluck(2350.0, 0.12, 0.16, tau=0.03), tt, 1.0, -0.5)
    gap *= 0.87
    tt += gap
noise_sweep(29.0, 0.85, 300, 6200, 0.055, 'riser')
subdrop(29.78, 110, 30, 0.5, 0.3)

# ───────────────────────  29.8 GRAND MALL SECRET ──────────────────────
for k in range(5):
    b = 29.8 + k * 0.5
    heartbeat(b, 0.20 if k % 2 == 0 else 0.15, dub=0.18)
for f, v in ((110.0, 0.05), (220.0, 0.032), (261.63, 0.026), (329.63, 0.026), (440.0, 0.013)):
    place(pad(f, 2.6, v, attack=0.35, bright=0.5, vib=0.2), 29.8, 1.0, 0.0)
melody2 = [(29.98, 659.26), (30.4, 587.33), (30.8, 523.25), (31.25, 440.0), (31.6, 523.25)]
for t, f in melody2:
    place(pluck(f, 1.6, 0.10, tau=0.6), t, 1.0, -0.2)
noise_sweep(31.3, 0.75, 400, 7000, 0.05, 'riser')

# ───────────────────────  32.0 SOON ───────────────────────────────────
impact(32.0, 1.7)
for f, v in ((110.0, 0.05), (220.0, 0.042), (261.63, 0.036), (329.63, 0.036),
             (440.0, 0.024), (659.26, 0.013), (880.0, 0.008)):
    place(pad(f, 5.0, v, attack=0.1, bright=0.6, vib=0.2), 32.0, 1.0, 0.1)
# колокола (тёмный мажорный отблеск)
for bt, f, v in ((33.1, 440.0, 0.055), (33.9, 659.26, 0.04), (34.75, 880.0, 0.032),
                 (35.6, 1318.5, 0.018), (36.4, 1046.5, 0.014)):
    place(bell(f, 3.2, 1.0), bt, v, pan=0.3 if bt % 2 < 0.5 else -0.3)
noise_sweep(32.0, 1.8, 7000, 900, 0.09, 'wind')
# редкое медленное сердце в финале
heartbeat(33.6, 0.12, dub=0.32)
heartbeat(35.4, 0.10, dub=0.32)

# ───────────────────────────  РЕВЕРБ + МАСТЕР ─────────────────────────
dryL = L.copy()
dryR = R.copy()
# 1) приводим сухой микс к разумному уровню
dry_peak = max(float(np.abs(dryL).max()), float(np.abs(dryR).max())) or 1.0
dryL *= 0.85 / dry_peak
dryR *= 0.85 / dry_peak
# 2) секционная автоматика (тише → ГРОМЧЕ по сюжету)
gains = [
    (0.0, 15.5, 1.0),      # подход — растёт вместе с сердцем
    (15.5, 17.0, 2.4),     # 💥 рубильник
    (17.0, 18.0, 0.8),
    (18.0, 18.9, 1.6),     # ⚡ глюк
    (18.9, 20.8, 1.05),    # 🪑 кресло
    (20.8, 22.8, 2.2),     # 💥💥 грохот
    (22.8, 24.7, 0.9),
    (24.7, 28.2, 1.0),     # титры 1
    (28.2, 29.8, 1.15),    # ✂️ перечёркивание
    (29.8, 32.0, 1.3),     # 🏬 SECRET
    (32.0, 36.5, 2.6),     # 🚀 SOON
]
g = np.ones(N)
for a, b, v in gains:
    g[int(a * SR):int(b * SR)] = v
dryL *= g
dryR *= g
# 3) реверберация (IR нормирован по энергии)
mid = (dryL + dryR) * 0.5
wetL = reverb(mid, IRL)
wetR = reverb(mid, IRR)
# 4) микс + мягкий клиппер
L = dryL + wetL * 0.85
R = dryR + wetR * 0.85
mix = np.stack([L, R])
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
peak = np.max(np.abs(mix)) or 1.0
mix *= 0.95 / peak

# финальный фейд (36.2 → 38.8)
fade_t = np.arange(N) / SR
fade = np.clip(1 - (fade_t - 36.2) / 2.6, 0, 1)
mix *= fade

# ───────────────────────────  ЗАПИСЬ ──────────────────────────────────
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
frames = pcm.tobytes()
with wave.open('trailer-cinematic.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(frames)
print(f'trailer-cinematic.wav: {DUR}s, peak={peak:.3f}')

try:
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(320)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    with open('trailer-cinematic.mp3', 'wb') as f:
        f.write(enc.encode(frames) + enc.flush())
    print('trailer-cinematic.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
