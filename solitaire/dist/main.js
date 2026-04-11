import { SolitaireGame } from './solitaire.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { GameStorage, formatSavedAt } from './storage.js';
import { DeckIndex } from './deck.js';
// ─── GameController ────────────────────────────────────────────────────────
class GameController {
    constructor() {
        this._rafId = 0;
        this.startTime = 0;
        this.elapsed = 0;
        this.timerInterval = 0;
        this._saveTimer = 0;
        this._toastTimer = 0;
        this.game = new SolitaireGame();
        this.sound = new SoundManager();
        this.storage = new GameStorage();
        this._setupDOM();
        this.renderer = new Renderer(this.canvas);
        this.input = new InputHandler(this.canvas, this.game, this.renderer, {
            onNewGame: () => this._newGame(),
            onUndo: () => this._undo(),
            onPause: () => this._togglePause(),
            onHelp: () => this._toggleHelp(),
            onFlipStock: () => this._flipStock(),
            onMoveCard: (from, to, count) => this._handleMove(from, to, count),
            onAutoMove: (from) => this._handleAutoMove(from),
        });
    }
    // ── 초기화 ─────────────────────────────────────────────────────────────
    async start() {
        await this.renderer.init();
        await this.storage.init();
        this._bindButtons();
        this._bindResize();
        this._bindPageHide();
        this._loop();
        await this._checkSavedGame();
    }
    _setupDOM() {
        this.canvas = document.getElementById('game-canvas');
        this.elMoves = document.getElementById('moves-value');
        this.elTimer = document.getElementById('timer-value');
        this.elUndoBtn = document.getElementById('btn-undo');
        this.elPauseBtn = document.getElementById('btn-pause');
        this.elMuteBtn = document.getElementById('btn-mute');
        this.startOverlay = document.getElementById('start-overlay');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.winOverlay = document.getElementById('win-overlay');
        this.failOverlay = document.getElementById('fail-overlay');
        this.helpOverlay = document.getElementById('help-overlay');
        this.elWinMoves = document.getElementById('win-moves');
        this.elWinTime = document.getElementById('win-time');
        this.resumeBtn = document.getElementById('overlay-continue-btn');
        this.elSavedInfo = document.getElementById('saved-info');
        this.elSaveToast = document.getElementById('save-toast');
        this.elStockCount = document.getElementById('stock-count');
        this.confirmNewOverlay = document.getElementById('confirm-new-overlay');
        this.confirmGiveupOverlay = document.getElementById('confirm-giveup-overlay');
        this.confirmRestartOverlay = document.getElementById('confirm-restart-overlay');
    }
    _bindButtons() {
        document.getElementById('btn-new').addEventListener('click', () => this._requestNewGame());
        this.elUndoBtn.addEventListener('click', () => this._undo());
        this.elPauseBtn.addEventListener('click', () => this._togglePause());
        this.elMuteBtn.addEventListener('click', () => {
            this.sound.toggleMute();
            this.elMuteBtn.textContent = this.sound.muted ? '🔇 음소거' : '🔊 소리';
        });
        // 시작 화면
        document.getElementById('overlay-start-btn').addEventListener('click', async () => {
            await this.sound.init();
            this._newGame();
        });
        // 이어하기
        this.resumeBtn.addEventListener('click', async () => {
            await this.sound.init();
            await this._continueGame();
        });
        // 일시정지 재개
        document.getElementById('overlay-resume-btn').addEventListener('click', () => {
            this._togglePause();
        });
        // 승리 후 새 게임
        document.getElementById('overlay-win-new-btn').addEventListener('click', () => {
            this._newGame();
        });
        // 패배 후 새 게임
        document.getElementById('overlay-fail-new-btn').addEventListener('click', () => {
            this._newGame();
        });
        // 도움말 닫기
        document.getElementById('help-close-btn').addEventListener('click', () => {
            this._toggleHelp();
        });
        // 자동 완성 버튼
        document.getElementById('btn-auto-complete').addEventListener('click', () => {
            this._autoComplete();
        });
        // 다시 하기 버튼
        document.getElementById('btn-restart').addEventListener('click', () => {
            this._requestRestart();
        });
        document.getElementById('confirm-restart-yes').addEventListener('click', () => {
            this.confirmRestartOverlay.classList.add('hidden');
            this._doRestart();
        });
        document.getElementById('confirm-restart-no').addEventListener('click', () => {
            this._dismissConfirm(this.confirmRestartOverlay);
        });
        // 새 게임 확인 팝업
        document.getElementById('confirm-new-yes').addEventListener('click', () => {
            this.confirmNewOverlay.classList.add('hidden');
            this._newGame();
        });
        document.getElementById('confirm-new-no').addEventListener('click', () => {
            this._dismissConfirm(this.confirmNewOverlay);
        });
        // 포기 확인 팝업
        document.getElementById('btn-give-up').addEventListener('click', () => {
            this._requestGiveUp();
        });
        document.getElementById('confirm-giveup-yes').addEventListener('click', () => {
            this.confirmGiveupOverlay.classList.add('hidden');
            this._onFail();
        });
        document.getElementById('confirm-giveup-no').addEventListener('click', () => {
            this._dismissConfirm(this.confirmGiveupOverlay);
        });
    }
    _bindResize() {
        const ro = new ResizeObserver(() => { this.renderer.resize(); });
        ro.observe(this.canvas);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.renderer.resize(), 100);
        });
    }
    _bindPageHide() {
        const saveNow = () => {
            if (this.game.state === 'play' || this.game.state === 'pause') {
                const snap = this.game.serialize(this.elapsed);
                this.storage.save(snap);
            }
        };
        window.addEventListener('pagehide', saveNow);
        window.addEventListener('beforeunload', saveNow);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden')
                saveNow();
        });
    }
    // ── 저장 / 불러오기 ────────────────────────────────────────────────────
    async _checkSavedGame() {
        const snap = await this.storage.load();
        if (snap) {
            this.resumeBtn.classList.remove('hidden');
            this.elSavedInfo.textContent =
                `저장: ${formatSavedAt(snap.savedAt)}  ·  이동 ${snap.moveCount}회  ·  ${this._formatTime(snap.elapsed)}`;
            this.elSavedInfo.classList.remove('hidden');
        }
        else {
            this.resumeBtn.classList.add('hidden');
            this.elSavedInfo.classList.add('hidden');
        }
    }
    async _continueGame() {
        const snap = await this.storage.load();
        if (!snap) {
            this._newGame();
            return;
        }
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
    _scheduleSave() {
        if (this._saveTimer)
            clearTimeout(this._saveTimer);
        this._saveTimer = window.setTimeout(async () => {
            if (this.game.state === 'play' || this.game.state === 'pause') {
                const snap = this.game.serialize(this.elapsed);
                await this.storage.save(snap);
                this._showSaveToast();
            }
        }, 800);
    }
    _showSaveToast() {
        if (this._toastTimer)
            clearTimeout(this._toastTimer);
        this.elSaveToast.classList.add('show');
        this._toastTimer = window.setTimeout(() => {
            this.elSaveToast.classList.remove('show');
        }, 1500);
    }
    // ── 게임 흐름 ───────────────────────────────────────────────────────────
    /** 다시 하기 요청: 게임 진행 중이면 확인 팝업 */
    _requestRestart() {
        if (this.game.state !== 'play' && this.game.state !== 'pause')
            return;
        this._pauseForConfirm();
        this.confirmRestartOverlay.classList.remove('hidden');
    }
    /** 다시 하기 실행: 전체 카드 불타는 이펙트 후 새 게임 시작 */
    _doRestart() {
        this._stopTimer();
        this.storage.clear();
        this.sound.play('lose');
        // 이펙트 재생 — 완료 콜백에서 새 게임 시작
        this.renderer.startRestartEffect(this.game, () => {
            this._newGame();
        });
    }
    /** 새 게임 요청: 게임 진행 중이면 확인 팝업, 아니면 즉시 시작 */
    _requestNewGame() {
        if (this.game.state === 'play' || this.game.state === 'pause') {
            this._pauseForConfirm();
            this.confirmNewOverlay.classList.remove('hidden');
        }
        else {
            this._newGame();
        }
    }
    /** 포기 요청: 게임 진행 중이면 확인 팝업 */
    _requestGiveUp() {
        if (this.game.state !== 'play' && this.game.state !== 'pause')
            return;
        this._pauseForConfirm();
        this.confirmGiveupOverlay.classList.remove('hidden');
    }
    /** 확인 팝업을 띄우기 전 게임을 일시정지 */
    _pauseForConfirm() {
        if (this.game.state === 'play') {
            this.game.pause();
            this._stopTimer();
            this.elPauseBtn.textContent = '▶ 계속';
        }
    }
    /** 확인 팝업 취소: 숨기고, 게임이 pause면 재개 */
    _dismissConfirm(overlay) {
        overlay.classList.add('hidden');
        if (this.game.state === 'pause') {
            this.game.resume();
            this._startTimer();
            this.pauseOverlay.classList.add('hidden');
            this.elPauseBtn.textContent = '⏸ 일시정지';
        }
    }
    _newGame() {
        this._stopTimer();
        this.storage.clear();
        this.game.deal();
        this.elapsed = 0;
        this._startTimer();
        this._hideAllOverlays();
        this._updateUI();
        this._scheduleSave();
    }
    _undo() {
        if (!this.game.canUndo)
            return;
        this.game.undo();
        this.sound.play('card_flip');
        this._updateUI();
        this._scheduleSave();
    }
    _flipStock() {
        if (this.game.state !== 'play')
            return;
        const ok = this.game.flipStock();
        if (ok) {
            this.sound.play('card_flip');
            this._updateUI();
            this._scheduleSave();
        }
    }
    _togglePause() {
        if (this.game.state === 'idle' || this.game.state === 'win')
            return;
        if (this.game.state === 'play') {
            this.game.pause();
            this._stopTimer();
            this.pauseOverlay.classList.remove('hidden');
            this.elPauseBtn.textContent = '▶ 계속';
            const snap = this.game.serialize(this.elapsed);
            this.storage.save(snap);
        }
        else if (this.game.state === 'pause') {
            this.game.resume();
            this._startTimer();
            this.pauseOverlay.classList.add('hidden');
            this.elPauseBtn.textContent = '⏸ 일시정지';
        }
    }
    _handleMove(from, to, count) {
        let ok;
        if (from === DeckIndex.Waste) {
            ok = this.game.moveFromWaste(to);
        }
        else {
            ok = this.game.moveCard(from, to, count);
        }
        if (ok) {
            this.sound.play('card_place');
            this._updateUI();
            this._scheduleSave();
            if (this.game.state === 'win')
                this._onWin();
        }
        else {
            this.sound.play('invalid');
        }
        return ok;
    }
    _handleAutoMove(from) {
        const ok = this.game.autoMoveToFoundation(from);
        if (ok) {
            this.sound.play('card_place');
            this._updateUI();
            this._scheduleSave();
            if (this.game.state === 'win')
                this._onWin();
        }
    }
    _autoComplete() {
        if (this.game.state !== 'play')
            return;
        const moved = this.game.autoMoveAll();
        if (moved > 0) {
            this.sound.play('card_place');
            this._updateUI();
            this._scheduleSave();
            const st = this.game.state;
            if (st === 'win')
                this._onWin();
        }
    }
    _onWin() {
        this._stopTimer();
        this.storage.clear();
        this.sound.play('win');
        this.renderer.startWinEffect(this.game);
        this.elWinMoves.textContent = String(this.game.moveCount);
        this.elWinTime.textContent = this._formatTime(this.elapsed);
        setTimeout(() => {
            this.winOverlay.classList.remove('hidden');
        }, 2000);
    }
    /** 패배(포기) 이펙트 */
    _onFail() {
        this._stopTimer();
        this.storage.clear();
        this.sound.play('lose');
        this.renderer.startFailEffect(this.game);
        setTimeout(() => {
            this.failOverlay.classList.remove('hidden');
        }, 2500);
    }
    // ── UI 업데이트 ─────────────────────────────────────────────────────────
    _updateUI() {
        this.elMoves.textContent = String(this.game.moveCount);
        this.elUndoBtn.disabled = !this.game.canUndo;
        // 스톡 남은 카드 수 표시
        const stockSize = this.game.getDeck(DeckIndex.Stock).size();
        this.elStockCount.textContent = String(stockSize);
    }
    _hideAllOverlays() {
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
    _toggleHelp() {
        const isOpen = !this.helpOverlay.classList.contains('hidden');
        if (isOpen) {
            this.helpOverlay.classList.add('hidden');
            if (this.game.state === 'play' && this.timerInterval === 0) {
                this._startTimer();
            }
        }
        else {
            this.helpOverlay.classList.remove('hidden');
            if (this.game.state === 'play') {
                this._stopTimer();
            }
        }
    }
    // ── 타이머 ─────────────────────────────────────────────────────────────
    _startTimer() {
        this.startTime = Date.now() - this.elapsed * 1000;
        this.timerInterval = window.setInterval(() => {
            this.elapsed = (Date.now() - this.startTime) / 1000;
            this.elTimer.textContent = this._formatTime(this.elapsed);
        }, 1000);
    }
    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = 0;
        }
    }
    _formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    // ── 렌더 루프 ───────────────────────────────────────────────────────────
    _loop() {
        const step = () => {
            if (this.game.state !== 'idle') {
                this.renderer.render(this.game, this.input.getDragState(), this.elapsed, this.input.getKeyboardState());
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
//# sourceMappingURL=main.js.map