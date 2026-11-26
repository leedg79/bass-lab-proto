// Rhythm(베이스) 재생: 준비 박 → 클릭(정한 박만)·드럼 루프·베이스 시범음을 오디오 시계에 미리 예약
// 판정할 때는 시범음 없이(silent) 클릭·드럼만
import { unlockAudio, getAudioContext } from "./context.js";
import { loadInstrument, playNote, masterOut } from "./sampler.js";
import { drum } from "./drums.js";
import { TUNING } from "../theory/notes.js";

let timers = [];
let srcs = [];
let bus = null;

export function stopGroove() {
  timers.forEach(clearTimeout); timers = [];
  srcs.forEach(s => { try { s.stop(); } catch (_) {} }); srcs = [];
  // 이미 예약된 클릭·드럼은 출력 단을 끊어서 멈춤
  if (bus) { try { bus.disconnect(); } catch (_) {} bus = null; }
}

const swingAt = (beat, feel) => { if (feel !== "shuffle") return beat; const w = Math.floor(beat + 1e-9), f = beat - w; return Math.abs(f - 0.5) < 1e-6 ? w + 2 / 3 : beat; };

// line: { events, ticks, feel }, clicks: [{beat, vel}], drums: [{beat, kind, vel}]
// opts: countIn(박), startAt(첫 박 시각, 없으면 곧바로), silent(베이스 음 없음), demoGain, onBeat(beatIndex) — 준비 박은 음수
export async function playGroove(line, bpm, { clicks = [], drums = [], countIn = 4, startAt = null, silent = false, demoGain = 0.85, onBeat = null } = {}) {
  stopGroove();
  await unlockAudio();
  if (!silent) await loadInstrument("bass");
  const ctx = getAudioContext();
  bus = ctx.createGain(); bus.gain.value = 1; bus.connect(masterOut(ctx));
  const out = bus;
  const spb = 60 / bpm;
  const start = startAt != null ? startAt : ctx.currentTime + 0.15 + countIn * spb;
  const pre = start - countIn * spb;
  for (let k = 0; k < countIn; k++) drum("click", pre + k * spb, k === 0 ? 1 : 0.7, out);
  for (const c of clicks) drum("click", start + c.beat * spb, c.vel, out);
  for (const d of drums) drum(d.kind, start + d.beat * spb, d.vel, out);
  if (!silent) line.events.forEach(e => {
    if (e.rest) return;
    const t = start + swingAt(e.at / 12, line.feel) * spb;
    const end = start + swingAt((e.at + e.dur) / 12, line.feel) * spb;
    for (const n of e.notes) {
      const midi = TUNING[n.s - 1] + n.f;
      const s = e.ghost
        ? playNote("bass", midi, t, 0.05, { gain: demoGain * 0.35, out })
        : playNote("bass", midi, t, Math.max(0.06, (end - t) * 0.92), { gain: demoGain, out });
      if (s) srcs.push(s);
    }
  });
  const beats = line.ticks / 12;
  if (onBeat) for (let b = -countIn; b < beats; b++) {
    const t = start + b * spb;
    timers.push(setTimeout(() => onBeat(b), Math.max(0, (t - ctx.currentTime) * 1000)));
  }
  const total = start + beats * spb;
  return { start, end: total, duration: total - ctx.currentTime };
}
