import { Card, Figure } from './card.js';
import { DeckIndex, TOTAL_DECKS, InitDeck, FoundationDeck, TableauDeck, StockDeck, WasteDeck, } from './deck.js';
// ─── Foundation 무늬 순서 ────────────────────────────────────────────────────
const FOUNDATION_FIGURES = [
    Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade,
];
// ─── SolitaireGame ───────────────────────────────────────────────────────────
export class SolitaireGame {
    constructor() {
        this._decks = [];
        this._history = [];
        this._state = 'idle';
        this._moveCount = 0;
        /** deal() 직후 초기 배치 스냅샷 ("다시 하기"로 같은 배열 재시작용) */
        this._initialDeal = null;
        this._buildDecks();
    }
    // ── Getter ──────────────────────────────────────────────────────────────
    get state() { return this._state; }
    get moveCount() { return this._moveCount; }
    get canUndo() { return this._history.length > 0; }
    getDeck(index) { return this._decks[index]; }
    // ── 초기화 ─────────────────────────────────────────────────────────────
    _buildDecks() {
        this._decks = new Array(TOTAL_DECKS);
        this._decks[DeckIndex.Stock] = new StockDeck();
        this._decks[DeckIndex.Waste] = new WasteDeck();
        for (let i = 0; i < 4; i++) {
            this._decks[DeckIndex.Found1 + i] = new FoundationDeck(FOUNDATION_FIGURES[i]);
        }
        for (let i = 0; i < 7; i++) {
            this._decks[DeckIndex.Tab1 + i] = new TableauDeck();
        }
    }
    /**
     * 새 게임 시작: 솔리테어 초기 배치
     * - 태블로 1열: 1장, 2열: 2장, ..., 7열: 7장 (28장 총)
     * - 각 열 맨 위 카드만 앞면
     * - 나머지 24장 → 스톡(뒤집어서)
     */
    deal() {
        this._buildDecks();
        this._history = [];
        this._moveCount = 0;
        const init = new InitDeck();
        // 태블로에 배분 (Android PlayState.runInitBoardCmd 참조)
        // 1열: 1장, 2열: 2장, ..., 7열: 7장
        for (let col = 0; col < 7; col++) {
            for (let row = 0; row <= col; row++) {
                const card = init.pop();
                card.close();
                this._decks[DeckIndex.Tab1 + col].push(card);
            }
            // 맨 위 카드 앞면 공개
            const deck = this._decks[DeckIndex.Tab1 + col];
            deck.top().open();
        }
        // 나머지 24장 → 스톡 (뒤집어서)
        let card = init.pop();
        while (card !== null) {
            card.close();
            this._decks[DeckIndex.Stock].push(card);
            card = init.pop();
        }
        this._initialDeal = this._snapshotDecks();
        this._state = 'play';
    }
    /**
     * "다시 하기": deal() 로 저장해 둔 초기 배치로 되돌린다.
     * 새로 셔플하지 않고 동일한 카드 배열로 재시작.
     * @returns 초기 스냅샷이 없으면 false
     */
    restart() {
        if (!this._initialDeal)
            return false;
        this._buildDecks();
        for (let i = 0; i < TOTAL_DECKS; i++) {
            const deckSnap = this._initialDeal[i];
            if (!deckSnap)
                continue;
            for (const cs of deckSnap.cards) {
                const card = new Card(cs.figure, cs.number);
                if (cs.isOpen)
                    card.open();
                else
                    card.close();
                this._decks[i].push(card);
            }
        }
        this._history = [];
        this._moveCount = 0;
        this._state = 'play';
        return true;
    }
    /** 현재 덱 상태를 SavedDeck[] 형태로 스냅샷 */
    _snapshotDecks() {
        return this._decks.map(deck => ({
            cards: deck.toArray().map(c => ({
                figure: c.figure,
                number: c.number,
                isOpen: c.isOpen,
            })),
        }));
    }
    // ── 스톡 뒤집기 ─────────────────────────────────────────────────────────
    /**
     * 스톡 클릭: 스톡 맨 위 카드를 웨이스트로 이동
     * 스톡이 비면 웨이스트를 다시 스톡으로 복원 (무한 재시도 가능)
     */
    flipStock() {
        if (this._state !== 'play')
            return false;
        const stock = this._decks[DeckIndex.Stock];
        const waste = this._decks[DeckIndex.Waste];
        if (stock.isEmpty()) {
            if (waste.isEmpty())
                return false;
            // 웨이스트 스냅샷 저장 (undo용)
            const wasteSnapshot = waste.toArray().map(c => ({ figure: c.figure, number: c.number }));
            // 재충전
            stock.refillFrom(waste);
            this._history.push({ type: 'refill', wasteSnapshot });
            this._moveCount++;
            return true;
        }
        // 스톡 → 웨이스트 이동
        const card = stock.drawCard();
        waste.addCard(card);
        this._history.push({ type: 'flip' });
        this._moveCount++;
        return true;
    }
    // ── 카드 이동 ────────────────────────────────────────────────────────────
    /**
     * 카드 이동 시도
     * @param from 출발 덱
     * @param to   목적 덱
     * @param count 이동할 카드 수 (태블로→태블로 멀티카드)
     * @returns 성공 여부
     */
    moveCard(from, to, count = 1) {
        if (this._state !== 'play')
            return false;
        // 스톡/웨이스트는 moveCard 대상이 아님 (flipStock 사용)
        if (to === DeckIndex.Stock || to === DeckIndex.Waste)
            return false;
        if (from === DeckIndex.Stock)
            return false;
        // Foundation에서 꺼낼 때는 1장만
        if (this._isFoundation(from) && count !== 1)
            return false;
        // Foundation 이동: 1장만
        if (this._isFoundation(to) && count !== 1)
            return false;
        const fromDeck = this._decks[from];
        const toDeck = this._decks[to];
        if (fromDeck.isEmpty())
            return false;
        if (count > fromDeck.size())
            return false;
        // 이동할 카드들 확인
        const cards = fromDeck.peekTop(count);
        if (!cards[0].isOpen)
            return false;
        // 시퀀스 유효성 (멀티카드)
        if (count > 1 && !this._isValidSequence(cards))
            return false;
        // 목적지 첫 카드(맨 아래) 수락 가능 여부
        if (!toDeck.canAccept(cards[0]))
            return false;
        // undo용: 아래 카드가 닫혀있었는지 기록
        const belowCard = fromDeck.size() > count ? fromDeck.get(fromDeck.size() - count - 1) : null;
        const didOpenCard = belowCard !== null && !belowCard.isOpen;
        // 실제 이동
        const moved = fromDeck.popMany(count);
        toDeck.pushMany(moved);
        this._history.push({ type: 'move', from, to, count, didOpenCard });
        this._moveCount++;
        if (this._checkWin()) {
            this._state = 'win';
        }
        return true;
    }
    /**
     * 웨이스트 맨 위 카드를 목적지로 이동
     */
    moveFromWaste(to) {
        if (this._state !== 'play')
            return false;
        if (to === DeckIndex.Stock || to === DeckIndex.Waste)
            return false;
        const waste = this._decks[DeckIndex.Waste];
        if (waste.isEmpty())
            return false;
        const card = waste.top();
        const toDeck = this._decks[to];
        if (!toDeck.canAccept(card))
            return false;
        waste.pop();
        toDeck.push(card);
        this._history.push({ type: 'move', from: DeckIndex.Waste, to, count: 1, didOpenCard: false });
        this._moveCount++;
        if (this._checkWin())
            this._state = 'win';
        return true;
    }
    // ── Foundation 자동 이동 ─────────────────────────────────────────────────
    /**
     * 지정 덱의 맨 위 카드를 가장 적합한 Foundation으로 자동 이동
     */
    autoMoveToFoundation(from) {
        if (this._state !== 'play')
            return false;
        if (this._isFoundation(from))
            return false;
        const fromDeck = this._decks[from];
        if (fromDeck.isEmpty())
            return false;
        const card = fromDeck.top();
        if (!card.isOpen)
            return false;
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const foundation = this._decks[i];
            if (foundation.canAccept(card)) {
                return this.moveCard(from, i, 1);
            }
        }
        return false;
    }
    /**
     * 가능한 모든 카드를 Foundation으로 자동 이동 (연쇄)
     * @returns 이동한 카드 수
     */
    autoMoveAll() {
        if (this._state !== 'play')
            return 0;
        let moved = 0;
        let changed = true;
        while (changed) {
            changed = false;
            // 웨이스트
            if (this.autoMoveToFoundation(DeckIndex.Waste)) {
                moved++;
                changed = true;
                continue;
            }
            // 태블로
            for (let i = DeckIndex.Tab1; i <= DeckIndex.Tab7; i++) {
                if (this.autoMoveToFoundation(i)) {
                    moved++;
                    changed = true;
                    break;
                }
            }
        }
        return moved;
    }
    // ── Undo ─────────────────────────────────────────────────────────────────
    undo() {
        if (this._history.length === 0)
            return false;
        const cmd = this._history.pop();
        if (cmd.type === 'flip') {
            // 웨이스트 맨 위 카드를 스톡으로 돌려보내기
            const waste = this._decks[DeckIndex.Waste];
            const stock = this._decks[DeckIndex.Stock];
            const card = waste.pop();
            if (card) {
                card.close();
                stock.push(card);
            }
        }
        else if (cmd.type === 'refill') {
            // 스톡 → 웨이스트 역순 복원
            const stock = this._decks[DeckIndex.Stock];
            const waste = this._decks[DeckIndex.Waste];
            waste.clear();
            stock.clear();
            if (cmd.wasteSnapshot) {
                for (const s of cmd.wasteSnapshot) {
                    const card = new Card(s.figure, s.number);
                    card.open();
                    waste.push(card);
                }
            }
        }
        else if (cmd.type === 'move' && cmd.from !== undefined && cmd.to !== undefined && cmd.count !== undefined) {
            const fromDeck = this._decks[cmd.from];
            const toDeck = this._decks[cmd.to];
            const count = cmd.count;
            // 이동 역순
            const cards = toDeck.popMany(count);
            // 태블로에서 꺼낼 때 열린 카드를 다시 닫기
            if (cmd.didOpenCard && this._isTableau(cmd.from)) {
                const deck = this._decks[cmd.from];
                if (!deck.isEmpty())
                    deck.top().close();
            }
            fromDeck.pushMany(cards);
        }
        this._moveCount = Math.max(0, this._moveCount - 1);
        if (this._state === 'win')
            this._state = 'play';
        return true;
    }
    // ── 일시정지 / 재개 ──────────────────────────────────────────────────────
    pause() { if (this._state === 'play')
        this._state = 'pause'; }
    resume() { if (this._state === 'pause')
        this._state = 'play'; }
    // ── 승리 판정 ────────────────────────────────────────────────────────────
    _checkWin() {
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const f = this._decks[i];
            if (!f.isComplete())
                return false;
        }
        return true;
    }
    // ── 직렬화 / 복원 ────────────────────────────────────────────────────────
    serialize(elapsed) {
        const decks = this._snapshotDecks();
        const history = this._history.map(cmd => ({
            type: cmd.type,
            from: cmd.from ?? -1,
            to: cmd.to ?? -1,
            count: cmd.count ?? 0,
            didOpenCard: cmd.didOpenCard ?? false,
            wasteSnapshot: cmd.wasteSnapshot ?? [],
        }));
        return {
            version: 2,
            savedAt: Date.now(),
            gameState: this._state,
            moveCount: this._moveCount,
            elapsed,
            decks,
            history,
            initialDeal: this._initialDeal ?? undefined,
        };
    }
    restore(snap) {
        if (snap.version !== 2)
            return null;
        try {
            this._buildDecks();
            for (let i = 0; i < TOTAL_DECKS; i++) {
                const deckSnap = snap.decks[i];
                if (!deckSnap)
                    continue;
                for (const cs of deckSnap.cards) {
                    const card = new Card(cs.figure, cs.number);
                    if (cs.isOpen)
                        card.open();
                    else
                        card.close();
                    this._decks[i].push(card);
                }
            }
            // 무결성 검증: 카드 52장 + 중복 없음
            if (!this._validateDecks())
                return null;
            this._history = snap.history.map(h => ({
                type: h.type,
                from: h.from >= 0 ? h.from : undefined,
                to: h.to >= 0 ? h.to : undefined,
                count: h.count,
                didOpenCard: h.didOpenCard,
                wasteSnapshot: h.wasteSnapshot,
            }));
            this._moveCount = snap.moveCount;
            this._state = snap.gameState;
            this._initialDeal = snap.initialDeal ?? null;
            return snap.elapsed;
        }
        catch {
            return null;
        }
    }
    /** 전체 덱에 52장의 카드가 중복 없이 존재하는지 검증 */
    _validateDecks() {
        const seen = new Set();
        for (const deck of this._decks) {
            for (const c of deck.toArray()) {
                const key = c.figure * 100 + c.number;
                if (seen.has(key))
                    return false;
                seen.add(key);
            }
        }
        return seen.size === 52;
    }
    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────
    _isFoundation(idx) {
        return idx >= DeckIndex.Found1 && idx <= DeckIndex.Found4;
    }
    _isTableau(idx) {
        return idx >= DeckIndex.Tab1 && idx <= DeckIndex.Tab7;
    }
    /** 카드 배열이 올바른 시퀀스인지 (교대 색상 + 내림차순) */
    _isValidSequence(cards) {
        for (let i = 1; i < cards.length; i++) {
            const upper = cards[i];
            const lower = cards[i - 1];
            if (upper.color === lower.color)
                return false;
            if (upper.number !== lower.number - 1)
                return false;
        }
        return true;
    }
}
//# sourceMappingURL=solitaire.js.map