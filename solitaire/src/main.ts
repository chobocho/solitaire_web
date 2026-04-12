import { SolitaireGame } from './solitaire.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { GameStorage, formatSavedAt } from './storage.js';
import { DeckIndex } from './deck.js';

// ─── GameController ────────────────────────────────────────────────────────

class GameController {
  private game:     SolitaireGame;
  private renderer: Renderer;
  private input:    InputHandler;
  private sound:    SoundManager;
  private storage:  GameStorage;

  private canvas!:       HTMLCanvasElement;
  private _rafId = 0;
  private startTime:     number = 0;
  private elapsed:       number = 0;
  private timerInterval: number = 0;

  // UI 요소
  private elMoves!:        HTMLElement;
  private elTimer!:        HTMLElement;
  private elUndoBtn!:      HTMLButtonElement;
  private elPauseBtn!:     HTMLButtonElement;
  private elMuteBtn!:      HTMLButtonElement;
  private startOverlay!:   HTMLElement;
  private pauseOverlay!:   HTMLElement;
  private winOverlay!:     HTMLElement;
  private failOverlay!:         HTMLElement;
  private helpOverlay!:         HTMLElement;
  private confirmNewOverlay!:     HTMLElement;
  private confirmGiveupOverlay!:  HTMLElement;
  private confirmRestartOverlay!: HTMLElement;
  private elWinMoves!:     HTMLElement;
  private elWinTime!:      HTMLElement;
  private resumeBtn!:      HTMLButtonElement;
  private elSavedInfo!:    HTMLElement;
  private elSaveToast!:    HTMLElement;
  private elStockCount!:   HTMLElement;

  private _saveTimer:  number = 0;
  private _toastTimer: number = 0;

  constructor() {
    this.game    = new SolitaireGame();
    this.sound   = new SoundManager();
    this.storage = new GameStorage();
    this._setupDOM();
    this.renderer = new Renderer(this.canvas);
    this.input    = new InputHandler(this.canvas, this.game, this.renderer, {
      onNewGame:   () => this._newGame(),
      onUndo:      () => this._undo(),
      onPause:     () => this._togglePause(),
      onHelp:      () => this._toggleHelp(),
      onFlipStock: () => this._flipStock(),
      onMoveCard:  (from, to, count) => this._handleMove(from, to, count),
      onAutoMove:  (from) => this._handleAutoMove(from),
    });
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.renderer.init();
    await this.storage.init();
    this._bindButtons();
    this._bindResize();
    this._bindPageHide();
    this._loop();
    await this._checkSavedGame();
  }

  private _setupDOM(): void {
    const req = <T extends HTMLElement>(id: string): T => {
      const el = document.getElementById(id) as T | null;
      if (!el) throw new Error(`Required DOM element not found: #${id} — try hard-reload (Ctrl+Shift+R)`);
      return el;
    };
    this.canvas       = req<HTMLCanvasElement>('game-canvas');
    this.elMoves      = req('moves-value');
    this.elTimer      = req('timer-value');
    this.elUndoBtn    = req<HTMLButtonElement>('btn-undo');
    this.elPauseBtn   = req<HTMLButtonElement>('btn-pause');
    this.elMuteBtn    = req<HTMLButtonElement>('btn-mute');
    this.startOverlay = req('start-overlay');
    this.pauseOverlay = req('pause-overlay');
    this.winOverlay   = req('win-overlay');
    this.failOverlay  = req('fail-overlay');
    this.helpOverlay  = req('help-overlay');
    this.elWinMoves   = req('win-moves');
    this.elWinTime    = req('win-time');
    this.resumeBtn    = req<HTMLButtonElement>('overlay-continue-btn');
    this.elSavedInfo  = req('saved-info');
    this.elSaveToast         = req('save-toast');
    this.elStockCount        = req('stock-count');
    this.confirmNewOverlay     = req('confirm-new-overlay');
    this.confirmGiveupOverlay  = req('confirm-giveup-overlay');
    this.confirmRestartOverlay = req('confirm-restart-overlay');
  }

  private _bindButtons(): void {
    document.getElementById('btn-new')!.addEventListener('click', () => this._requestNewGame());
    this.elUndoBtn.addEventListener('click', () => this._undo());
    this.elPauseBtn.addEventListener('click', () => this._togglePause());
    this.elMuteBtn.addEventListener('click', () => {
      this.sound.toggleMute();
      this.elMuteBtn.textContent = this.sound.muted ? '🔇 음소거' : '🔊 소리';
    });

    // 시작 화면
    document.getElementById('overlay-start-btn')!.addEventListener('click', async () => {
      await this.sound.init();
      this._newGame();
    });
    // 이어하기
    this.resumeBtn.addEventListener('click', async () => {
      await this.sound.init();
      await this._continueGame();
    });
    // 일시정지 재개
    document.getElementById('overlay-resume-btn')!.addEventListener('click', () => {
      this._togglePause();
    });
    // 승리 후 새 게임
    document.getElementById('overlay-win-new-btn')!.addEventListener('click', () => {
      this._newGame();
    });
    // 패배 후 새 게임
    document.getElementById('overlay-fail-new-btn')!.addEventListener('click', () => {
      this._newGame();
    });
    // 도움말 닫기
    document.getElementById('help-close-btn')!.addEventListener('click', () => {
      this._toggleHelp();
    });
    // 자동 완성 버튼
    document.getElementById('btn-auto-complete')!.addEventListener('click', () => {
      this._autoComplete();
    });
    // 다시 하기 버튼
    document.getElementById('btn-restart')!.addEventListener('click', () => {
      this._requestRestart();
    });
    document.getElementById('confirm-restart-yes')!.addEventListener('click', () => {
      this.confirmRestartOverlay.classList.add('hidden');
      this._doRestart();
    });
    document.getElementById('confirm-restart-no')!.addEventListener('click', () => {
      this._dismissConfirm(this.confirmRestartOverlay);
    });

    // 새 게임 확인 팝업
    document.getElementById('confirm-new-yes')!.addEventListener('click', () => {
      this.confirmNewOverlay.classList.add('hidden');
      this._newGame();
    });
    document.getElementById('confirm-new-no')!.addEventListener('click', () => {
      this._dismissConfirm(this.confirmNewOverlay);
    });
    // 포기 확인 팝업
    document.getElementById('btn-give-up')!.addEventListener('click', () => {
      this._requestGiveUp();
    });
    document.getElementById('confirm-giveup-yes')!.addEventListener('click', () => {
      this.confirmGiveupOverlay.classList.add('hidden');
      this._onFail();
    });
    document.getElementById('confirm-giveup-no')!.addEventListener('click', () => {
      this._dismissConfirm(this.confirmGiveupOverlay);
    });
  }

  private _bindResize(): void {
    const ro = new ResizeObserver(() => { this.renderer.resize(); });
    ro.observe(this.canvas);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.renderer.resize(), 100);
    });
  }

  private _bindPageHide(): void {
    const saveNow = () => {
      if (this.game.state === 'play' || this.game.state === 'pause') {
        const snap = this.game.serialize(this.elapsed);
        this.storage.save(snap);
      }
    };
    window.addEventListener('pagehide',          saveNow);
    window.addEventListener('beforeunload',       saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
  }

  // ── 저장 / 불러오기 ────────────────────────────────────────────────────

  private async _checkSavedGame(): Promise<void> {
    const snap = await this.storage.load();
    if (snap) {
      this.resumeBtn.classList.remove('hidden');
      this.elSavedInfo.textContent =
        `저장: ${formatSavedAt(snap.savedAt)}  ·  이동 ${snap.moveCount}회  ·  ${this._formatTime(snap.elapsed)}`;
      this.elSavedInfo.classList.remove('hidden');
    } else {
      this.resumeBtn.classList.add('hidden');
      this.elSavedInfo.classList.add('hidden');
    }
  }

  private async _continueGame(): Promise<void> {
    const snap = await this.storage.load();
    if (!snap) { this._newGame(); return; }

    this._stopTimer();
    const restoredElapsed = this.game.restore(snap);
    if (restoredElapsed === null) {
      await this.storage.clear();
      this._newGame();
      return;
    }

    this.elapsed = restoredElapsed;
    this._hideAllOverlays();
    this._updateUI();

    if (this.game.state === 'pause') {
      this.game.resume();
    }
    this._startTimer();
  }

  private _scheduleSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(async () => {
      if (this.game.state === 'play' || this.game.state === 'pause') {
        const snap = this.game.serialize(this.elapsed);
        await this.storage.save(snap);
        this._showSaveToast();
      }
    }, 800);
  }

  private _showSaveToast(): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this.elSaveToast.classList.add('show');
    this._toastTimer = window.setTimeout(() => {
      this.elSaveToast.classList.remove('show');
    }, 1500);
  }

  // ── 게임 흐름 ───────────────────────────────────────────────────────────

  /** 다시 하기 요청: 게임 진행 중이면 확인 팝업 */
  private _requestRestart(): void {
    if (this.game.state !== 'play' && this.game.state !== 'pause') return;
    this._pauseForConfirm();
    this.confirmRestartOverlay.classList.remove('hidden');
  }

  /** 다시 하기 실행: 전체 카드 불타는 이펙트 후 새 게임 시작 */
  private _doRestart(): void {
    this._stopTimer();
    this.storage.clear();
    this.sound.play('lose');

    // 이펙트 재생 — 완료 콜백에서 새 게임 시작
    this.renderer.startRestartEffect(this.game, () => {
      this._newGame();
    });
  }

  /** 새 게임 요청: 게임 진행 중이면 확인 팝업, 아니면 즉시 시작 */
  private _requestNewGame(): void {
    if (this.game.state === 'play' || this.game.state === 'pause') {
      this._pauseForConfirm();
      this.confirmNewOverlay.classList.remove('hidden');
    } else {
      this._newGame();
    }
  }

  /** 포기 요청: 게임 진행 중이면 확인 팝업 */
  private _requestGiveUp(): void {
    if (this.game.state !== 'play' && this.game.state !== 'pause') return;
    this._pauseForConfirm();
    this.confirmGiveupOverlay.classList.remove('hidden');
  }

  /** 확인 팝업을 띄우기 전 게임을 일시정지 */
  private _pauseForConfirm(): void {
    if (this.game.state === 'play') {
      this.game.pause();
      this._stopTimer();
      this.elPauseBtn.textContent = '▶ 계속';
    }
  }

  /** 확인 팝업 취소: 숨기고, 게임이 pause면 재개 */
  private _dismissConfirm(overlay: HTMLElement): void {
    overlay.classList.add('hidden');
    if (this.game.state === 'pause') {
      this.game.resume();
      this._startTimer();
      this.pauseOverlay.classList.add('hidden');
      this.elPauseBtn.textContent = '⏸ 일시정지';
    }
  }

  private _newGame(): void {
    this._stopTimer();
    this.storage.clear();
    this.game.deal();
    this.elapsed = 0;
    this._startTimer();
    this._hideAllOverlays();
    this._updateUI();
    this._scheduleSave();
  }

  private _undo(): void {
    if (!this.game.canUndo) return;
    this.game.undo();
    this.sound.play('card_flip');
    this._updateUI();
    this._scheduleSave();
  }

  private _flipStock(): void {
    if (this.game.state !== 'play') return;
    const ok = this.game.flipStock();
    if (ok) {
      this.sound.play('card_flip');
      this._updateUI();
      this._scheduleSave();
    }
  }

  private _togglePause(): void {
    if (this.game.state === 'idle' || this.game.state === 'win') return;

    if (this.game.state === 'play') {
      this.game.pause();
      this._stopTimer();
      this.pauseOverlay.classList.remove('hidden');
      this.elPauseBtn.textContent = '▶ 계속';
      const snap = this.game.serialize(this.elapsed);
      this.storage.save(snap);
    } else if (this.game.state === 'pause') {
      this.game.resume();
      this._startTimer();
      this.pauseOverlay.classList.add('hidden');
      this.elPauseBtn.textContent = '⏸ 일시정지';
    }
  }

  private _handleMove(from: DeckIndex, to: DeckIndex, count: number): boolean {
    let ok: boolean;

    if (from === DeckIndex.Waste) {
      ok = this.game.moveFromWaste(to);
    } else {
      ok = this.game.moveCard(from, to, count);
    }

    if (ok) {
      this.sound.play('card_place');
      this._updateUI();
      this._scheduleSave();
      if (this.game.state === 'win') this._onWin();
    } else {
      this.sound.play('invalid');
    }
    return ok;
  }

  private _handleAutoMove(from: DeckIndex): void {
    const ok = this.game.autoMoveToFoundation(from);
    if (ok) {
      this.sound.play('card_place');
      this._updateUI();
      this._scheduleSave();
      if (this.game.state === 'win') this._onWin();
    }
  }

  private _autoComplete(): void {
    if (this.game.state !== 'play') return;
    const moved = this.game.autoMoveAll();
    if (moved > 0) {
      this.sound.play('card_place');
      this._updateUI();
      this._scheduleSave();
      const st = this.game.state as string;
      if (st === 'win') this._onWin();
    }
  }

  private _onWin(): void {
    this._stopTimer();
    this.storage.clear();
    this.sound.play('win');
    this.renderer.startWinEffect(this.game);

    this.elWinMoves.textContent = String(this.game.moveCount);
    this.elWinTime.textContent  = this._formatTime(this.elapsed);

    setTimeout(() => {
      this.winOverlay.classList.remove('hidden');
    }, 2000);
  }

  /** 패배(포기) 이펙트 */
  private _onFail(): void {
    this._stopTimer();
    this.storage.clear();
    this.sound.play('lose');
    this.renderer.startFailEffect(this.game);

    setTimeout(() => {
      this.failOverlay.classList.remove('hidden');
    }, 2500);
  }

  // ── UI 업데이트 ─────────────────────────────────────────────────────────

  private _updateUI(): void {
    this.elMoves.textContent = String(this.game.moveCount);
    this.elUndoBtn.disabled  = !this.game.canUndo;

    // 스톡 남은 카드 수 표시
    const stockSize = this.game.getDeck(DeckIndex.Stock).size();
    this.elStockCount.textContent = String(stockSize);
  }

  private _hideAllOverlays(): void {
    this.startOverlay.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.winOverlay.classList.add('hidden');
    this.failOverlay.classList.add('hidden');
    this.helpOverlay.classList.add('hidden');
    this.confirmNewOverlay.classList.add('hidden');
    this.confirmGiveupOverlay.classList.add('hidden');
    this.confirmRestartOverlay.classList.add('hidden');
    this.elPauseBtn.textContent = '⏸ 일시정지';
  }

  private _toggleHelp(): void {
    const isOpen = !this.helpOverlay.classList.contains('hidden');
    if (isOpen) {
      this.helpOverlay.classList.add('hidden');
      if (this.game.state === 'play' && this.timerInterval === 0) {
        this._startTimer();
      }
    } else {
      this.helpOverlay.classList.remove('hidden');
      if (this.game.state === 'play') {
        this._stopTimer();
      }
    }
  }

  // ── 타이머 ─────────────────────────────────────────────────────────────

  private _startTimer(): void {
    this.startTime    = Date.now() - this.elapsed * 1000;
    this.timerInterval = window.setInterval(() => {
      this.elapsed = (Date.now() - this.startTime) / 1000;
      this.elTimer.textContent = this._formatTime(this.elapsed);
    }, 1000);
  }

  private _stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = 0;
    }
  }

  private _formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── 렌더 루프 ───────────────────────────────────────────────────────────

  private _loop(): void {
    const step = () => {
      if (this.game.state !== 'idle') {
        this.renderer.render(
          this.game,
          this.input.getDragState(),
          this.elapsed,
          this.input.getKeyboardState(),
        );
      }
      this._rafId = requestAnimationFrame(step);
      void this._rafId;
    };
    this._rafId = requestAnimationFrame(step);
  }

}

// ─── 진입점 ────────────────────────────────────────────────────────────────

const controller = new GameController();
controller.start().catch(console.error);
