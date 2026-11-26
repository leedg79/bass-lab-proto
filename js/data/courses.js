// 단계별 연습 코스: 입문 · 초보 · 초급 · 중급 · 고급
// 콘텐츠는 모듈에 한 번만 있고, 코스는 각 모듈에서 그 단계에 맞는 과제·주제·설정을 모아 보여 줌
// 항목: { mod, lvl, task, topics, set: { 설정 키: 값 }, title, note }
// - 누르면 주제·설정을 채운 채 그 과제 화면으로 감. 기록은 원래 모듈 과제로 쌓임
// - mod가 준비 중인 모듈이면 "준비 중"으로만 표시

export const STEPS = [
  { id: 1, name: "입문", goal: "지판 음 이름과 4분음표 박자. 클릭에 맞춰 한 음을 고르게" },
  { id: 2, name: "초보", goal: "8분음표와 셔플, 클릭 2·4박만으로 템포 유지, 록·팝 킥에 붙이기" },
  { id: 3, name: "초급", goal: "16분음표·싱코페이션, 클릭 1박만, 펑크·모타운·레게 그루브, 7th 코드톤" },
  { id: 4, name: "중급", goal: "고스트 노트·셋잇단, 2마디 무음 유지, R&B·보사노바, 진행 위 코드톤" },
  { id: 5, name: "고급", goal: "박 쪼개기 섞기·당겨 치기, 4마디 무음 유지, 펑크 고스트·툼바오, 2옥타브·모드" }
];

const T = (lvl, topics, click, title, note, extra = {}) => ({ mod: "rhythm", lvl, task: "time-set", topics, set: { "groove.click.time": click, ...extra }, title, note });
const G = (lvl, topics, click, title, note) => ({ mod: "groove", lvl, task: "groove-lock", topics, set: { "groove.click.lock": click }, title, note });

export const COURSES = {
  1: [
    { mod: "notes", lvl: "n1", task: "note-finder", topics: [], set: {}, title: "음 찾기 · 두 줄", note: "무작위 두 줄에서 음 위치 찾기" },
    T("b4", ["quarter"], "beat", "4분·2분·온음표", "클릭 매 박. 박 머리를 같은 간격으로"),
    T("b4", ["move"], "beat", "4분 음 옮기기", "근음 → 5음 · 옥타브 · 코드 바꾸기"),
    T("b4", ["rest"], "beat", "1·3박만 · 2·4박만", "쉬는 박에서 서두르지 않기"),
    { mod: "arps", lvl: "a1", task: "arp-find", topics: ["maj", "min"], set: {}, title: "메이저·마이너 트라이어드", note: "근음부터 한 옥타브" },
    { mod: "ear", lvl: "e1", task: "note-name", topics: [], set: {}, title: "음 이름 청음", note: "베이스 음역 한 음 듣고 이름" },
    { mod: "technique", title: "크로매틱 1234 · 1손가락 1프렛", note: "Technique 모듈에서" }
  ],
  2: [
    { mod: "notes", lvl: "n2", task: "note-finder", topics: [], set: {}, title: "음 찾기 · 4줄 전체", note: "0~15프렛" },
    T("b4", ["quarter", "move"], "c24", "4비트 · 클릭 2·4박만", "1·3박은 내가 만듦"),
    T("b8", ["pump8"], "beat", "8분 펌핑", "8개 음을 같은 크기·길이로"),
    T("b8", ["dotted", "rest"], "c24", "점4분 · 끊어 치기 · 클릭 2·4박만", ""),
    T("bsh", ["shuffle"], "beat", "셔플 8분", "따-ㄷ따, 뒤 음은 셋잇단 3번째"),
    G("g1", ["rock", "pop"], "beat", "록·팝 킥에 붙이기", "드럼 계속"),
    { mod: "arps", lvl: "a1", task: "arp-quality", topics: ["maj", "min", "dim", "aug", "sus4"], set: {}, title: "트라이어드 종류 바꾸기", note: "C → Cm → Cdim …" },
    { mod: "ear", lvl: "e2", task: "interval", topics: ["4-5", "octave-compound"], set: {}, title: "음정 청음 · 4·5도·옥타브", note: "베이스 라인에서 가장 많이 쓰는 음정" }
  ],
  3: [
    T("b8", ["sync"], "c1", "싱코페이션 · 클릭 1박만", "뒷박·찰스턴·앞당김"),
    T("b16", ["sixteenth"], "beat", "16분 연속·갤럽", "두 손가락 교대로 고르게"),
    T("b16", ["dotted16"], "c24", "점8분 + 16분 · 클릭 2·4박만", ""),
    T("bsh", ["shuffle", "triplet"], "c24", "셔플·셋잇단 · 클릭 2·4박만", ""),
    G("g1", ["disco"], "beat", "디스코 옥타브", ""),
    G("g2", ["motown", "hiphop"], "beat", "모타운·힙합", ""),
    G("g3", ["reggae"], "beat", "레게 원 드롭·스테퍼", "1박을 비우는 감각"),
    G("g4", ["shuffle"], "beat", "블루스 셔플", ""),
    { mod: "arps", lvl: "a2", task: "arp-find", topics: ["maj7", "dom7", "m7", "m7b5"], set: {}, title: "7th 코드톤", note: "maj7 · 7 · m7 · m7♭5" },
    { mod: "ear", lvl: "e3", task: "chord-ear", topics: ["triads"], set: {}, title: "코드 청음 · 트라이어드", note: "" }
  ],
  4: [
    T("b16", ["sync16", "ghost"], "cbar2", "16분 싱코페이션·고스트 · 2마디에 한 번", ""),
    T("b8", ["pump8", "sync"], "drop", "8비트 · 2마디 듣고 2마디 무음", "무음에서 빨라지는지 결과로 확인"),
    T("bsh", ["triplet"], "c1", "셋잇단 · 클릭 1박만", ""),
    T("bmix", ["subdiv", "anticip"], "beat", "박 쪼개기 바꾸기 · 당겨 치기", ""),
    G("g2", ["rnb", "funk"], "beat", "R&B 하프타임·펑크 16분 킥", ""),
    G("g3", ["bossa"], "beat", "보사노바", ""),
    G("g1", ["rock", "pop"], "drop", "록·팝 · 드럼 2마디 없이", "드럼이 빠져도 같은 템포"),
    { mod: "arps", lvl: "a4", task: "arp-follow", topics: ["major251", "blues12"], set: { "afw.pat": "r357" }, title: "진행 위 코드톤 따라가기", note: "ii–V–I · 블루스, R–3–5–7" },
    { mod: "arps", lvl: "a3", task: "arp-inversion", topics: ["maj", "min", "maj7", "dom7", "m7"], set: {}, title: "전위로 치기", note: "3음·5음·7음부터" },
    { mod: "slap", title: "엄지 · 팝 기본", note: "Slap 모듈에서" }
  ],
  5: [
    T("bmix", ["subdiv"], "drop", "박 쪼개기 섞기 · 2마디 무음", ""),
    T("b16", ["ghost"], "drop4", "16분 고스트 · 4마디 듣고 4마디 무음", ""),
    T("bmix", ["anticip"], "c1", "당겨 치기·붙임줄 · 클릭 1박만", ""),
    G("g2", ["funk"], "drop4", "펑크 고스트 · 드럼 4마디 없이", ""),
    G("g3", ["latin"], "beat", "라틴 툼바오", "1박을 비우고 2박 &·4박"),
    { mod: "arps", lvl: "a3", task: "arp-two-octave", topics: ["maj7", "dom7", "m7", "m7b5"], set: {}, title: "2옥타브 아르페지오", note: "4번 줄 근음" },
    { mod: "arps", lvl: "md", task: "shape-learning", topics: ["dorian", "mixolydian"], set: {}, title: "모드 포지션", note: "도리안 · 믹솔리디안" },
    { mod: "ear", lvl: "e3", task: "melodic", topics: [], set: {}, title: "선율 채보", note: "" },
    { mod: "slap", title: "고스트 · 더블 썸", note: "Slap 모듈에서" }
  ]
};
