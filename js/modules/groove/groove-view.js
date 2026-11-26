// Rhythm(베이스) 연습 화면: 박자·템포 유지(R1), 리듬 패턴(R2), 드럼과 맞추기(R3)
// 두 방식
// - 판정: 클릭(또는 드럼) 4번 뒤 연주 → 마이크로 내가 친 소리의 시작점(어택)을 잡아 박과 비교 → 통과하면 BPM을 올리는 템포 사다리
// - 판정 없이: 클릭·드럼(시범 베이스 소리 선택)에 맞춰 정한 길이를 끝까지 같이 치기
// 판정 통과 또는 판정 없이 끝까지 1번 = 통과 1회, 3회 = 완료 1회

import * as G from "./groove-core.js";
import * as T from "../technique/tech-core.js";
import { scoreSvg } from "../../render/score.js";
import { playGroove, stopGroove } from "../../audio/groove-player.js";
import { unlockAudio, getAudioContext } from "../../audio/context.js";
import { drum } from "../../audio/drums.js";
import { masterOut } from "../../audio/sampler.js";
import { openMic, listen, closeMic, micSupported, isMicOpen, listInputs, micInfo, setMonitor } from "../../audio/mic.js";
import { floorFromNoise } from "../../audio/onset-core.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";

const PASSES_PER_UNIT = 3;
const STEPS = [["2", "+2"], ["4", "+4"], ["6", "+6"], ["8", "+8"]];
const MODES = [["judge", "판정(마이크)"], ["free", "판정 없이 같이 치기"]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtMs = v => (v == null ? "-" : `${Math.round(v)}ms`);
const sgn = v => (v == null ? "-" : `${v > 0 ? "+" : ""}${Math.round(v)}ms`);

export function makeGrooveTask(kind) {
  const store = makeStore(`basslab:groove-${kind}`);
  const P = `gv${kind}`;
  const RUNS = kind === "time" ? [["8", "8마디"], ["16", "16마디"]] : [["4", "4마디"], ["8", "8마디"]];
  const defRun = kind === "time" ? 8 : 4;

  function settingsHtml() {
    return `
      <div class="field"><label>연습 방식</label>${segHtml(`${P}Mode`, MODES, getSetting("groove.mode", "judge"))}
        <p class="muted small" style="margin:6px 0 0">판정은 마이크(또는 NUX·iRig 같은 입력 장치)로 친 소리의 시작점을 잡아 박과 비교함. 판정 없이는 클릭·드럼에 맞춰 끝까지 같이 치기만 함. 세션 중에도 바꿀 수 있음</p></div>
      ${kind === "time" ? `<div class="field" style="margin-top:14px"><label>내가 칠 음표</label>${segHtml(`${P}Note`, [["q", "4분음표"], ["e", "8분음표"]], getSetting("groove.note", "q"))}
        <p class="muted small" style="margin:6px 0 0">개방 A(3번 줄)를 계속 침. "박 쪼개기 바꾸기"는 마디마다 4분 → 8분 → 셋잇단 → 16분으로 바뀜</p></div>` : ""}
      <div class="field" style="margin-top:14px"><label>시작 BPM</label>${segHtml(`${P}Start`, [["rec", "권장 시작 BPM"], ["best", "내 최고 기록부터"]], getSetting("groove.start", "rec"))}</div>
      <div class="field" style="margin-top:14px"><label>통과할 때마다 올릴 BPM</label>${segHtml(`${P}Step`, STEPS, String(getSetting("groove.step", 4)))}</div>
      <div class="field" style="margin-top:14px"><label>한 번 칠 길이</label>${segHtml(`${P}Run`, RUNS, String(getSetting(`groove.run.${kind}`, defRun)))}</div>
      ${kind === "time" ? "" : `<div class="field" style="margin-top:14px"><label>순서</label>${segHtml(`${P}Order`, [["seq", "순서대로"], ["rand", "무작위"]], getSetting("groove.order", "seq"))}</div>`}
      <p class="muted small" style="margin:4px 0 0">판정 통과 또는 판정 없이 끝까지 1번 = 통과 1회, ${PASSES_PER_UNIT}회 = 완료 1회. 판정은 이어폰을 끼면 클릭이 마이크에 섞이지 않아 정확함. 처음 한 번 "박자 보정"으로 기기 지연을 빼 둠</p>`;
  }
  const ids = [`${P}Mode`, `${P}Note`, `${P}Start`, `${P}Step`, `${P}Run`, `${P}Order`];
  function bindSettings(root) { ids.forEach(id => bindPicker(root, id)); }
  function readSettings(root) {
    const o = {
      mode: readSel(root, `${P}Mode`, "v") || "judge",
      note: readSel(root, `${P}Note`, "v") || "q",
      start: readSel(root, `${P}Start`, "v") || "rec",
      step: Number(readSel(root, `${P}Step`, "v") || 4),
      run: Number(readSel(root, `${P}Run`, "v") || defRun),
      order: readSel(root, `${P}Order`, "v") || "seq"
    };
    setSetting("groove.mode", o.mode); setSetting("groove.note", o.note); setSetting("groove.start", o.start);
    setSetting("groove.step", o.step); setSetting(`groove.run.${kind}`, o.run); setSetting("groove.order", o.order);
    return o;
  }

  function mount(container, api) {
    const s0 = api.getActive();
    const o = s0.options || {};
    const runBars = o.run || defRun;
    // 연습할 목록: R1은 고른 모드, R2·R3는 고른 주제의 패턴
    let list;
    if (kind === "time") {
      const modes = (s0.topics || []).filter(t => G.TIME_MODES[t]);
      list = (modes.length ? modes : Object.keys(G.TIME_MODES)).map(m => G.timeDrill(m, { note: o.note || "q", bars: runBars }));
    } else {
      list = G.drillsFor(kind === "lock" ? "lock" : "pattern", s0.topics);
      if (o.order === "rand") for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    }
    const order = list.map(x => x.id);
    const byId = id => list.find(x => x.id === id) || list[0];
    const bestAll = () => getSetting("groove.best", {}) || {};
    const startBpm = x => (o.start === "best" && bestAll()[x.id] ? bestAll()[x.id] : x.bpm.start);
    let st = store.load(s0.id) || { order, n: 0, passes: 0, units: 0, lad: {}, last: null, mode: o.mode || "judge", demo: true };
    if (!st.order || st.order.some(id => !list.some(x => x.id === id))) st = { ...st, order, n: 0 };
    const persist = () => store.save(s0.id, st);
    let x, busy = false, stopFns = [];

    container.innerHTML = `
      <div class="nf tq">
        <div class="nf-meta"><span id="gvNo"></span><span id="gvProg"></span></div>
        <div class="rh-head"><b id="gvName"></b><small id="gvTopic" class="muted"></small></div>
        <div class="score-wrap" id="gvScore"></div>
        <div id="gvMap"></div>
        <p class="small rh-tip" id="gvTip"></p>
        <div class="tq-bpm"><div><b id="gvBpm">-</b><span>BPM</span></div><small id="gvBest" class="muted"></small></div>
        <div class="seg wide-seg" id="gvModeLive">${MODES.map(([v, n]) => `<button type="button" data-v="${v}" class="${v === st.mode ? "sel" : ""}">${n}</button>`).join("")}</div>
        <label class="tq-mon" id="gvDemoWrap"><input type="checkbox" id="gvDemo" ${st.demo ? "checked" : ""}> 시범 베이스 소리 같이 듣기</label>
        <div id="gvMicBox">
          <div class="tq-mic"><span id="gvMicState" class="muted small">마이크 꺼짐</span><span class="tq-meter"><i id="gvMeter"></i></span><button class="btn small" id="gvCal" type="button">박자 보정</button></div>
          <details class="tq-help" id="gvMicMore"><summary class="small">입력 장치 · 감도 · 입력 확인</summary>
          <div class="tq-io">
            <div class="field"><label for="gvInput">입력 장치</label><select id="gvInput"><option value="">아이폰이 정한 기본 입력</option></select></div>
            <p class="muted small" id="gvInputInfo" style="margin:4px 0 0">판정을 시작하거나 "입력 확인"을 누르면 장치 목록을 불러옴</p>
            <label class="tq-mon"><input type="checkbox" id="gvMon"> 베이스 소리를 이어폰으로 같이 듣기(입력 모니터링)</label>
            <details class="tq-help"><summary class="small">오디오 인터페이스·이어폰 연결 안내</summary>
              <p class="small">NUX Mighty Plug·iRig처럼 베이스를 직접 꽂는 장비를 쓰면 주변 소리가 섞이지 않아 판정이 정확함. "입력 확인"을 켜고 손뼉을 쳐서 점이 찍히지 않고 줄에만 반응하면 장비 입력이 맞음</p>
              <p class="small">이어폰은 장비의 헤드폰 단자에 꽂는 것을 권장함. 블루투스 이어폰은 소리가 늦게 들리고 마이크를 쓰는 동안 음질이 바뀔 수 있어 권장하지 않음</p>
              <p class="small">아이폰 마이크로 판정할 때는 앰프나 헤드폰 앰프 소리를 조금 키우고 폰을 앰프 가까이 둠. 베이스는 저음이라 "민감"이 맞는 경우가 많음</p>
            </details>
          </div>
          <div class="field" style="margin-top:6px"><label>마이크 감도 (바로 바뀜)</label>${segHtml("gvSens", Object.entries(T.SENS).map(([k, v]) => [k, v.label]), getSetting("tech.sens", "mid"))}</div>
          <div class="tq-check">
            <button class="btn small" id="gvCheck" type="button">입력 확인</button>
            <div class="tq-strip" id="gvStrip"><span class="muted small">치는 대로 잡힌 어택이 점으로 찍힘</span></div>
            <b id="gvCount" class="small">0</b>
          </div>
          </details>
        </div>
        <div class="beats bf-beats" id="gvBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
        <div class="jam-state muted small" id="gvState"></div>
        <div class="nf-actions" style="margin-top:8px">
          <button class="btn primary wide" id="gvGo" type="button"></button>
          <button class="btn wide" id="gvListen" type="button" style="margin-top:8px">시범 듣기</button>
          <button class="btn wide hidden" id="gvStop" type="button" style="margin-top:8px">멈춤</button>
        </div>
        <div id="gvResult" class="tq-result hidden"></div>
        <div class="btn-row" style="gap:8px;margin-top:8px">
          <button class="btn small" id="gvPrev" type="button">← 이전</button>
          <button class="btn small" id="gvNext" type="button">다음 →</button>
        </div>
        <div class="bf-controls"><div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
          <div class="bpm-val"><b id="gvBpm2">-</b><span>BPM</span></div>
          <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
        </div></div>
      </div>`;
    const $ = s => container.querySelector(s);
    const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
    const lad = () => st.lad[x.id] || { bpm: startBpm(x), fails: 0, best: bestAll()[x.id] || 0 };
    const loops = () => (kind === "time" ? 1 : Math.max(1, Math.round(runBars / x.bars)));

    function load() { x = byId(st.order[st.n % st.order.length]); }

    // R1: 마디 × 박 칸에 클릭 자리 표시
    function drawMap() {
      const el = $("#gvMap");
      if (kind !== "time") {
        if (kind === "lock" && x.drums) {
          const names = { k: "킥", s: "스네어", h: "하이햇", o: "오픈 햇", r: "라이드" };
          el.innerHTML = `<div class="gv-drums">${Object.entries(x.drums).map(([k, v]) => `<div class="gv-drow"><small>${names[k]}</small><span>${[...v].map((c, i) => `<i class="${c === "." ? "" : c === "X" ? "on acc" : "on"} ${i % (x.feel === "shuffle" ? 2 : 4) === 0 ? "beat" : ""}"></i>`).join("")}</span></div>`).join("")}</div>`;
        } else el.innerHTML = "";
        return;
      }
      const set = new Set(x.clicks.map(c => c.beat));
      el.innerHTML = `<div class="gv-map">${Array.from({ length: x.bars }, (_, b) => {
        const sec = x.sections.find(s => b >= s.from && b < s.to);
        return `<div class="gv-bar ${sec && !sec.click ? "silent" : ""}"><small>${b + 1}</small>${[0, 1, 2, 3].map(k => `<i class="${set.has(b * 4 + k) ? "on" : ""}"></i>`).join("")}</div>`;
      }).join("")}</div><p class="muted small" style="margin:4px 0 0">채운 칸 = 클릭이 나오는 박, 어두운 마디 = 클릭 없음. 나는 모든 박에서 ${x.mode === "subdiv" ? "마디마다 바뀌는 음표" : o.note === "e" ? "8분음표" : "4분음표"}를 침</p>`;
    }
    function drawScore(grades) {
      const el = $("#gvScore");
      if (kind === "time") { el.innerHTML = ""; el.style.display = "none"; return; }
      if (!scoreSvg(el, x.events, { ticks: x.ticks })) { el.textContent = "악보를 그릴 수 없음"; return; }
      if (x.feel === "shuffle") el.insertAdjacentHTML("afterbegin", `<div class="muted small">Shuffle (♪♪ = ♩♪ 셋잇단)</div>`);
      if (grades) for (const [idx, g] of Object.entries(grades)) el.querySelectorAll(`[data-ev="${idx}"]`).forEach(n => n.classList.add(`j-${g}`));
    }
    function drawHead() {
      const L = lad();
      $("#gvNo").textContent = `${(st.n % st.order.length) + 1}/${st.order.length} · ${x.id}`;
      $("#gvProg").textContent = `통과 ${st.passes % PASSES_PER_UNIT}/${PASSES_PER_UNIT} · 완료 ${st.units}회`;
      $("#gvName").textContent = x.name;
      const topicName = kind === "time" ? "박자·템포 유지" : kind === "lock" ? G.GROOVE_TOPICS[x.topic] : G.PATTERN_TOPICS[x.topic];
      $("#gvTopic").textContent = `${topicName || ""} · ${kind === "time" ? `${x.bars}마디` : `${x.bars}마디 × ${loops()}번`} · 권장 ${x.bpm.start}→${x.bpm.target} BPM`;
      $("#gvTip").textContent = x.tip;
      $("#gvBpm").textContent = L.bpm; $("#gvBpm2").textContent = L.bpm;
      const best = Math.max(L.best || 0, bestAll()[x.id] || 0);
      $("#gvBest").textContent = best ? `최고 통과 ${best} BPM${best >= x.bpm.target ? " · 목표 달성" : ` · 목표 ${x.bpm.target}`}` : `목표 ${x.bpm.target} BPM`;
      const judge = st.mode === "judge";
      $("#gvMicBox").classList.toggle("hidden", !judge);
      $("#gvDemoWrap").classList.toggle("hidden", judge);
      $("#gvGo").textContent = judge ? "판정 시작 (준비 4박 뒤 연주)" : "같이 치기 시작 (준비 4박)";
    }
    function drawResult() {
      const r = st.last && st.last.id === x.id ? st.last : null;
      const el = $("#gvResult");
      if (!r) { el.classList.add("hidden"); return; }
      el.classList.remove("hidden");
      if (r.free) {
        el.innerHTML = `<div class="tq-verdict ok">끝까지 같이 침 <small>${r.bpm} BPM</small></div><p class="muted small" style="margin:6px 0 0">판정 없이 연습 · 통과 1회로 셈. ${esc(r.next)}</p>`;
        return;
      }
      const tend = r.signedMs == null ? "" : Math.abs(r.signedMs) < 8 ? "박 위에서 고르게 침" : r.signedMs < 0 ? `평균 ${Math.round(-r.signedMs)}ms 빠름(앞으로 쏠림)` : `평균 ${Math.round(r.signedMs)}ms 늦음(뒤로 처짐)`;
      let time = "";
      if (r.time) {
        const tb = r.time.playedBpm;
        const secs = r.time.sections.map(s => `<li>${s.from + 1}~${s.to}마디 · ${s.click ? (x.mode === "drop" || x.mode === "drop4" ? "클릭 있음" : esc(x.name)) : "클릭 없음"}: 평균 ${sgn(s.meanMs)}${s.driftMsPerBar != null && Math.abs(s.driftMsPerBar) >= 3 ? ` · 마디마다 ${Math.abs(Math.round(s.driftMsPerBar))}ms씩 ${s.driftMsPerBar < 0 ? "빨라짐" : "느려짐"}` : ""} (${s.hits}/${s.n})</li>`).join("");
        const re = r.time.reentries.length ? `<p class="small" style="margin:6px 0 0">클릭이 돌아올 때 첫 박: ${r.time.reentries.map(v => (v == null ? "못 잡음" : sgn(v))).join(" · ")}</p>` : "";
        time = `<div class="gv-time">
          <p class="small" style="margin:8px 0 0"><b>실제 연주 템포 ${tb ? tb.toFixed(1) : "-"} BPM</b> (설정 ${r.bpm})${tb ? ` · ${Math.abs(tb - r.bpm) < 0.5 ? "템포 유지" : tb > r.bpm ? `${(tb - r.bpm).toFixed(1)} BPM 빨라짐` : `${(r.bpm - tb).toFixed(1)} BPM 느려짐`}` : ""}</p>
          <ul class="small gv-secs">${secs}</ul>${re}</div>`;
      }
      el.innerHTML = `
        <div class="tq-verdict ${r.pass ? "ok" : "ng"}">${r.pass ? "통과" : "다시"} <small>${r.bpm} BPM</small></div>
        <div class="tq-stats">
          <div><b>${Math.round(r.hitRate * 100)}%</b><small>박에 맞춘 어택 (${r.hits}/${r.required})</small></div>
          <div><b>${fmtMs(r.meanMs)}</b><small>평균 오차</small></div>
          <div><b>${Math.round(r.within * 100)}%</b><small>±50ms 안</small></div>
          <div><b>${r.extras}</b><small>불필요한 어택(허용 ${r.allowedExtras})</small></div>
        </div>
        <p class="small" style="margin:8px 0 0">${esc(tend)}${r.misses ? ` · 빠진 음 ${r.misses}개` : ""}${kind === "time" ? "" : `. 악보 색: <span class="j-dot good"></span>±25ms <span class="j-dot ok"></span>±50ms <span class="j-dot off"></span>그 이상 <span class="j-dot miss"></span>못 잡음`}</p>
        ${time}
        <p class="muted small" style="margin:4px 0 0">${esc(r.next)}</p>`;
    }
    function drawAll() { drawHead(); drawMap(); drawScore(st.last && st.last.id === x.id && !st.last.free ? st.last.grades : null); drawResult(); }
    const setState = t => { $("#gvState").textContent = t; };
    const setMic = t => { $("#gvMicState").textContent = t; };
    const beatsEl = () => [...container.querySelectorAll("#gvBeats .beat")];
    const showBeat = b => beatsEl().forEach((el, i) => el.classList.toggle("on", b >= -4 && ((b % 4) + 4) % 4 === i));

    // ── 마이크 ──
    let meterTimer = null;
    const micOpts = () => { const sv = T.sensOf(getSetting("tech.sens", "mid")); return { floor: getSetting("tech.floor", 2e-6) * sv.floorMul, ratio: sv.ratio, deviceId: getSetting("audio.input", "") }; };
    const KIND_TEXT = { builtin: "아이폰 마이크로 보임", headset: "이어폰·헤드셋 마이크로 보임", interface: "외부 입력(오디오 인터페이스 등)으로 보임" };
    async function refreshInputs() {
      const sel = $("#gvInput"); if (!sel) return;
      const devs = await listInputs().catch(() => []);
      const want = getSetting("audio.input", "");
      sel.innerHTML = `<option value="">아이폰이 정한 기본 입력</option>` + devs.map(d => `<option value="${esc(d.deviceId)}" ${d.deviceId === want ? "selected" : ""}>${esc(d.label)}</option>`).join("");
      const info = micInfo();
      $("#gvInputInfo").textContent = info ? `지금 듣는 입력: ${info.label || "이름 없음"} · ${KIND_TEXT[info.kind]}${devs.length > 1 ? ` · 입력 ${devs.length}개 있음` : ""}` : "판정을 시작하거나 \"입력 확인\"을 누르면 장치 목록을 불러옴";
      $("#gvMon").checked = !!(info && info.monitor);
    }
    async function ensureMic() {
      if (window.__basslabGrooveInject) return true;
      if (!micSupported()) { setMic("이 브라우저는 마이크를 쓸 수 없음 — \"판정 없이 같이 치기\"로 연습"); return false; }
      try {
        const m = await openMic(micOpts());
        await refreshInputs();
        if (getSetting("audio.monitor", false)) setMonitor(true);
        setMic(getSetting("tech.latency", null) == null ? "마이크 켜짐 · 박자 보정 전(기본 지연 60ms)" : `마이크 켜짐 · 보정 지연 ${Math.round(getSetting("tech.latency", 0.06) * 1000)}ms`);
        if (!meterTimer) meterTimer = setInterval(() => { const lv = Math.min(1, Math.sqrt(m.level || 0) * 25); const b = $("#gvMeter"); if (b) b.style.width = `${Math.round(lv * 100)}%`; }, 80);
        return true;
      } catch (e) {
        setMic(e && e.name === "NotAllowedError" ? "마이크 권한이 없음 — 설정에서 허용하거나 \"판정 없이 같이 치기\"로 연습" : `마이크를 열 수 없음: ${e.message}`);
        return false;
      }
    }
    async function calibrate() {
      if (busy || !running()) { if (!running()) api.toast("연습을 시작(재개)한 뒤 보정할 수 있음"); return; }
      if (!(await ensureMic())) return;
      stopCheck();
      busy = true; stopGroove();
      try {
        await unlockAudio();
        const ctx = getAudioContext();
        const energies = [], onsets = [];
        const off = listen({ onEnergy: (t, e) => energies.push([t, e]), onOnset: t => onsets.push(t) });
        setState("보정 1/3 · 조용히 1초…"); await sleep(1100);
        setSetting("tech.floor", floorFromNoise(energies.map(v => v[1])));
        await openMic(micOpts());
        setState("보정 2/3 · 클릭 4번 — 치지 말고 들어만 봄");
        onsets.length = 0;
        const t0 = ctx.currentTime + 0.3, spb = 0.75;
        const quiet = Array.from({ length: 4 }, (_, k) => t0 + k * spb);
        quiet.forEach(t => drum("click", t, 1, masterOut(ctx)));
        await sleep((0.3 + 4 * spb) * 1000 + 200);
        const bleed = T.latencyFrom(quiet, onsets.slice(), 0.15);
        setState("보정 3/3 · 클릭 8번에 맞춰 뮤트한 줄을 짧게 튕김(첫 클릭부터)");
        onsets.length = 0;
        const t1 = ctx.currentTime + 1.2;
        const clicks = Array.from({ length: 8 }, (_, k) => t1 + k * spb);
        clicks.forEach((t, k) => drum("click", t, k % 4 === 0 ? 1 : 0.7, masterOut(ctx)));
        await sleep((1.2 + 8 * spb) * 1000 + 400);
        off();
        const r = T.latencyFrom(clicks, onsets.slice());
        if (!r) { setState(`어택을 충분히 못 잡음(${onsets.length}개). 조금 더 세게, 클릭에 맞춰 다시 보정`); return; }
        setSetting("tech.latency", Math.max(0, r.latency));
        setMic(`마이크 켜짐 · 보정 지연 ${Math.round(r.latency * 1000)}ms`);
        setState(`보정 완료 · 지연 ${Math.round(r.latency * 1000)}ms (${r.matched}/8 잡음)${bleed ? " · 스피커 클릭이 마이크에 들어감: 이어폰을 끼는 것이 정확함" : ""}`);
      } finally { busy = false; }
    }
    let checkOff = null, checkTimer = null;
    function stopCheck() { if (checkOff) checkOff(); checkOff = null; if (checkTimer) clearInterval(checkTimer); checkTimer = null; $("#gvCheck").textContent = "입력 확인"; }
    async function inputCheck() {
      if (checkOff) { stopCheck(); return; }
      if (busy) return;
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 확인할 수 있음"); return; }
      if (!(await ensureMic())) return;
      await unlockAudio();
      const ctx = getAudioContext();
      const hits = [], t0 = ctx.currentTime;
      checkOff = listen({ onOnset: t => hits.push(t) });
      $("#gvCheck").textContent = "멈춤";
      const strip = $("#gvStrip");
      checkTimer = setInterval(() => {
        const now = ctx.currentTime;
        strip.innerHTML = hits.filter(t => now - t < 4).map(t => `<i style="left:${Math.max(0, 100 - ((now - t) / 4) * 100)}%"></i>`).join("");
        $("#gvCount").textContent = hits.length;
        if (now - t0 > 8) { stopCheck(); strip.innerHTML = `<span class="small">${hits.length ? `8초 동안 어택 ${hits.length}개를 잡음. 친 횟수와 비슷하면 이 위치·감도로 판정 가능` : "어택을 하나도 못 잡음. 폰을 앰프 가까이 두거나 감도를 \"민감\"으로"}</span>`; }
      }, 60);
    }

    // ── 재생·판정 ──
    const plan = bpm => ({ line: G.loopEvents(x, loops()), clicks: G.clickBeats(x, loops()), drums: G.drumEvents(x, loops()) });
    function finishRun(entry) {
      const L = lad();
      const pass = entry.free ? true : entry.pass;
      const L2 = entry.free ? L : T.ladder(L, pass, o.step || 4);
      if (!entry.free && pass) { const b = bestAll(); if (!b[x.id] || b[x.id] < entry.bpm) { b[x.id] = entry.bpm; setSetting("groove.best", b); } }
      const next = entry.free ? "BPM을 직접 올리거나 판정으로 바꿔 확인" : pass ? `다음 판정은 ${L2.bpm} BPM` : L2.bpm < entry.bpm ? `2번 연속 실패 → ${L2.bpm} BPM으로 내림` : `같은 ${entry.bpm} BPM으로 한 번 더`;
      st = { ...st, lad: { ...st.lad, [x.id]: L2 }, passes: st.passes + (pass ? 1 : 0), last: { ...entry, id: x.id, next } };
      if (pass && st.passes % PASSES_PER_UNIT === 0) { st.units += 1; api.addUnit(1); api.toast(`통과 ${PASSES_PER_UNIT}회 · 완료 ${st.units}회`); }
      persist();
      drawAll();
    }
    let runToken = 0;
    function uiPlaying(on) { $("#gvGo").disabled = on; $("#gvListen").disabled = on; $("#gvStop").classList.toggle("hidden", !on); }
    async function go() {
      if (busy) return;
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 칠 수 있음"); return; }
      const judge = st.mode === "judge";
      if (judge && !(await ensureMic())) return;
      stopCheck();
      busy = true; uiPlaying(true);
      const my = ++runToken;
      try {
        await unlockAudio();
        const ctx = getAudioContext();
        const L = lad(), bpm = L.bpm, spb = 60 / bpm;
        const { line, clicks, drums } = plan(bpm);
        const startAt = ctx.currentTime + 0.25 + 4 * spb;
        const onsets = [];
        const off = judge && !window.__basslabGrooveInject ? listen({ onOnset: t => onsets.push(t) }) : () => {};
        const bars = line.ticks / 48;
        const r = await playGroove(line, bpm, { clicks, drums, countIn: 4, startAt, silent: judge || !st.demo, onBeat: b => {
          showBeat(b);
          setState(b < 0 ? `준비 ${-b}` : `${judge ? "판정 중" : "같이 치기"} · ${Math.floor(b / 4) + 1}/${bars}마디`);
        } });
        await sleep(r.duration * 1000 + 350);
        off(); showBeat(-99);
        if (my !== runToken) return;   // 멈춤
        if (!api.getActive() || !running()) { setState("일시정지되어 기록하지 않음"); return; }
        if (!judge) { finishRun({ free: true, bpm }); setState("끝까지 같이 침"); return; }
        const expected = G.expectedOnsets(x, bpm, loops());
        const latency = getSetting("tech.latency", 0.06);
        const detected = window.__basslabGrooveInject ? window.__basslabGrooveInject(expected, { bpm, latency }) : onsets.map(t => t - latency - startAt);
        const res = T.judge(expected, detected);
        const entry = { bpm, pass: res.pass, hitRate: res.hitRate, hits: res.hits, required: res.required, misses: res.misses, extras: res.extras, allowedExtras: res.allowedExtras, meanMs: res.meanMs, signedMs: res.signedMs, within: res.within, grades: T.gradeByIndex(res) };
        if (kind === "time") entry.time = G.analyzeTime(res, x, bpm);
        finishRun(entry);
        setState(res.pass ? "통과" : "다시");
        const rel = $("#gvResult"); if (rel && rel.scrollIntoView) rel.scrollIntoView({ behavior: "smooth", block: "center" });
      } finally { busy = false; uiPlaying(false); }
    }
    async function listenDemo() {
      if (busy) return;
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 들을 수 있음"); return; }
      const bpm = lad().bpm;
      const { clicks, drums } = plan(bpm);
      const one = { ...G.loopEvents(x, 1) };
      const perLoop = x.ticks / 12;
      busy = true; uiPlaying(true);
      const my = ++runToken;
      try {
        const r = await playGroove(one, bpm, { clicks: clicks.filter(c => c.beat < perLoop), drums: drums.filter(d => d.beat < perLoop), countIn: 4, onBeat: b => { showBeat(b); setState(b < 0 ? `준비 ${-b}` : "시범 재생 중"); } });
        await sleep(r.duration * 1000 + 200);
        if (my === runToken) setState("");
      } finally { busy = false; uiPlaying(false); showBeat(-99); }
    }
    function stopNow() { runToken++; stopGroove(); busy = false; uiPlaying(false); showBeat(-99); setState("멈춤"); }

    $("#gvGo").onclick = go;
    $("#gvListen").onclick = listenDemo;
    $("#gvStop").onclick = stopNow;
    $("#gvCal").onclick = calibrate;
    $("#gvCheck").onclick = inputCheck;
    $("#gvDemo").onchange = e => { st = { ...st, demo: e.target.checked }; persist(); };
    $("#gvModeLive").onclick = e => {
      const b = e.target.closest("[data-v]"); if (!b || busy) return;
      st = { ...st, mode: b.dataset.v }; persist(); setSetting("groove.mode", st.mode);
      container.querySelectorAll("#gvModeLive button").forEach(y => y.classList.toggle("sel", y === b));
      if (st.mode !== "judge") { stopCheck(); }
      drawHead();
    };
    $("#gvInput").onchange = async e => {
      if (busy) return;
      setSetting("audio.input", e.target.value);
      if (isMicOpen() || e.target.value) { closeMic(); await ensureMic(); if (getSetting("audio.monitor", false)) setMonitor(true); await refreshInputs(); }
      api.toast("입력 장치를 바꿨음. 박자 보정을 다시 하면 정확함");
    };
    $("#gvMon").onchange = async e => {
      const on = e.target.checked;
      setSetting("audio.monitor", on);
      if (on && !isMicOpen()) { if (!(await ensureMic())) { e.target.checked = false; return; } }
      setMonitor(on);
      const info = micInfo();
      if (on && info && info.kind === "builtin") api.toast("아이폰 마이크 입력이라 스피커로 들으면 소리가 울릴 수 있음 — 이어폰을 꼈을 때만 켬");
    };
    $("#gvSens").onclick = async e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      $("#gvSens").querySelectorAll("button").forEach(y => y.classList.toggle("sel", y === b));
      setSetting("tech.sens", b.dataset.v);
      if (isMicOpen()) await openMic(micOpts());
      api.toast(`마이크 감도: ${T.sensOf(b.dataset.v).label}`);
    };
    stopFns.push(stopCheck);
    function move(d) { if (busy) return; st = { ...st, n: (st.n + d + st.order.length) % st.order.length }; persist(); load(); drawAll(); setState(""); }
    $("#gvPrev").onclick = () => move(-1);
    $("#gvNext").onclick = () => move(1);
    container.querySelector(".bf-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-bpm]"); if (!b || busy) return;
      const L = lad();
      st = { ...st, lad: { ...st.lad, [x.id]: { ...L, bpm: Math.max(40, Math.min(200, L.bpm + Number(b.dataset.bpm))), fails: 0 } } };
      persist(); drawHead();
    });
    load(); drawAll(); persist();
    if (window.__basslabGrooveInject) setMic("시험용 입력");
    return () => { runToken++; stopGroove(); stopFns.forEach(f => f()); if (meterTimer) clearInterval(meterTimer); closeMic(); };
  }

  return { settingsHtml, bindSettings, readSettings, mount, clearFinder: () => store.clear() };
}
