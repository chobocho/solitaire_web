// 난이도별 시드 목록 생성: tsc 후 `node scripts/gen-seeds.mjs [시작] [끝] [노드한도] [난이도당최대]`
// 결과를 src/seeds.ts 로 저장한다. (풀이가 확인된 시드만 포함)
import { writeFileSync } from 'node:fs';
import { solve, layoutFromSeed } from '../dist/solver.js';
import { classify, DIFFICULTIES } from '../dist/difficulty.js';

const [from = 1, to = 2000, cap = 10000, perTier = 300] = process.argv.slice(2).map(Number);
const out = { easy: [], medium: [], hard: [] };
const t0 = Date.now();
for (let seed = from; seed <= to; seed++) {
  const r = solve(layoutFromSeed(seed), { maxNodes: cap });
  if (r.status !== 'solved') continue;
  const d = classify(r.nodes);
  if (out[d].length < perTier) out[d].push(seed);
  if (DIFFICULTIES.every(k => out[k].length >= perTier)) break;
  if (seed % 200 === 0) console.log(seed, DIFFICULTIES.map(k => out[k].length).join('/'), Math.round((Date.now() - t0) / 1000) + 's');
}
const body = DIFFICULTIES.map(k => `  ${k}: [${out[k].join(', ')}],`).join('\n');
writeFileSync(new URL('../src/seeds.ts', import.meta.url),
`// 자동 생성 파일 (scripts/gen-seeds.mjs). 풀이가 확인된 시드만 포함. 직접 수정 금지.
// 범위: seed ${from}~${to}, 노드 한도 ${cap}
export const SEEDS: Record<'easy' | 'medium' | 'hard', number[]> = {
${body}
};
`);
console.log('done', DIFFICULTIES.map(k => `${k}=${out[k].length}`).join(' '), Math.round((Date.now() - t0) / 1000) + 's');
