// 시드 기반 셔플 테스트. 실행: tsc && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randomSeed } from '../dist/rng.js';
import { InitDeck, DeckIndex } from '../dist/deck.js';
import { SolitaireGame } from '../dist/solitaire.js';

const order = (deck) => deck.toArray().map(c => `${c.figure}-${c.number}`).join(',');
const layout = (game) => {
  const parts = [];
  for (let i = 0; i < 13; i++) parts.push(order(game.getDeck(i)));
  return parts.join('|');
};

test('mulberry32: 같은 시드는 같은 수열', () => {
  const a = mulberry32(12345), b = mulberry32(12345);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('mulberry32: 값 범위 [0,1) 및 시드별 상이', () => {
  const a = mulberry32(1), b = mulberry32(2);
  let diff = false;
  for (let i = 0; i < 100; i++) {
    const x = a(), y = b();
    assert.ok(x >= 0 && x < 1);
    if (x !== y) diff = true;
  }
  assert.ok(diff);
});

test('randomSeed: 32비트 부호 없는 정수', () => {
  for (let i = 0; i < 50; i++) {
    const s = randomSeed();
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xFFFFFFFF);
  }
});

test('InitDeck: 같은 시드는 같은 덱, 다른 시드는 다른 덱', () => {
  assert.equal(order(new InitDeck(777)), order(new InitDeck(777)));
  assert.notEqual(order(new InitDeck(777)), order(new InitDeck(778)));
});

test('InitDeck: 52장, 중복 없음, seed getter', () => {
  const d = new InitDeck(42);
  assert.equal(d.seed, 42);
  assert.equal(d.size(), 52);
  assert.equal(new Set(d.toArray().map(c => `${c.figure}-${c.number}`)).size, 52);
});

test('InitDeck: 시드 생략 시 랜덤 시드가 부여되고 재현 가능', () => {
  const d = new InitDeck();
  assert.ok(Number.isInteger(d.seed));
  assert.equal(order(d), order(new InitDeck(d.seed)));
});

test('SolitaireGame.deal(seed): 같은 시드는 같은 배치, seed getter', () => {
  const g1 = new SolitaireGame(), g2 = new SolitaireGame();
  g1.deal(2024); g2.deal(2024);
  assert.equal(g1.seed, 2024);
  assert.equal(layout(g1), layout(g2));
  g2.deal(2025);
  assert.notEqual(layout(g1), layout(g2));
});

test('SolitaireGame.deal(): 시드 생략 시 시드가 기록됨', () => {
  const g = new SolitaireGame();
  g.deal();
  assert.ok(Number.isInteger(g.seed));
  const g2 = new SolitaireGame();
  g2.deal(g.seed);
  assert.equal(layout(g), layout(g2));
});

test('배치 규칙: 태블로 1~7장, 스톡 24장', () => {
  const g = new SolitaireGame();
  g.deal(1);
  for (let i = 0; i < 7; i++) assert.equal(g.getDeck(DeckIndex.Tab1 + i).size(), i + 1);
  assert.equal(g.getDeck(DeckIndex.Stock).size(), 24);
});
