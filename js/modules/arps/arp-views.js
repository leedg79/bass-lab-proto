// Arpeggios 연습 화면
// - 찾기·종류 바꾸기·전위·2옥타브: Scales 문제형 화면(prompt-drill)을 그대로 씀(지시 → 제한시간 → 정답 모양·소리)
// - 진행 위 코드톤 따라가기: 반주(베이스 파트 끔)에 맞춰 마디마다 코드 아르페지오 자리와 박마다 칠 코드톤 표시
// - 사전: 근음·종류를 고르면 4·3번 줄 근음 모양과 2옥타브 모양, 소리

import { ARPS, TRIADS, SEVENTHS, NINTHS, chordName, placeArp, arpShape, fretsOn, upDown } from "../../theory/arpeggio.js";
import { stringLabel } from "../../theory/notes.js";
import { KEY_LIST, keyName } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { PROGRESSIONS, buildBacking } from "../../audio/backing.js";
import { startBacking, stopBacking, setBackingBpm, isBackingRunning, setPartLevel } from "../../audio/backing-player.js";
import { loadInstrument, playNote, masterOut } from "../../audio/sampler.js";
import { unlockAudio, getAudioContext } from "../../audio/context.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, makeStore, pickKey, esc } from "../scales/common.js";
import { mountPromptDrill, regionTimeHtml, bindRegionTime, readRegionTime, clearStore } from "../scales/prompt-drill.js";
import * as D from "../scales/drill-core.js";
import * as A from "./arp-core.js";

const ALL_IDS = [...TRIADS, ...SEVENTHS, ...NINTHS];
const pickArps = (topics, fallback) => { const l = (topics || []).filter(t => ARPS[t]); return l.length ? l : fallback; };

function orderHtml(p) {
  return `<div class="field"><label>근음 순서</label>${segHtml(`${p}Order`, D.ROOT_ORDERS, getSetting(`${p}.order`, "random"))}</div>
    <div class="field" style="margin-top:14px"><label>첫 근음 (4도·반음 순환일 때)</label>${keyPickerHtml(`${p}Key`, `${p}.key`)}</div>`;
}
function readOrder(root, p) {
  const v = readSel(root, `${p}Order`, "v");
  const order = ["fourths", "chromatic"].includes(v) ? v : "random";
  const key = Number(readSel(root, `${p}Key`));
  setSetting(`${p}.order`, order); setSetting(`${p}.key`, key);
  return { order, key };
}
const stringHtml = p => `<div class="field" style="margin-top:14px"><label>시작 줄</label>${segHtml(`${p}Str`, A.ROOT_STRINGS, getSetting(`${p}.str`, "auto"))}</div>`;
const readString = (root, p) => { const v = readSel(root, `${p}Str`, "v") || "auto"; setSetting(`${p}.str`, v); return v; };

// ── 아르페지오 찾기 ──
function makeFind({ p, storeKey, fallback, note }) {
  return {
    clearFinder: () => clearStore(storeKey),
    settingsHtml() {
      return `${orderHtml(p)}${stringHtml(p)}${regionTimeHtml(p)}
        <p class="muted small" style="margin:4px 0 0">${note} 문제 중에는 지판에 음을 표시하지 않음. 시간이 끝나거나 정답 확인을 누르면 모양(파란 선 = 운지 순서)과 소리 공개. 근음 12개 = 완료 1회</p>`;
    },
    bindSettings(root) { bindPicker(root, `${p}Order`); bindPicker(root, `${p}Key`); bindPicker(root, `${p}Str`); bindRegionTime(root, p); },
    readSettings(root) { return { ...readRegionTime(root, p), ...readOrder(root, p), rootString: readString(root, p) }; },
    mount(container, api) {
      const s0 = api.getActive(), o = s0.options || {};
      const list = pickArps(s0.topics, fallback);
      return mountPromptDrill(container, api, {
        storeKey, timeKey: `${p}.time`, timeLimit: o.timeLimit,
        makeDeck: n => A.findDeck({ arpId: list[n % list.length], order: o.order || "random", startPc: pickKey(o.key ?? -1), regionId: o.region || "5-9", rootString: o.rootString || "auto" }),
        doneText: () => "근음 12개 완료", caption: "PLAY THIS ARPEGGIO"
      });
    }
  };
}
export const ArpFind = {
  a1: makeFind({ p: "af1", storeKey: "basslab:af1", fallback: ["maj"], note: "고른 코드 종류의 아르페지오를 근음부터 한 옥타브 올라갔다 내려오기." }),
  a2: makeFind({ p: "af2", storeKey: "basslab:af2", fallback: ["maj7"], note: "고른 7th 코드의 아르페지오를 근음부터 한 옥타브 올라갔다 내려오기." }),
  a3: makeFind({ p: "af3", storeKey: "basslab:af3", fallback: ["dom9"], note: "9th 아르페지오: 근음 → 3 → 5 → 7 → 옥타브 → 9음까지 올라갔다 내려오기." })
};

// ── 코드 종류 바꾸기 ──
function makeQuality({ p, storeKey, fallback }) {
  return {
    clearFinder: () => clearStore(storeKey),
    settingsHtml() {
      return `<div class="field"><label>근음</label>${keyPickerHtml(`${p}Key`, `${p}.key`)}</div>${stringHtml(p)}${regionTimeHtml(p)}
        <p class="muted small" style="margin:4px 0 0">근음 자리는 그대로 두고 고른 코드 종류를 차례로 바꿔 치기(예: C → Cm → Cdim). 확인 때 앞 종류에서 바뀐 음은 주황. 고른 종류 1순환 = 완료 1회, 근음이 무작위면 순환마다 새 근음</p>`;
    },
    bindSettings(root) { bindPicker(root, `${p}Key`); bindPicker(root, `${p}Str`); bindRegionTime(root, p); },
    readSettings(root) {
      const key = Number(readSel(root, `${p}Key`)); setSetting(`${p}.key`, key);
      return { ...readRegionTime(root, p), key, rootString: readString(root, p) };
    },
    mount(container, api) {
      const s0 = api.getActive(), o = s0.options || {};
      const list = pickArps(s0.topics, fallback);
      return mountPromptDrill(container, api, {
        storeKey, timeKey: `${p}.time`, timeLimit: o.timeLimit,
        makeDeck: () => A.qualityDeck({ rootPc: pickKey(o.key ?? -1), arpIds: list.length > 1 ? list : fallback, regionId: o.region || "5-9", rootString: o.rootString || "auto" }),
        doneText: d => `코드 종류 ${d.length}개 1순환 완료`, caption: "SWITCH CHORD QUALITY", changedText: "앞 종류에서 바뀐 음"
      });
    }
  };
}
export const ArpQuality = {
  a1: makeQuality({ p: "aq1", storeKey: "basslab:aq1", fallback: ["maj", "min", "dim", "aug", "sus4"] }),
  a2: makeQuality({ p: "aq2", storeKey: "basslab:aq2", fallback: ["maj7", "dom7", "m7", "m7b5", "dim7"] })
};

// ── 전위로 치기 ──
export const ArpInversion = {
  clearFinder: () => clearStore("basslab:ai1"),
  settingsHtml() {
    return `${orderHtml("ai")}${stringHtml("ai")}${regionTimeHtml("ai")}
      <p class="muted small" style="margin:4px 0 0">3음·5음·7음 중 하나에서 시작해 같은 음 한 옥타브 위까지 코드톤만 올라갔다 내려오기. 고른 코드 종류를 번갈아 냄. 12문제 = 완료 1회</p>`;
  },
  bindSettings(root) { bindPicker(root, "aiOrder"); bindPicker(root, "aiKey"); bindPicker(root, "aiStr"); bindRegionTime(root, "ai"); },
  readSettings(root) { return { ...readRegionTime(root, "ai"), ...readOrder(root, "ai"), rootString: readString(root, "ai") }; },
  mount(container, api) {
    const s0 = api.getActive(), o = s0.options || {};
    const list = pickArps(s0.topics, ["maj", "min"]);
    return mountPromptDrill(container, api, {
      storeKey: "basslab:ai1", timeKey: "ai.time", timeLimit: o.timeLimit,
      makeDeck: () => A.inversionDeck({ arpIds: list, order: o.order || "random", startPc: pickKey(o.key ?? -1), regionId: o.region || "5-9", rootString: o.rootString || "auto" }),
      doneText: () => "전위 12문제 완료", caption: "START FROM"
    });
  }
};

// ── 2옥타브 ──
export const ArpTwoOctave = {
  clearFinder: () => clearStore("basslab:a2o1"),
  settingsHtml() {
    return `${orderHtml("ato")}${regionTimeHtml("ato")}
      <p class="muted small" style="margin:4px 0 0">4번 줄(E) 근음에서 두 옥타브 올라갔다 내려오기. 손 자리 옮기기(시프트)는 되도록 위쪽 줄에서 한 번. 구간은 시작 자리 기준. 근음 6개 = 완료 1회</p>`;
  },
  bindSettings(root) { bindPicker(root, "atoOrder"); bindPicker(root, "atoKey"); bindRegionTime(root, "ato"); },
  readSettings(root) { return { ...readRegionTime(root, "ato"), ...readOrder(root, "ato") }; },
  mount(container, api) {
    const s0 = api.getActive(), o = s0.options || {};
    const list = pickArps(s0.topics, ["maj"]);
    return mountPromptDrill(container, api, {
      storeKey: "basslab:a2o1", timeKey: "ato.time", timeLimit: o.timeLimit,
      makeDeck: () => A.twoOctaveDeck({ arpIds: list, order: o.order || "random", startPc: pickKey(o.key ?? -1), regionId: o.region || "2-6" }).slice(0, 6),
      doneText: () => "2옥타브 6개 완료", caption: "TWO OCTAVES"
    });
  }
};

// ── 진행 위 코드톤 따라가기 ──
const fstore = makeStore("basslab:afw1");
const FOLLOW_HINTS = [["shape", "모양 + 칠 음"], ["beat", "칠 음만"], ["hide", "이름만"]];
export const ArpFollow = {
  clearFinder: () => fstore.clear(),
  settingsHtml() {
    return `
      <div class="field"><label>키(단조 진행은 이 음이 단조 으뜸음)</label>${keyPickerHtml("afwKey", "afw.key")}</div>
      <div class="field" style="margin-top:14px"><label>연습 구간</label>${segHtml("afwRegion", D.REGIONS.filter(r => r[0] !== "random"), getSetting("afw.region", "2-6"))}</div>
      <div class="field" style="margin-top:14px"><label>박마다 칠 음</label>${segHtml("afwPat", A.PATTERNS.map(x => [x[0], x[1]]), getSetting("afw.pat", "r5"))}</div>
      <div class="field" style="margin-top:14px"><label>표시</label>${segHtml("afwHint", FOLLOW_HINTS, getSetting("afw.hint", "shape"))}</div>
      <p class="muted small" style="margin:4px 0 0">드럼·코드 반주(베이스 꺼짐)에 맞춰 마디마다 그 코드의 코드톤을 고른 패턴으로 치기. 코드가 바뀔 때 손 이동이 가장 적은 자리를 보여 줌. 노랑 = 지금 박에 칠 음. 진행 2바퀴 = 완료 1회</p>`;
  },
  bindSettings(root) { ["afwKey", "afwRegion", "afwPat", "afwHint"].forEach(id => bindPicker(root, id)); },
  readSettings(root) {
    const key = Number(readSel(root, "afwKey"));
    const region = readSel(root, "afwRegion", "v") || "2-6";
    const pat = readSel(root, "afwPat", "v") || "r5";
    const hint = readSel(root, "afwHint", "v") || "shape";
    setSetting("afw.key", key); setSetting("afw.region", region); setSetting("afw.pat", pat); setSetting("afw.hint", hint);
    return { key, region, pat, hint };
  },
  mount(container, api) {
    const s0 = api.getActive(), o = s0.options || {};
    const ids = (s0.topics || []).filter(t => PROGRESSIONS[t]);
    const list = ids.length ? ids : ["blues12"];
    let st = fstore.load(s0.id) || { n: 0, units: 0, bpm: 80, key: pickKey(o.key ?? -1), pat: o.pat || "r5", hint: o.hint || "shape" };
    const regionId = o.region || "2-6";
    const mkPlan = () => { const prog = list[st.n % list.length]; const song = buildBacking({ prog, key: st.key }, () => 0.5); return { prog, name: PROGRESSIONS[prog].name, bars: A.followPlan(song.bars, regionId) }; };
    let plan = mkPlan();
    let bar = 0, beat = -1, loops = 0, playing = false;
    container.innerHTML = `
      <div class="nf cs">
        <div class="nf-meta"><span id="afwTitle"></span><span id="afwProg"></span></div>
        <div class="jam-chart" id="afwChart"></div>
        <div class="sp-prompt"><b id="afwChord"></b><span id="afwSub"></span></div>
        <div class="fretboard sb-board" id="afwBoard"></div>
        <div class="muted small" id="afwNext"></div>
        <div class="seg wide-seg" id="afwPatLive" style="margin-top:8px">${A.PATTERNS.map(([v, n]) => `<button type="button" data-v="${v}" class="${v === st.pat ? "sel" : ""}">${esc(n)}</button>`).join("")}</div>
        <div class="seg wide-seg" id="afwHintLive" style="margin-top:6px">${FOLLOW_HINTS.map(([v, n]) => `<button type="button" data-v="${v}" class="${v === st.hint ? "sel" : ""}">${esc(n)}</button>`).join("")}</div>
        <div class="jam-state muted small" id="afwState">정지</div>
        <div class="nf-actions" style="margin-top:8px"><button class="btn primary wide" id="afwPlay" type="button" data-autostart>반주 시작</button></div>
        <div class="bf-controls"><div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button>
          <div class="bpm-val"><b id="afwBpm">${st.bpm}</b><span>BPM</span></div>
          <button type="button" data-bpm="5">+5</button>
        </div></div>
        <p class="muted small nf-foot">초록 = 근음, 흰색 = 코드톤, 노랑 = 지금 박에 칠 음, 흐린 원 = 같은 자리의 다른 코드톤. 7음이 없는 코드(트라이어드)에서 7음 자리는 옥타브 근음</p>
      </div>`;
    const $ = s => container.querySelector(s);
    const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
    const persist = () => fstore.save(s0.id, st);
    function board(b) {
      const sh = b.shape;
      if (st.hint === "hide") return scaleBoardSvg([], { from: Math.max(0, sh.lo - 1) <= 1 ? 0 : sh.lo - 1, to: Math.max(sh.lo + 4, sh.hi + 1) });
      const act = playing && beat >= 0 ? A.beatNote(sh, st.pat, beat) : null;
      const isAct = n => act && n.s === act.s && n.f === act.f;
      let marks;
      if (st.hint === "beat") marks = act ? [{ s: act.s, f: act.f, label: act.label, kind: "active" }] : sh.notes.filter(n => n.root).slice(0, 1).map(n => ({ s: n.s, f: n.f, label: n.label, kind: "root" }));
      else marks = [
        ...sh.ghost.map(n => ({ s: n.s, f: n.f, label: n.label, kind: n.root ? "ghostRoot" : "ghost" })),
        ...sh.notes.map(n => ({ s: n.s, f: n.f, label: n.label, kind: isAct(n) ? "active" : n.root ? "root" : "note" }))
      ];
      let from = Math.max(0, Math.min(sh.lo, ...sh.ghost.map(g => g.f)) - 1); if (from <= 1) from = 0;
      return scaleBoardSvg(marks, { from, to: Math.max(from + 5, Math.max(sh.hi, ...sh.ghost.map(g => g.f)) + 1) });
    }
    function draw() {
      const b = plan.bars[bar], nb = plan.bars[(bar + 1) % plan.bars.length];
      $("#afwTitle").textContent = `${plan.name} · ${keyName(st.key, "major")}`;
      $("#afwProg").textContent = `${loops}/2바퀴 · 완료 ${st.units}회`;
      $("#afwChart").innerHTML = plan.bars.map((x, i) => `<div class="jam-bar ${i === bar && playing ? "now" : ""}"><small>${i + 1}</small><b>${esc(x.name)}</b></div>`).join("");
      $("#afwChord").textContent = b.name;
      $("#afwSub").textContent = `${ARPS[b.arpId].name} · 근음 ${stringLabel(b.shape.notes[0].s)} ${b.shape.notes[0].f}프렛`;
      $("#afwBoard").innerHTML = board(b);
      $("#afwNext").textContent = `다음: ${nb.name} · 근음 ${stringLabel(nb.shape.notes[0].s)} ${nb.shape.notes[0].f}프렛`;
    }
    async function play() {
      if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
      $("#afwPlay").textContent = "음원 불러오는 중…";
      try {
        await startBacking({
          prog: plan.prog, key: st.key, bpm: st.bpm,
          onBar: (b, loop) => {
            bar = b;
            if (b === 0 && loop > 0) {
              loops++;
              if (loops >= 2) {
                loops = 0; st = { ...st, units: st.units + 1, n: st.n + 1 }; persist(); api.addUnit(1); api.toast(`2바퀴 완료 · 이번 세션 ${st.units}회`);
                if (list.length > 1) { stop(); plan = mkPlan(); draw(); return; }
              }
            }
            $("#afwState").textContent = `${b + 1}마디`;
          },
          onBeat: (bb, counting, left) => {
            if (counting) { $("#afwState").textContent = `준비 ${left}`; return; }
            beat = bb; draw();
          }
        });
        setPartLevel("comp", 0.5);
        setPartLevel("bass", 0);   // 베이스는 내가 침
        playing = true; $("#afwPlay").textContent = "멈춤"; draw();
      } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#afwPlay").textContent = "반주 시작"; }
    }
    function stop() { stopBacking(); playing = false; bar = 0; beat = -1; $("#afwPlay").textContent = "반주 시작"; $("#afwState").textContent = "정지"; draw(); }
    $("#afwPlay").onclick = () => (isBackingRunning() ? stop() : play());
    const seg = (id, k) => { $(id).onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; st = { ...st, [k]: b.dataset.v }; persist(); container.querySelectorAll(`${id} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(); }; };
    seg("#afwPatLive", "pat"); seg("#afwHintLive", "hint");
    container.querySelector(".bf-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-bpm]"); if (!b) return;
      st = { ...st, bpm: Math.max(40, Math.min(200, st.bpm + Number(b.dataset.bpm))) }; persist(); setBackingBpm(st.bpm); $("#afwBpm").textContent = st.bpm;
    });
    const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
    draw();
    return () => { clearInterval(watch); stopBacking(); };
  }
};

// ── 아르페지오 사전(기록 없음) ──
async function listen(notes) {
  await unlockAudio(); await loadInstrument("bass");
  const ctx = getAudioContext(), t0 = ctx.currentTime + 0.05;
  upDown(notes).forEach((n, i) => playNote("bass", n.midi, t0 + i * 0.3, 0.42, { gain: 0.8, out: masterOut(ctx) }));
}
export function renderArpDictionary(root, { level, toast }) {
  const ids = level === "a1" ? TRIADS : level === "a2" ? SEVENTHS : ALL_IDS;
  let pc = getSetting("adict.root", 0), id = ids.includes(getSetting("adict.type", "")) ? getSetting("adict.type", "") : ids[0];
  root.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">근음</h3>
      <div class="root-grid key7" id="adRoot">${KEY_LIST.map(k => `<button type="button" data-key="${k}" class="${k === pc ? "sel" : ""}">${esc(keyName(k, "major"))}</button>`).join("")}</div>
      <h3 class="panel-title" style="margin-top:14px">코드 종류</h3>
      <div class="seg wide-seg" id="adType">${ids.map(x => `<button type="button" data-v="${x}" class="${x === id ? "sel" : ""}">${esc(chordName(0, x).replace(/^C/, "") || "M")} · ${esc(ARPS[x].name)}</button>`).join("")}</div>
    </div>
    <div id="adShapes" style="display:grid;gap:14px"></div>`;
  const $ = s => root.querySelector(s);
  let shown = [];
  function draw() {
    const cands = [];
    for (const s of [4, 3]) for (const f of fretsOn(s, pc)) { const sh = arpShape(pc, id, s, f); if (sh) cands.push({ sh, label: `${stringLabel(s)} ${f}프렛 근음 · 1옥타브` }); }
    if (!ARPS[id].steps.some(x => x > 12)) {
      const two = placeArp(pc, id, 4, { lo: 0, hi: 8 }, { octaves: 2 });
      if (two) cands.push({ sh: two, label: `4번 줄(E) ${two.notes[0].f}프렛 근음 · 2옥타브` });
    }
    shown = cands.sort((a, b) => a.sh.octaves - b.sh.octaves || a.sh.lo - b.sh.lo);
    $("#adShapes").innerHTML = shown.map((c, i) => {
      const sh = c.sh;
      const marks = [...sh.ghost.map(n => ({ s: n.s, f: n.f, label: n.label, kind: n.root ? "ghostRoot" : "ghost" })), ...sh.notes.map(n => ({ s: n.s, f: n.f, label: n.label, kind: n.root ? "root" : "note" }))];
      let from = Math.max(0, Math.min(sh.lo, ...sh.ghost.map(g => g.f)) - 1); if (from <= 1) from = 0;
      const to = Math.max(from + 5, Math.max(sh.hi, ...sh.ghost.map(g => g.f)) + 1);
      return `<div class="panel"><div class="answer-title">${esc(chordName(pc, id))} · ${esc(c.label)}${sh.shifts ? ` · 자리 옮기기 ${sh.shifts}번` : ""}</div>
        <div class="fretboard">${scaleBoardSvg(marks, { from, to, path: sh.notes })}</div>
        <div class="answer-note">${esc(sh.notes.map(n => n.label).join(" → "))}</div>
        <button class="btn small" type="button" data-play="${i}" style="margin-top:8px">소리 듣기</button></div>`;
    }).join("") || `<div class="panel muted">이 근음·종류는 표시할 모양이 없음</div>`;
  }
  $("#adRoot").onclick = e => { const b = e.target.closest("[data-key]"); if (!b) return; pc = Number(b.dataset.key); setSetting("adict.root", pc); root.querySelectorAll("#adRoot button").forEach(x => x.classList.toggle("sel", x === b)); draw(); };
  $("#adType").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; id = b.dataset.v; setSetting("adict.type", id); root.querySelectorAll("#adType button").forEach(x => x.classList.toggle("sel", x === b)); draw(); };
  $("#adShapes").onclick = e => { const b = e.target.closest("[data-play]"); if (b) listen(shown[Number(b.dataset.play)].sh.notes).catch(err => toast("소리를 켤 수 없음: " + err.message)); };
  draw();
}
