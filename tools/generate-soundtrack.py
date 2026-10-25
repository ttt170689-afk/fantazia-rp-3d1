#!/usr/bin/env python3
"""Original deterministic instrumental loops. Requires numpy; no sampled songs.
Run: PYTHONPATH=/path/to/numpy python tools/generate-soundtrack.py
PCM stereo 22050 Hz preserves exact loop points (no MP3 encoder padding).
"""
from pathlib import Path
import wave
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public/audio/music'
RATE = 22050

def render(name, bpm, chords, drums, seed):
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    count = round(32 * beat * RATE)
    mix = np.zeros((count, 2), dtype=np.float64)
    def add(signal, at, pan=0):
        index = (round(at * RATE) + np.arange(len(signal))) % count
        np.add.at(mix[:, 0], index, signal * np.sqrt((1-pan)/2))
        np.add.at(mix[:, 1], index, signal * np.sqrt((1+pan)/2))
    def note(midi, at, duration, volume, kind='pad', pan=0):
        t = np.arange(round(duration * RATE)) / RATE
        f = 440 * 2 ** ((midi - 69) / 12)
        if kind == 'pad':
            s = (np.sin(2*np.pi*f*t) + .24*np.sin(2*np.pi*f*2*t)
                 + .18*np.sin(2*np.pi*f*1.002*t))
            env = np.sin(np.pi*t/duration) ** 1.4
        else:
            s = np.sin(2*np.pi*f*t) + .16*np.sin(2*np.pi*f*3*t)
            env = (1-np.exp(-t*120))*np.exp(-t/(duration*.23))
            env *= np.minimum(1, (duration-t)*40)
        add(s*env*volume, at, pan)
        if kind == 'bell':
            add(s*env*volume*.28, at+beat*.75, -pan)
            add(s*env*volume*.12, at+beat*1.5, pan)
    for bar in range(8):
        chord = chords[bar % 4]
        for j, n in enumerate(chord):
            note(n, bar*4*beat, beat*4, .08, pan=(j-1.5)*.32)
        note(chord[0]-12, bar*4*beat, beat*3.9, .13, 'pad')
        for eighth in range(8):
            if not drums and eighth % 2: continue
            n = chord[[0,2,1,3,2,1,3,2][eighth]] + 12
            note(n, (bar*4+eighth*.5)*beat, beat*1.4,
                 .05 if drums else .045, 'bell', (-1 if eighth%2 else 1)*.45)
        if drums:
            for k in (0,2):
                t = np.arange(round(.34*RATE))/RATE
                phase = 2*np.pi*(47*t+75*.035*(1-np.exp(-t/.035)))
                kick = np.sin(phase)*np.exp(-t*18)*np.minimum(1,t*800)
                add(kick*.27,(bar*4+k)*beat)
            for k in (1,3):
                t = np.arange(round(.16*RATE))/RATE
                noise = rng.normal(0,1,len(t))
                noise = np.convolve(noise, [.25,.5,.25], mode='same')
                add(noise*np.exp(-t*35)*.055, (bar*4+k)*beat, .1)
            for k in range(8):
                t = np.arange(round(.045*RATE))/RATE
                noise = rng.normal(0,1,len(t))
                noise = np.diff(noise, prepend=noise[0])
                add(noise*np.exp(-t*110)*.014,(bar*4+k*.5)*beat,-.3)
    mix = np.tanh(mix)
    mix *= .72 / max(.001, np.max(np.abs(mix)))
    pcm = np.round(mix*32767).astype('<i2')
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / (name+'.wav')), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    print(name, f'{count/RATE:.3f}s', 'peak', round(float(np.max(np.abs(mix))),3),
          'RMS', round(float(np.sqrt(np.mean(mix**2))),3))

if __name__ == '__main__':
    render('neon-route', 80, [[57,60,64,71],[53,57,60,64],[48,55,59,64],[55,59,62,69]], True, 2401)
    render('above-clouds', 72, [[50,57,61,64],[57,61,64,68],[54,57,61,64],[55,59,62,66]], False, 2402)
    render('last-train', 96, [[52,55,59,66],[48,55,59,62],[55,59,62,69],[50,57,60,64]], True, 2403)
