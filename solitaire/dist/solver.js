// ─── 클론다이크 솔버 ─────────────────────────────────────────────────────────
// 규칙: 스톡 1장 뽑기, 재순환 무제한 → 스톡/웨이스트 카드는 언제든 순환해서 꺼낼 수 있다.
// 카드 id = 무늬(0=♣ 1=♦ 2=♥ 3=♠) * 13 + (숫자 - 1)
// 탐색: DFS + 방문 상태 메모 + 안전한 파운데이션 자동 이동.
// 제한: 파운데이션 → 태블로 이동은 탐색하지 않는다.
//   → solved 는 항상 실제로 풀리는 판이고, unsolvable 은 "이 제한 하에서" 풀이가 없다는 뜻.
import { SolitaireGame } from './solitaire.js';
import { DeckIndex } from './deck.js';
const suitOf = (id) => (id / 13) | 0;
const rankOf = (id) => (id % 13) + 1;
const isRed = (id) => { const s = suitOf(id); return s === 1 || s === 2; };
// ─── Layout 추출 ─────────────────────────────────────────────────────────────
export function layoutFromGame(game) {
    const cid = (c) => (c.figure - 1) * 13 + c.number - 1;
    const tableau = [];
    for (let i = 0; i < 7; i++) {
        const deck = game.getDeck(DeckIndex.Tab1 + i);
        const down = [], up = [];
        for (const c of deck.toArray())
            (c.isOpen ? up : down).push(cid(c));
        tableau.push({ down, up });
    }
    const stock = game.getDeck(DeckIndex.Stock).toArray().map(cid).reverse(); // 뽑는 순서
    const waste = game.getDeck(DeckIndex.Waste).toArray().map(cid);
    return { tableau, talon: [...waste, ...stock] };
}
/** 시드로 deal한 초기 배치 */
export function layoutFromSeed(seed) {
    const game = new SolitaireGame();
    game.deal(seed);
    return layoutFromGame(game);
}
// ─── 상태 유틸 ───────────────────────────────────────────────────────────────
function fromLayout(l) {
    return {
        piles: l.tableau.map(p => ({ c: [...p.down, ...p.up], d: p.down.length })),
        found: [...(l.foundation ?? [0, 0, 0, 0])],
        talon: [...l.talon],
    };
}
function isSolved(s) {
    return s.talon.length === 0 && s.piles.every(p => p.c.length === 0);
}
function stateKey(s) {
    const piles = s.piles.map(p => `${p.d}:${p.c.join(',')}`).sort().join('|');
    return `${piles}#${s.found.join(',')}#${s.talon.join(',')}`;
}
function cloneState(s) {
    return { piles: s.piles.map(p => ({ c: p.c.slice(), d: p.d })), found: s.found.slice(), talon: s.talon.slice() };
}
/** 카드를 빼낸 뒤 맨 위가 뒷면이면 뒤집는다 */
function revealTop(p) {
    if (p.c.length > 0 && p.d >= p.c.length)
        p.d = p.c.length - 1;
}
/** 자동 이동해도 손해가 없는 카드인가 */
function isSafe(s, id) {
    const r = rankOf(id);
    if (r <= 2)
        return true;
    // 반대 색 카드(랭크 r-1)가 이 카드 위에 놓일 일이 없어야 안전
    const opp = isRed(id) ? [0, 3] : [1, 2];
    return s.found[opp[0]] >= r - 1 && s.found[opp[1]] >= r - 1;
}
/** 안전한 파운데이션 이동을 최대한 적용 (제자리 변경) */
function applySafeMoves(s, out) {
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < s.piles.length; i++) {
            const p = s.piles[i];
            if (p.c.length === 0)
                continue;
            const id = p.c[p.c.length - 1];
            if (s.found[suitOf(id)] === rankOf(id) - 1 && isSafe(s, id)) {
                p.c.pop();
                revealTop(p);
                s.found[suitOf(id)]++;
                out.push({ kind: 'toFoundation', from: i, card: id });
                changed = true;
            }
        }
        for (let t = 0; t < s.talon.length; t++) {
            const id = s.talon[t];
            if (s.found[suitOf(id)] === rankOf(id) - 1 && isSafe(s, id)) {
                s.talon.splice(t, 1);
                s.found[suitOf(id)]++;
                out.push({ kind: 'toFoundation', from: 'waste', card: id });
                changed = true;
                break;
            }
        }
    }
}
function canPlace(p, id) {
    if (p.c.length === 0)
        return rankOf(id) === 13;
    const top = p.c[p.c.length - 1];
    return rankOf(top) === rankOf(id) + 1 && isRed(top) !== isRed(id);
}
function successors(s) {
    const res = [];
    const push = (move, ns, prio) => {
        const moves = [move];
        applySafeMoves(ns, moves);
        res.push({ moves, state: ns, prio });
    };
    for (let i = 0; i < s.piles.length; i++) {
        const p = s.piles[i];
        const n = p.c.length;
        if (n === 0)
            continue;
        // 태블로 → 파운데이션 (안전하지 않은 것도 후보)
        const topId = p.c[n - 1];
        if (s.found[suitOf(topId)] === rankOf(topId) - 1) {
            const ns = cloneState(s);
            const np = ns.piles[i];
            np.c.pop();
            revealTop(np);
            ns.found[suitOf(topId)]++;
            push({ kind: 'toFoundation', from: i, card: topId }, ns, p.d >= n - 1 && p.d > 0 ? 1 : 3);
        }
        // 태블로 → 태블로 (앞면 구간의 어느 위치에서든 시작)
        for (let k = p.d; k < n; k++) {
            const id = p.c[k];
            for (let j = 0; j < s.piles.length; j++) {
                if (j === i)
                    continue;
                const target = s.piles[j];
                if (!canPlace(target, id))
                    continue;
                if (target.c.length === 0 && k === 0)
                    continue; // 킹 통째로 빈 열로: 의미 없음
                const ns = cloneState(s);
                const moved = ns.piles[i].c.splice(k);
                revealTop(ns.piles[i]);
                ns.piles[j].c.push(...moved);
                const reveals = k === p.d && p.d > 0;
                push({ kind: 'tableau', from: i, to: j, count: n - k }, ns, reveals ? 0 : 4);
            }
        }
    }
    // 스톡/웨이스트 → 파운데이션 / 태블로
    for (let t = 0; t < s.talon.length; t++) {
        const id = s.talon[t];
        if (s.found[suitOf(id)] === rankOf(id) - 1) {
            const ns = cloneState(s);
            ns.talon.splice(t, 1);
            ns.found[suitOf(id)]++;
            push({ kind: 'toFoundation', from: 'waste', card: id }, ns, 2);
        }
        for (let j = 0; j < s.piles.length; j++) {
            if (!canPlace(s.piles[j], id))
                continue;
            const ns = cloneState(s);
            ns.talon.splice(t, 1);
            ns.piles[j].c.push(id);
            push({ kind: 'wasteToTableau', to: j, card: id }, ns, 2);
        }
    }
    res.sort((a, b) => a.prio - b.prio);
    return res;
}
// ─── 솔버 (최선 우선 탐색) ───────────────────────────────────────────────────
/** 낮을수록 유망한 상태 */
function heuristic(s) {
    let down = 0, empty = 0, found = 0;
    for (const p of s.piles) {
        down += p.d;
        if (p.c.length === 0)
            empty++;
    }
    for (const f of s.found)
        found += f;
    return 3 * down - 2 * found + s.talon.length - 3 * empty;
}
class MinHeap {
    constructor() {
        this.a = [];
    }
    get size() { return this.a.length; }
    push(n) {
        const a = this.a;
        a.push(n);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (a[p].f <= a[i].f)
                break;
            [a[p], a[i]] = [a[i], a[p]];
            i = p;
        }
    }
    pop() {
        const a = this.a;
        const top = a[0];
        const last = a.pop();
        if (a.length > 0) {
            a[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < a.length && a[l].f < a[m].f)
                    m = l;
                if (r < a.length && a[r].f < a[m].f)
                    m = r;
                if (m === i)
                    break;
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return top;
    }
}
export function solve(layout, opts = {}) {
    const maxNodes = opts.maxNodes ?? 100000;
    const visited = new Set();
    const heap = new MinHeap();
    let nodes = 0;
    const start = fromLayout(layout);
    const init = [];
    applySafeMoves(start, init);
    heap.push({ state: start, parent: null, moves: init, f: heuristic(start) });
    while (heap.size > 0) {
        const node = heap.pop();
        const s = node.state;
        if (isSolved(s)) {
            const moves = [];
            for (let n = node; n !== null; n = n.parent)
                moves.unshift(...n.moves);
            return { status: 'solved', nodes, moves };
        }
        const key = stateKey(s);
        if (visited.has(key))
            continue;
        if (nodes >= maxNodes)
            return { status: 'unknown', nodes, moves: [] };
        visited.add(key);
        nodes++;
        for (const succ of successors(s)) {
            heap.push({ state: succ.state, parent: node, moves: succ.moves, f: heuristic(succ.state) + succ.prio * 0.01 });
        }
    }
    return { status: 'unsolvable', nodes, moves: [] };
}
//# sourceMappingURL=solver.js.map