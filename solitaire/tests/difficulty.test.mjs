// 난이도 분류/시드 선택 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, pickSeed, DIFFICULTIES } from '../dist/difficulty.js';
import { SEEDS } from '../dist/seeds.js';
import { solve, layoutFromSeed } from '../dist/solver.js';

test('classify: 노드 수 경계값', () => {
  assert.equal(classify(1), 'easy');
  assert.equal(classify(45), 'easy');
  assert.equal(classify(46), 'medium');
  assert.equal(classify(200), 'medium');
  assert.equal(classify(201), 'hard');
});

test('DIFFICULTIES 순서: 하/중/상', () => {
  assert.deepEqual(DIFFICULTIES, ['easy', 'medium', 'hard']);
});

test('SEEDS: 난이도별 목록이 비어 있지 않고 중복/교차 없음', () => {
  const all = [];
  for (const d of DIFFICULTIES) {
    assert.ok(SEEDS[d].length > 0, d);
    all.push(...SEEDS[d]);
  }
  assert.equal(new Set(all).size, all.length);
});

test('pickSeed: 해당 난이도 목록의 원소를 반환, rand 주입 가능', () => {
  for (const d of DIFFICULTIES) {
    assert.ok(SEEDS[d].includes(pickSeed(d)));
    assert.equal(pickSeed(d, () => 0), SEEDS[d][0]);
    assert.equal(pickSeed(d, () => 0.999999), SEEDS[d][SEEDS[d].length - 1]);
  }
});

test('SEEDS 표본 재검증: 각 난이도 앞 3개는 다시 풀어도 같은 난이도의 solved', () => {
  for (const d of DIFFICULTIES) {
    for (const seed of SEEDS[d].slice(0, 3)) {
      const r = solve(layoutFromSeed(seed), { maxNodes: 20000 });
      assert.equal(r.status, 'solved', `${d} ${seed}`);
      assert.equal(classify(r.nodes), d, `${d} ${seed}`);
    }
  }
});

test('pickSeed: exclude 시드는 피하고, 전부 제외되면 무시', () => {
  const first = SEEDS.easy[0];
  assert.notEqual(pickSeed('easy', () => 0, new Set([first])), first);
  const all = new Set(SEEDS.easy);
  assert.ok(SEEDS.easy.includes(pickSeed('easy', () => 0, all)));
});
