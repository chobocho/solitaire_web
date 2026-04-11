import { DeckIndex } from './deck.js';
// ─── 키 매핑 ─────────────────────────────────────────────────────────────
// 화면 배치와 일치:
//   Stock(좌):       S
//   Waste(좌2):      D
//   Foundation(우):  Q W E R
//   Tableau(하단):   1 2 3 4 5 6 7
const DECK_KEY_MAP = {
    's': DeckIndex.Stock,
    'd': DeckIndex.Waste,
    'q': DeckIndex.Found1,
    'w': DeckIndex.Found2,
    'e': DeckIndex.Found3,
    'r': DeckIndex.Found4,
    '1': DeckIndex.Tab1,
    '2': DeckIndex.Tab2,
    '3': DeckIndex.Tab3,
    '4': DeckIndex.Tab4,
    '5': DeckIndex.Tab5,
    '6': DeckIndex.Tab6,
    '7': DeckIndex.Tab7,
};
export const DECK_KEY_LABELS = {
    [DeckIndex.Stock]: 'S',
    [DeckIndex.Waste]: 'D',
    [DeckIndex.Found1]: 'Q',
    [DeckIndex.Found2]: 'W',
    [DeckIndex.Found3]: 'E',
    [DeckIndex.Found4]: 'R',
    [DeckIndex.Tab1]: '1',
    [DeckIndex.Tab2]: '2',
    [DeckIndex.Tab3]: '3',
    [DeckIndex.Tab4]: '4',
    [DeckIndex.Tab5]: '5',
    [DeckIndex.Tab6]: '6',
    [DeckIndex.Tab7]: '7',
};
// ─── InputHandler ──────────────────────────────────────────────────────────
export class InputHandler {
    constructor(canvas, game, renderer, cb) {
        this.canvas = canvas;
        this.game = game;
        this.renderer = renderer;
        this.cb = cb;
        this.drag = {
            isDragging: false,
            fromDeck: DeckIndex.Tab1,
            cards: [],
            x: 0, y: 0,
            offsetX: 0, offsetY: 0,
        };
        this.lastTapTime = 0;
        this.lastTapDeck = null;
        this._kbState = { selectedDeck: null, ctrlHeld: false };
        this._bindMouse();
        this._bindTouch();
        this._bindKeyboard();
    }
    getDragState() { return this.drag; }
    getKeyboardState() { return this._kbState; }
    // ── 마우스 ──────────────────────────────────────────────────────────────
    _bindMouse() {
        this.canvas.addEventListener('mousedown', e => {
            e.preventDefault();
            this._onPress(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mousemove', e => {
            e.preventDefault();
            this._onMove(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseup', e => {
            e.preventDefault();
            this._onRelease(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseleave', () => {
            if (this.drag.isDragging)
                this._cancelDrag();
        });
        // 더블클릭 자동 이동
        this.canvas.addEventListener('dblclick', e => {
            e.preventDefault();
            const deckIdx = this._getDeckAt(e.clientX - this.canvas.getBoundingClientRect().left, e.clientY - this.canvas.getBoundingClientRect().top);
            if (deckIdx !== null)
                this.cb.onAutoMove(deckIdx);
        });
    }
    // ── 터치 ────────────────────────────────────────────────────────────────
    _bindTouch() {
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            const pos = this._touchPos(t);
            const now = Date.now();
            const deckIdx = this._getDeckAt(pos.x, pos.y);
            if (now - this.lastTapTime < 400 && deckIdx !== null && deckIdx === this.lastTapDeck) {
                this.cb.onAutoMove(deckIdx);
                this.lastTapTime = 0;
                return;
            }
            this.lastTapTime = now;
            this.lastTapDeck = deckIdx;
            this._onPress(t.clientX, t.clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            this._onMove(t.clientX, t.clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            this._onRelease(t.clientX, t.clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', () => {
            if (this.drag.isDragging)
                this._cancelDrag();
        });
    }
    // ── 키보드 ──────────────────────────────────────────────────────────────
    _bindKeyboard() {
        window.addEventListener('keydown', e => {
            if (e.key === 'Control') {
                this._kbState.ctrlHeld = true;
                return;
            }
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const key = e.key.toLowerCase();
                if (key in DECK_KEY_MAP) {
                    e.preventDefault();
                    this._handleDeckKey(DECK_KEY_MAP[key]);
                    return;
                }
            }
            switch (e.key) {
                case 'z':
                case 'Z':
                    e.preventDefault();
                    this.cb.onUndo();
                    break;
                case 'n':
                case 'N':
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        this.cb.onNewGame();
                    }
                    break;
                case 'Enter':
                    if (this.game.state === 'play' && this._kbState.selectedDeck !== null) {
                        e.preventDefault();
                        this.cb.onAutoMove(this._kbState.selectedDeck);
                        this._kbState.selectedDeck = null;
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    this.cb.onPause();
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (this._kbState.selectedDeck !== null) {
                        this._kbState.selectedDeck = null;
                    }
                    else if (this.drag.isDragging) {
                        this._cancelDrag();
                    }
                    else {
                        this.cb.onPause();
                    }
                    break;
                case 'F1':
                    e.preventDefault();
                    this.cb.onHelp();
                    break;
            }
        });
        window.addEventListener('keyup', e => {
            if (e.key === 'Control')
                this._kbState.ctrlHeld = false;
        });
    }
    /** 덱 키 처리: 스톡은 뒤집기, 그 외는 선택→이동 */
    _handleDeckKey(deckIdx) {
        if (this.game.state !== 'play')
            return;
        // 스톡 키: 즉시 카드 뒤집기
        if (deckIdx === DeckIndex.Stock) {
            this.cb.onFlipStock();
            return;
        }
        const { selectedDeck } = this._kbState;
        if (selectedDeck === null) {
            this._kbState.selectedDeck = deckIdx;
        }
        else if (selectedDeck === deckIdx) {
            this._kbState.selectedDeck = null;
        }
        else {
            // 이동 시도
            const count = this._kbMovableCount(selectedDeck, deckIdx);
            if (count > 0) {
                this.cb.onMoveCard(selectedDeck, deckIdx, count);
            }
            this._kbState.selectedDeck = null;
        }
    }
    _kbMovableCount(from, _to) {
        if (from === DeckIndex.Waste)
            return 1;
        if (from >= DeckIndex.Found1 && from <= DeckIndex.Found4)
            return 1;
        const deck = this.game.getDeck(from);
        if (deck.isEmpty())
            return 0;
        // 태블로: 이동 가능한 시퀀스 길이
        if (from >= DeckIndex.Tab1 && from <= DeckIndex.Tab7) {
            const tabDeck = deck;
            return tabDeck.sequenceLength();
        }
        return 1;
    }
    // ── 공통 처리 ────────────────────────────────────────────────────────────
    _onPress(cx, cy) {
        if (this.game.state !== 'play')
            return;
        const rect = this.canvas.getBoundingClientRect();
        const x = cx - rect.left;
        const y = cy - rect.top;
        // 스톡 클릭: 카드 뒤집기
        const L = this.renderer.getLayout();
        const { cardW, cardH } = L;
        if (this._inRect(x, y, L.stockX, L.topRowY, cardW, cardH)) {
            this.cb.onFlipStock();
            return;
        }
        const hit = this._getCardAt(x, y);
        if (!hit)
            return;
        const { deckIdx, cardIdx } = hit;
        const deck = this.game.getDeck(deckIdx);
        // Foundation, Stock에서는 드래그 불가
        if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4)
            return;
        if (deckIdx === DeckIndex.Stock)
            return;
        // 웨이스트: 맨 위 카드만 드래그
        if (deckIdx === DeckIndex.Waste) {
            const card = deck.top();
            if (!card || !card.isOpen)
                return;
            const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);
            this.drag = {
                isDragging: true,
                fromDeck: DeckIndex.Waste,
                cards: [card],
                x, y,
                offsetX: x - cardRect.x,
                offsetY: y - cardRect.y,
            };
            this.canvas.classList.add('dragging');
            return;
        }
        // 태블로: 선택한 카드부터 맨 위까지 드래그
        const topIdx = deck.size() - 1;
        const count = topIdx - cardIdx + 1;
        const cards = deck.peekTop(count);
        if (!cards[0].isOpen)
            return;
        const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);
        this.drag = {
            isDragging: true,
            fromDeck: deckIdx,
            cards: [...cards],
            x, y,
            offsetX: x - cardRect.x,
            offsetY: y - cardRect.y,
        };
        this.canvas.classList.add('dragging');
    }
    _onMove(cx, cy) {
        if (!this.drag.isDragging)
            return;
        const rect = this.canvas.getBoundingClientRect();
        this.drag.x = cx - rect.left;
        this.drag.y = cy - rect.top;
    }
    _onRelease(cx, cy) {
        if (!this.drag.isDragging)
            return;
        const rect = this.canvas.getBoundingClientRect();
        const x = cx - rect.left;
        const y = cy - rect.top;
        const target = this._getBestDropTarget(x, y, this.drag.fromDeck);
        if (target !== null && target !== this.drag.fromDeck) {
            this.cb.onMoveCard(this.drag.fromDeck, target, this.drag.cards.length);
        }
        this._endDrag();
    }
    _cancelDrag() { this._endDrag(); }
    _endDrag() {
        this.drag.isDragging = false;
        this.drag.cards = [];
        this.canvas.classList.remove('dragging');
    }
    // ── 히트 테스트 ──────────────────────────────────────────────────────────
    _getCardAt(x, y) {
        const L = this.renderer.getLayout();
        const { cardW, cardH } = L;
        // 웨이스트 맨 위 카드
        const waste = this.game.getDeck(DeckIndex.Waste);
        if (!waste.isEmpty()) {
            const showCount = Math.min(3, waste.size());
            // 맨 위 카드 (오른쪽 오프셋이 가장 큰)
            const offset = (showCount - 1) * Math.min(18, Math.floor(cardW * 0.2));
            if (this._inRect(x, y, L.wasteX + offset, L.topRowY, cardW, cardH)) {
                return { deckIdx: DeckIndex.Waste, cardIdx: waste.size() - 1 };
            }
        }
        // 태블로 (아래→위 탐색, 위 카드 우선)
        for (let col = 6; col >= 0; col--) {
            const ti = (DeckIndex.Tab1 + col);
            const deck = this.game.getDeck(ti);
            const tx = L.tabX[col];
            if (!this._inColumnX(x, tx, cardW))
                continue;
            let yAcc = L.tableauY;
            const positions = [yAcc];
            for (let ci = 0; ci < deck.size() - 1; ci++) {
                yAcc += deck.get(ci).isOpen ? L.stackGap : L.stackGapClosed;
                positions.push(yAcc);
            }
            for (let ci = deck.size() - 1; ci >= 0; ci--) {
                const cardY = positions[ci];
                const cardBottom = ci === deck.size() - 1
                    ? cardY + cardH
                    : positions[ci + 1];
                if (y >= cardY && y <= Math.max(cardBottom, cardY + 20)) {
                    return { deckIdx: ti, cardIdx: ci };
                }
            }
        }
        return null;
    }
    _getDeckAt(x, y) {
        const L = this.renderer.getLayout();
        const { cardW, cardH } = L;
        // 스톡
        if (this._inRect(x, y, L.stockX, L.topRowY, cardW, cardH))
            return DeckIndex.Stock;
        // 웨이스트
        if (this._inRect(x, y, L.wasteX, L.topRowY, cardW, cardH))
            return DeckIndex.Waste;
        // 파운데이션
        for (let i = 0; i < 4; i++) {
            if (this._inRect(x, y, L.foundX[i], L.topRowY, cardW, cardH))
                return (DeckIndex.Found1 + i);
        }
        // 태블로
        for (let i = 0; i < 7; i++) {
            const ti = (DeckIndex.Tab1 + i);
            const bottomY = this.renderer.getDeckBottomY(ti, this.game);
            if (this._inColumnX(x, L.tabX[i], cardW) &&
                y >= L.tableauY && y <= Math.max(bottomY, L.tableauY + cardH)) {
                return ti;
            }
        }
        return null;
    }
    _getBestDropTarget(x, y, fromDeck) {
        const L = this.renderer.getLayout();
        const offsets = [
            { dx: 0, dy: 0 },
            { dx: -L.cardW * 0.3, dy: 0 },
            { dx: L.cardW * 0.3, dy: 0 },
            { dx: 0, dy: -L.stackGap * 0.5 },
        ];
        for (const { dx, dy } of offsets) {
            const target = this._getDeckAt(x + dx, y + dy);
            if (target !== null && target !== fromDeck)
                return target;
        }
        return null;
    }
    _inRect(x, y, rx, ry, w, h) {
        return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
    }
    _inColumnX(x, colX, cardW) {
        return x >= colX && x <= colX + cardW;
    }
    _touchPos(t) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
}
//# sourceMappingURL=input.js.map