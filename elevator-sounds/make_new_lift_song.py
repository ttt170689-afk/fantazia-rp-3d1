#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎵 НОВАЯ супер-песня лифта для Fantazia RP 3D1.

Весёлый фанк-джаз луп (8 секунд, бесшовно повторяется):
  Cmaj7 → Am7 → Fmaj7 → G6
  - рифф мелодии (triangle)  — восходящие переливы
  - ходячий бас (sine)       — по четвертям
  - мягкие джазовые аккорды  (sine, каждые 2 сек)

Тот же алгоритм, что игра использует в WebAudio (public/index.html,
playElevatorMoving). Файл: 05-lift-song-new.wav/.mp3
"""
import math
import struct
import wave

SR = 44100
STEP = 0.25          # одна восьмая = 250 мс (как setInterval в игре)
STEPS = 32           # 8 секунд — один луп

# ── ноты ─────────────────────────────────────────────────────────────
# Мелодия: 4 такта по 8 восьмых (32 шага)
MELODY = [
    # Cmaj7:   E4  G4  A4  C5  D5  C5  A4  G4
    329.63, 392.00, 440.00, 523.25, 587.33, 523.25, 440.00, 392.00,
    # Am7:     E4  A4  C5  E5  D5  C5  A4  E4
    329.63, 440.00, 523.25, 659.26, 587.33, 523.25, 440.00, 329.63,
    # Fmaj7:   F4  A4  C5  F5  E5  D5  C5  A4
    349.23, 440.00, 523.25, 698.46, 659.26, 587.33, 523.25, 440.00,
    # G6:      G4  B4  D5  G5  E5  D5  B4  G4
    392.00, 493.88, 587.33, 783.99, 659.26, 587.33, 493.88, 392.00,
]

# Бас: четверти (на чётных шагах), ходячий бас
BASS = [
    # C:  C3   D3   E3   G3
    130.81, None, 146.83, None, 164.81, None, 196.00, None,
    # A:  A2   B2   C3   E3
    110.00, None, 123.47, None, 130.81, None, 164.81, None,
    # F:  F2   G2   A2   C3
    87.31, None, 98.00, None, 110.00, None, 130.81, None,
    # G:  G2   A2   B2   D3
    98.00, None, 110.00, None, 123.47, None, 146.83, None,
]

# Аккорды: один на такт (на 0-м шаге такта), мягкие
CHORDS = [
    [130.81, 164.81, 196.00, 246.94],   # Cmaj7: C3 E3 G3 B3
    [110.00, 130.81, 164.81, 196.00],   # Am7:   A2 C3 E3 G3
    [87.31, 110.00, 130.81, 164.81],    # Fmaj7: F2 A2 C3 E3
    [98.00, 123.47, 146.83, 164.81],    # G6:    G2 B2 D3 E3
]

LOOPS = 2          # сколько лупов записать в файл (8 c * 2 = 16 c)
DUR = LOOPS * STEPS * STEP + 0.3

buf = [0.0] * int(DUR * SR)


def env(t, gain, decay_s):
    tau = decay_s / math.log(gain / 0.001)
    return gain * math.exp(-t / tau)


def add_note(start_s, freq, dur_s, gain, wtype, decay_s):
    n0 = int(start_s * SR)
    n1 = min(int((start_s + dur_s) * SR), len(buf))
    for i in range(n0, n1):
        t = (i - n0) / SR
        if wtype == 'sine':
            s = math.sin(2 * math.pi * freq * t)
        else:  # triangle
            s = 2.0 / math.pi * math.asin(math.sin(2 * math.pi * freq * t))
        buf[i] += env(t, gain, decay_s) * s


for loop in range(LOOPS):
    for i in range(STEPS):
        t = (loop * STEPS + i) * STEP
        mf = MELODY[i]
        if mf:
            add_note(t, mf, 0.25, 0.070, 'triangle', 0.22)   # рифф
        bf = BASS[i]
        if bf:
            add_note(t, bf, 0.50, 0.055, 'sine', 0.45)       # бас
        if i % 8 == 0:
            for f in CHORDS[i // 8]:
                add_note(t, f, 2.00, 0.014, 'sine', 1.90)    # аккорд

# ── запись ───────────────────────────────────────────────────────────
peak = max(abs(v) for v in buf) or 1.0
k = 0.85 / peak
with wave.open('05-lift-song-new.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v * k)) * 32767)
        frames += struct.pack('<h', s)
    w.writeframes(bytes(frames))
print(f'05-lift-song-new.wav: {DUR:.2f} c')

try:
    import lameenc
    with wave.open('05-lift-song-new.wav', 'rb') as f:
        sr = f.getframerate(); ch = f.getnchannels()
        data = f.readframes(f.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(192); enc.set_in_sample_rate(sr)
    enc.set_channels(ch); enc.set_quality(2)
    with open('05-lift-song-new.mp3', 'wb') as f:
        f.write(enc.encode(data) + enc.flush())
    print('05-lift-song-new.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
