import { SoundEffects } from '../audio/SoundEffects';

export interface HUDCallbacks {
  onUndo: () => void;
  onHint: () => void;
  onRestart: () => void;
  onNewGame: () => void;
  onAutoComplete: () => void;
  onToggleDrawMode: (mode: 1 | 3) => void;
}

export class HUD {
  private container: HTMLElement;
  private headerEl!: HTMLElement;
  private bottomBarEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private scoreValEl!: HTMLElement;
  private movesValEl!: HTMLElement;
  private timerValEl!: HTMLElement;
  private drawModeBtn!: HTMLButtonElement;
  private muteBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private hintBtn!: HTMLButtonElement;
  private autoCompleteBtn!: HTMLButtonElement;

  private currentDrawMode: 1 | 3 = 1;

  constructor(
    container: HTMLElement,
    private soundEffects: SoundEffects,
    private callbacks: HUDCallbacks
  ) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';

    // Header Bar
    this.headerEl = document.createElement('header');
    this.headerEl.className = 'hud-header';
    this.headerEl.innerHTML = `
      <div class="hud-stat-box">
        <span class="hud-stat-title">SCORE</span>
        <span class="hud-stat-number" id="hud-score">0</span>
      </div>

      <div class="hud-stat-box">
        <span class="hud-stat-title">MOVES</span>
        <span class="hud-stat-number" id="hud-moves">0</span>
      </div>

      <div class="hud-stat-box">
        <span class="hud-stat-title">TIME</span>
        <span class="hud-stat-number" id="hud-timer">00:00</span>
      </div>

      <div class="hud-header-actions">
        <button class="hud-pill-btn" id="hud-draw-mode" title="Toggle Draw Mode">
          DRAW 1
        </button>
        <button class="hud-icon-btn" id="hud-sound-toggle" title="Toggle Sound">
          ${this.soundEffects.getMuted() ? '🔇' : '🔊'}
        </button>
      </div>
    `;

    // Bottom Action Bar
    this.bottomBarEl = document.createElement('nav');
    this.bottomBarEl.className = 'hud-bottom-bar';
    this.bottomBarEl.innerHTML = `
      <button class="hud-action-btn" id="hud-undo-btn" title="Undo Move">
        <span class="btn-icon">↶</span>
        <span class="btn-label">Undo</span>
      </button>

      <button class="hud-action-btn" id="hud-hint-btn" title="Get Hint">
        <span class="btn-icon">💡</span>
        <span class="btn-label">Hint</span>
      </button>

      <button class="hud-action-btn highlight-gold" id="hud-autocomplete-btn" style="display: none;" title="Auto-Complete Game">
        <span class="btn-icon">✨</span>
        <span class="btn-label">Auto</span>
      </button>

      <button class="hud-action-btn" id="hud-restart-btn" title="Restart Game">
        <span class="btn-icon">↻</span>
        <span class="btn-label">Restart</span>
      </button>

      <button class="hud-action-btn btn-primary" id="hud-newgame-btn" title="New Game">
        <span class="btn-icon">＋</span>
        <span class="btn-label">New</span>
      </button>
    `;

    // Toast element for in-game notifications
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.toastEl.style.display = 'none';

    this.container.appendChild(this.headerEl);
    this.container.appendChild(this.bottomBarEl);
    this.container.appendChild(this.toastEl);

    // Cache elements
    this.scoreValEl = this.headerEl.querySelector('#hud-score')!;
    this.movesValEl = this.headerEl.querySelector('#hud-moves')!;
    this.timerValEl = this.headerEl.querySelector('#hud-timer')!;
    this.drawModeBtn = this.headerEl.querySelector('#hud-draw-mode')!;
    this.muteBtn = this.headerEl.querySelector('#hud-sound-toggle')!;

    this.undoBtn = this.bottomBarEl.querySelector('#hud-undo-btn')!;
    this.hintBtn = this.bottomBarEl.querySelector('#hud-hint-btn')!;
    this.autoCompleteBtn = this.bottomBarEl.querySelector('#hud-autocomplete-btn')!;

    this.initEvents();
  }

  private initEvents(): void {
    this.drawModeBtn.addEventListener('click', () => {
      this.currentDrawMode = this.currentDrawMode === 1 ? 3 : 1;
      this.drawModeBtn.textContent = `DRAW ${this.currentDrawMode}`;
      this.callbacks.onToggleDrawMode(this.currentDrawMode);
    });

    this.muteBtn.addEventListener('click', () => {
      const isMuted = this.soundEffects.toggleMute();
      this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    this.undoBtn.addEventListener('click', () => {
      this.callbacks.onUndo();
    });

    this.hintBtn.addEventListener('click', () => {
      this.callbacks.onHint();
    });

    this.autoCompleteBtn.addEventListener('click', () => {
      this.callbacks.onAutoComplete();
    });

    const restartBtn = this.bottomBarEl.querySelector('#hud-restart-btn')!;
    restartBtn.addEventListener('click', () => {
      this.callbacks.onRestart();
    });

    const newGameBtn = this.bottomBarEl.querySelector('#hud-newgame-btn')!;
    newGameBtn.addEventListener('click', () => {
      this.callbacks.onNewGame();
    });
  }

  public updateStats(score: number, moves: number, elapsedSeconds: number): void {
    this.scoreValEl.textContent = score.toString();
    this.movesValEl.textContent = moves.toString();

    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    this.timerValEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  public setUndoEnabled(enabled: boolean): void {
    this.undoBtn.disabled = !enabled;
    this.undoBtn.style.opacity = enabled ? '1.0' : '0.4';
  }

  public setAutoCompleteVisible(visible: boolean): void {
    this.autoCompleteBtn.style.display = visible ? 'flex' : 'none';
  }

  public setDrawMode(mode: 1 | 3): void {
    this.currentDrawMode = mode;
    this.drawModeBtn.textContent = `DRAW ${mode}`;
  }

  public showToast(message: string, durationMs: number = 3000): void {
    this.toastEl.textContent = message;
    this.toastEl.style.display = 'block';
    this.toastEl.classList.remove('fade-out');

    clearTimeout((this.toastEl as any)._timeout);
    (this.toastEl as any)._timeout = setTimeout(() => {
      this.toastEl.classList.add('fade-out');
      setTimeout(() => {
        this.toastEl.style.display = 'none';
      }, 300);
    }, durationMs);
  }
}
