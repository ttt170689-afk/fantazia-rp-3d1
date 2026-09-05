#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор звуков лифта из Fantazia RP 3D1 (public/index.html).

Точная реплика WebAudio-синтеза игры (без файлов, всё из кода):

1) playElevatorBeep()            (~строка 9055) — бип закрытия дверей:
   sine 523, 659, 784 Гц, шаг 0.12 c, gain 0.15, спад до 0.001 за 0.25 c.

2) playElevatorMoving()          (~строка 9073) — "jazz-like elevator music":
   triangle-мелодия 392,440,494,523,494,440,392,370 Гц, нота каждые 0.25 c,
   gain 0.06, спад до 0.001 за 0.22 c. (setInterval 250 мс)

3) прибытие (progress >= 0.95)   — динь: sine 784, затем 1047 Гц через 0.15 c,
   gain 0.2, спад до 0.001 за 0.5 c.

Файлы пишутся в текущую папку (WAV 44.1 кГц / 16 бит).
"""
import math
import struct
import wave

SR = 44100


def render_note(buf, start_s, freq, dur_s, gain, wave_type, decay_s):
    """Добавить ноту: WebAudio-огибающая: мгновенный атак, эксп. спад до 0.001."""
    n0 = int(start_s * SR)
    n1 = int((start_s + dur_s) * SR)
    if n0 >= len(buf):
        return
    n1 = min(n1, len(buf))
    tau = decay_s / math.log(gain / 0.001)  # время, за которое gain -> 0.001
    for i in range(n0, n1):
        t = (i - n0) / SR
        if wave_type == 'sine':
            s = math.sin(2 * math.pi * freq * t)
        else:  # triangle: 2/pi * asin(sin(2 pi f t))
            s = 2.0 / math.pi * math.asin(math.sin(2 * math.pi * freq * t))
        env = gain * math.exp(-t / tau)
        buf[i] += env * s


def render_file(name, blocks, normalize=0.8):
    """blocks: [(start_s, dur_s, freq, gain, wave_type, decay_s)]"""
    total = max(b[0] + b[1] for b in blocks) + 0.15
    n = int(total * SR)
    buf = [0.0] * n
    for start_s, dur_s, freq, gain, wt, decay in blocks:
        render_note(buf, start_s, freq, dur_s, gain, wt, decay)
    peak = max(abs(v) for v in buf) or 1.0
    k = normalize / peak
    with wave.open(name, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for v in buf:
            s = int(max(-1.0, min(1.0, v * k)) * 32767)
            frames += struct.pack('<h', s)
        w.writeframes(bytes(frames))
    print(f'{name}: {total:.2f} c')


# 1) Бип при закрытии/открытии дверей: C5 E5 G5 (523, 659, 784), шаг 0.12
blocks1 = []
for i, f in enumerate([523, 659, 784]):
    blocks1.append((i * 0.12, 0.30, f, 0.15, 'sine', 0.25))
render_file('01-zakrytie-dverej-beep.wav', blocks1)

# 2) Музыка в лифте во время поездки: 4 цикла мелодии по 8 нот (2 c/цикл = 8 c)
melody = [392, 440, 494, 523, 494, 440, 392, 370]
blocks2 = []
for cyc in range(4):
    for i, f in enumerate(melody):
        t = (cyc * 8 + i) * 0.25
        blocks2.append((t, 0.25, f, 0.06, 'triangle', 0.22))
render_file('02-muzyka-lifta-8s.wav', blocks2)

# 3) Динь по прибытии: G5 -> C6 (784, 1047), шаг 0.15
blocks3 = [(0.0, 0.60, 784, 0.2, 'sine', 0.5),
           (0.15, 0.60, 1047, 0.2, 'sine', 0.5)]
render_file('03-pribytie-din.wav', blocks3)

# 4) Полная поездка: бип дверей -> музыка (~6 c) -> динь прибытия
blocks4 = []
for i, f in enumerate([523, 659, 784]):
    blocks4.append((i * 0.12, 0.30, f, 0.15, 'sine', 0.25))
music_start = 0.55
for i, f in enumerate(melody * 3):
    t = music_start + i * 0.25
    blocks4.append((t, 0.25, f, 0.06, 'triangle', 0.22))
ding_start = music_start + len(melody) * 3 * 0.25 + 0.1
blocks4.append((ding_start, 0.60, 784, 0.2, 'sine', 0.5))
blocks4.append((ding_start + 0.15, 0.60, 1047, 0.2, 'sine', 0.5))
render_file('04-polnaya-poezdka-v-lifte.wav', blocks4)

print('Готово.')
