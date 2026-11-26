// 아르페지오 엔진·출제 테스트
import test from "node:test";
import assert from "node:assert/strict";
import * as A from "../js/theory/arpeggio.js";
import * as C from "../js/modules/arps/arp-core.js";

const pos = sh => sh.notes.map(n => `${n.s}-${n.f}`);
const mod = n => ((n % 12) + 12) % 12;

test("알려진 모양: C 메이저(3번 줄 3프렛), C maj7(4번 줄 8프렛), C m7(3번 줄 3프렛)", () => {
  assert.deepEqual(pos(A.arpShape(0, "maj", 3, 3)), ["3-3", "2-2", "2-5", "1-5"]);
  assert.deepEqual(pos(A.arpShape(0, "maj7", 4, 8)), ["4-8", "3-7", "3-10", "2-9", "2-10"]);
  assert.deepEqual(pos(A.arpShape(0, "m7", 3, 3)), ["3-3", "3-6", "2-5", "1-3", "1-5"]);
  assert.deepEqual(A.arpShape(0, "m7", 3, 3).notes.map(n => n.label), ["R", "♭3", "5", "♭7", "R"]);
});

test("2옥타브 A m7: 한 자리에서 치고 1번 줄에서 한 번만 옮김", () => {
  const sh = A.arpShape(9, "m7", 4, 5, { octaves: 2 });
  assert.deepEqual(pos(sh), ["4-5", "4-8", "3-7", "2-5", "2-7", "1-5", "1-9", "1-12", "1-14"]);
  assert.equal(sh.shifts, 1);
});

test("9th: 9음은 옥타브 위에서만(R 3 5 7 R 9)", () => {
  const sh = A.arpShape(0, "dom9", 3, 3);
  assert.deepEqual(sh.notes.map(n => n.label), ["R", "3", "5", "♭7", "R", "9"]);
});

test("모든 종류·근음·시작 줄(4·3)·구간·전위: 모양이 나오고, 코드톤만, 오름차순, 1옥타브는 자리 옮기기 없이 6프렛 안", () => {
  for (const id of Object.keys(A.ARPS)) for (let pc = 0; pc < 12; pc++) for (const s of [4, 3]) for (const [lo, hi] of [[0, 4], [5, 9], [9, 13], [12, 16]]) {
    const invs = id.endsWith("9") ? 1 : Math.min(4, A.ARPS[id].steps.length);
    for (let inv = 0; inv < invs; inv++) {
      const sh = A.placeArp(pc, id, s, { lo, hi }, { inv });
      assert.ok(sh, `${id} ${pc} ${s} ${lo} ${inv}`);
      const pcs = new Set(A.tonePcs(pc, id));
      for (let i = 0; i < sh.notes.length; i++) {
        assert.ok(pcs.has(mod(sh.notes[i].midi)), `${id} 코드톤`);
        if (i) assert.ok(sh.notes[i].midi > sh.notes[i - 1].midi && sh.notes[i].s <= sh.notes[i - 1].s, `${id} ${pc} 오름차순`);
      }
      assert.equal(mod(sh.notes[0].midi), A.tonePcs(pc, id)[inv]);
      assert.ok(sh.notes.at(-1).midi - sh.notes[0].midi >= 12, "한 옥타브 이상");
      assert.equal(sh.shifts, 0, `${id} ${pc} s${s} ${lo} inv${inv} 자리 옮기기`);
      assert.ok(sh.hi - sh.lo <= 5, `${id} ${pc} 폭 ${sh.lo}-${sh.hi}`);
    }
  }
});

test("2옥타브: 9th를 뺀 모든 종류·근음에서 4번 줄 근음 모양, 20프렛 안, 자리 옮기기 3번 이하", () => {
  for (const id of [...A.TRIADS, ...A.SEVENTHS]) for (let pc = 0; pc < 12; pc++) {
    const sh = A.placeArp(pc, id, 4, { lo: 2, hi: 6 }, { octaves: 2 });
    assert.ok(sh, `${id} ${pc}`);
    assert.equal(sh.notes.at(-1).midi - sh.notes[0].midi, 24);
    assert.ok(sh.hi <= 20 && sh.shifts <= 3);
  }
});

test("출제: 찾기 12개(구간 안 근음), 종류 바꾸기(바뀐 음 주황), 전위, 2옥타브 6개", () => {
  for (const order of ["random", "fourths", "chromatic"]) {
    const d = C.findDeck({ arpId: "maj7", order, startPc: 0, regionId: "5-9" });
    assert.equal(d.length, 12);
    assert.equal(new Set(d.map(p => p.rootPc)).size, 12);
    for (const p of d) {
      assert.ok(p.shape[0].root);
      assert.ok(p.shape[0].f >= 3 && p.shape[0].f <= 11, `${p.main} ${p.shape[0].f}`);
      assert.equal(p.midis.length, p.shape.length * 2 - 1);
    }
  }
  const q = C.qualityDeck({ rootPc: 0, arpIds: ["maj", "min", "dim"], regionId: "2-6" });
  assert.deepEqual(q.map(p => p.main), ["C", "Cm", "Cdim"]);
  assert.equal(q[0].changed.length, 0);
  assert.ok(q[1].changed.length >= 1 && q[1].answer.includes("♭3"));
  assert.ok(q[2].answer.includes("♭5"));
  assert.equal(q[0].shape[0].f, q[2].shape[0].f);   // 근음 자리는 그대로
  const inv = C.inversionDeck({ arpIds: ["maj", "m7"], regionId: "5-9" });
  assert.equal(inv.length, 12);
  for (const p of inv) assert.ok(!p.shape[0].root, "전위는 근음이 아닌 음에서 시작");
  const two = C.twoOctaveDeck({ arpIds: ["maj"], regionId: "2-6" }).slice(0, 6);
  assert.equal(two.length, 6);
  for (const p of two) assert.equal(p.shape[0].s, 4);
});

test("진행 위 따라가기: 마디마다 코드에 맞는 모양, 앞 마디와 가까운 자리, 패턴의 박 음", async () => {
  const { buildBacking } = await import("../js/audio/backing.js");
  const song = buildBacking({ prog: "major251", key: 0 }, () => 0.5);
  const plan = C.followPlan(song.bars, "2-6");
  assert.deepEqual(plan.map(b => b.arpId), ["m7", "dom7", "maj7", "maj7"]);
  for (let i = 1; i < plan.length; i++) assert.ok(Math.abs(plan[i].shape.lo - plan[i - 1].shape.lo) <= 5);
  const sh = plan[0].shape;   // Dm7
  assert.equal(mod(C.beatNote(sh, "r353", 0).midi), 2);
  assert.equal(mod(C.beatNote(sh, "r353", 1).midi), 5);
  assert.equal(mod(C.beatNote(sh, "r357", 3).midi), 0);
  assert.equal(C.beatNote(sh, "free", 0), null);
  // 트라이어드의 7음 자리는 옥타브 근음
  const pop = C.followPlan(buildBacking({ prog: "pop", key: 0 }, () => 0.5).bars, "5-9");
  const n = C.beatNote(pop[0].shape, "r357", 3);
  assert.ok(n.root && n.midi > pop[0].shape.notes[0].midi);
});
