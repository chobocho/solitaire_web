import { Card } from './card.js';
import { DeckIndex, TableauDeck, FoundationDeck, StockDeck, WasteDeck } from './deck.js';
import { SolitaireGame } from './solitaire.js';

// ─── 타입 정의 ────────────────────────────────────────────────────────────

export interface DragState {
  isDragging: boolean;
  fromDeck:   DeckIndex;
  cards:      Card[];
  x: number; y: number;
  offsetX: number; offsetY: number;
}

export interface KeyboardSelectState {
  selectedDeck: DeckIndex | null;
  ctrlHeld:     boolean;
}

export interface CardRect {
  x: number; y: number;
  w: number; h: number;
}

// ─── 레이아웃 ─────────────────────────────────────────────────────────────

export interface BoardLayout {
  cardW: number;
  cardH: number;
  padX:  number;
  padY:  number;
  colGap: number;
  stackGap: number;
  stackGapClosed: number;
  topRowY:    number;
  tableauY:   number;
  stockX:     number;
  wasteX:     number;
  foundX:     number[];
  tabX:       number[];
}

export function calcLayout(canvasW: number, canvasH: number): BoardLayout {
  const padX   = Math.max(6, canvasW * 0.015);
  const padY   = Math.max(6, canvasH * 0.02);
  const colGap = Math.max(4, canvasW * 0.008);

  // 7컬럼 기준 카드 폭 계산
  const totalColW = canvasW - padX * 2;
  const cardW = Math.min(110, Math.max(36, Math.floor((totalColW - colGap * 6) / 7)));
  const cardH = Math.floor(cardW * 1.4);

  const stackGap       = Math.max(16, Math.floor(cardH * 0.28));
  const stackGapClosed = Math.max(6,  Math.floor(cardH * 0.12));

  // 7컬럼을 화면 중앙 정렬
  const totalTabW = cardW * 7 + colGap * 6;
  const startX    = Math.floor((canvasW - totalTabW) / 2);

  const tabX: number[] = [];
  for (let i = 0; i < 7; i++) tabX.push(startX + i * (cardW + colGap));

  // 상단: 스톡(0), 웨이스트(1), 공백, Foundation(3~6)
  const stockX  = tabX[0];
  const wasteX  = tabX[1];
  const foundX  = [tabX[3], tabX[4], tabX[5], tabX[6]];

  const topRowY  = padY;
  const tableauY = topRowY + cardH + padY + 6;

  return {
    cardW, cardH, padX, padY, colGap,
    stackGap, stackGapClosed,
    topRowY, tableauY,
    stockX, wasteX, foundX, tabX,
  };
}

// ─── 이미지 로더 ──────────────────────────────────────────────────────────

export type ImageMap = Map<string, HTMLImageElement>;

export async function loadImages(baseUrl: string = 'img/'): Promise<ImageMap> {
  const figPfx = ['c', 'd', 'h', 's'];
  const numSfx = ['a','2','3','4','5','6','7','8','9','10','j','q','k'];
  const cardNames: string[] = [];
  for (const f of figPfx)
    for (const n of numSfx)
      cardNames.push(f + n);

  const extras = ['abg', 'bg', 'none'];
  const allNames = [...cardNames, ...extras];

  const map: ImageMap = new Map();
  const promises = allNames.map(name =>
    new Promise<void>(resolve => {
      const img = new Image();
      img.onload  = () => { map.set(name, img); resolve(); };
      img.onerror = () => resolve();
      img.src = baseUrl + name + '.png';
    })
  );
  await Promise.all(promises);
  return map;
}

// ─── Renderer ─────────────────────────────────────────────────────────────

export class Renderer {
  private ctx:    CanvasRenderingContext2D;
  private images: ImageMap = new Map();
  private layout: BoardLayout;
  private _winAnimCards:  WinAnimCard[]  = [];
  private _failAnimCards: FailAnimCard[] = [];
  private _animActive: boolean = false;
  /** 현재 이펙트로 날아가는 중인 덱들 — 보드에는 그리지 않아 이중 표시 방지 */
  private _animDecks: Set<number> = new Set();
  /** 프레임레이트 독립 애니메이션용 이전 프레임 타임스탬프(ms) */
  private _lastFrameTime: number = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx    = canvas.getContext('2d')!;
    this.layout = calcLayout(canvas.clientWidth, canvas.clientHeight);
  }

  async init(): Promise<void> {
    this.images = await loadImages('img/');
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w   = this.canvas.clientWidth;
    const h   = this.canvas.clientHeight;
    this.canvas.width  = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.scale(dpr, dpr);
    this.layout = calcLayout(w, h);
  }

  getLayout(): BoardLayout { return this.layout; }

  // ─── 메인 렌더 ────────────────────────────────────────────────────────

  render(
    game:  SolitaireGame,
    drag:  DragState,
    _elapsed: number,
    kbState: KeyboardSelectState,
  ): void {
    const { ctx } = this;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;

    // 배경
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1b5e20';
    ctx.fillRect(0, 0, W, H);

    this._drawBoard(game, drag, kbState);

    // 드래그 중인 카드
    if (drag.isDragging) {
      this._drawDragCards(drag);
    }

    // Ctrl 키 힌트 오버레이
    if (kbState.ctrlHeld) {
      this._drawKeyOverlay(game);
    }

    // 애니메이션 (프레임레이트 독립: 실제 경과 시간 dt 사용)
    if (this._animActive) {
      const now = performance.now();
      let dt = this._lastFrameTime ? (now - this._lastFrameTime) / 1000 : 1 / 60;
      this._lastFrameTime = now;
      // 탭 비활성화 등으로 프레임이 크게 벌어지면 클램프 (물리 폭주 방지)
      if (dt > 0.05) dt = 0.05;
      if (this._winAnimCards.length > 0)  this._stepWinAnim(dt);
      if (this._failAnimCards.length > 0) this._stepFailAnim(dt);
    } else {
      this._lastFrameTime = 0;
    }
  }

  private _drawBoard(game: SolitaireGame, drag: DragState, kbState: KeyboardSelectState): void {
    const L = this.layout;
    const { cardW, cardH } = L;

    // ── 스톡 ──────────────────────────────────────────────────────────
    this._drawSlotBackground(L.stockX, L.topRowY, cardW, cardH, '↩');
    const stock = game.getDeck(DeckIndex.Stock) as StockDeck;
    if (this._isDeckAnimating(DeckIndex.Stock)) {
      // 이펙트 중: 카드는 애니메이션으로만 표시 (슬롯 배경만 유지)
    } else if (!stock.isEmpty()) {
      // 뒤집힌 카드 더미 표시 (최대 3장 겹쳐 보이게)
      const depth = Math.min(3, stock.size());
      for (let i = depth - 1; i >= 0; i--) {
        this._drawCardBack(L.stockX + i * 2, L.topRowY - i * 2, cardW, cardH);
      }
    } else {
      // 비었으면 재시도 아이콘
      this._drawEmptySlot(L.stockX, L.topRowY, cardW, cardH, '♻');
    }

    // ── 웨이스트 ──────────────────────────────────────────────────────
    this._drawSlotBackground(L.wasteX, L.topRowY, cardW, cardH, '');
    const waste = game.getDeck(DeckIndex.Waste) as WasteDeck;
    if (!waste.isEmpty() && !this._isDeckAnimating(DeckIndex.Waste)) {
      // 맨 위 3장을 살짝 겹쳐 보이게
      const showCount = Math.min(3, waste.size());
      for (let i = 0; i < showCount; i++) {
        const cardIdx = waste.size() - showCount + i;
        const offset  = i * Math.min(18, Math.floor(cardW * 0.2));
        const card    = waste.get(cardIdx);
        const isDragTop = drag.isDragging && drag.fromDeck === DeckIndex.Waste && i === showCount - 1;
        if (!isDragTop) {
          this._drawCard(card, L.wasteX + offset, L.topRowY, true);
        }
      }
    }

    // ── 파운데이션 ────────────────────────────────────────────────────
    const foundLabels = ['♣', '♦', '♥', '♠'];
    for (let i = 0; i < 4; i++) {
      const fi = (DeckIndex.Found1 + i) as DeckIndex;
      const fx = L.foundX[i];
      this._drawSlotBackground(fx, L.topRowY, cardW, cardH, foundLabels[i]);
      const deck = game.getDeck(fi) as FoundationDeck;
      if (!deck.isEmpty() && !this._isDeckAnimating(fi)) {
        this._drawCard(deck.top()!, fx, L.topRowY, true);
      }
      if (kbState.selectedDeck === fi) {
        this._drawSelectHighlight(fx, L.topRowY, cardW, cardH);
      }
    }

    // ── 태블로 ────────────────────────────────────────────────────────
    for (let col = 0; col < 7; col++) {
      const ti = (DeckIndex.Tab1 + col) as DeckIndex;
      const tx = L.tabX[col];
      this._drawSlotBackground(tx, L.tableauY, cardW, cardH, '');

      const deck = game.getDeck(ti) as TableauDeck;
      // 이펙트 중인 태블로 열은 카드 생략 (애니메이션 카드와 이중 표시 방지)
      if (!this._isDeckAnimating(ti)) {
        let y = L.tableauY;
        for (let ci = 0; ci < deck.size(); ci++) {
          const card = deck.get(ci);
          const isDragCard = drag.isDragging && drag.fromDeck === ti &&
                             ci >= deck.size() - drag.cards.length;
          if (!isDragCard) {
            this._drawCard(card, tx, y, card.isOpen);
          } else {
            // 드래그 중인 자리는 투명하게
            this.ctx.save();
            this.ctx.globalAlpha = 0.25;
            this._drawCard(card, tx, y, card.isOpen);
            this.ctx.restore();
          }
          y += card.isOpen ? L.stackGap : L.stackGapClosed;
        }
      }

      if (kbState.selectedDeck === ti) {
        const h = Math.max(cardH, this.getDeckBottomY(ti, game) - L.tableauY);
        this._drawSelectHighlight(tx, L.tableauY, cardW, h);
      }
    }

    // 웨이스트 선택 하이라이트
    if (kbState.selectedDeck === DeckIndex.Waste) {
      this._drawSelectHighlight(L.wasteX, L.topRowY, cardW, cardH);
    }
  }

  private _isDeckAnimating(di: DeckIndex): boolean {
    return this._animActive && this._animDecks.has(di);
  }

  private _drawDragCards(drag: DragState): void {
    const L = this.layout;
    let y = drag.y - drag.offsetY;
    const x = drag.x - drag.offsetX;
    for (const card of drag.cards) {
      this._drawCard(card, x, y, true);
      y += L.stackGap;
    }
  }

  // ─── 카드 그리기 ──────────────────────────────────────────────────────

  private _drawCard(card: Card, x: number, y: number, open: boolean): void {
    const { cardW, cardH } = this.layout;
    const imgName = open ? card.imageName : 'abg';
    const img = this.images.get(imgName);
    if (img) {
      this.ctx.drawImage(img, x, y, cardW, cardH);
    } else {
      // 이미지 없으면 컬러 사각형으로 대체
      this.ctx.fillStyle = open ? '#fff' : '#1565c0';
      this._fillRoundRect(x, y, cardW, cardH, 6);
      if (open) {
        this.ctx.fillStyle = card.color === 'red' ? '#c62828' : '#212121';
        this.ctx.font = `bold ${Math.floor(cardH * 0.25)}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(card.imageName, x + cardW / 2, y + cardH / 2);
      }
    }
    // 카드 테두리
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this._roundRect(x, y, cardW, cardH, 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private _drawCardBack(x: number, y: number, w: number, h: number): void {
    const img = this.images.get('abg');
    if (img) {
      this.ctx.drawImage(img, x, y, w, h);
    } else {
      this.ctx.fillStyle = '#1565c0';
      this._fillRoundRect(x, y, w, h, 6);
    }
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this._roundRect(x, y, w, h, 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private _drawSlotBackground(x: number, y: number, w: number, h: number, label: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 2;
    ctx.fillStyle   = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    this._roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    if (label) {
      ctx.fillStyle    = 'rgba(255,255,255,0.3)';
      ctx.font         = `bold ${Math.floor(h * 0.35)}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
    }
    ctx.restore();
  }

  private _drawEmptySlot(x: number, y: number, w: number, h: number, label: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.fillStyle   = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    this._roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle    = 'rgba(255,255,255,0.45)';
      ctx.font         = `bold ${Math.floor(h * 0.4)}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
    }
    ctx.restore();
  }

  private _drawSelectHighlight(x: number, y: number, w: number, h: number): void {
    const { ctx } = this;
    const pad = 4;
    ctx.save();
    ctx.shadowColor  = '#ffd700';
    ctx.shadowBlur   = 16;
    ctx.strokeStyle  = '#ffd700';
    ctx.lineWidth    = 3;
    ctx.beginPath();
    this._roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 10);
    ctx.stroke();
    ctx.globalAlpha  = 0.12;
    ctx.fillStyle    = '#ffd700';
    ctx.fill();
    ctx.restore();
  }

  // ─── 카드 위치 계산 ────────────────────────────────────────────────────

  /** 덱의 특정 카드 인덱스에 대한 화면 좌표 반환 */
  getCardRect(deckIdx: DeckIndex, cardIdx: number, game: SolitaireGame): CardRect {
    const L = this.layout;
    const { cardW, cardH } = L;

    if (deckIdx === DeckIndex.Stock) {
      return { x: L.stockX, y: L.topRowY, w: cardW, h: cardH };
    }
    if (deckIdx === DeckIndex.Waste) {
      const waste = game.getDeck(DeckIndex.Waste);
      const showCount = Math.min(3, waste.size());
      const relIdx = cardIdx - (waste.size() - showCount);
      const offset  = relIdx * Math.min(18, Math.floor(cardW * 0.2));
      return { x: L.wasteX + Math.max(0, offset), y: L.topRowY, w: cardW, h: cardH };
    }
    if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4) {
      const col = deckIdx - DeckIndex.Found1;
      return { x: L.foundX[col], y: L.topRowY, w: cardW, h: cardH };
    }
    // Tableau
    const col  = deckIdx - DeckIndex.Tab1;
    const deck = game.getDeck(deckIdx);
    let y = L.tableauY;
    for (let i = 0; i < cardIdx; i++) {
      y += deck.get(i).isOpen ? L.stackGap : L.stackGapClosed;
    }
    return { x: L.tabX[col], y, w: cardW, h: cardH };
  }

  /** 태블로 덱의 맨 아래 Y 좌표 */
  getDeckBottomY(deckIdx: DeckIndex, game: SolitaireGame): number {
    const L = this.layout;
    const { cardH } = L;
    if (deckIdx < DeckIndex.Tab1 || deckIdx > DeckIndex.Tab7) return L.tableauY + cardH;

    const deck = game.getDeck(deckIdx);
    let y = L.tableauY;
    for (let i = 0; i < deck.size() - 1; i++) {
      y += deck.get(i).isOpen ? L.stackGap : L.stackGapClosed;
    }
    return y + cardH;
  }

  // ─── Ctrl 키 오버레이 ──────────────────────────────────────────────────

  private _drawKeyOverlay(game: SolitaireGame): void {
    const { ctx } = this;
    const { cardW, cardH } = this.layout;
    const L = this.layout;

    // 전체 반투명 다크 오버레이
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.restore();

    const badgeSize = Math.max(18, Math.floor(cardW * 0.32));
    const fontSize  = Math.max(11, Math.floor(badgeSize * 0.6));

    const drawBadge = (key: string, x: number, y: number, w: number, h: number) => {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const bw = badgeSize * 1.8;
      const bh = badgeSize * 1.4;
      const bx = cx - bw / 2;
      const by = cy - bh / 2;

      ctx.save();
      ctx.beginPath();
      this._roundRect(bx, by, bw, bh, 6);
      ctx.fillStyle   = 'rgba(20,20,20,0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,80,0.9)';
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.fillStyle    = '#ffd740';
      ctx.font         = `bold ${fontSize}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, cx, cy);
      ctx.restore();
    };

    // 스톡
    drawBadge('S', L.stockX, L.topRowY, cardW, cardH);
    // 웨이스트
    drawBadge('D', L.wasteX, L.topRowY, cardW, cardH);
    // 파운데이션
    const fKeys = ['Q', 'W', 'E', 'R'];
    for (let i = 0; i < 4; i++) {
      drawBadge(fKeys[i], L.foundX[i], L.topRowY, cardW, cardH);
    }
    // 태블로
    for (let i = 0; i < 7; i++) {
      const h = Math.max(cardH, this.getDeckBottomY((DeckIndex.Tab1 + i) as DeckIndex, game) - L.tableauY);
      drawBadge(String(i + 1), L.tabX[i], L.tableauY, cardW, h);
    }

    this._drawKeyLegend();
  }

  private _drawKeyLegend(): void {
    const { ctx } = this;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;

    const text = 'S=스톡  D=웨이스트  Q W E R=파운데이션  1~7=태블로  Enter=자동이동';
    const pad  = 10;
    const fh   = Math.max(11, Math.min(14, Math.floor(W / 55)));

    ctx.save();
    ctx.font = `${fh}px monospace`;
    const tw = ctx.measureText(text).width;
    const bx = (W - tw) / 2 - pad;
    const by = H - fh - pad * 2 - 8;
    const bw = tw + pad * 2;
    const bh = fh + pad * 2;

    ctx.fillStyle = 'rgba(10,10,10,0.82)';
    ctx.beginPath();
    this._roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,80,0.5)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillStyle    = '#ffd740';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, by + bh / 2);
    ctx.restore();
  }

  // ─── 승리 이펙트 ──────────────────────────────────────────────────────

  startWinEffect(game: SolitaireGame): void {
    this._winAnimCards = [];
    const { cardW, cardH } = this.layout;

    for (let di = DeckIndex.Found1; di <= DeckIndex.Found4; di++) {
      this._animDecks.add(di);
      const deck = game.getDeck(di);
      for (let ci = 0; ci < deck.size(); ci++) {
        const rect  = this.getCardRect(di as DeckIndex, ci, game);
        const delay = Math.random() * 0.8;
        this._winAnimCards.push({
          card: deck.get(ci),
          x: rect.x, y: rect.y,
          vx: (Math.random() - 0.5) * 10,
          vy: -(Math.random() * 12 + 4),
          angle: 0,
          vAngle: (Math.random() - 0.5) * 0.25,
          alpha: 1,
          delay, elapsed: 0,
          w: cardW, h: cardH,
        });
      }
    }
    this._animActive = true;
  }

  private _stepWinAnim(dt: number): void {
    const { ctx } = this;
    const H = this.canvas.clientHeight;
    const G = 0.4;
    const k = dt * 60; // 60fps 기준 물리 스텝 스케일

    for (const c of this._winAnimCards) {
      c.elapsed += dt;
      if (c.elapsed < c.delay) continue;

      c.vy    += G * k;
      c.x     += c.vx * k;
      c.y     += c.vy * k;
      c.angle += c.vAngle * k;

      if (c.y > H + 50) { c.alpha = 0; continue; }
      if (c.y > H * 0.7) c.alpha = Math.max(0, 1 - (c.y - H * 0.7) / (H * 0.3));

      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(c.angle);
      this._drawCard(c.card, -c.w / 2, -c.h / 2, true);
      ctx.restore();
    }

    if (this._winAnimCards.every(c => c.alpha <= 0)) {
      this._winAnimCards = [];
      if (this._failAnimCards.length === 0) this._endAnim();
    }
  }

  // ─── 패배 이펙트 (바람에 흩날리며 불타기) ────────────────────────────────

  startFailEffect(game: SolitaireGame): void {
    this._failAnimCards = [];
    const { cardW, cardH } = this.layout;

    for (let di = DeckIndex.Tab1; di <= DeckIndex.Tab7; di++) {
      this._animDecks.add(di);
      const deck = game.getDeck(di);
      for (let ci = 0; ci < deck.size(); ci++) {
        const rect = this.getCardRect(di as DeckIndex, ci, game);
        this._failAnimCards.push({
          card: deck.get(ci),
          x: rect.x, y: rect.y,
          vx: (Math.random() - 0.3) * 6 + 2,
          vy: (Math.random() - 0.5) * 4,
          angle: 0,
          vAngle: (Math.random() - 0.5) * 0.15,
          alpha: 1,
          delay: Math.random() * 1.5,
          elapsed: 0,
          w: cardW, h: cardH,
          scaleY: 1,
          firePhase: Math.random() * Math.PI * 2,
        });
      }
    }
    this._animActive = true;
  }

  private _stepFailAnim(dt: number): void {
    const { ctx } = this;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const k = dt * 60; // 60fps 기준 물리 스텝 스케일

    for (const c of this._failAnimCards) {
      c.elapsed += dt;
      if (c.elapsed < c.delay) continue;

      c.vx    *= Math.pow(0.99, k);
      c.vy    += 0.15 * k;
      c.x     += c.vx * k;
      c.y     += c.vy * k;
      c.angle += c.vAngle * k;
      c.firePhase += 0.1 * k;

      if (c.x > W + 100 || c.x < -100 || c.y > H + 100) {
        c.alpha = 0; continue;
      }
      c.alpha = Math.max(0, c.alpha - 0.008 * k);

      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(c.angle);

      const wobble = Math.sin(c.firePhase) * 2;
      this._drawCard(c.card, -c.w / 2 + wobble, -c.h / 2, c.card.isOpen);

      if (c.alpha > 0.3) {
        this._drawFire(0, -c.h / 2, c.w, c.firePhase);
      }
      ctx.restore();
    }

    if (this._failAnimCards.every(c => c.alpha <= 0)) {
      this._failAnimCards = [];
      if (this._winAnimCards.length === 0) this._endAnim();
      if (this._restartOnComplete) {
        const cb = this._restartOnComplete;
        this._restartOnComplete = null;
        cb();
      }
    }
  }

  /** 이펙트 종료: 상태·애니메이션 덱 목록 초기화 */
  private _endAnim(): void {
    this._animActive = false;
    this._animDecks.clear();
    this._lastFrameTime = 0;
  }

  private _drawFire(cx: number, cy: number, w: number, _phase: number): void {
    const { ctx } = this;
    const fireColors = ['#ff6f00', '#ff8f00', '#ffca28', '#fff176'];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const px = cx + (Math.random() - 0.5) * w;
      const py = cy - Math.random() * 15;
      const r  = Math.random() * 4 + 2;
      const col = fireColors[Math.floor(Math.random() * fireColors.length)];
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }
  }

  // ─── 다시 하기 이펙트 (전체 카드 불타며 날아가기) ───────────────────────

  /**
   * 모든 덱의 카드를 강한 불꽃+바람으로 날려 보낸 뒤 onComplete 호출
   */
  startRestartEffect(game: SolitaireGame, onComplete: () => void): void {
    this._failAnimCards = [];
    const { cardW, cardH } = this.layout;

    // 모든 덱 수집 순서: Stock → Waste → Foundation → Tableau
    const deckOrder: DeckIndex[] = [
      DeckIndex.Stock, DeckIndex.Waste,
      DeckIndex.Found1, DeckIndex.Found2, DeckIndex.Found3, DeckIndex.Found4,
      DeckIndex.Tab1, DeckIndex.Tab2, DeckIndex.Tab3, DeckIndex.Tab4,
      DeckIndex.Tab5, DeckIndex.Tab6, DeckIndex.Tab7,
    ];

    for (const di of deckOrder) {
      this._animDecks.add(di);
      const deck = game.getDeck(di);
      for (let ci = 0; ci < deck.size(); ci++) {
        const rect  = this.getCardRect(di, ci, game);
        // 화면 중앙에서의 방향 벡터로 바깥쪽으로 날려 보냄
        const cx    = this.canvas.clientWidth  / 2;
        const cy    = this.canvas.clientHeight / 2;
        const dx    = rect.x + cardW / 2 - cx;
        const dy    = rect.y + cardH / 2 - cy;
        const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 5 + Math.random() * 8;
        this._failAnimCards.push({
          card: deck.get(ci),
          x: rect.x, y: rect.y,
          vx: (dx / dist) * speed + (Math.random() - 0.5) * 3,
          vy: (dy / dist) * speed - Math.random() * 4,
          angle: 0,
          vAngle: (Math.random() - 0.5) * 0.25,
          alpha: 1,
          delay: Math.random() * 0.8,
          elapsed: 0,
          w: cardW, h: cardH,
          scaleY: 1,
          firePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    this._restartOnComplete = onComplete;
    this._animActive = true;
  }

  private _restartOnComplete: (() => void) | null = null;

  get isAnimating(): boolean { return this._animActive; }

  // ─── 유틸 ─────────────────────────────────────────────────────────────

  private _roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  private _fillRoundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this._roundRect(x, y, w, h, r);
    this.ctx.fill();
  }
}

// ─── 애니메이션 카드 타입 ──────────────────────────────────────────────────

interface WinAnimCard {
  card: Card;
  x: number; y: number;
  vx: number; vy: number;
  angle: number; vAngle: number;
  alpha: number;
  delay: number; elapsed: number;
  w: number; h: number;
}

interface FailAnimCard extends WinAnimCard {
  scaleY: number;
  firePhase: number;
}
