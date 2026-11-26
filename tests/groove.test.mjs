// Rhythm(베이스) 엔진 테스트
import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/modules/groove/groove-core.js";
import * as T from "../js/modules/technique/tech-core.js";

test("리듬 패턴·드럼 그루브: 형식·길이·음 위치·권장 BPM 통과, 주제마다 3개 이상", () => {
  for (const x of [...G.PATTERN_DRILLS, ...G.GROOVE_DRILLS]) assert.deepEqual(G.validateDrill(x), [], x.id);
  for (const t of Object.keys(G.PATTERN_TOPICS)) assert.ok(G.PATTERN_DRILLS.filter(x => x.topic === t).length >= 3, t);
  assert.ok(G.GROOVE_DRILLS.length >= 10);
  assert.equal(new Set([...G.PATTERN_DRILLS, ...G.GROOVE_DRILLS].map(x => x.id)).size, G.PATTERN_DRILLS.length + G.GROOVE_DRILLS.length);
});

test("기대 어택: 셔플은 8분 뒤쪽이 셋잇단 3번째, 고스트·쉼표 처리", () => {
  const sh = G.PATTERN_DRILLS.find(x => x.id === "RF-01");
  const e = G.expectedOnsets(sh, 60);
  assert.deepEqual(e.slice(0, 3).map(v => +v.t.toFixed(3)), [0, 0.667, 1]);
  const gh = G.PATTERN_DRILLS.find(x => x.id === "RG-01");
  const g = G.expectedOnsets(gh, 60);
  assert.equal(g.filter(v => v.optional).length, 4);   // 고스트 4개는 선택
  const rest = G.PATTERN_DRILLS.find(x => x.id === "RY-02");
  assert.deepEqual(G.expectedOnsets(rest, 60).map(v => v.t), [0.5, 1.5, 2.5, 3.5]);
});

test("드럼과 맞추기: 킥 자리와 베이스 어택이 같음(GL-01·04·06·08)", () => {
  for (const id of ["GL-01", "GL-04", "GL-06", "GL-08", "GL-11", "GL-12"]) {
    const x = G.GROOVE_DRILLS.find(v => v.id === id);
    const kicks = G.drumEvents(x).filter(d => d.kind === "kick").map(d => d.beat);
    const bass = G.expectedOnsets(x, 60).filter(v => !v.optional).map(v => v.t);
    assert.deepEqual(bass, kicks, id);
  }
  const sh = G.GROOVE_DRILLS.find(v => v.id === "GL-09");
  assert.ok(G.drumEvents(sh).some(d => Math.abs(d.beat - 2 / 3) < 1e-9));   // 셔플 라이드
  assert.equal(G.drumEvents(sh, 2).filter(d => d.kind === "kick").length, 4);
});

test("박자·템포 유지: 클릭 자리, 구간, 칠 음 수", () => {
  const c24 = G.timeDrill("c24", { bars: 8 });
  assert.equal(c24.events.length, 32);
  assert.deepEqual(c24.clicks.slice(0, 4).map(c => c.beat), [1, 3, 5, 7]);
  assert.equal(c24.sections.length, 1);
  const d = G.timeDrill("drop4", { bars: 16, note: "e" });
  assert.equal(d.events.length, 128);
  assert.deepEqual(d.sections.map(s => [s.from, s.to, s.click]), [[0, 4, true], [4, 8, false], [8, 12, true], [12, 16, false]]);
  assert.ok(d.clicks.every(c => Math.floor(c.beat / 4) % 8 < 4));
  const sub = G.timeDrill("subdiv", { bars: 4 });
  assert.equal(sub.events.length, 4 + 8 + 12 + 16);
  assert.equal(sub.ticks, 4 * 48);
  assert.equal(G.timeDrill("cbar2", { bars: 8 }).clicks.length, 4);
});

test("박자·템포 유지 분석: 무음 구간에서 빨라지면 실제 템포·흐름·재진입이 잡힘", () => {
  const x = G.timeDrill("drop", { bars: 8 });
  const bpm = 100, spb = 0.6;
  const exp = G.expectedOnsets(x, bpm);
  // 클릭 구간은 정확, 무음 구간은 박마다 4ms씩 빨라짐(앞당김), 다시 클릭 구간 첫 박에서 -30ms
  let drift = 0;
  const det = exp.map(e => {
    const bar = Math.floor(e.t / (4 * spb));
    const silent = Math.floor(bar / 2) % 2 === 1;
    if (silent) { drift -= 0.004; return e.t + drift; }
    const v = drift ? e.t - 0.03 : e.t; drift = 0; return v;
  });
  const res = T.judge(exp, det);
  const a = G.analyzeTime(res, x, bpm);
  assert.equal(a.sections.length, 4);
  assert.ok(a.sections[1].meanMs < -10 && a.sections[1].driftMsPerBar < -10, JSON.stringify(a.sections[1]));
  assert.ok(Math.abs(a.sections[0].meanMs) < 1);
  assert.equal(a.reentries.length, 1);
  assert.ok(Math.abs(a.reentries[0] + 30) < 1);
  // 전체를 2% 느리게 치면 실제 템포 ≈ 98
  const slow = exp.map(e => e.t * 1.02);
  const a2 = G.analyzeTime(T.judge(exp, slow), x, bpm);
  assert.ok(Math.abs(a2.playedBpm - 100 / 1.02) < 0.3, String(a2.playedBpm));
});

test("클릭: 리듬 패턴은 매 박, 드럼과 맞추기는 없음, 반복 시 이어짐", () => {
  const p = G.PATTERN_DRILLS[0];
  assert.equal(G.clickBeats(p, 2).length, 8);
  assert.equal(G.clickBeats(G.GROOVE_DRILLS[0], 2).length, 0);
  const c1 = G.timeDrill("c1", { bars: 4 });
  assert.deepEqual(G.clickBeats(c1).map(c => c.beat), [0, 4, 8, 12]);
});
