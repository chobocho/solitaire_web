// LFSR 기반 시드 순환 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lfsrStep, LFSR_PERIOD, nextLfsrIndex, randomLfsrState } from '../dist/lfsr.js';
import { pickSeedByLfsr, DIFFICULTIES } from '../dist/difficulty.js';
import { SEEDS } from '../dist/seeds.js';

test('LFSR: 11비트 최대주기 2047, 모든 상태를 한 번씩 방문 후 복귀', () => {
  assert.equal(LFSR_PERIOD, 2047);
  const seen = new Set();
  let s = 1;
  for (let i = 0; i < LFSR_PERIOD; i++) {
    assert.ok(s >= 1 && s <= 2047, `state ${s}`);
    assert.ok(!seen.has(s), `중복 ${s}`);
    seen.add(s);
    s = lfsrStep(s);
  }
  assert.equal(seen.size, 2047);
  assert.equal(s, 1);
});

test('nextLfsrIndex: 길이 2000이면 2000번 호출에 0~1999가 한 번씩', () => {
  let state = 777;
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const r = nextLfsrIndex(state, 2000);
    assert.ok(r.index >= 0 && r.index < 2000);
    seen.add(r.index);
    state = r.state;
  }
  assert.equal(seen.size, 2000);
});

test('nextLfsrIndex: 한 바퀴 후 반복(순서 동일)', () => {
  const run = (n, st) => { const out = []; for (let i = 0; i < n; i++) { const r = nextLfsrIndex(st, 2000); out.push(r.index); st = r.state; } return out; };
  const a = run(4000, 5);
  assert.deepEqual(a.slice(0, 2000), a.slice(2000));
});

test('nextLfsrIndex: 임의 길이(예: 10)에서도 한 바퀴에 중복 없음', () => {
  let st = 9; const seen = new Set();
  for (let i = 0; i < 10; i++) { const r = nextLfsrIndex(st, 10); seen.add(r.index); st = r.state; }
  assert.equal(seen.size, 10);
});

test('randomLfsrState: 1~2047', () => {
  for (let i = 0; i < 200; i++) { const s = randomLfsrState(); assert.ok(Number.isInteger(s) && s >= 1 && s <= 2047); }
});

test('pickSeedByLfsr: 난이도 목록의 시드를 반환, 한 바퀴 동안 모두 다름', () => {
  for (const d of DIFFICULTIES) {
    let st = 123;
    const seen = new Set();
    for (let i = 0; i < SEEDS[d].length; i++) {
      const r = pickSeedByLfsr(d, st);
      assert.ok(SEEDS[d].includes(r.seed));
      seen.add(r.seed);
      st = r.state;
    }
    assert.equal(seen.size, SEEDS[d].length, d);
  }
});
