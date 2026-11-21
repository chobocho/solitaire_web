// ─── 시드 기반 난수 생성기 ───────────────────────────────────────────────────
// 같은 시드 → 같은 수열. 의존성 없음 (솔버/시드 생성 스크립트에서도 재사용).
/** mulberry32: 32비트 시드로 [0,1) 난수를 반환하는 함수를 만든다. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** 32비트 부호 없는 정수 랜덤 시드 */
export function randomSeed() {
    return Math.floor(Math.random() * 4294967296) >>> 0;
}
//# sourceMappingURL=rng.js.map