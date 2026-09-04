#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎬 МУЗЫКА ДЛЯ КОНЦОВКИ ТИЗЕРА (GRAND MALL SECRET SOON) — v1

Синхронизирована с титрами public/teaser.html (отсчёт с момента T.phase='end'):
  0.0   — затемнение, титры: FANTAZIA RP мигает
  3.4   — FANTAZIA RP ПЕРЕЧЁРКИВАЕТСЯ (удар + скрежет)
  5.0   — появляется GRAND MALL SECRET (бас-пульс + мрачный пэд Am)
  7.2   — появляется SOON (БАБАХ + широкий аккорд + колокольчики)
  ~10.5 — финальное затухание (тизер закрывается ~11.5)

Жанр: тёмный кинематографичный эмбиент-тизер. Без голоса.
Длина: 12.6 с. Файл: teaser-outro.wav/.mp3
"""
import math
import random
import struct
import wave

SR = 44100
random.seed(5)
NOISE = [random.uniform(-1, 1) for _ in range(SR * 3)]
DUR = 12.6
buf = [0.0] * int(DUR * SR)


def n2i(t):
    return int(t * SR)


def add_tone(t0, f0, f1, vol, dur, wtype='sine'):
    """Тон с глиссандо f0→f1, экспоненциальный спад."""
    n0, n1 = n2i(t0), min(n2i(t0 + dur), len(buf))
    tau = dur * 0.62
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        f = f1 + (f0 - f1) * math.exp(-t / (dur * 0.4)) if f1 and f1 != f0 else (f0 or f1)
        ph += 2 * math.pi * f / SR
        s = math.sin(ph) if wtype != 'triangle' else 2 / math.pi * math.asin(math.sin(ph))
        buf[i] += vol * math.exp(-t / tau) * s


def add_kick(t0, vol=0.3, f_lo=40):
    add_tone(t0, 85, f_lo, vol, 0.32)


def add_crash(t0, vol=0.2, dur=0.8, bright=0.5):
    n0, n1 = n2i(t0), min(n2i(t0 + dur), len(buf))
    prev = NOISE[n0 % len(NOISE)]
    for i in range(n0 + 1, n1):
        t = (i - n0) / SR
        cur = NOISE[i % len(NOISE)]
        hp = cur - prev
        prev = cur
        buf[i] += vol * hp * math.exp(-t / (dur * 0.3))


def add_riser(t0, dur, vol=0.06, bright=True):
    """Шумовой райзер с нарастанием и «яркостью»."""
    n0, n1 = n2i(t0), min(n2i(t0 + dur), len(buf))
    prev = NOISE[n0 % len(NOISE)]
    for i in range(n0, n1):
        t = (i - n0) / (SR * dur)
        cur = NOISE[i % len(NOISE)]
        hp = cur - prev
        prev = cur
        # имитация фильтра: чем дальше — тем ярче (больше вклад HP)
        buf[i] += vol * t * (hp + (1 - t) * cur * 0.4)


def add_hat(t0, vol=0.012):
    n0, n1 = n2i(t0), min(n2i(t0 + 0.05), len(buf))
    prev = NOISE[n0 % len(NOISE)]
    for i in range(n0 + 1, n1):
        t = (i - n0) / SR
        cur = NOISE[i % len(NOISE)]
        buf[i] += vol * (cur - prev) * math.exp(-t / 0.012)
        prev = cur


# ─────────────────────────── таймлайн ────────────────────────────────
# 0.0–3.4: дрон + редкие удары (FANTAZIA RP мигает)
add_tone(0.0, 55.0, 55.0, 0.075, 12.2)          # саб-дрон A1
add_tone(0.0, 110.6, 110.6, 0.018, 11.5)        # лёгкое биение
for k in range(4):                               # редкие «удары сердца»
    add_kick(0.45 + k * 0.85, 0.17, 46)
add_tone(1.05, 987.77, 987.77, 0.010, 0.4)       # холодные звоночки
add_tone(2.3, 1174.66, 1174.66, 0.009, 0.5)
add_riser(2.9, 0.55, 0.035)                      # короткий райзер

# 3.4: ПЕРЕЧЁРКИВАНИЕ — удар + скрежет + диссонанс
add_kick(3.4, 0.42, 36)
add_crash(3.4, 0.2, 0.5, 0.6)
add_tone(3.4, 1500, 500, 0.035, 0.5, 'sawtooth')  # скрежет
add_tone(3.4, 233.1, 231.0, 0.02, 1.1, 'triangle')
add_tone(3.4, 235.4, 233.0, 0.018, 1.1, 'triangle')
add_tone(3.4, 349.23, 349.23, 0.022, 0.9, 'triangle')  # напряжённая терция

# 3.4–5.0: тишина, редкие удары + отсчёт (тиканье учащается)
for k in range(4):
    add_kick(3.95 + k * 0.35, 0.12 - k * 0.015, 50)
for tk in (4.35, 4.52, 4.68, 4.8, 4.9):
    add_tone(tk, 2200, 1900, 0.006, 0.05, 'square')
add_riser(4.35, 0.7, 0.055)

# 5.0: GRAND MALL SECRET — музыка вступает
for k in range(5):                               # бас-пульс
    add_kick(5.0 + k * 0.5, 0.3, 40)
    add_hat(5.0 + k * 0.5 + 0.25, 0.011)
pad_v = [(110.0, 0.035), (220.0, 0.030), (261.63, 0.024), (329.63, 0.024), (440.0, 0.014)]
for f, v in pad_v:                               # мрачный пэд Am
    add_tone(5.0, f, f, v, 2.3)
for t0n, f, v in ((5.18, 659.26, 0.05), (5.55, 587.33, 0.045), (5.95, 523.25, 0.045),
                  (6.35, 440.0, 0.05), (6.75, 523.25, 0.035)):
    add_tone(t0n, f, f, v, 0.42, 'triangle')     # медленный мотив вниз
add_riser(6.3, 0.95, 0.075)

# 7.2: SOON — БАБАХ + широкий аккорд + колокольчики
add_kick(7.2, 0.5, 34)
add_crash(7.2, 0.22, 1.1, 0.7)
big = [(110.0, 0.06), (220.0, 0.055), (261.63, 0.05), (329.63, 0.05),
       (440.0, 0.032), (659.26, 0.02), (880.0, 0.012)]
for f, v in big:
    add_tone(7.2, f, f, v, 4.4)
for k in range(4):                               # пульс продолжается
    add_kick(7.2 + k * 0.5, 0.26, 40)
    add_hat(7.2 + k * 0.5 + 0.25, 0.011)
add_tone(8.3, 1318.51, 1318.51, 0.02, 0.9)       # колокольчики E6
add_tone(8.75, 1046.5, 1046.5, 0.016, 1.3)       # C6
add_tone(9.05, 1567.98, 1567.98, 0.012, 1.0)     # G6
add_tone(9.9, 1318.51, 1318.51, 0.009, 1.4)      # эхо-звоночек

# ── финальное затухание с 10.4 ──
for i in range(len(buf)):
    t = i / SR
    if t > 10.4:
        k = max(0.0, 1.0 - (t - 10.4) / 2.1)
        buf[i] *= k

# ── запись ──
peak = max(abs(v) for v in buf) or 1.0
k = 0.95 / peak
with wave.open('teaser-outro.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v * k)) * 32767)
        frames += struct.pack('<h', s)
    w.writeframes(bytes(frames))
print(f'teaser-outro.wav: {DUR:.2f} c, peak={peak:.2f}')

try:
    import lameenc
    with wave.open('teaser-outro.wav', 'rb') as f:
        sr = f.getframerate()
        ch = f.getnchannels()
        data = f.readframes(f.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(sr)
    enc.set_channels(ch)
    enc.set_quality(2)
    with open('teaser-outro.mp3', 'wb') as f:
        f.write(enc.encode(data) + enc.flush())
    print('teaser-outro.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
