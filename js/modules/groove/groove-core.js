// Rhythm(베이스) 엔진 (순수 함수)
// - 연습 단위(drill): { id, kind, name, events, ticks, bars, feel, bpm{start,target}, tip, clicks, drums, sections }
//   kind "time"(박자·템포 유지) | "pattern"(리듬 패턴) | "lock"(드럼과 맞추기)
// - 기대 어택: 셔플은 8분 뒤쪽을 셋잇단 3번째 자리로. 고스트 노트는 선택(쳐도 되고 안 쳐도 됨)
// - 박자 판정 자체는 Technique 엔진(judge)을 그대로 씀. 박자·템포 유지는 구간별(클릭 있음·없음) 쏠림과 실제 템포를 더 계산

import { parseToken } from "../licks/lick-core.js";
import { PATTERNS, PATTERN_TOPICS, GROOVES, GROOVE_TOPICS, TIME_MODES } from "./groove-data.js";

export { PATTERN_TOPICS, GROOVE_TOPICS, TIME_MODES };

const BAR = 48;

export function parseLine(str) {
  const events = str.trim().split(/\s+/).map(parseToken);
  let t = 0;
  for (const e of events) { e.at = t; t += e.dur; }
  return { events, ticks: t };
}

// 셔플: 박 안 8분 뒤쪽(0.5)을 셋잇단 3번째(2/3)로
export function feelBeat(beat, feel) {
  if (feel !== "shuffle") return beat;
  const w = Math.floor(beat + 1e-9), f = beat - w;
  return Math.abs(f - 0.5) < 1e-6 ? w + 2 / 3 : beat;
}

// 판정 대상: 쉼표·해머·풀·슬라이드 제외. 고스트는 선택
const judged = e => !e.rest && !e.h && !e.p && !e.sl;

function fromPattern([id, topic, name, str, bpm, tip, feel = "straight"]) {
  const { events, ticks } = parseLine(str);
  return { id, kind: "pattern", topic, name, events, ticks, bars: Math.ceil(ticks / BAR), feel, bpm: { start: bpm[0], target: bpm[1] }, tip, clicks: "beat", drums: null };
}
function fromGroove([id, topic, name, str, drums, bpm, tip, feel = "straight"]) {
  const { events, ticks } = parseLine(str);
  return { id, kind: "lock", topic, name, events, ticks, bars: Math.ceil(ticks / BAR), feel, bpm: { start: bpm[0], target: bpm[1] }, tip, clicks: "none", drums };
}
export const PATTERN_DRILLS = PATTERNS.map(fromPattern);
export const GROOVE_DRILLS = GROOVES.map(fromGroove);

export function validateDrill(x) {
  const errs = [];
  if (x.ticks % BAR !== 0) errs.push(`길이 ${x.ticks}틱이 마디의 배수가 아님`);
  if (!x.events.some(e => judged(e) && !e.ghost)) errs.push("판정할 음 없음");
  for (const e of x.events) for (const n of e.notes) if (n.s < 1 || n.s > 4 || n.f < 0 || n.f > 17) errs.push(`음 위치 ${n.s}-${n.f}`);
  if (!(x.bpm.start >= 40 && x.bpm.target > x.bpm.start && x.bpm.target <= 200)) errs.push("권장 BPM");
  if (x.drums) {
    const len = x.feel === "shuffle" ? 8 : 16;
    for (const [k, v] of Object.entries(x.drums)) if (v.length !== len * x.bars && v.length !== len) errs.push(`드럼 ${k} 길이 ${v.length}`);
  }
  return errs;
}

// ── 박자·템포 유지(R1) ──
// note: "q" 4분 | "e" 8분 (박 쪼개기 바꾸기는 마디마다 바뀜). bars: 판정 길이(마디)
// clicks: 클릭 칠 박 번호 배열(0부터, 준비 박 제외). sections: [{ from, to(마디, to 미포함), click }]
export function timeDrill(mode, { note = "q", bars = 8 } = {}) {
  const M = TIME_MODES[mode] || TIME_MODES.c24;
  const tokens = [];
  const clicks = [];
  const sections = [];
  const root = "3-0";
  if (mode === "subdiv") {
    const seq = ["q", "e", "t", "s"];
    for (let b = 0; b < bars; b++) {
      const d = seq[b % 4], n = { q: 4, e: 8, t: 12, s: 16 }[d];
      for (let i = 0; i < n; i++) tokens.push(`${root}:${d}`);
      for (let k = 0; k < 4; k++) clicks.push({ beat: b * 4 + k, vel: k === 0 ? 0.9 : 0.55 });
    }
    sections.push({ from: 0, to: bars, click: true });
  } else {
    const per = note === "e" ? 8 : 4;
    for (let b = 0; b < bars * per; b++) tokens.push(`${root}:${note === "e" ? "e" : "q"}`);
    let on = null;
    for (let b = 0; b < bars; b++) {
      let has;
      if (mode === "c24") { has = true; clicks.push({ beat: b * 4 + 1, vel: 0.8 }, { beat: b * 4 + 3, vel: 0.8 }); }
      else if (mode === "c1") { has = true; clicks.push({ beat: b * 4, vel: 0.9 }); }
      else if (mode === "cbar2") { has = b % 2 === 0; if (has) clicks.push({ beat: b * 4, vel: 0.9 }); }
      else {
        const len = mode === "drop4" ? 4 : 2;
        has = Math.floor(b / len) % 2 === 0;
        if (has) for (let k = 0; k < 4; k++) clicks.push({ beat: b * 4 + k, vel: k === 0 ? 0.9 : 0.55 });
      }
      // 구간: 2·4박·1박·2마디에 한 번은 전체가 "클릭 줄임" 한 구간, drop은 클릭 있음/없음 번갈아
      const sec = mode === "drop" || mode === "drop4" ? has : true;
      if (on === null || on.click !== sec) { on = { from: b, to: b + 1, click: sec }; sections.push(on); } else on.to = b + 1;
    }
  }
  const { events, ticks } = parseLine(tokens.join(" "));
  return { id: `TK-${mode}-${note}`, kind: "time", topic: mode, name: M.name, events, ticks, bars, feel: "straight", bpm: { start: 70, target: 140 }, tip: M.tip, clicks, drums: null, sections, mode };
}

// 기대 어택(초, 첫 박 기준). loops = 반복 횟수
export function expectedOnsets(x, bpm, loops = 1) {
  const spb = 60 / bpm, out = [];
  for (let l = 0; l < loops; l++) x.events.forEach((e, idx) => {
    if (e.rest) return;
    out.push({ t: feelBeat((l * x.ticks + e.at) / 12, x.feel) * spb, idx, loop: l, optional: !judged(e) || e.ghost });
  });
  return out;
}

// 재생할 클릭(박 번호, 준비 박 뒤 0부터). "beat" = 매 박, "none" = 없음, 배열 = 그대로(반복 고려)
export function clickBeats(x, loops = 1) {
  const beats = (x.ticks / 12) * loops;
  if (x.clicks === "none") return [];
  if (x.clicks === "beat") return Array.from({ length: beats }, (_, b) => ({ beat: b, vel: b % 4 === 0 ? 0.8 : 0.45 }));
  const per = x.ticks / 12, out = [];
  for (let l = 0; l < loops; l++) for (const c of x.clicks) out.push({ beat: c.beat + l * per, vel: c.vel });
  return out;
}

// 드럼 칸 → 재생 이벤트(박 단위, 셔플 반영)
const KIND = { k: "kick", s: "snare", h: "hat", o: "ohat", r: "ride" };
export function drumEvents(x, loops = 1) {
  if (!x.drums) return [];
  const slots = x.feel === "shuffle" ? 2 : 4;
  const out = [];
  const beats = x.ticks / 12;
  for (const [k, str] of Object.entries(x.drums)) {
    const unit = str.length / slots;   // 이 문자열이 덮는 박 수
    for (let l = 0; l < loops; l++) for (let start = 0; start < beats; start += unit) {
      [...str].forEach((c, i) => {
        if (c === ".") return;
        const beat = l * beats + start + i / slots;
        out.push({ beat: feelBeat(beat, x.feel), kind: KIND[k] || "hat", vel: c === "X" ? 1 : k === "h" ? 0.55 : 0.8 });
      });
    }
  }
  return out.sort((a, b) => a.beat - b.beat);
}

// 반복 재생용 이벤트
export function loopEvents(x, loops) {
  const out = [];
  for (let l = 0; l < loops; l++) for (const e of x.events) out.push({ ...e, at: e.at + l * x.ticks });
  return { events: out, ticks: x.ticks * loops, feel: x.feel };
}

// ── 박자·템포 유지 결과 분석 ──
// res: judge 결과(notes에 t·dt), sections, bpm → 실제 템포(BPM), 구간별 평균 쏠림, 무음 구간 흐름, 재진입 오차
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
function slope(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}
export function analyzeTime(res, x, bpm) {
  const spb = 60 / bpm, barSec = 4 * spb;
  const hits = res.notes.filter(n => n.dt != null && !n.optional);
  // 실제 템포: 친 시각 = a + b × 기대 시각 → b가 1보다 크면 느림
  const b = slope(hits.map(n => n.t), hits.map(n => n.t + n.dt));
  const playedBpm = b ? bpm / b : null;
  const sections = (x.sections || [{ from: 0, to: x.bars, click: true }]).map(sc => {
    const inSec = hits.filter(n => n.t >= sc.from * barSec - 1e-6 && n.t < sc.to * barSec - 1e-6);
    const all = res.notes.filter(n => !n.optional && n.t >= sc.from * barSec - 1e-6 && n.t < sc.to * barSec - 1e-6);
    const drift = slope(inSec.map(n => n.t / barSec), inSec.map(n => n.dt * 1000));   // ms/마디
    return { from: sc.from, to: sc.to, click: sc.click, n: all.length, hits: inSec.length, meanMs: mean(inSec.map(n => n.dt * 1000)), driftMsPerBar: drift };
  });
  // 재진입: 무음 구간 바로 다음 클릭 구간의 첫 박
  const reentries = [];
  for (let i = 1; i < sections.length; i++) if (sections[i].click && !sections[i - 1].click) {
    const t0 = sections[i].from * barSec;
    const first = res.notes.find(n => !n.optional && Math.abs(n.t - t0) < 1e-6);
    reentries.push(first && first.dt != null ? first.dt * 1000 : null);
  }
  return { playedBpm, sections, reentries };
}

// 쏠림을 말로
export function tendency(ms) {
  if (ms == null) return "-";
  if (Math.abs(ms) < 8) return "박 위";
  return ms < 0 ? `${Math.round(-ms)}ms 빠름` : `${Math.round(ms)}ms 늦음`;
}

export function drillsFor(kind, topics) {
  const all = kind === "lock" ? GROOVE_DRILLS : PATTERN_DRILLS;
  const t = (topics || []).filter(x => all.some(e => e.topic === x));
  return t.length ? all.filter(e => t.includes(e.topic)) : all;
}
export const drillById = id => [...PATTERN_DRILLS, ...GROOVE_DRILLS].find(x => x.id === id) || null;
