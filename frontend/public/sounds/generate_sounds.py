import wave
import struct
import math
import random

def generate_wav(filename, duration, generate_sample):
    sample_rate = 44100
    n_samples = int(duration * sample_rate)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(n_samples):
            t = i / sample_rate
            sample = generate_sample(t)
            # Clip
            sample = max(-1.0, min(1.0, sample))
            # Convert to 16-bit
            value = int(sample * 32767.0)
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)

# 1. Gentle Chimes (arpeggio)
def gentle_chimes(t):
    freqs = [523.25, 659.25, 783.99, 1046.50] # C5, E5, G5, C6
    note_duration = 0.4
    idx = int((t % 1.6) / note_duration)
    f = freqs[idx]
    env = math.exp(-3 * (t % note_duration))
    return math.sin(2 * math.pi * f * t) * env * 0.5

generate_wav('Gentle Chimes.wav', 3.2, gentle_chimes)

# 2. Loud Beep (square wave)
def loud_beep(t):
    f = 1000
    # beep for 0.1s, silence for 0.1s
    if (t % 0.2) < 0.1:
        return 0.8 if math.sin(2 * math.pi * f * t) > 0 else -0.8
    return 0.0

generate_wav('Loud Beep.wav', 2.0, loud_beep)

# 3. Digital Alarm (fast alternating)
def digital_alarm(t):
    # toggle between 800 and 1200 every 0.1s
    f = 800 if (t % 0.2) < 0.1 else 1200
    # beep group: 3 beeps, then silence
    if (t % 1.0) < 0.6:
        return 0.6 if math.sin(2 * math.pi * f * t) > 0 else -0.6
    return 0.0

generate_wav('Digital Alarm.wav', 2.0, digital_alarm)

# 4. Nature Sounds (soft noise + bird-like chirp)
def nature_sounds(t):
    # white noise background
    noise = random.uniform(-0.1, 0.1)
    # bird chirp every 2s
    if (t % 2.0) < 0.2:
        f = 2000 + 1000 * math.sin(2 * math.pi * 5 * t)
        chirp = math.sin(2 * math.pi * f * t) * 0.3 * math.exp(-5 * (t % 2.0))
        return noise + chirp
    return noise

generate_wav('Nature Sounds.wav', 4.0, nature_sounds)

# 5. Zen Bowl (slow decaying sine wave)
def zen_bowl(t):
    # hit every 4 seconds
    t_mod = t % 4.0
    f = 432.0
    env = math.exp(-1.0 * t_mod)
    # add a slight harmonic
    harmonic = math.sin(2 * math.pi * (f * 2) * t) * 0.2 * math.exp(-2.0 * t_mod)
    return (math.sin(2 * math.pi * f * t) + harmonic) * env * 0.8

generate_wav('Zen Bowl.wav', 8.0, zen_bowl)

print("Sounds generated!")
