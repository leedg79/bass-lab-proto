// 박자 유지·장르별 그루브 엔진 테스트
import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../js/modules/groove/groove-core.js";
import * as T from "../js/modules/technique/tech-core.js";

test("기본 리듬 세트·그루브: 형식·길이·음 위치·권장 BPM·난이도 통과, 레벨마다 3개 이상, 번호 중복 없음", () => {
  for (const x of G.ALL_DRILLS) assert.deepEqual(G.validateDrill(x), [], x.id);
  for (const l of ["b4", "b8", "b16", "bsh", "bmix"]) assert.ok(G.drillsFor("time", l).length >= 3, l);
  for (const l of ["g1", "g2", "g3", "g4"]) assert.ok(G.drillsFor("lock", l).length >= 3, l);
  assert.equal(new Set(G.ALL_DRILLS.map(x => x.id)).size, G.ALL_DRILLS.length);
  // 레벨별 난이도 범위: 4비트는 입문·초보, 혼합은 중급 이상
  assert.ok(G.drillsFor("time", "b4").every(x => x.lv <= 2));
  assert.ok(G.drillsFor("time", "bmix").every(x => x.lv >= 4));
  // 쉬운 것부터
  const b16 = G.drillsFor("time", "b16");
  for (let i = 1; i < b16.length; i++) assert.ok(b16[i].lv >= b16[i - 1].lv);
  assert.deepEqual(G.drillsFor("time", "b16", ["ghost"]).map(x => x.topic), Array(4).fill("ghost"));
});

test("기대 어택: 셔플은 8분 뒤쪽이 셋잇단 3번째, 고스트·쉼표 처리", () => {
  const sh = G.drillById("RF-01");
  assert.deepEqual(G.expectedOnsets(sh, 60).slice(0, 3).map(v => +v.t.toFixed(3)), [0, 0.667, 1]);
  assert.equal(G.expectedOnsets(G.drillById("RG-01"), 60).filter(v => v.optional).length, 4);
  assert.deepEqual(G.expectedOnsets(G.drillById("RY-02"), 60).map(v => v.t), [0.5, 1.5, 2.5, 3.5]);
  const sd = G.drillById("SD-01");
  assert.equal(sd.bars, 4);
  assert.equal(G.expectedOnsets(sd, 60).length, 4 + 8 + 12 + 16);
});

test("드럼과 맞추기: 킥 자리와 베이스 어택이 같음", () => {
  for (const id of ["GL-01", "GL-04", "GL-06", "GL-08", "GL-11", "GL-12"]) {
    const x = G.drillById(id);
    const kicks = G.drumEvents(x).filter(d => d.kind === "kick").map(d => d.beat);
    const bass = G.expectedOnsets(x, 60).filter(v => !v.optional).map(v => v.t);
    assert.deepEqual(bass, kicks, id);
  }
  const sh = G.drillById("GL-09");
  assert.ok(G.drumEvents(sh).some(d => Math.abs(d.beat - 2 / 3) < 1e-9));
});

test("클릭 방식: 매 박·2·4박만·1박만·2마디에 한 번·무음 마디, 최소 마디 수", () => {
  const x = G.drillById("RP-01");   // 1마디
  const p = m => G.runPlan(x, 8, m);
  assert.equal(p("beat").clicks.length, 32);
  assert.deepEqual(p("c24").clicks.slice(0, 4).map(c => c.beat), [1, 3, 5, 7]);
  assert.deepEqual(p("c1").clicks.slice(0, 2).map(c => c.beat), [0, 4]);
  assert.equal(p("cbar2").clicks.length, 4);
  const d = p("drop");
  assert.deepEqual(d.sections.map(s => [s.from, s.to, s.click]), [[0, 2, true], [2, 4, false], [4, 6, true], [6, 8, false]]);
  assert.ok(d.clicks.every(c => Math.floor(c.beat / 4) % 4 < 2));
  // 4마디만 고르더라도 4마디 무음 방식은 8마디로 늘림
  assert.equal(G.runPlan(x, 4, "drop4").bars, 8);
  // 그루브: 클릭 없음, 드럼이 무음 마디에서 빠짐, 2·4박만 같은 방식은 쓰지 않음
  const g = G.drillById("GL-01");
  const gp = G.runPlan(g, 8, "drop");
  assert.equal(gp.clicks.length, 0);
  assert.ok(gp.drums.every(e => Math.floor(e.beat / 4 + 1e-9) % 4 < 2));
  assert.equal(G.runPlan(g, 8, "c24").mode, "beat");
});

test("템포 분석: 무음 구간에서 빨라지면 실제 템포·흐름·재진입이 잡힘", () => {
  const x = G.drillById("B4-01");
  const pl = G.runPlan(x, 8, "drop");
  const bpm = 100, spb = 0.6;
  const exp = G.expectedOnsets(x, bpm, pl.loops);
  let drift = 0;
  const det = exp.map(e => {
    const bar = Math.floor(e.t / (4 * spb) + 1e-9);
    const silent = Math.floor(bar / 2) % 2 === 1;
    if (silent) { drift -= 0.004; return e.t + drift; }
    const v = drift ? e.t - 0.03 : e.t; drift = 0; return v;
  });
  const a = G.analyzeTime(T.judge(exp, det), pl.sections, bpm);
  assert.equal(a.sections.length, 4);
  assert.ok(a.sections[1].meanMs < -10 && a.sections[1].driftMsPerBar < -10, JSON.stringify(a.sections[1]));
  assert.ok(Math.abs(a.sections[0].meanMs) < 1);
  assert.equal(a.reentries.length, 1);
  assert.ok(Math.abs(a.reentries[0] + 30) < 1);
  const slow = exp.map(e => e.t * 1.02);
  const a2 = G.analyzeTime(T.judge(exp, slow), pl.sections, bpm);
  assert.ok(Math.abs(a2.playedBpm - 100 / 1.02) < 0.3, String(a2.playedBpm));
});
