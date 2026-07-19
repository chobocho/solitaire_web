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
  private elFailMsg!:           HTMLElement;
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
  /** 게임 종료(승리/포기/교착) 후 중복 처리 방지 플래그 */
  private _ended: boolean = false;

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
      onEscapeModal: () => this._handleEscapeModal(),
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
    this.elFailMsg    = req('fail-msg');
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
      if (this._ended) return;
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

    this._ended = false;
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
      if (!this._ended && (this.game.state === 'play' || this.game.state === 'pause')) {
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

  /** 다시 하기 실행: 전체 카드 불타는 이펙트 후 같은 배열로 재시작 */
  private _doRestart(): void {
    this._stopTimer();
    this.storage.clear();
    this.sound.play('lose');

    // 이펙트 재생 — 완료 콜백에서 동일 배열로 재시작
    this.renderer.startRestartEffect(this.game, () => {
      this._restartSameDeal();
    });
  }

  /** deal() 시 저장한 초기 배치로 되돌려 재시작 (새 셔플 없음) */
  private _restartSameDeal(): void {
    this._stopTimer();
    const ok = this.game.restart();
    if (!ok) { this._newGame(); return; }
    this._ended = false;
    void this.sound.init();
    this.elapsed = 0;
    this._startTimer();
    this._hideAllOverlays();
    this._updateUI();
    this._scheduleSave();
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
    // 키보드(N)로 시작하는 경우에도 소리가 나도록 사운드 초기화 (사용자 제스처 내)
    void this.sound.init();
    this._ended = false;
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
    // 승리/미시작 상태에서는 undo 차단 (승리 처리 후 상태 불일치 방지)
    if (this.game.state !== 'play' && this.game.state !== 'pause') return;
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
      this._checkDeadlock();
    }
  }

  /**
   * Esc 우선 처리: 도움말/확인 팝업이 열려 있으면 닫고 true 반환.
   * 열린 모달이 없으면 false (호출측이 선택취소/일시정지로 처리).
   */
  private _handleEscapeModal(): boolean {
    if (!this.helpOverlay.classList.contains('hidden')) {
      this._toggleHelp();
      return true;
    }
    for (const ov of [this.confirmNewOverlay, this.confirmGiveupOverlay, this.confirmRestartOverlay]) {
      if (!ov.classList.contains('hidden')) {
        this._dismissConfirm(ov);
        return true;
      }
    }
    return false;
  }

  /** 확인 팝업이 하나라도 열려 있는지 */
  private _anyConfirmOpen(): boolean {
    return !this.confirmNewOverlay.classList.contains('hidden')
        || !this.confirmGiveupOverlay.classList.contains('hidden')
        || !this.confirmRestartOverlay.classList.contains('hidden');
  }

  private _togglePause(): void {
    if (this._ended) return;
    if (this.game.state === 'idle' || this.game.state === 'win') return;
    // 확인 팝업이 떠 있는 동안에는 일시정지 토글 금지 (팝업 뒤 상태 꼬임 방지)
    if (this._anyConfirmOpen()) return;

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
      else this._checkDeadlock();
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
      else this._checkDeadlock();
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
      else this._checkDeadlock();
    }
  }

  private _onWin(): void {
    this._ended = true;
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

  /** 패배 이펙트 (포기 또는 교착) */
  private _onFail(reason: 'giveup' | 'deadlock' = 'giveup'): void {
    this._ended = true;
    this.elFailMsg.textContent = reason === 'deadlock'
      ? '더 이상 이동할 수 없습니다.'
      : '게임을 포기했습니다.';
    this._stopTimer();
    // 종료 직전 예약된 자동저장이 storage.clear() 이후 죽은 판을 재저장하지 않도록 취소
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = 0; }
    this.storage.clear();
    this.sound.play('lose');
    this.renderer.startFailEffect(this.game);

    setTimeout(() => {
      this.failOverlay.classList.remove('hidden');
    }, 2500);
  }

  /** 이동 후 교착(더 이상 둘 수 없음) 검사 → 자동 게임 종료 */
  private _checkDeadlock(): void {
    if (this._ended) return;
    if (this.game.state !== 'play') return;
    if (!this.game.hasAnyMove()) {
      this._onFail('deadlock');
    }
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
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

}

// ─── 진입점 ────────────────────────────────────────────────────────────────

const controller = new GameController();
controller.start().catch(console.error);
