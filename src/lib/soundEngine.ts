// ─── Web Audio API Sound Engine ───────────────────────────────────────────────
// No external files needed — all sounds generated programmatically

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function resumeContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") return ctx.resume();
  return Promise.resolve();
}

// ─── Core tone generator ──────────────────────────────────────────────────────
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3,
  delay = 0
): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

    gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + duration + 0.05);
  } catch (e) {
    console.warn("Sound error:", e);
  }
}

// ─── CALL Signal — Rising triumphant arpeggio (Green) ─────────────────────────
export async function playCallSound(): Promise<void> {
  await resumeContext();
  // Rising major chord: C5 → E5 → G5 → C6
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, i) => {
    playTone(freq, 0.25, "sine", 0.28, i * 0.08);
  });
  // Sustain the last note
  playTone(1046.50, 0.4, "triangle", 0.15, notes.length * 0.08);
}

// ─── PUT Signal — Descending alert tone (Red) ────────────────────────────────
export async function playPutSound(): Promise<void> {
  await resumeContext();
  // Descending minor: A5 → F5 → D5 → A4
  const notes = [880, 698.46, 587.33, 440];
  notes.forEach((freq, i) => {
    playTone(freq, 0.22, "sine", 0.28, i * 0.08);
  });
  // Sustain low note
  playTone(440, 0.35, "triangle", 0.15, notes.length * 0.08);
}

// ─── STRONG signal — Extra impact ─────────────────────────────────────────────
export async function playStrongSignalSound(direction: "CALL" | "PUT"): Promise<void> {
  await resumeContext();

  if (direction === "CALL") {
    // Triumphant fanfare
    playTone(523.25, 0.1, "square", 0.15, 0);
    playTone(659.25, 0.1, "square", 0.15, 0.05);
    playTone(783.99, 0.15, "square", 0.15, 0.10);
    playTone(1046.50, 0.4, "sine", 0.25, 0.20);
    playTone(1318.51, 0.3, "sine", 0.18, 0.35);
  } else {
    // Warning descend
    playTone(880, 0.1, "sawtooth", 0.15, 0);
    playTone(698.46, 0.1, "sawtooth", 0.15, 0.05);
    playTone(587.33, 0.15, "sawtooth", 0.12, 0.10);
    playTone(440, 0.4, "sine", 0.22, 0.20);
    playTone(349.23, 0.3, "sine", 0.15, 0.35);
  }
}

// ─── Engine start ─────────────────────────────────────────────────────────────
export async function playEngineStart(): Promise<void> {
  await resumeContext();
  playTone(200, 0.1, "sawtooth", 0.12, 0);
  playTone(400, 0.1, "sawtooth", 0.14, 0.08);
  playTone(600, 0.15, "sine", 0.18, 0.16);
  playTone(800, 0.2, "sine", 0.2, 0.28);
}

// ─── Engine stop ──────────────────────────────────────────────────────────────
export async function playEngineStop(): Promise<void> {
  await resumeContext();
  playTone(600, 0.1, "sine", 0.15, 0);
  playTone(400, 0.1, "sine", 0.12, 0.1);
  playTone(200, 0.2, "sine", 0.08, 0.2);
}

// ─── Alert beep (for countdown) ───────────────────────────────────────────────
export async function playCountdownBeep(isLast: boolean): Promise<void> {
  await resumeContext();
  const freq = isLast ? 880 : 440;
  const dur = isLast ? 0.15 : 0.08;
  playTone(freq, dur, "sine", isLast ? 0.2 : 0.1, 0);
}

// ─── Screenshot analysis complete ─────────────────────────────────────────────
export async function playAnalysisComplete(): Promise<void> {
  await resumeContext();
  playTone(523.25, 0.08, "sine", 0.15, 0);
  playTone(783.99, 0.08, "sine", 0.15, 0.1);
  playTone(1046.50, 0.2, "sine", 0.18, 0.2);
}

// ─── Error sound ──────────────────────────────────────────────────────────────
export async function playErrorSound(): Promise<void> {
  await resumeContext();
  playTone(200, 0.15, "sawtooth", 0.15, 0);
  playTone(150, 0.25, "sawtooth", 0.1, 0.15);
}
