// 베이스 아르페지오 엔진 (화면과 무관)
// 코드 종류별 구성음과, 지정한 줄·프렛에서 시작해 코드톤을 낮은 음부터 차례로 올라가는 운지 경로를 만듦
// 운지 규칙(4현 베이스 관례)
// - 왼손 한 자리 = 검지 프렛(lo)부터 4프렛(1손가락 1프렛), 새끼 쪽 1프렛 넓히기·검지 쪽 1프렛 뒤로 뻗기는 감점
// - 줄은 같은 줄(더 높은 프렛)이나 더 가는 줄로만 이동, 줄 건너뛰기는 감점
// - 손 자리 옮기기(시프트)는 큰 감점, 1옥타브는 최대 1번, 2옥타브는 최대 3번
// - 개방현은 손 자리가 낮을 때(검지 3프렛 이하)만 씀

import { TUNING, LOWEST } from "./notes.js";
import { keyName } from "./scales.js";

const mod = n => ((n % 12) + 12) % 12;
const MAXF = 17;        // 1옥타브 모양
const MAXF2 = 20;       // 2옥타브는 20프렛 베이스 기준(높은 키는 17프렛을 넘음)

export const ARPS = {
  maj:   { name: "메이저", suffix: "", steps: [0, 4, 7], minor: false },
  min:   { name: "마이너", suffix: "m", steps: [0, 3, 7], minor: true },
  dim:   { name: "디미니시드", suffix: "dim", steps: [0, 3, 6], minor: true },
  aug:   { name: "어그먼티드", suffix: "aug", steps: [0, 4, 8], minor: false },
  sus4:  { name: "서스 4", suffix: "sus4", steps: [0, 5, 7], minor: false },
  maj7:  { name: "메이저 7", suffix: "maj7", steps: [0, 4, 7, 11], minor: false },
  dom7:  { name: "도미넌트 7", suffix: "7", steps: [0, 4, 7, 10], minor: false },
  m7:    { name: "마이너 7", suffix: "m7", steps: [0, 3, 7, 10], minor: true },
  m7b5:  { name: "하프 디미니시드", suffix: "m7♭5", steps: [0, 3, 6, 10], minor: true },
  dim7:  { name: "디미니시드 7", suffix: "dim7", steps: [0, 3, 6, 9], minor: true },
  "6":   { name: "메이저 6", suffix: "6", steps: [0, 4, 7, 9], minor: false },
  m6:    { name: "마이너 6", suffix: "m6", steps: [0, 3, 7, 9], minor: true },
  mmaj7: { name: "마이너 메이저 7", suffix: "m(maj7)", steps: [0, 3, 7, 11], minor: true },
  maj9:  { name: "메이저 9", suffix: "maj9", steps: [0, 4, 7, 11, 14], minor: false },
  dom9:  { name: "도미넌트 9", suffix: "9", steps: [0, 4, 7, 10, 14], minor: false },
  m9:    { name: "마이너 9", suffix: "m9", steps: [0, 3, 7, 10, 14], minor: true }
};

export const TRIADS = ["maj", "min", "dim", "aug", "sus4"];
export const SEVENTHS = ["maj7", "dom7", "m7", "m7b5", "dim7", "6", "m6", "mmaj7"];
export const NINTHS = ["maj9", "dom9", "m9"];

// 반음 → 도수 표기(코드 종류에 맞게)
export function degreeLabel(arpId, semi) {
  const s = mod(semi);
  if (arpId === "dim7" && s === 9) return "♭♭7";
  if (arpId === "aug" && s === 8) return "♯5";
  return { 0: "R", 2: "9", 3: "♭3", 4: "3", 5: "4", 6: "♭5", 7: "5", 8: "♭6", 9: "6", 10: "♭7", 11: "7" }[s] || "?";
}

// 코드 이름(플랫 키는 플랫)
export function chordName(rootPc, arpId) {
  const a = ARPS[arpId];
  return keyName(rootPc, a.minor ? "natural-minor" : "major") + a.suffix;
}

export const tonePcs = (rootPc, arpId) => ARPS[arpId].steps.map(x => mod(rootPc + x));

// 시작음부터 올라갈 음높이 목록. inv = 시작 코드톤 번호(0 = 근음), octaves = 1·2
// 9th 계열은 근음에서 시작할 때 맨 위에 9음까지
export function arpPitches(startMidi, rootPc, arpId, octaves = 1) {
  const steps = ARPS[arpId].steps;
  const base = new Set(steps.filter(x => x < 12).map(x => mod(rootPc + x)));
  const upper = new Set(steps.filter(x => x >= 12).map(x => mod(rootPc + x)));   // 9음: 근음 한 옥타브 위에서만
  const ext = upper.size && mod(startMidi - rootPc) === 0 ? 2 : 0;
  const top = startMidi + 12 * octaves + ext;
  const out = [];
  for (let m = startMidi; m <= top; m++) if (base.has(mod(m)) || (upper.has(mod(m)) && m - startMidi >= 12)) out.push(m);
  return out;
}

// 손 자리(lo = 검지 프렛)에서 프렛 f를 누르는 감점. 못 누르면 null
function reach(lo, f) {
  if (f === 0) return lo <= 3 ? 0 : null;
  if (f >= lo && f <= lo + 3) return 0;
  if (f === lo + 4 || f === lo - 1) return 0.8;
  return null;
}

// 지정한 시작 자리(s, f)에서 pitches를 차례로 올라가는 운지 경로(가장 적은 감점)
export function fingerPath(pitches, s0, f0, { maxShifts = 1, maxFret = MAXF } = {}) {
  if (TUNING[s0 - 1] + f0 !== pitches[0]) return null;
  const key = st => `${st.s}|${st.f}|${st.lo}|${st.sh}`;
  let layer = new Map();
  for (let lo = Math.max(1, f0 - 4); lo <= Math.max(1, f0 + 1); lo++) {
    const r = reach(lo, f0);
    if (r == null) continue;
    const st = { s: s0, f: f0, lo, sh: 0, cost: r + Math.abs(f0 - (lo + 1)) * 0.05, prev: null, shift: false };
    layer.set(key(st), st);
  }
  for (let i = 1; i < pitches.length; i++) {
    const m = pitches[i], next = new Map(), left = pitches.length - 1 - i;
    for (const p of layer.values()) {
      for (let s = p.s; s >= 1; s--) {
        const f = m - TUNING[s - 1];
        if (f < 0 || f > maxFret) continue;
        if (s === p.s && f <= p.f) continue;
        const skip = p.s - s >= 2 ? 1.5 * (p.s - s - 1) : 0;
        const same = s === p.s ? 0.2 : 0;
        const add = (lo, sh, extra, shift) => {
          const r = reach(lo, f);
          if (r == null || sh > maxShifts) return;
          const st = { s, f, lo, sh, cost: p.cost + r + skip + same + extra, prev: p, shift };
          const k = key(st);
          if (!next.has(k) || next.get(k).cost > st.cost) next.set(k, st);
        };
        add(p.lo, p.sh, 0, false);
        // 손 자리 옮기기: 새 자리에서 이 음을 누름
        // 자리 옮기기는 되도록 늦게(남은 음이 적을 때) — 한 자리에서 칠 수 있는 만큼 치고 마지막 줄에서 옮기는 관례
        if (f > 0) for (let lo = Math.max(1, f - 3); lo <= f; lo++) if (lo !== p.lo) add(lo, p.sh + 1, 4 + Math.abs(lo - p.lo) * 0.3 + left * 0.4, true);
      }
    }
    if (!next.size) return null;
    layer = next;
  }
  let best = null;
  for (const st of layer.values()) if (!best || st.cost < best.cost) best = st;
  const out = [];
  for (let x = best; x; x = x.prev) out.push({ s: x.s, f: x.f, midi: TUNING[x.s - 1] + x.f, lo: x.lo, shift: x.shift });
  return { notes: out.reverse(), cost: best.cost, shifts: best.sh };
}

// 아르페지오 모양: rootPc·arpId, 시작 코드톤 inv, 시작 줄 s와 시작 프렛 f
export function arpShape(rootPc, arpId, s, f, { inv = 0, octaves = 1 } = {}) {
  const start = TUNING[s - 1] + f;
  const pcs = tonePcs(rootPc, arpId);
  if (mod(start) !== pcs[inv % pcs.length]) return null;
  const path = fingerPath(arpPitches(start, rootPc, arpId, octaves), s, f, { maxShifts: octaves === 1 ? 1 : 3, maxFret: octaves === 1 ? MAXF : MAXF2 });
  if (!path) return null;
  const notes = path.notes.map(n => ({ ...n, label: degreeLabel(arpId, n.midi - rootPc), root: mod(n.midi - rootPc) === 0 }));
  const fr = notes.map(n => n.f);
  const used = new Set(notes.map(n => n.s + "-" + n.f));
  // 같은 손 자리에서 짚을 수 있는 다른 코드톤(흐린 원으로 보여 줌, 시프트가 없을 때만)
  const ghost = [];
  if (!path.shifts) {
    const lo = notes[0].lo;
    for (let gs = LOWEST; gs >= 1; gs--) for (let gf = Math.max(0, lo - 1); gf <= Math.min(MAXF, lo + 4); gf++) {
      const m = TUNING[gs - 1] + gf;
      if (used.has(gs + "-" + gf) || !pcs.includes(mod(m)) || reach(lo, gf) == null) continue;
      ghost.push({ s: gs, f: gf, midi: m, label: degreeLabel(arpId, m - rootPc), root: mod(m - rootPc) === 0 });
    }
  }
  return { rootPc, arpId, inv, octaves, notes, ghost, lo: Math.min(...fr), hi: Math.max(...fr), shifts: path.shifts, cost: path.cost };
}

// 한 줄에서 pc가 나오는 프렛(0~15) 중 구간 가운데에 가까운 순
export function fretsOn(s, pc, region = null) {
  const out = [];
  for (let f = 0; f <= 15; f++) if (mod(TUNING[s - 1] + f) === mod(pc)) out.push(f);
  if (!region) return out;
  const mid = (region.lo + region.hi) / 2;
  const outside = f => (f < region.lo ? region.lo - f : f > region.hi ? f - region.hi : 0);
  return out.sort((a, b) => outside(a) * 3 + Math.abs(a - mid) - (outside(b) * 3 + Math.abs(b - mid)));
}

// 구간 안에서 시작 줄 s의 시작음으로 모양 배치. 안 되면 다음 후보 프렛
export function placeArp(rootPc, arpId, s, region, { inv = 0, octaves = 1 } = {}) {
  const pc = tonePcs(rootPc, arpId)[inv];
  for (const f of fretsOn(s, pc, region)) {
    const sh = arpShape(rootPc, arpId, s, f, { inv, octaves });
    if (sh) return sh;
  }
  return null;
}

// 올라갔다 내려오는 순서(꼭대기 음 1번)
export function upDown(notes) {
  return [...notes, ...[...notes].reverse().slice(1)];
}
