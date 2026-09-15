"""Generate original procedural melodies and UI tones; no external samples."""
from pathlib import Path
import math
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / "assets" / "audio"
RATE = 22050

def render(name, duration, notes, ambience=False):
    frames = bytearray()
    for i in range(int(duration * RATE)):
        t = i / RATE
        value = 0.0
        for start, length, midi, gain in notes:
            age = t-start
            if 0 <= age < length:
                envelope = min(1.0, age/.035) * min(1.0, (length-age)/.15)
                freq = 440 * 2**((midi-69)/12)
                value += gain*envelope*(math.sin(2*math.pi*freq*age)+.13*math.sin(4*math.pi*freq*age))
        edge = min(1.0, t/.12, (duration-t)/.18)
        frames.extend(struct.pack("<h", int(max(-.9, min(.9, value*edge))*32767)))
    with wave.open(str(ROOT / (name+".wav")), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(frames)

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    melodies = {
        "bus": [60,64,67,69,67,64,62,60],
        "garden": [62,65,69,72,69,65,64,62],
        "cinema": [57,60,64,67,64,62,60,57],
    }
    for scene, melody in melodies.items():
        notes=[(i*1.5,1.65,n,.09) for i,n in enumerate(melody)]
        notes += [(0,6,melody[0]-12,.04),(6,6,melody[4]-12,.04)]
        render("music-"+scene,12,notes,True)
    for index,name in enumerate(["select","place","swap","undo","reset","hint","complete","claim","open","close"]):
        base=64+index%5
        duration=.65 if name in ["complete","claim"] else .24
        notes=[(0,.18,base,.16)]
        if duration>.3: notes +=[(.14,.22,base+4,.14),(.3,.3,base+7,.13)]
        render(name,duration,notes)
    print("Generated 3 original music loops and 10 original UI sounds.")

if __name__ == "__main__":
    main()
