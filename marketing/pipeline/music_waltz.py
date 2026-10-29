# Original spooky-romantic waltz for the Halloween Night ad (D minor, 3/4, 138 BPM): pizzicato "oom" on beat one,
# music-box "pah-pah" chords, a music-box melody, a distant bell at each phrase and a soft organ. python music_waltz.py out.wav seconds
import numpy as np, wave, sys

SR = 48000; BPM = 138; B = 60 / BPM; BAR = 3 * B
OUT = sys.argv[1] if len(sys.argv) > 1 else 'waltz.wav'; DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 32
N = int(SR * DUR); L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(11)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N: return
    s = sig[:j - i] * gain; L[i:j] += s * np.sqrt((1 - pan) / 2); R[i:j] += s * np.sqrt((1 + pan) / 2)


def pluck(m, dur=0.9):
    f = hz(m); n = int(SR * dur); p = int(SR / f)
    buf = np.convolve(rng.uniform(-1, 1, p + 6), np.ones(6) / 6, 'valid')[:p]; buf /= np.abs(buf).max(); out = np.zeros(n)
    for k in range(n):
        out[k] = buf[k % p]; buf[k % p] = 0.5 * (buf[k % p] + buf[(k + 1) % p]) * 0.994
    return out * np.minimum(1, np.arange(n) / 60)


def box(m, dur=1.1, bright=1.0):
    t = np.arange(int(SR * dur)) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6) + 0.15 * bright * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 9)
    return s * np.exp(-t * 3.4) * np.minimum(1, t / 0.003)


def bell(m, dur=3.0):
    t = np.arange(int(SR * dur)) / SR; f = hz(m); s = np.zeros_like(t)
    for r, a, d in ((0.5, 0.6, 1.2), (1, 1, 1.6), (1.19, 0.5, 2.4), (1.5, 0.35, 2.8), (2, 0.3, 3.5), (2.74, 0.15, 5)):
        s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d)
    return s * np.minimum(1, t / 0.002) / 2.5


def organ(chord, dur):
    t = np.arange(int(SR * dur)) / SR; s = np.zeros_like(t)
    for m in chord: f = hz(m); s += np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t)
    return s * (1 + 0.12 * np.sin(2 * np.pi * 5 * t)) * np.minimum(1, t / 0.5) * np.minimum(1, (dur - t) / 0.6) / len(chord)


prog = [(38, [62, 65, 69]), (38, [62, 65, 69]), (34, [62, 65, 70]), (33, [61, 64, 69]),
        (31, [62, 67, 70]), (34, [62, 65, 70]), (33, [61, 64, 67]), (38, [62, 65, 69])]   # Dm Dm Bb A Gm Bb A7 Dm
mel = [[(0, 74), (1, 77), (2, 76)], [(0, 74), (2, 69)], [(0, 70), (1, 74), (2, 77)], [(0, 76), (1.5, 73)],
       [(0, 74), (1, 79), (2, 77)], [(0, 77), (1, 74), (2, 70)], [(0, 73), (1, 76), (2, 79)], [(0, 77), (1, 74)]]
bars = int(DUR / BAR) + 1
for bar in range(bars):
    t0 = bar * BAR; h = bar % 8
    if t0 > DUR - 1.5: break
    root, chord = prog[h]
    add(pluck(root, 0.9), t0, pan=-0.15, gain=0.85)                                        # oom
    for beat in (1, 2):                                                                     # pah-pah
        for m in chord: add(box(m, 0.35, 0.4), t0 + beat * B, pan=0.1, gain=0.06)
    add(organ([c - 12 for c in chord], BAR + 0.3), t0, gain=0.05)
    if t0 >= 5.0:                                                                           # the melody joins after the hook
        for beat, m in mel[h]: add(box(m, 1.0), t0 + beat * B, pan=0.3, gain=0.2)
    if h in (0, 4): add(bell(50 if h == 0 else 55), t0, pan=-0.35, gain=0.18)
tend = DUR - 2.4
for m, d in ((74, 0), (77, 0.07), (81, 0.14), (86, 0.22)): add(box(m, 2.0), tend + d, pan=0.2, gain=0.22)
add(pluck(38, 1.6), tend, gain=0.7); add(bell(50), tend, pan=-0.3, gain=0.22)
for d, g in ((0.029, 0.28), (0.047, 0.2), (0.071, 0.14), (0.113, 0.1), (0.17, 0.06)):          # a little room
    k = int(d * SR); L[k:] += L[:-k] * g * 0.5; R[k:] += R[:-k] * g * 0.5
fade = np.ones(N); fl = int(1.4 * SR); fade[-fl:] = np.linspace(1, 0, fl); L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max()); L /= pk / 0.89; R /= pk / 0.89
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.stack([L, R], 1) * 32767).astype(np.int16).tobytes()); w.close(); print(OUT, DUR, 's')
