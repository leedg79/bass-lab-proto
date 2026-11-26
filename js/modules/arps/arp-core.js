// Arpeggios 출제 규칙 (순수 함수)
// 문제 카드 형식은 Scales 문제형 화면(prompt-drill)과 같음:
// { title, main, sub, shape, ghost, path, changed, from, to, lo, hi, region, answer, midis }

import { ARPS, chordName, degreeLabel, tonePcs, placeArp, arpShape, fretsOn, upDown } from "../../theory/arpeggio.js";
import { stringLabel } from "../../theory/notes.js";
import { rootOrder, regionRange } from "../scales/drill-core.js";

const mod = n => ((n % 12) + 12) % 12;
export const INV_NAMES = ["근음", "3음", "5음", "7음"];

export const ROOT_STRINGS = [["auto", "구간 안에서 자동"], ["4", "4번 줄(E)"], ["3", "3번 줄(A)"]];

const view = sh => { let from = Math.max(0, sh.lo - 1); if (from <= 1) from = 0; return { from, to: Math.max(from + 5, sh.hi + 1) }; };

// 시작 줄 고르기: 고정이면 그 줄, 자동이면 시작음이 구간 안에 들어오는 줄(4·3번, 없으면 2번까지) 중 무작위
export function pickString(pc, region, setting, rand = Math.random) {
  if (setting === "4" || setting === "3") return Number(setting);
  const inside = s => fretsOn(s, pc).some(f => f >= region.lo && f <= region.hi);
  let opts = [4, 3].filter(inside);
  if (!opts.length) opts = [2].filter(inside);
  if (!opts.length) opts = [4, 3];
  return opts[Math.floor(rand() * opts.length)];
}

// 모양 → 문제 카드
export function card(sh, { region, title, main, sub, answer, changed = [] }) {
  const notes = sh.notes.map(n => ({ s: n.s, f: n.f, label: n.label, root: n.root, midi: n.midi }));
  return {
    rootPc: sh.rootPc, arpId: sh.arpId, region, title, main, sub,
    shape: notes, path: notes, ghost: sh.ghost.map(g => ({ s: g.s, f: g.f, label: g.label, root: g.root })),
    changed, lo: sh.lo, hi: sh.hi, answer, midis: upDown(notes).map(n => n.midi), ...view(sh)
  };
}

const shapeNote = sh => `${sh.notes.length}음 · ${sh.lo}~${sh.hi}프렛${sh.shifts ? ` · 자리 옮기기 ${sh.shifts}번` : ""}`;

// 아르페지오 찾기: 근음 12개(무작위·4도·반음 순서), 고른 코드 종류를 묶음마다 차례로
export function findDeck({ arpId, order = "random", startPc = 0, regionId = "5-9", rootString = "auto" }, rand = Math.random) {
  return rootOrder(order, startPc, rand).map(pc => {
    const region = regionRange(regionId, rand);
    const s = pickString(pc, region, rootString, rand);
    const sh = placeArp(pc, arpId, s, region) || placeArp(pc, arpId, s === 4 ? 3 : 4, region);
    const name = chordName(pc, arpId);
    return card(sh, {
      region, title: `${name} 아르페지오`, main: name,
      sub: `${stringLabel(sh.notes[0].s)} 근음 · ${region.label}`,
      answer: `근음 ${stringLabel(sh.notes[0].s)} ${sh.notes[0].f}프렛 · ${shapeNote(sh)}`
    });
  });
}

// 코드 종류 바꾸기: 근음·시작 자리는 그대로, 고른 종류를 차례로. 앞 종류에서 바뀐 음은 주황
export function qualityDeck({ rootPc, arpIds, regionId = "5-9", rootString = "auto" }, rand = Math.random) {
  const region = regionRange(regionId, rand);
  const s = pickString(rootPc, region, rootString, rand);
  const f = fretsOn(s, rootPc, region)[0];
  let prev = null;
  return arpIds.map(id => {
    const sh = arpShape(rootPc, id, s, f) || placeArp(rootPc, id, s, region);
    const prevPcs = prev ? new Set(tonePcs(rootPc, prev)) : null;
    const changed = prevPcs ? sh.notes.filter(n => !prevPcs.has(mod(n.midi))).map(n => `${n.s}-${n.f}`) : [];
    const changedDeg = prevPcs ? [...new Set(tonePcs(rootPc, id).filter(x => !prevPcs.has(x)).map(x => degreeLabel(id, x - rootPc)))] : [];
    const name = chordName(rootPc, id);
    const c = card(sh, {
      region, title: `근음 ${stringLabel(s)} ${f}프렛 · 코드 종류 바꾸기`, main: name, sub: `${ARPS[id].name} · 같은 근음 자리에서`,
      answer: prev ? (changedDeg.length ? `${chordName(rootPc, prev)}에서 바뀐 음: ${changedDeg.join("·")}` : `${chordName(rootPc, prev)}와 같은 음`) : shapeNote(sh),
      changed
    });
    prev = id;
    return c;
  });
}

// 전위로 치기: 3음·5음·(7음)에서 시작해 같은 음 한 옥타브 위까지
export function inversionDeck({ arpIds, order = "random", startPc = 0, regionId = "5-9", rootString = "auto" }, rand = Math.random) {
  return rootOrder(order, startPc, rand).map((pc, i) => {
    const id = arpIds[i % arpIds.length];
    const n = Math.min(ARPS[id].steps.length, 4);
    const inv = 1 + Math.floor(rand() * (n - 1));
    const region = regionRange(regionId, rand);
    const startPc = tonePcs(pc, id)[inv];
    const s = pickString(startPc, region, rootString, rand);
    const sh = placeArp(pc, id, s, region, { inv }) || placeArp(pc, id, s === 4 ? 3 : 4, region, { inv });
    const name = chordName(pc, id);
    const tone = degreeLabel(id, ARPS[id].steps[inv]);
    return card(sh, {
      region, title: `${name} · ${INV_NAMES[inv]}부터`, main: name,
      sub: `${INV_NAMES[inv]}(${tone})부터 · ${stringLabel(sh.notes[0].s)} · ${region.label}`,
      answer: `시작 ${stringLabel(sh.notes[0].s)} ${sh.notes[0].f}프렛(${tone}) · ${shapeNote(sh)}`
    });
  });
}

// 2옥타브: 4번 줄 근음에서 두 옥타브(자리 옮기기 포함)
export function twoOctaveDeck({ arpIds, order = "random", startPc = 0, regionId = "2-6" }, rand = Math.random) {
  return rootOrder(order, startPc, rand).map((pc, i) => {
    const id = arpIds[i % arpIds.length];
    const region = regionRange(regionId, rand);
    const sh = placeArp(pc, id, 4, region, { octaves: 2 });
    const name = chordName(pc, id);
    return card(sh, {
      region, title: `${name} 2옥타브`, main: name,
      sub: `4번 줄(E) 근음 · 2옥타브 · ${region.label} 근처`,
      answer: `근음 4번 줄(E) ${sh.notes[0].f}프렛 · ${shapeNote(sh)} · 파란 선 = 운지 순서`
    });
  });
}

// ── 진행 위 코드톤 따라가기 ──
// 박마다 칠 코드톤 패턴(코드 구성음 번호: 0 근음, 1 3음, 2 5음, 3 7음, "8" 옥타브 근음)
export const PATTERNS = [
  ["root", "근음 4박", [0, 0, 0, 0]],
  ["r5", "근음–5음", [0, 0, 2, 2]],
  ["r58", "근음–5음–옥타브–5음", [0, 2, "8", 2]],
  ["r353", "근음–3음–5음–3음", [0, 1, 2, 1]],
  ["r357", "근음–3음–5음–7음", [0, 1, 2, 3]],
  ["free", "자유(코드톤만 표시)", null]
];

// backing.js 코드 종류 → 아르페지오 종류
export const QUALITY_ARP = { "": "maj", m: "min", "7": "dom7", maj7: "maj7", m7: "m7", "ø7": "m7b5", "7♭9": "dom7" };

// 마디마다 코드 모양: 구간 안에서, 앞 마디 근음 자리와 가까운 쪽(손 이동 최소)
export function followPlan(bars, regionId = "5-9") {
  const region = regionRange(regionId);
  let prev = null;
  return bars.map(b => {
    const id = QUALITY_ARP[b.quality] || "maj";
    const cands = [];
    for (const s of [4, 3]) for (const f of fretsOn(s, b.rootPc)) {
      if (f < region.lo - 2 || f > region.hi + 2) continue;
      const sh = arpShape(b.rootPc, id, s, f);
      if (sh) cands.push(sh);
    }
    if (!cands.length) cands.push(placeArp(b.rootPc, id, 4, region) || placeArp(b.rootPc, id, 3, region));
    const mid = (region.lo + region.hi) / 2;
    const score = sh => (prev ? Math.abs(sh.lo - prev.lo) + (sh.notes[0].s === prev.notes[0].s ? 0 : 0.5) : Math.abs(sh.lo - mid)) + sh.cost * 0.2;
    const sh = cands.sort((a, c) => score(a) - score(c))[0];
    prev = sh;
    return { ...b, arpId: id, shape: sh };
  });
}

// 패턴의 박 → 칠 음(모양 안 위치). 7음이 없는 코드(트라이어드)는 옥타브 근음으로 대신
export function beatNote(shape, pattern, beat) {
  const pat = PATTERNS.find(p => p[0] === pattern);
  if (!pat || !pat[2]) return null;
  const want = pat[2][beat % 4];
  const ns = shape.notes;
  if (want === "8") return ns.filter(n => n.root).at(-1) || ns[0];
  const steps = ARPS[shape.arpId].steps;
  const k = want < steps.length ? want : null;
  if (k == null) return ns.filter(n => n.root).at(-1) || ns[0];
  const pc = mod(shape.rootPc + steps[k]);
  return ns.find(n => mod(n.midi) === pc) || ns[0];
}
