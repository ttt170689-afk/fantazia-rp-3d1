#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎬 ФИНАЛЬНЫЙ САУНДТРЕК ТРЕЙЛЕРА «GRAND MALL SECRET» (36.6с)
Изучен teaser.html вдоль и поперёк — каждое событие на своём месте:

  0.0–15.5  камера летит в тёмном зале, сердце 42→110 BPM + пульс-разгон
  15.5      💡 РУБИЛЬНИК — свет гаснет: мега-удар → ПОЛНЫЙ ОБРЫВ
  18.05/18.17/18.5 ⚡ ГЛЮЧ ×3: толчки из тишины
  18.45     🪑 БОСС ПОВОРАЧИВАЕТ КРЕСЛО: скрип + 😈 МЁРТВЫЙ ХОХОТ
            (в коде: haHa — 8 нот, 215→~110 Гц, saw+square) + кресло едет
  20.85/21.15 👀 ГЛАЗА ВСПЫХИВАЮТ ×2 (ignite): удар + сияющий кластер
  21.5–23.9  глаза горят: тремоло-дрон, затихает
  23.9      🌑 тьма — почти тишина
  24.8      титры: FANTAZIA RP МИГАЕТ → пульс в такт (0.44с)
  28.2      ✂️ перечёркивается: удар + скрежет вниз + тиканье
  29.8      🏬 GRAND MALL SECRET: тёмный гранд-аккорд + пульс
  32.0      🚀 SOON: финальный аккорд + колокола → тонет к 36.3 (конец)
"""
import numpy as np
from scipy.signal import fftconvolve, stft, istft
import wave

SR = 48000
DUR = 36.6
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(991)

# ── реверберация ──
def make_ir(dur=2.4, tau=0.85, lp=3300, sl=13, sr_=14):
    n = int(SR * dur); t = np.arange(n) / SR; out = []
    for seed in (sl, sr_):
        g = np.random.default_rng(seed); noise = g.standard_normal(n)
        a = np.exp(-2 * np.pi * lp / SR); y = np.empty(n); acc = 0.0
        for i in range(n):
            acc += (noise[i] - acc) * a; y[i] = acc
        er = np.zeros(n)
        for off, g2 in ((0.011, .5), (.019, .33), (.031, .22), (.048, .14), (.068, .09)):
            j = int(off * SR); er[j:j + 350] += g2 * np.linspace(1, 0, 350)
        y = y * np.exp(-t / tau) * 2.0 + er * noise * .05
        out.append(y / np.sqrt(np.sum(y * y)))
    return out
IRL, IRR = make_ir()
def reverb(x, ir): return fftconvolve(x, ir)[:N]
def place(arr, t0, vol, pan=0.0):
    s = int(t0 * SR); e = min(N, s + len(arr))
    if s >= N or e <= 0: return
    seg = arr[:e - s]
    gl = np.cos((pan + 1) * np.pi / 4); gr = np.sin((pan + 1) * np.pi / 4)
    L[s:e] += seg * vol * gl; R[s:e] += seg * vol * gr

# ── инструменты ──
def strings(freq, dur, vol, attack=.8, bright=.55, tremolo=0., detune=8.):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for d in (-detune, 0., detune):
        f = freq * 2 ** (d / 1200); ph = 2 * np.pi * f * t
        for k in range(1, 14):
            amp = (1. / k ** 1.12) * np.exp(-k * .06 * (1.6 - bright))
            out += amp * np.sin(k * ph + rng.uniform(0, 6.28))
    out *= np.minimum(1, t / attack) * np.clip((dur - t) / 1.4, 0, 1)
    if tremolo > 0: out *= (1 + .5 * np.sin(2 * np.pi * tremolo * t)) * .72
    return out

def stab(freq, dur, vol, bright=.55):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for d in (-6., 0., 6.):
        f = freq * 2 ** (d / 1200); ph = 2 * np.pi * f * t
        for k in range(1, 11):
            amp = (1. / k ** 1.25) * np.exp(-k * .035 * (1.7 - bright))
            out += amp * np.sin(k * ph)
    return out * np.minimum(1, t / .004) * np.exp(-t / (dur * .4))

def taiko(t0, vol=.3, f0=95, f1=42, dur=.5):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * .35))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * .5))
    out += .2 * np.sin(2 * np.pi * f1 * 2 * t) * np.exp(-t / (dur * .3))
    c = rng.standard_normal(int(.008 * SR)); out[:len(c)] += c * .5
    place(out, t0, vol, rng.uniform(-.15, .15))

def sub(t0, f0, f1, dur, vol, at=.004):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * .4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.sin(ph) * np.exp(-t / (dur * .6))
    c = rng.standard_normal(int(.01 * SR)); out[:len(c)] += c * .3
    place(out, t0, vol, 0.)

def boom(t0, size=1.):
    taiko(t0, .42 * size, 120, 28, 1.3)
    n = int(.45 * SR); z = rng.standard_normal(n)
    z = np.diff(z, prepend=0)
    place(z * np.exp(-np.arange(n) / SR / .08), t0, .35 * size, 0.)
    for f, v in ((55, .4), (58.3, .3), (65.4, .2), (82.4, .12), (110, .07)):
        place(strings(f, 2.6, v * .03 * size, attack=.015, bright=.4), t0, 1., 0.)
    sub(t0, 60, 18, 3., .5 * size)

def roll(t0, dur, v0=.05, v1=.3):
    t = 0.; gap = .085
    while t < dur:
        k = t / dur
        taiko(t0 + t, v0 + (v1 - v0) * k, 85 - 40 * k, 40, .4)
        gap = max(.03, .085 - k * .055); t += gap

def sweep(t0, dur, f0, f1, vol, kind='riser'):
    n = int(dur * SR); noise = rng.standard_normal(n + 2048)
    f, ts, Z = stft(noise, fs=SR, nperseg=2048, noverlap=1536)
    K = Z.shape[1]; cents = np.linspace(0, 1, K)
    center = f0 * (f1 / f0) ** cents
    mask = np.exp(-(((f[:, None] - center[None, :]) / (center[None, :] * .5)) ** 2))
    Zf = Z * mask
    _, x = istft(Zf, fs=SR, nperseg=2048, noverlap=1536); x = x[:n]
    env = np.ones(n)
    if kind == 'riser': env = (np.arange(n) / n) ** 1.7
    elif kind == 'fall': env = (1 - np.arange(n) / n) ** 1.5
    att = np.minimum(1, np.arange(n) / SR / .3)
    rel = np.clip(1 - (np.arange(n) / SR - dur + .7) / .7, 0, 1)
    place(x * env * att * rel, t0, vol, 0.)

def bell(t0, f, dur, vol):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for k, a in ((1, 1.), (2., .4), (2.76, .22), (5.4, .08)):
        out += a * np.sin(2 * np.pi * f * k * t)
    place(out * np.exp(-t / 1.05), t0, vol, .15)

def heartbeat(t, vol, dub=.3):
    sub(t, 90, 34, .28, vol)
    n = int(.025 * SR); c = rng.standard_normal(n)
    c = np.diff(c, prepend=0) * np.exp(-np.arange(n) / SR / .009)
    place(c, t, vol * .5, 0.)
    sub(t + dub, 80, 32, .22, vol * .5)

def whisper(t0, dur, vol):
    n = int(dur * SR); noise = rng.standard_normal(n)
    a = np.exp(-2 * np.pi * 1100 / SR); y = np.empty(n); acc = 0.
    for i in range(n):
        acc += (noise[i] - acc) * a; y[i] = acc
    t = np.arange(n) / SR
    y *= (.6 + .4 * np.sin(2 * np.pi * 3.1 * t)) * (.6 + .4 * np.sin(2 * np.pi * 1.7 * t + 1.3))
    place(y * np.minimum(1, t / .8) * np.clip(1 - (t - dur + 1.) / 1., 0, 1), t0, vol, .4)

# 😈 мёртвый хохот босса — как в коде: 8 нот 215→~110 Гц, saw+square, убыстрение
def boss_laugh(t0=18.45):
    hf = 215.
    for i in range(8):
        when = t0 + i * (0.16 if i < 4 else 0.12) + i * 0.02
        n = int(0.22 * SR); t = np.arange(n) / SR
        f0n = hf; f1n = hf * 0.62
        f = f1n + (f0n - f1n) * np.exp(-t / 0.05)
        ph = 2 * np.pi * np.cumsum(f) / SR
        vib = 1 + 0.05 * np.sin(2 * np.pi * 7.5 * t)
        ph2 = 2 * np.pi * np.cumsum(f * 0.5 * vib) / SR
        saw = 2 * (ph / (2 * np.pi) % 1.) - 1.
        sq = 1.0 * (np.sin(ph2) >= 0) - 1.0 * (np.sin(ph2) < 0)
        sig = saw * 0.7 + sq * 0.3
        # хрип-дыхание после
        env = np.minimum(1, t / .006) * np.exp(-t / .075)
        # лёгкий «двойной» хохоток — вибрато амплитуды 10 Гц
        env *= (0.7 + 0.3 * np.abs(np.sin(2 * np.pi * 9 * t + 1.)))
        # форманта рта: простой резонанс через второй тон
        sig += 0.25 * np.sin(2 * np.pi * np.cumsum(f * 2.7 * vib) / SR)
        vol = (0.085 if i < 3 else 0.11) * (1 - i * 0.045)
        place(sig * env, when, vol, 0.1 - i * 0.03)
        hf *= 0.925
    # дыхание-вдох перед хохотом и после
    whisper(t0 - 0.25, 0.2, 0.02)
    whisper(t0 + 1.9, 0.7, 0.012)

# ═══════════════ СКОР ═══════════════
# 0–15.5 полёт: дрон-фундамент + сердце + мотив + пульс
place(strings(73.42, 15.8, .028, attack=2.5, bright=.3, detune=12.), 0., 1., 0.)
place(strings(146.83, 15.8, .016, attack=2.5, bright=.35), 0., 1., -.2)
sub(0., 36.7, 36.7, 15.8, .02)
sweep(.3, 6.5, 350, 180, .012, 'wind')
t = .9
while t < 15.1:
    k = min(1., t / 15.3)
    heartbeat(t, .07 + k * .12, .3)
    t += 60.0 / (42 + k * 66)
for tm, f, v in ((2.4, 293.66, .045), (3.6, 349.23, .04), (5., 293.66, .042)):
    place(strings(f, 2.2, v, attack=.6, bright=.7), tm, 1., .3)
for tm, f, v in ((6.2, 220., .05), (7.6, 261.63, .046), (8.8, 329.63, .05)):
    place(strings(f, 2.4, v, attack=.5, bright=.7), tm, 1., -.3)
PATS = [73.42, 146.83, 73.42, 146.83, 73.42, 146.83, 220., 146.83]
t = 5.; i = 0
while t < 15.45:
    k = min(1., (t - 5.) / 10.5)
    gap = .5 - k * .28
    vol = .05 + k * .09
    bright = .4 + k * .35
    chord_i = int((t - 5.) / 3.9) % 4
    CH = {0: [146.83, 174.61, 220., 293.66], 1: [116.54, 146.83, 174.61, 233.08],
          2: [87.31, 110., 174.61, 220.], 3: [65.41, 130.81, 196., 261.63]}[chord_i]
    if abs(t - round(t / 3.9) * 3.9) < gap * .6 and i % 2 == 0:
        place(strings(CH[0], 3.4, .02 + k * .03, attack=.5, bright=.45), t, 1., 0.)
        place(strings(CH[2], 3.4, .014 + k * .02, attack=.5, bright=.45), t, 1., .15)
    place(stab(PATS[i % 8], .14, vol * (1.6 if i % 4 == 0 else 1.), bright), t, 1., -.2 if i % 2 == 0 else .2)
    if t > 8.5 and i % 4 == 0: taiko(t, .12 + k * .2, 90, 44, .45)
    t += gap; i += 1
roll(11.4, 1.3, .06, .26); sweep(11.6, 1.6, 400, 7000, .06, 'riser')
roll(13.1, 1.6, .08, .42); sweep(13.2, 2.3, 500, 9000, .085, 'riser')
boom(14.3, .7); boom(14.95, .9)

# 15.5 рубильник + обрыв
boom(15.5, 2.)
sweep(15.5, 1.2, 9000, 300, .16, 'fall')
# 16.2–18: мёртвая тишина + шёпот
whisper(16.4, 1.9, .02)
whisper(17.6, 1.6, .012)
# 18.05/18.17/18.5 глюк ×3
boom(18.05, .55)
for df in (.05, .1): taiko(18.05 + df, .13, 300, 70, .2)
boom(18.35, .35); taiko(18.5, .16, 260, 66, .25)
# 18.45 кресло + МЁРТВЫЙ ХОХОТ
place(strings(110., 2.0, .02, attack=.4, bright=.3, tremolo=4.2), 18.6, 1., 0.)
place(strings(73.42, 2.2, .016, attack=.5, bright=.25), 18.65, 1., -.25)
boss_laugh(18.45)
for lf in (19.9, 20.25, 20.6):  # кресло едет: глухие толчки
    sub(lf, 66, 26, .8, .17)
    taiko(lf, .1, 72, 38, .45)
# 20.85 / 21.15 👀 ГЛАЗА ВСПЫХИВАЮТ
for tt in (20.85, 21.15):
    boom(tt, 1.35 if tt < 21. else 1.0)
    for f, v in ((1318.5, .02), (1396.9, .014), (1567.98, .016), (1760., .01)):
        place(strings(f, 1.6, v, attack=.008, bright=.95, tremolo=7.), tt + .02, 1.,
              .4 if f < 1500 else -.4)
    sweep(tt, .5, 3000, 12000, .09, 'riser')
    sub(tt, 70, 20, 2.2, .4)
# 21.5–23.9 глаза горят
place(strings(1318.5, 2.5, .007, attack=1., bright=.9, tremolo=6.2, detune=14.), 21.5, 1., .35)
place(strings(1244.5, 2.5, .005, attack=1., bright=.9, tremolo=6.), 21.5, 1., -.35)
place(strings(55., 2.5, .02, attack=.6, bright=.25), 21.6, 1., 0.)
for pb in (21.9, 22.5, 23.1): sub(pb, 64, 26, .6, .09)
# 23.9: почти тишина
# 24.8 титры — FANTAZIA RP мигает (пульс каждые ~0.44с до 28.8)
place(strings(55., 3.9, .02, attack=1., bright=.3), 24.9, 1., 0.)
place(strings(110., 3.9, .012, attack=1., bright=.4, tremolo=4.), 24.9, 1., .2)
bl = 25.0
while bl < 28.8:
    sub(bl, 84, 30, .5, .15)
    place(strings(220., .35, .011, attack=.02, bright=.6), bl, 1., -.2)
    bl += 0.46
# 28.2 ✂️ перечёркивание
boom(28.2, 1.1)
sweep(28.2, 1.1, 6000, 150, .08, 'fall')
place(strings(58.27, 1.5, .03, attack=.03, bright=.3), 28.2, 1., .2)
tt = 28.55; gap = .33
while tt < 29.75:
    place(stab(2350., .08, .03 + (tt - 28.55) * .02, .9), tt, 1., -.5)
    gap *= .86; tt += gap
sweep(29.0, .85, 300, 6000, .05, 'riser')
sub(29.78, 100, 26, .6, .3)
# 29.8 SECRET
for k in range(6):
    bt = 29.8 + k * .5
    taiko(bt, .2 + (k % 2) * .08, 88, 40, .4)
    place(stab(220. if k % 2 == 0 else 233.08, .13, .03, .5), bt, 1., .15)
place(strings(110., 2.6, .024, attack=.4, bright=.35, tremolo=4.5), 29.8, 1., 0.)
place(strings(220., 2.6, .015, attack=.4, bright=.45), 29.8, 1., .25)
# 32.0 SOON
boom(32.0, 2.3)
for f, v in ((73.42, .05), (110., .06), (146.83, .045), (220., .035), (293.66, .02)):
    place(strings(f, 4.4, v, attack=.02, bright=.4), 32.0, 1., 0.)
place(strings(1318.5, 3.6, .01, attack=.1, bright=.95, tremolo=7.5, detune=16.), 32.2, 1., .4)
roll(32.1, 1.4, .07, .3)
for bt, f, v in ((33.1, 440., .045), (33.9, 293.66, .04), (34.7, 220., .035), (35.5, 146.83, .028)):
    bell(bt, f, 2.8, v)
heartbeat(34.5, .12, .4)
heartbeat(35.1, .1, .4)

# ═══════════════ МАСТЕР ═══════════════
dryL, dryR = L.copy(), R.copy()
p = max(float(np.abs(dryL).max()), float(np.abs(dryR).max())) or 1.
dryL *= .88 / p; dryR *= .88 / p
gains = [(0., 15.5, 1.), (15.5, 16.2, 2.1), (16.2, 18.35, .10), (18.35, 18.55, .9),
         (18.55, 20.8, 1.0), (20.8, 21.6, 1.9), (21.6, 24.7, .5), (24.7, 28.2, .95),
         (28.2, 29.8, 1.2), (29.8, 32., 1.4), (32., 36.6, 2.6)]
g = np.ones(N)
for a, b, v in gains: g[int(a * SR):int(b * SR)] = v
dryL *= g; dryR *= g
mid = (dryL + dryR) * .5
L = dryL + reverb(mid, IRL) * .6
R = dryR + reverb(mid, IRR) * .6
mix = np.stack([L, R])
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix *= .95 / (np.max(np.abs(mix)) or 1.)
env = np.ones(N)
for i in range(N):
    t = i / SR
    if 16.2 <= t < 16.55: env[i] = 1 - ((t - 16.2) / .35) ** 2
    elif 16.55 <= t < 17.95: env[i] = 0.
    elif 17.95 <= t < 18.07: env[i] = (t - 17.95) / .12
mix *= env
mix *= np.clip(1 - (np.arange(N) / SR - 34.6) / 1.9, 0, 1)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open('trailer-final.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('trailer-final.wav OK')
import lameenc
enc = lameenc.Encoder(); enc.set_bit_rate(320); enc.set_in_sample_rate(SR)
enc.set_channels(2); enc.set_quality(2)
open('trailer-final.mp3', 'wb').write(enc.encode(pcm.tobytes()) + enc.flush())
print('trailer-final.mp3 OK')
