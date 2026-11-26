// 박자 유지·장르별 그루브 엔진 (순수 함수)
// - 연습 단위(drill): { id, kind("time" | "lock"), level, topic, lv(난이도 1~5), name, events, ticks, bars, feel, bpm{start,target}, tip, drums }
// - 클릭 방식(CLICK_MODES): 매 박 → 2·4박만 → 1박만 → 2마디에 한 번 → 무음 마디. 그루브는 드럼이 마디째 빠지는 방식만
// - 기대 어택: 셔플은 8분 뒤쪽을 셋잇단 3번째 자리로. 고스트 노트는 선택(쳐도 되고 안 쳐도 됨)
// - 박자 판정은 Technique 엔진(judge)을 그대로 쓰고, 실제 템포·구간별 쏠림·재진입 오차를 더 계산

import { parseToken } from "../licks/lick-core.js";
import { PATTERNS, PATTERN_TOPICS, GROOVES, GROOVE_TOPICS, CLICK_MODES, CLICK_LV, DIFFICULTY } from "./groove-data.js";

export { PATTERN_TOPICS, GROOVE_TOPICS, CLICK_MODES, CLICK_LV, DIFFICULTY };

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

function fromPattern([id, level, topic, lv, name, str, bpm, tip, feel = "straight"]) {
  const { events, ticks } = parseLine(str);
  return { id, kind: "time", level, topic, lv, name, events, ticks, bars: Math.ceil(ticks / BAR), feel, bpm: { start: bpm[0], target: bpm[1] }, tip, drums: null };
}
function fromGroove([id, level, topic, lv, name, str, drums, bpm, tip, feel = "straight"]) {
  const { events, ticks } = parseLine(str);
  return { id, kind: "lock", level, topic, lv, name, events, ticks, bars: Math.ceil(ticks / BAR), feel, bpm: { start: bpm[0], target: bpm[1] }, tip, drums };
}
export const PATTERN_DRILLS = PATTERNS.map(fromPattern);
export const GROOVE_DRILLS = GROOVES.map(fromGroove);
export const ALL_DRILLS = [...PATTERN_DRILLS, ...GROOVE_DRILLS];
export const drillById = id => ALL_DRILLS.find(x => x.id === id) || null;

// 레벨·주제·난이도로 고르기. topics가 비면 레벨 전체, maxLv가 있으면 그 난이도까지
export function drillsFor(kind, level, topics = [], { maxLv = 5, minLv = 1 } = {}) {
  const all = (kind === "lock" ? GROOVE_DRILLS : PATTERN_DRILLS).filter(x => !level || x.level === level);
  const t = (topics || []).filter(x => all.some(e => e.topic === x));
  const pick = t.length ? all.filter(e => t.includes(e.topic)) : all;
  const byLv = pick.filter(e => e.lv >= minLv && e.lv <= maxLv);
  return (byLv.length ? byLv : pick).slice().sort((a, b) => a.lv - b.lv);
}

export function validateDrill(x) {
  const errs = [];
  if (x.ticks % BAR !== 0) errs.push(`길이 ${x.ticks}틱이 마디의 배수가 아님`);
  if (!x.events.some(e => judged(e) && !e.ghost)) errs.push("판정할 음 없음");
  for (const e of x.events) for (const n of e.notes) if (n.s < 1 || n.s > 4 || n.f < 0 || n.f > 17) errs.push(`음 위치 ${n.s}-${n.f}`);
  if (!(x.bpm.start >= 40 && x.bpm.target > x.bpm.start && x.bpm.target <= 200)) errs.push("권장 BPM");
  if (!(x.lv >= 1 && x.lv <= 5)) errs.push("난이도");
  if (x.drums) {
    const len = x.feel === "shuffle" ? 8 : 16;
    for (const [k, v] of Object.entries(x.drums)) if (v.length !== len * x.bars && v.length !== len) errs.push(`드럼 ${k} 길이 ${v.length}`);
  }
  return errs;
}

// 그루브에서 쓸 수 있는 클릭 방식(드럼이 마디째 빠짐)
export const LOCK_MODES = ["beat", "drop", "drop4"];
export const modesFor = kind => (kind === "lock" ? LOCK_MODES : Object.keys(CLICK_MODES));

// 무음 구간이 있는 방식은 최소 마디 수가 필요함
const MIN_BARS = { drop: 4, drop4: 8, cbar2: 4 };
export function loopsFor(x, runBars, mode) {
  const want = Math.max(runBars, MIN_BARS[mode] || 0);
  return Math.max(1, Math.ceil(want / x.bars));
}

// 한 번 칠 계획: 반복 횟수, 재생 이벤트, 클릭, 드럼, 구간(클릭·드럼 있음/없음)
export function runPlan(x, runBars, mode = "beat") {
  if (!modesFor(x.kind).includes(mode)) mode = "beat";
  const loops = loopsFor(x, runBars, mode);
  const bars = x.bars * loops;
  const audible = b => (mode === "drop" ? Math.floor(b / 2) % 2 === 0 : mode === "drop4" ? Math.floor(b / 4) % 2 === 0 : true);
  const sections = [];
  for (let b = 0; b < bars; b++) {
    const on = audible(b), last = sections[sections.length - 1];
    if (!last || last.click !== on) sections.push({ from: b, to: b + 1, click: on }); else last.to = b + 1;
  }
  const clicks = [];
  if (x.kind === "time") for (let b = 0; b < bars; b++) {
    if (!audible(b)) continue;
    for (let k = 0; k < 4; k++) {
      const beat = b * 4 + k;
      const on = mode === "c24" ? k === 1 || k === 3 : mode === "c1" ? k === 0 : mode === "cbar2" ? k === 0 && b % 2 === 0 : true;
      if (on) clicks.push({ beat, vel: mode === "c24" ? 0.8 : k === 0 ? 0.8 : 0.45 });
    }
  }
  const drums = drumEvents(x, loops).filter(d => audible(Math.floor(d.beat / 4 + 1e-9)));
  return { mode, loops, bars, line: loopEvents(x, loops), clicks, drums, sections };
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

// ── 템포 분석 ──
// res: judge 결과(notes에 t·dt), sections, bpm → 실제 템포(BPM), 구간별 평균 쏠림·마디당 흐름, 재진입 오차
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
function slope(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}
export function analyzeTime(res, sections, bpm) {
  const spb = 60 / bpm, barSec = 4 * spb;
  const hits = res.notes.filter(n => n.dt != null && !n.optional);
  // 실제 템포: 친 시각 = a + b × 기대 시각 → b가 1보다 크면 느림
  const b = slope(hits.map(n => n.t), hits.map(n => n.t + n.dt));
  const playedBpm = b ? bpm / b : null;
  const secs = sections.map(sc => {
    const inRange = n => n.t >= sc.from * barSec - 1e-6 && n.t < sc.to * barSec - 1e-6;
    const inSec = hits.filter(inRange);
    const all = res.notes.filter(n => !n.optional && inRange(n));
    const drift = slope(inSec.map(n => n.t / barSec), inSec.map(n => n.dt * 1000));   // ms/마디
    return { from: sc.from, to: sc.to, click: sc.click, n: all.length, hits: inSec.length, meanMs: mean(inSec.map(n => n.dt * 1000)), driftMsPerBar: drift };
  });
  // 재진입: 무음 구간 바로 다음 구간의 첫 어택
  const reentries = [];
  for (let i = 1; i < secs.length; i++) if (secs[i].click && !secs[i - 1].click) {
    const t0 = secs[i].from * barSec;
    const first = res.notes.filter(n => !n.optional && n.t >= t0 - 1e-6).sort((p, q) => p.t - q.t)[0];
    reentries.push(first && first.dt != null && first.t - t0 < spb + 1e-6 ? first.dt * 1000 : null);
  }
  return { playedBpm, sections: secs, reentries };
}

export function tendency(ms) {
  if (ms == null) return "-";
  if (Math.abs(ms) < 8) return "박 위";
  return ms < 0 ? `${Math.round(-ms)}ms 빠름` : `${Math.round(ms)}ms 늦음`;
}
