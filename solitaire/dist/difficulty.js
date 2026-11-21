// ─── 난이도 분류 ─────────────────────────────────────────────────────────────
// 솔버가 풀이를 찾기까지 탐색한 노드 수를 난이도 지표로 쓴다.
// (많이 헤맬수록 사람에게도 어려운 판이라고 본다.)
import { SEEDS } from './seeds.js';
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABEL = {
    easy: '하', medium: '중', hard: '상',
};
/** 노드 수 상한: 이 값 이하면 해당 난이도 */
export const EASY_MAX_NODES = 45;
export const MEDIUM_MAX_NODES = 200;
export function classify(nodes) {
    if (nodes <= EASY_MAX_NODES)
        return 'easy';
    if (nodes <= MEDIUM_MAX_NODES)
        return 'medium';
    return 'hard';
}
/**
 * 해당 난이도의 (풀이가 확인된) 시드 중 하나를 무작위로 고른다.
 * @param exclude 최근에 한 시드 등 제외할 시드 (후보가 모두 제외되면 무시)
 */
export function pickSeed(d, rand = Math.random, exclude) {
    let list = SEEDS[d];
    if (exclude && exclude.size > 0) {
        const rest = list.filter(s => !exclude.has(s));
        if (rest.length > 0)
            list = rest;
    }
    return list[Math.floor(rand() * list.length)];
}
//# sourceMappingURL=difficulty.js.map