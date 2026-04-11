import { Card, Figure, CardNumber } from './card.js';
// ─── 덱 인덱스 상수 ─────────────────────────────────────────────────────────
// SolitaireGame.decks[] 배열 내 각 덱의 인덱스
// Android 원본과 대응:
//   Stock    = PLAY_DECK       (0)
//   Found1~4 = RESULT_DECK_1~4 (1~4)
//   Tab1~7   = BOARD_DECK_1~7  (5~11)
//   Waste    = OPENED_CARD_DECK (12)
export var DeckIndex;
(function (DeckIndex) {
    DeckIndex[DeckIndex["Stock"] = 0] = "Stock";
    DeckIndex[DeckIndex["Found1"] = 1] = "Found1";
    DeckIndex[DeckIndex["Found2"] = 2] = "Found2";
    DeckIndex[DeckIndex["Found3"] = 3] = "Found3";
    DeckIndex[DeckIndex["Found4"] = 4] = "Found4";
    DeckIndex[DeckIndex["Tab1"] = 5] = "Tab1";
    DeckIndex[DeckIndex["Tab2"] = 6] = "Tab2";
    DeckIndex[DeckIndex["Tab3"] = 7] = "Tab3";
    DeckIndex[DeckIndex["Tab4"] = 8] = "Tab4";
    DeckIndex[DeckIndex["Tab5"] = 9] = "Tab5";
    DeckIndex[DeckIndex["Tab6"] = 10] = "Tab6";
    DeckIndex[DeckIndex["Tab7"] = 11] = "Tab7";
    DeckIndex[DeckIndex["Waste"] = 12] = "Waste";
})(DeckIndex || (DeckIndex = {}));
export const TOTAL_DECKS = 13;
// ─── 기본 Deck 클래스 ────────────────────────────────────────────────────────
export class Deck {
    constructor() {
        this._cards = [];
    }
    size() { return this._cards.length; }
    isEmpty() { return this._cards.length === 0; }
    /** 인덱스로 카드 접근 (0 = 바닥, size-1 = 맨 위) */
    get(index) { return this._cards[index]; }
    top() {
        return this._cards.length > 0 ? this._cards[this._cards.length - 1] : null;
    }
    clear() { this._cards = []; }
    push(card) { this._cards.push(card); }
    pop() {
        return this._cards.length > 0 ? this._cards.pop() : null;
    }
    peekTop(n) {
        return this._cards.slice(this._cards.length - n);
    }
    popMany(n) {
        if (n > this._cards.length)
            return [];
        return this._cards.splice(this._cards.length - n, n);
    }
    pushMany(cards) {
        for (const card of cards)
            this._cards.push(card);
    }
    toArray() { return [...this._cards]; }
}
// ─── InitDeck: 52장 셔플 덱 ──────────────────────────────────────────────────
export class InitDeck extends Deck {
    constructor() {
        super();
        this._createAndShuffle();
    }
    _createAndShuffle() {
        this._cards = [];
        const figures = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
        for (const fig of figures) {
            for (let num = CardNumber.Ace; num <= CardNumber.King; num++) {
                const card = new Card(fig, num);
                card.close();
                this._cards.push(card);
            }
        }
        this._shuffle();
    }
    _shuffle() {
        for (let i = this._cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
        }
    }
    canAccept(_card) { return false; }
}
// ─── FoundationDeck: 완성 덱 (같은 무늬 A→K) ────────────────────────────────
export class FoundationDeck extends Deck {
    constructor(figure) {
        super();
        this._figure = figure;
    }
    get figure() { return this._figure; }
    canAccept(card) {
        if (card.figure !== this._figure)
            return false;
        if (this.isEmpty())
            return card.number === CardNumber.Ace;
        return card.number === this.top().number + 1;
    }
    isComplete() { return this._cards.length === 13; }
}
// ─── TableauDeck: 태블로 컬럼 ────────────────────────────────────────────────
export class TableauDeck extends Deck {
    /**
     * 규칙:
     * - 빈 컬럼: 킹(King)만 허용
     * - 맨 위가 열린 카드: 교대 색상 + 숫자 1 감소
     */
    canAccept(card) {
        if (!card.isOpen)
            return false;
        if (this.isEmpty())
            return card.number === CardNumber.King;
        const topCard = this.top();
        if (!topCard.isOpen)
            return false;
        return (topCard.color !== card.color) && (card.number === topCard.number - 1);
    }
    /** 맨 위 카드 제거 후 아래 카드 자동 오픈 */
    pop() {
        if (this.isEmpty())
            return null;
        const card = this._cards.pop();
        if (!this.isEmpty() && !this.top().isOpen) {
            this.top().open();
        }
        return card;
    }
    popMany(n) {
        if (n > this._cards.length)
            return [];
        const removed = this._cards.splice(this._cards.length - n, n);
        if (!this.isEmpty() && !this.top().isOpen) {
            this.top().open();
        }
        return removed;
    }
    /** 맨 위에서 이어진 올바른 시퀀스 길이 */
    sequenceLength() {
        if (this.isEmpty())
            return 0;
        let count = 1;
        for (let i = this._cards.length - 1; i > 0; i--) {
            const upper = this._cards[i];
            const lower = this._cards[i - 1];
            if (!upper.isOpen || !lower.isOpen)
                break;
            if (upper.color === lower.color)
                break;
            if (upper.number !== lower.number - 1)
                break;
            count++;
        }
        return count;
    }
}
// ─── StockDeck: 스톡 파일 (뒤집혀있는 덱) ────────────────────────────────────
export class StockDeck extends Deck {
    canAccept(_card) { return false; }
    /** 스톡 클릭 시 맨 위 카드를 face-up으로 반환 (팝하지 않음) */
    drawCard() {
        if (this.isEmpty())
            return null;
        return this._cards.pop();
    }
    /** 웨이스트의 카드를 다시 뒤집어서 스톡으로 복원 */
    refillFrom(waste) {
        const cards = waste.takeAll();
        // 역순으로 쌓기 (웨이스트 맨 위가 스톡 맨 위가 되지 않도록)
        for (let i = cards.length - 1; i >= 0; i--) {
            cards[i].close();
            this._cards.push(cards[i]);
        }
    }
}
// ─── WasteDeck: 웨이스트 파일 (펼쳐진 카드들) ───────────────────────────────
export class WasteDeck extends Deck {
    /** 맨 위 카드만 이동 가능 */
    canAccept(_card) { return false; }
    /** 카드 추가 (스톡에서 뒤집을 때) */
    addCard(card) {
        card.open();
        this._cards.push(card);
    }
    /** 모든 카드 가져가기 (스톡 재충전 시) */
    takeAll() {
        const cards = [...this._cards];
        this._cards = [];
        return cards;
    }
}
//# sourceMappingURL=deck.js.map