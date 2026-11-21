// 솔버 테스트. 실행: tsc && node --test "tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, layoutFromSeed } from '../dist/solver.js';
import { SolitaireGame } from '../dist/solitaire.js';
import { DeckIndex } from '../dist/deck.js';

const id = (s, r) => s * 13 + (r - 1);           // s: 0=Club 1=Diamond 2=Heart 3=Spade
const cid = (c) => (c.figure - 1) * 13 + c.number - 1;
const pile = (down, up) => ({ down, up });
const empty = () => pile([], []);
const sevenPiles = (first) => [first, ...Array.from({ length: 6 }, empty)];

test('손으로 만든 배치: 에이스 한 장은 풀림', () => {
  const r = solve({ tableau: sevenPiles(pile([], [id(0, 1)])), talon: [] });
  assert.equal(r.status, 'solved');
  assert.equal(r.moves.length, 1);
});

test('손으로 만든 배치: 스톡의 A,2는 풀림', () => {
  const r = solve({ tableau: sevenPiles(empty()), talon: [id(0, 2), id(0, 1)] });
  assert.equal(r.status, 'solved');
});

test('손으로 만든 배치: 2♣ 밑에 A♣이 깔려 있으면 풀 수 없음', () => {
  const r = solve({ tableau: sevenPiles(pile([id(0, 1)], [id(0, 2)])), talon: [] });
  assert.equal(r.status, 'unsolvable');
});

test('손으로 만든 배치: 빨간 3 위로 검정 2 이동 후 해결', () => {
  // pile0: 맨 아래 닫힌 A♣, 위에 열린 2♣ → 2♣을 3♦(pile1)에 옮겨야 A♣이 열림
  const t = sevenPiles(pile([id(0, 1)], [id(0, 2)]));
  t[1] = pile([], [id(1, 3)]);
  const r = solve({ tableau: t, talon: [], foundation: [0, 2, 0, 0] });
  assert.equal(r.status, 'solved');
});

test('maxNodes 초과 시 unknown', () => {
  const r = solve(layoutFromSeed(1), { maxNodes: 1 });
  assert.equal(r.status, 'unknown');
});

test('layoutFromSeed: 52장 모두 한 번씩', () => {
  const l = layoutFromSeed(5);
  const all = [...l.talon, ...l.tableau.flatMap(p => [...p.down, ...p.up])];
  assert.equal(all.length, 52);
  assert.equal(new Set(all).size, 52);
  l.tableau.forEach((p, i) => assert.equal(p.down.length + p.up.length, i + 1));
});

test('같은 시드는 같은 결과(결정적)', () => {
  const a = solve(layoutFromSeed(11), { maxNodes: 3000 }), b = solve(layoutFromSeed(11), { maxNodes: 3000 });
  assert.equal(a.status, b.status);
  assert.equal(a.nodes, b.nodes);
  assert.deepEqual(a.moves, b.moves);
});

function bringToWasteTop(game, cardId) {
  for (let n = 0; n < 200; n++) {
    const w = game.getDeck(DeckIndex.Waste).top();
    if (w && cid(w) === cardId) return true;
    if (!game.flipStock()) return false;
  }
  return false;
}

function replay(game, moves) {
  for (const m of moves) {
    if (m.kind === 'tableau') {
      assert.ok(game.moveCard(DeckIndex.Tab1 + m.from, DeckIndex.Tab1 + m.to, m.count), `tableau ${JSON.stringify(m)}`);
    } else if (m.kind === 'toFoundation') {
      const f = DeckIndex.Found1 + Math.floor(m.card / 13);
      if (m.from === 'waste') {
        assert.ok(bringToWasteTop(game, m.card), 'bring');
        assert.ok(game.moveFromWaste(f), `waste->found ${m.card}`);
      } else {
        assert.ok(game.moveCard(DeckIndex.Tab1 + m.from, f, 1), `tab->found ${JSON.stringify(m)}`);
      }
    } else {
      assert.ok(bringToWasteTop(game, m.card), 'bring');
      assert.ok(game.moveFromWaste(DeckIndex.Tab1 + m.to), `waste->tab ${JSON.stringify(m)}`);
    }
  }
}

test('솔버의 풀이를 실제 게임에서 재생하면 승리 (시드 1~25)', () => {
  let solved = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const r = solve(layoutFromSeed(seed), { maxNodes: 5000 });
    if (r.status !== 'solved') continue;
    solved++;
    const game = new SolitaireGame();
    game.deal(seed);
    replay(game, r.moves);
    assert.equal(game.state, 'win', `seed ${seed}`);
  }
  assert.ok(solved >= 5, `풀린 판이 너무 적음: ${solved}`);
});
