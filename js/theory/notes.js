// 음 이름·지판 계산 (모듈 공용, 화면과 무관)

// 베이스 4현 표준 튜닝: 1번 현(G2)부터 4번 현(E1)까지의 MIDI 번호
export const TUNING = [43, 38, 33, 28];
export const NUM_STRINGS = TUNING.length;
export const ALL_STRINGS = TUNING.map((_, i) => i + 1);   // [1, 2, 3, 4]
export const LOWEST = NUM_STRINGS;                          // 가장 굵은 줄 번호
export const STRING_NAMES = ["G", "D", "A", "E"];
export const stringLabel = s => `${s}번 현(${STRING_NAMES[s - 1]})`;

// 음높이 12개(pitch class)별 표기. 두 이름이 있는 음은 [샤프, 플랫]
// E♯·F♭·B♯·C♭ 같은 드문 표기는 쓰지 않음
export const SPELLINGS = [
  ["C"], ["C♯", "D♭"], ["D"], ["D♯", "E♭"], ["E"], ["F"],
  ["F♯", "G♭"], ["G"], ["G♯", "A♭"], ["A"], ["A♯", "B♭"], ["B"]
];

export function spell(pc, rand = Math.random) {
  const names = SPELLINGS[((pc % 12) + 12) % 12];
  return names.length === 1 ? names[0] : names[Math.floor(rand() * names.length)];
}

export function pcOf(name) {
  for (let pc = 0; pc < 12; pc++) if (SPELLINGS[pc].includes(name)) return pc;
  return -1;
}

export function midiAt(string, fret) {
  return TUNING[string - 1] + fret;
}

// 지정한 현들에서 해당 음높이가 나오는 모든 위치 (0~maxFret)
export function positionsOf(pc, strings = ALL_STRINGS, maxFret = 15) {
  const out = [];
  for (const s of strings) {
    for (let f = 0; f <= maxFret; f++) {
      if (midiAt(s, f) % 12 === pc) out.push({ s, f });
    }
  }
  return out;
}
