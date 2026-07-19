import { DeckIndex } from './deck.js';
import { SolitaireGame } from './solitaire.js';
import { Renderer, DragState, KeyboardSelectState } from './renderer.js';

// ─── 입력 콜백 ───────────────────────────────────────────────────────────

export interface InputCallbacks {
  onNewGame():    void;
  onUndo():       void;
  onPause():      void;
  onHelp():       void;
  onFlipStock():  void;
  onMoveCard(from: DeckIndex, to: DeckIndex, count: number): boolean;
  onAutoMove(from: DeckIndex): void;
  /** Esc 처리 우선순위: 도움말/확인 팝업이 열려 있으면 닫고 true 반환 */
  onEscapeModal(): boolean;
}

export type { KeyboardSelectState } from './renderer.js';

// ─── 키 매핑 ─────────────────────────────────────────────────────────────
// 화면 배치와 일치:
//   Stock(좌):       S
//   Waste(좌2):      D
//   Foundation(우):  Q W E R
//   Tableau(하단):   1 2 3 4 5 6 7

// e.code 기반 매핑 — 한/영 IME 상태와 무관하게 물리 키 위치로 인식
const DECK_CODE_MAP: Record<string, DeckIndex> = {
  'KeyS':   DeckIndex.Stock,
  'KeyD':   DeckIndex.Waste,
  'KeyQ':   DeckIndex.Found1,
  'KeyW':   DeckIndex.Found2,
  'KeyE':   DeckIndex.Found3,
  'KeyR':   DeckIndex.Found4,
  'Digit1': DeckIndex.Tab1,
  'Digit2': DeckIndex.Tab2,
  'Digit3': DeckIndex.Tab3,
  'Digit4': DeckIndex.Tab4,
  'Digit5': DeckIndex.Tab5,
  'Digit6': DeckIndex.Tab6,
  'Digit7': DeckIndex.Tab7,
  'Numpad1': DeckIndex.Tab1,
  'Numpad2': DeckIndex.Tab2,
  'Numpad3': DeckIndex.Tab3,
  'Numpad4': DeckIndex.Tab4,
  'Numpad5': DeckIndex.Tab5,
  'Numpad6': DeckIndex.Tab6,
  'Numpad7': DeckIndex.Tab7,
};

export const DECK_KEY_LABELS: Record<number, string> = {
  [DeckIndex.Stock]:  'S',
  [DeckIndex.Waste]:  'D',
  [DeckIndex.Found1]: 'Q',
  [DeckIndex.Found2]: 'W',
  [DeckIndex.Found3]: 'E',
  [DeckIndex.Found4]: 'R',
  [DeckIndex.Tab1]:   '1',
  [DeckIndex.Tab2]:   '2',
  [DeckIndex.Tab3]:   '3',
  [DeckIndex.Tab4]:   '4',
  [DeckIndex.Tab5]:   '5',
  [DeckIndex.Tab6]:   '6',
  [DeckIndex.Tab7]:   '7',
};

// ─── InputHandler ──────────────────────────────────────────────────────────

export class InputHandler {
  private drag: DragState = {
    isDragging: false,
    fromDeck:   DeckIndex.Tab1,
    cards:      [],
    x: 0, y: 0,
    offsetX: 0, offsetY: 0,
  };

  private lastTapTime: number = 0;
  private lastTapDeck: DeckIndex | null = null;
  /** 드래그를 시작한 터치 식별자 (멀티터치 시 다른 손가락 무시용) */
  private _activeTouchId: number | null = null;

  private _kbState: KeyboardSelectState = { selectedDeck: null, ctrlHeld: false };

  constructor(
    private readonly canvas:   HTMLCanvasElement,
    private readonly game:     SolitaireGame,
    private readonly renderer: Renderer,
    private readonly cb:       InputCallbacks,
  ) {
    this._bindMouse();
    this._bindTouch();
    this._bindKeyboard();
  }

  getDragState():     DragState          { return this.drag;     }
  getKeyboardState(): KeyboardSelectState { return this._kbState; }

  // ── 마우스 ──────────────────────────────────────────────────────────────

  private _bindMouse(): void {
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
      if (this.drag.isDragging) this._cancelDrag();
    });

    // 더블클릭 자동 이동
    this.canvas.addEventListener('dblclick', e => {
      e.preventDefault();
      const deckIdx = this._getDeckAt(e.clientX - this.canvas.getBoundingClientRect().left,
                                      e.clientY - this.canvas.getBoundingClientRect().top);
      if (deckIdx !== null) this.cb.onAutoMove(deckIdx);
    });
  }

  // ── 터치 ────────────────────────────────────────────────────────────────

  private _bindTouch(): void {
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      // 이미 한 손가락으로 드래그 중이면 두 번째 손가락은 무시 (드래그 가로채기 방지)
      if (this.drag.isDragging && this._activeTouchId !== null) return;

      const t   = e.changedTouches[0];
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
      this._activeTouchId = t.identifier;
      this._onPress(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = this._findActiveTouch(e.changedTouches);
      if (!t) return;
      this._onMove(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const t = this._findActiveTouch(e.changedTouches);
      if (!t) return;
      this._onRelease(t.clientX, t.clientY);
      this._activeTouchId = null;
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', () => {
      if (this.drag.isDragging) this._cancelDrag();
      this._activeTouchId = null;
    });
  }

  /** 드래그를 시작한 손가락(identifier)에 해당하는 Touch 를 찾는다 */
  private _findActiveTouch(list: TouchList): Touch | null {
    if (this._activeTouchId === null) return list[0] ?? null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === this._activeTouchId) return list[i];
    }
    return null;
  }

  // ── 키보드 ──────────────────────────────────────────────────────────────

  private _bindKeyboard(): void {
    window.addEventListener('keydown', e => {
      if (e.key === 'Control') {
        this._kbState.ctrlHeld = true;
        return;
      }

      const code = e.code;

      if (!e.ctrlKey && !e.metaKey && !e.altKey && code in DECK_CODE_MAP) {
        e.preventDefault();
        this._handleDeckKey(DECK_CODE_MAP[code]);
        return;
      }

      switch (code) {
        case 'KeyZ':
          e.preventDefault();
          this.cb.onUndo();
          break;
        case 'KeyN':
          if (!e.ctrlKey) { e.preventDefault(); this.cb.onNewGame(); }
          break;
        case 'Enter':
        case 'NumpadEnter':
          if (this.game.state === 'play' && this._kbState.selectedDeck !== null) {
            e.preventDefault();
            this.cb.onAutoMove(this._kbState.selectedDeck);
            this._kbState.selectedDeck = null;
          }
          break;
        case 'Space':
          e.preventDefault();
          this.cb.onPause();
          break;
        case 'Escape':
          e.preventDefault();
          // 도움말/확인 팝업이 열려 있으면 먼저 닫는다
          if (this.cb.onEscapeModal()) break;
          if (this._kbState.selectedDeck !== null) {
            this._kbState.selectedDeck = null;
          } else if (this.drag.isDragging) {
            this._cancelDrag();
          } else {
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
      if (e.key === 'Control') this._kbState.ctrlHeld = false;
    });

    // 창 포커스를 잃으면 ctrlHeld 해제 (Alt+Tab 등으로 keyup이 안 오는 경우 방지)
    window.addEventListener('blur', () => {
      this._kbState.ctrlHeld = false;
    });
  }

  /** 덱 키 처리: 스톡은 뒤집기, 그 외는 선택→이동 */
  private _handleDeckKey(deckIdx: DeckIndex): void {
    if (this.game.state !== 'play') return;

    // 스톡 키: 즉시 카드 뒤집기
    if (deckIdx === DeckIndex.Stock) {
      this.cb.onFlipStock();
      return;
    }

    const { selectedDeck } = this._kbState;

    if (selectedDeck === null) {
      this._kbState.selectedDeck = deckIdx;
    } else if (selectedDeck === deckIdx) {
      this._kbState.selectedDeck = null;
    } else {
      // 이동 시도: 목적지가 수락 가능한 최대 카드 수를 찾는다
      const count = this._kbMovableCount(selectedDeck, deckIdx);
      if (count > 0) {
        this.cb.onMoveCard(selectedDeck, deckIdx, count);
      }
      this._kbState.selectedDeck = null;
    }
  }

  /**
   * from 덱에서 to 덱으로 옮길 수 있는 카드 수를 반환 (0 = 이동 불가).
   * 태블로→태블로는 전체 시퀀스부터 1장까지 줄여가며, 목적지가 수락하는
   * 가장 큰 개수를 찾는다. (예: 9-8-7 시퀀스에서 8 위로 7만 이동 가능)
   */
  private _kbMovableCount(from: DeckIndex, to: DeckIndex): number {
    const toDeck = this.game.getDeck(to);

    if (from === DeckIndex.Waste) {
      const c = this.game.getDeck(DeckIndex.Waste).top();
      return c && c.isOpen && toDeck.canAccept(c) ? 1 : 0;
    }
    if (from >= DeckIndex.Found1 && from <= DeckIndex.Found4) {
      const c = this.game.getDeck(from).top();
      return c && c.isOpen && toDeck.canAccept(c) ? 1 : 0;
    }
    if (from >= DeckIndex.Tab1 && from <= DeckIndex.Tab7) {
      const deck = this.game.getDeck(from) as import('./deck.js').TableauDeck;
      if (deck.isEmpty()) return 0;
      const seq = deck.sequenceLength();
      // 큰 개수부터 시도: 이동하는 묶음의 맨 아래 카드를 목적지가 수락해야 함
      for (let count = seq; count >= 1; count--) {
        const bottom = deck.get(deck.size() - count);
        if (!bottom.isOpen) continue;
        if (toDeck.canAccept(bottom)) return count;
      }
      return 0;
    }
    return 0;
  }

  // ── 공통 처리 ────────────────────────────────────────────────────────────

  private _onPress(cx: number, cy: number): void {
    if (this.game.state !== 'play') return;

    const rect = this.canvas.getBoundingClientRect();
    const x    = cx - rect.left;
    const y    = cy - rect.top;

    // 스톡 클릭: 카드 뒤집기
    const L = this.renderer.getLayout();
    const { cardW, cardH } = L;
    if (this._inRect(x, y, L.stockX, L.topRowY, cardW, cardH)) {
      this.cb.onFlipStock();
      return;
    }

    const hit = this._getCardAt(x, y);
    if (!hit) return;

    const { deckIdx, cardIdx } = hit;
    const deck = this.game.getDeck(deckIdx);

    // Stock에서는 드래그 불가
    if (deckIdx === DeckIndex.Stock) return;

    // 웨이스트: 맨 위 카드만 드래그
    if (deckIdx === DeckIndex.Waste) {
      const card = deck.top();
      if (!card || !card.isOpen) return;
      const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);
      this.drag = {
        isDragging: true,
        fromDeck:   DeckIndex.Waste,
        cards:      [card],
        x, y,
        offsetX: x - cardRect.x,
        offsetY: y - cardRect.y,
      };
      this.canvas.classList.add('dragging');
      return;
    }

    // Foundation: 맨 위 카드만 드래그
    if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4) {
      const card = deck.top();
      if (!card || !card.isOpen) return;
      const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);
      this.drag = {
        isDragging: true,
        fromDeck:   deckIdx,
        cards:      [card],
        x, y,
        offsetX: x - cardRect.x,
        offsetY: y - cardRect.y,
      };
      this.canvas.classList.add('dragging');
      return;
    }

    // 태블로: 선택한 카드부터 맨 위까지 드래그
    const topIdx   = deck.size() - 1;
    const count    = topIdx - cardIdx + 1;
    const cards    = deck.peekTop(count);

    if (!cards[0].isOpen) return;

    const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);

    this.drag = {
      isDragging: true,
      fromDeck:   deckIdx,
      cards:      [...cards],
      x, y,
      offsetX: x - cardRect.x,
      offsetY: y - cardRect.y,
    };
    this.canvas.classList.add('dragging');
  }

  private _onMove(cx: number, cy: number): void {
    if (!this.drag.isDragging) return;
    const rect  = this.canvas.getBoundingClientRect();
    this.drag.x = cx - rect.left;
    this.drag.y = cy - rect.top;
  }

  private _onRelease(cx: number, cy: number): void {
    if (!this.drag.isDragging) return;

    const rect   = this.canvas.getBoundingClientRect();
    const x      = cx - rect.left;
    const y      = cy - rect.top;

    const target = this._getBestDropTarget(x, y, this.drag.fromDeck);
    if (target !== null && target !== this.drag.fromDeck) {
      this.cb.onMoveCard(this.drag.fromDeck, target, this.drag.cards.length);
    }
    this._endDrag();
  }

  private _cancelDrag(): void { this._endDrag(); }

  private _endDrag(): void {
    this.drag.isDragging = false;
    this.drag.cards = [];
    this.canvas.classList.remove('dragging');
  }

  // ── 히트 테스트 ──────────────────────────────────────────────────────────

  private _getCardAt(x: number, y: number): { deckIdx: DeckIndex; cardIdx: number } | null {
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

    // Foundation 맨 위 카드
    for (let i = 0; i < 4; i++) {
      const fi   = (DeckIndex.Found1 + i) as DeckIndex;
      const deck = this.game.getDeck(fi);
      if (!deck.isEmpty() && this._inRect(x, y, L.foundX[i], L.topRowY, cardW, cardH)) {
        return { deckIdx: fi, cardIdx: deck.size() - 1 };
      }
    }

    // 태블로 (아래→위 탐색, 위 카드 우선)
    for (let col = 6; col >= 0; col--) {
      const ti   = (DeckIndex.Tab1 + col) as DeckIndex;
      const deck = this.game.getDeck(ti);
      const tx   = L.tabX[col];
      if (!this._inColumnX(x, tx, cardW)) continue;

      let yAcc = L.tableauY;
      const positions: number[] = [yAcc];
      for (let ci = 0; ci < deck.size() - 1; ci++) {
        yAcc += deck.get(ci).isOpen ? L.stackGap : L.stackGapClosed;
        positions.push(yAcc);
      }

      for (let ci = deck.size() - 1; ci >= 0; ci--) {
        const cardY      = positions[ci];
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

  private _getDeckAt(x: number, y: number): DeckIndex | null {
    const L = this.renderer.getLayout();
    const { cardW, cardH } = L;

    // 스톡
    if (this._inRect(x, y, L.stockX, L.topRowY, cardW, cardH)) return DeckIndex.Stock;
    // 웨이스트 — 맨 위 카드는 최대 (showCount-1)*offset 만큼 우측으로 그려지므로
    // 히트 영역을 그 오프셋만큼 넓힌다 (버그 6)
    {
      const waste = this.game.getDeck(DeckIndex.Waste);
      const showCount = Math.min(3, waste.size());
      const off = Math.max(0, showCount - 1) * Math.min(18, Math.floor(cardW * 0.2));
      if (this._inRect(x, y, L.wasteX, L.topRowY, cardW + off, cardH)) return DeckIndex.Waste;
    }
    // 파운데이션
    for (let i = 0; i < 4; i++) {
      if (this._inRect(x, y, L.foundX[i], L.topRowY, cardW, cardH))
        return (DeckIndex.Found1 + i) as DeckIndex;
    }
    // 태블로
    for (let i = 0; i < 7; i++) {
      const ti      = (DeckIndex.Tab1 + i) as DeckIndex;
      const bottomY = this.renderer.getDeckBottomY(ti, this.game);
      if (this._inColumnX(x, L.tabX[i], cardW) &&
          y >= L.tableauY && y <= Math.max(bottomY, L.tableauY + cardH)) {
        return ti;
      }
    }
    return null;
  }

  private _getBestDropTarget(x: number, y: number, fromDeck: DeckIndex): DeckIndex | null {
    const L = this.renderer.getLayout();
    const offsets = [
      { dx: 0,                dy: 0 },
      { dx: -L.cardW * 0.3,  dy: 0 },
      { dx:  L.cardW * 0.3,  dy: 0 },
      { dx: 0,                dy: -L.stackGap * 0.5 },
    ];
    for (const { dx, dy } of offsets) {
      const target = this._getDeckAt(x + dx, y + dy);
      if (target !== null && target !== fromDeck) return target;
    }
    return null;
  }

  private _inRect(x: number, y: number, rx: number, ry: number, w: number, h: number): boolean {
    return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
  }

  private _inColumnX(x: number, colX: number, cardW: number): boolean {
    return x >= colX && x <= colX + cardW;
  }

  private _touchPos(t: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
}
