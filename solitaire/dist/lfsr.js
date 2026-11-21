// ─── LFSR 시드 순환 ──────────────────────────────────────────────────────────
// 11비트 피보나치 LFSR (다항식 x^11 + x^9 + 1, 최대주기 2047).
// 0을 제외한 1~2047을 한 번씩 모두 방문한 뒤 처음으로 돌아온다.
// 난이도별로 "현재 상태" 숫자 하나만 저장하면, 한 바퀴 동안 같은 판이 나오지 않는다.
export const LFSR_PERIOD = 2047;
/** 다음 상태 (1~2047) */
export function lfsrStep(state) {
    const bit = ((state >> 10) ^ (state >> 8)) & 1;
    return ((state << 1) | bit) & 0x7FF;
}
/** 1~2047 사이의 랜덤 시작 상태 */
export function randomLfsrState() {
    return 1 + Math.floor(Math.random() * LFSR_PERIOD);
}
/**
 * 다음 인덱스(0 ~ length-1)와 새 상태. length 보다 큰 상태는 건너뛴다(cycle walking).
 * length 는 1 이상 2047 이하여야 한다.
 */
export function nextLfsrIndex(state, length) {
    let s = state;
    do {
        s = lfsrStep(s);
    } while (s > length);
    return { index: s - 1, state: s };
}
//# sourceMappingURL=lfsr.js.map