// ─── 난이도 분류 ─────────────────────────────────────────────────────────────
// 솔버가 풀이를 찾기까지 탐색한 노드 수를 난이도 지표로 쓴다.
// (많이 헤맬수록 사람에게도 어려운 판이라고 본다.)

import { SEEDS } from './seeds.js';
import { nextLfsrIndex } from './lfsr.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '하', medium: '중', hard: '상',
};

/** 노드 수 상한: 이 값 이하면 해당 난이도 */
export const EASY_MAX_NODES = 45;
export const MEDIUM_MAX_NODES = 200;

export function classify(nodes: number): Difficulty {
  if (nodes <= EASY_MAX_NODES) return 'easy';
  if (nodes <= MEDIUM_MAX_NODES) return 'medium';
  return 'hard';
}

/**
 * 해당 난이도의 (풀이가 확인된) 시드 중 하나를 무작위로 고른다.
 * @param exclude 최근에 한 시드 등 제외할 시드 (후보가 모두 제외되면 무시)
 */
export function pickSeed(
  d: Difficulty,
  rand: () => number = Math.random,
  exclude?: ReadonlySet<number>,
): number {
  let list = SEEDS[d];
  if (exclude && exclude.size > 0) {
    const rest = list.filter(s => !exclude.has(s));
    if (rest.length > 0) list = rest;
  }
  return list[Math.floor(rand() * list.length)];
}

let _seedLevel: Map<number, Difficulty> | null = null;

/** 시드가 속한 난이도. 목록에 없는 시드(랜덤 게임)는 null */
export function difficultyOfSeed(seed: number): Difficulty | null {
  if (_seedLevel === null) {
    _seedLevel = new Map();
    for (const d of DIFFICULTIES) for (const s of SEEDS[d]) _seedLevel.set(s, d);
  }
  return _seedLevel.get(seed) ?? null;
}

/**
 * LFSR 순서로 다음 시드를 고른다. 한 바퀴(목록 길이만큼) 동안 같은 시드가 나오지 않는다.
 * @param state 현재 LFSR 상태 (저장된 값)
 * @returns 고른 시드와 새 LFSR 상태 (새 상태를 저장해야 한다)
 */
export function pickSeedByLfsr(d: Difficulty, state: number): { seed: number; state: number } {
  const list = SEEDS[d];
  const r = nextLfsrIndex(state, list.length);
  return { seed: list[r.index], state: r.state };
}
