// 단계별 코스: 모든 항목이 실제 과제·주제를 가리키는지
import test from "node:test";
import assert from "node:assert/strict";
import { STEPS, COURSES } from "../js/data/courses.js";
import { findModule, findTask, topicsFor } from "../js/data/catalog.js";
import { CLICK_MODES } from "../js/modules/groove/groove-data.js";

test("단계 5개, 단계마다 5개 이상, 항목은 과제·주제가 실제로 있음(준비 중 모듈 제외)", () => {
  assert.deepEqual(STEPS.map(s => s.name), ["입문", "초보", "초급", "중급", "고급"]);
  for (const s of STEPS) {
    const items = COURSES[s.id];
    assert.ok(items.length >= 5, s.name);
    for (const it of items) {
      const m = findModule(it.mod);
      assert.ok(m, `${s.name} ${it.mod}`);
      if (m.soon) continue;
      assert.ok(findTask(it.mod, it.lvl, it.task), `${s.name} ${it.mod}/${it.lvl}/${it.task}`);
      const ids = topicsFor(it.mod, it.lvl, it.task).map(t => t.id);
      for (const t of it.topics) assert.ok(ids.includes(t), `${s.name} ${it.title} 주제 ${t}`);
      for (const [k, v] of Object.entries(it.set)) if (k.startsWith("groove.click")) assert.ok(CLICK_MODES[v], v);
    }
  }
});
