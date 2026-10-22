import { SoundEffects } from '../audio/SoundEffects';
import { CardBackSettings, CardBackSymbol, DEFAULT_CARD_BACK_SETTINGS } from '../core/types';
import { CardMeshFactory } from '../gfx/CardMeshFactory';

export interface HUDCallbacks {
  onUndo: () => void;
  onHint: () => void;
  onRestart: () => void;
  onNewGame: () => void;
  onAutoComplete: () => void;
  onToggleDrawMode: (mode: 1 | 3) => void;
  onSelectSeed: (seed: number | string) => void;
  onNewWinnableGame: () => void;
  /** commit=false for live previews (e.g. color picker drag); persist only on commit. */
  onCardBackChanged?: (settings: CardBackSettings, commit: boolean) => void;
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
  private seedBtn!: HTMLButtonElement;
  private seedValEl!: HTMLElement;
  private seedModalOverlay!: HTMLElement;
  private seedInput!: HTMLInputElement;
  private seedModalCurrent!: HTMLElement;

  private cardBackBtn!: HTMLButtonElement;
  private cardBackModalOverlay!: HTMLElement;
  private cardBackPreviewCanvas!: HTMLCanvasElement;
  private cardBackCustomColorInput!: HTMLInputElement;
  private cardBackColorHexEl!: HTMLElement;
  private cardBackSymbolBtns: HTMLButtonElement[] = [];
  private cardBackSwatches: HTMLButtonElement[] = [];
  private currentCardBackSettings: CardBackSettings = { ...DEFAULT_CARD_BACK_SETTINGS };

  private currentDrawMode: 1 | 3 = 1;
  private currentSeed: number | string = '---';

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
      <div class="hud-stats-group">
        <div class="hud-stat-box">
          <span class="hud-stat-title">SCORE</span>
          <span class="hud-stat-number" id="hud-score">0</span>
        </div>
        <div class="hud-stat-divider"></div>
        <div class="hud-stat-box">
          <span class="hud-stat-title">MOVES</span>
          <span class="hud-stat-number" id="hud-moves">0</span>
        </div>
        <div class="hud-stat-divider"></div>
        <div class="hud-stat-box">
          <span class="hud-stat-title">TIME</span>
          <span class="hud-stat-number" id="hud-timer">00:00</span>
        </div>
      </div>

      <div class="hud-header-actions">
        <button class="hud-pill-btn" id="hud-seed-btn" title="Game Seed (Click to share/change)">
          <span class="seed-hash">#</span><span id="hud-seed-val">---</span>
        </button>
        <button class="hud-pill-btn" id="hud-draw-mode" title="Toggle Draw Mode">
          DRAW 1
        </button>
        <button class="hud-icon-btn" id="hud-cardback-btn" title="Customize Card Back" aria-label="Customize Card Back">
          ♠
        </button>
        <button class="hud-icon-btn" id="hud-sound-toggle" title="Toggle Sound" aria-label="Toggle Sound">
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

    // Seed Modal Dialog
    this.seedModalOverlay = document.createElement('div');
    this.seedModalOverlay.className = 'hud-modal-overlay hud-seed-modal-overlay';
    this.seedModalOverlay.id = 'hud-seed-modal-overlay';
    this.seedModalOverlay.style.display = 'none';
    this.seedModalOverlay.innerHTML = `
      <div class="hud-modal hud-seed-modal" role="dialog" aria-modal="true" aria-labelledby="seed-modal-title">
        <div class="hud-modal-header">
          <h3 id="seed-modal-title" class="hud-modal-title">Game Seed</h3>
          <button class="hud-modal-close-btn" id="seed-modal-close" aria-label="Close">✕</button>
        </div>
        <div class="hud-modal-body">
          <div class="hud-modal-row">
            <span class="hud-modal-label">Current Seed:</span>
            <span class="hud-modal-badge" id="seed-modal-current">---</span>
          </div>
          <div class="hud-modal-group">
            <label for="seed-input" class="hud-modal-label">Custom Seed</label>
            <input type="text" id="seed-input" class="hud-input" placeholder="Enter seed (number or text)" maxlength="32" autocomplete="off" />
          </div>
          <div class="hud-modal-actions">
            <button class="hud-action-btn btn-primary" id="seed-play-btn">Play Seed</button>
            <button class="hud-action-btn" id="seed-copy-link-btn">Copy Share Link</button>
            <button class="hud-action-btn highlight-gold" id="seed-winnable-btn">New Winnable Game</button>
          </div>
        </div>
      </div>
    `;

    // Card Back Customization Modal Dialog
    this.cardBackModalOverlay = document.createElement('div');
    this.cardBackModalOverlay.className = 'hud-modal-overlay hud-cardback-modal-overlay';
    this.cardBackModalOverlay.id = 'hud-cardback-modal-overlay';
    this.cardBackModalOverlay.style.display = 'none';
    this.cardBackModalOverlay.innerHTML = `
      <div class="hud-modal hud-cardback-modal" role="dialog" aria-modal="true" aria-labelledby="cardback-modal-title">
        <div class="hud-modal-header">
          <h3 id="cardback-modal-title" class="hud-modal-title">Customize Card Back</h3>
          <button class="hud-modal-close-btn" id="cardback-modal-close" aria-label="Close">✕</button>
        </div>
        <div class="hud-modal-body hud-cardback-body">
          <div class="cardback-preview-section">
            <canvas id="cardback-preview-canvas" width="140" height="202" class="cardback-preview-canvas"></canvas>
          </div>
          <div class="cardback-controls-section">
            <div class="cardback-group">
              <label class="hud-modal-label">Center Symbol</label>
              <div class="cardback-symbol-grid" role="group" aria-label="Center Symbol">
                <button type="button" class="cardback-symbol-btn active" data-symbol="spades" title="Spades" aria-label="Spades" aria-pressed="true">♠</button>
                <button type="button" class="cardback-symbol-btn" data-symbol="hearts" title="Hearts" aria-label="Hearts" aria-pressed="false">♥</button>
                <button type="button" class="cardback-symbol-btn" data-symbol="diamonds" title="Diamonds" aria-label="Diamonds" aria-pressed="false">♦</button>
                <button type="button" class="cardback-symbol-btn" data-symbol="clubs" title="Clubs" aria-label="Clubs" aria-pressed="false">♣</button>
              </div>
            </div>
            <div class="cardback-group">
              <label class="hud-modal-label">Card Back Color</label>
              <div class="cardback-color-swatches" role="group" aria-label="Card Back Color">
                <button type="button" class="cardback-swatch active" data-color="#0f2b5c" title="Navy" aria-label="Navy" aria-pressed="true" style="background-color: #0f2b5c;"></button>
                <button type="button" class="cardback-swatch" data-color="#7f1d1d" title="Crimson" aria-label="Crimson" aria-pressed="false" style="background-color: #7f1d1d;"></button>
                <button type="button" class="cardback-swatch" data-color="#064e3b" title="Emerald" aria-label="Emerald" aria-pressed="false" style="background-color: #064e3b;"></button>
                <button type="button" class="cardback-swatch" data-color="#4c1d95" title="Purple" aria-label="Purple" aria-pressed="false" style="background-color: #4c1d95;"></button>
                <button type="button" class="cardback-swatch" data-color="#1e293b" title="Slate" aria-label="Slate" aria-pressed="false" style="background-color: #1e293b;"></button>
                <button type="button" class="cardback-swatch" data-color="#78350f" title="Amber" aria-label="Amber" aria-pressed="false" style="background-color: #78350f;"></button>
                <button type="button" class="cardback-swatch" data-color="#134e4a" title="Teal" aria-label="Teal" aria-pressed="false" style="background-color: #134e4a;"></button>
                <button type="button" class="cardback-swatch" data-color="#831843" title="Rose" aria-label="Rose" aria-pressed="false" style="background-color: #831843;"></button>
              </div>
              <div class="cardback-custom-color-row">
                <label for="cardback-color-input" class="cardback-color-label">Custom Color:</label>
                <div class="cardback-color-picker-wrapper">
                  <input type="color" id="cardback-color-input" class="cardback-color-input" value="#0f2b5c" />
                  <span id="cardback-color-hex" class="cardback-color-hex">#0f2b5c</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="hud-modal-actions">
          <button class="hud-action-btn" id="cardback-reset-btn">Reset Default</button>
          <button class="hud-action-btn btn-primary" id="cardback-done-btn">Done</button>
        </div>
      </div>
    `;

    // Toast element for in-game notifications
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.toastEl.style.display = 'none';

    this.container.appendChild(this.headerEl);
    this.container.appendChild(this.bottomBarEl);
    this.container.appendChild(this.seedModalOverlay);
    this.container.appendChild(this.cardBackModalOverlay);
    this.container.appendChild(this.toastEl);

    // Cache elements
    this.scoreValEl = this.headerEl.querySelector('#hud-score')!;
    this.movesValEl = this.headerEl.querySelector('#hud-moves')!;
    this.timerValEl = this.headerEl.querySelector('#hud-timer')!;
    this.drawModeBtn = this.headerEl.querySelector('#hud-draw-mode')!;
    this.muteBtn = this.headerEl.querySelector('#hud-sound-toggle')!;
    this.cardBackBtn = this.headerEl.querySelector('#hud-cardback-btn')!;
    this.seedBtn = this.headerEl.querySelector('#hud-seed-btn')!;
    this.seedValEl = this.headerEl.querySelector('#hud-seed-val')!;

    this.undoBtn = this.bottomBarEl.querySelector('#hud-undo-btn')!;
    this.hintBtn = this.bottomBarEl.querySelector('#hud-hint-btn')!;
    this.autoCompleteBtn = this.bottomBarEl.querySelector('#hud-autocomplete-btn')!;

    this.seedInput = this.seedModalOverlay.querySelector('#seed-input')!;
    this.seedModalCurrent = this.seedModalOverlay.querySelector('#seed-modal-current')!;

    this.cardBackPreviewCanvas = this.cardBackModalOverlay.querySelector('#cardback-preview-canvas')!;
    this.cardBackCustomColorInput = this.cardBackModalOverlay.querySelector('#cardback-color-input')!;
    this.cardBackColorHexEl = this.cardBackModalOverlay.querySelector('#cardback-color-hex')!;
    this.cardBackSymbolBtns = Array.from(this.cardBackModalOverlay.querySelectorAll('.cardback-symbol-btn'));
    this.cardBackSwatches = Array.from(this.cardBackModalOverlay.querySelectorAll('.cardback-swatch'));

    this.initEvents();
    this.updateCardBackUI();
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

    this.cardBackBtn.addEventListener('click', () => {
      this.openCardBackModal();
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

    // Seed Modal Events
    this.seedBtn.addEventListener('click', () => {
      this.openSeedModal();
    });

    const closeBtn = this.seedModalOverlay.querySelector('#seed-modal-close')!;
    closeBtn.addEventListener('click', () => {
      this.closeSeedModal();
    });

    this.seedModalOverlay.addEventListener('click', (e) => {
      if (e.target === this.seedModalOverlay) {
        this.closeSeedModal();
      }
    });

    const playBtn = this.seedModalOverlay.querySelector('#seed-play-btn')!;
    const handlePlayCustomSeed = () => {
      const val = this.seedInput.value.trim();
      if (val) {
        this.callbacks.onSelectSeed(val);
        this.closeSeedModal();
      }
    };
    playBtn.addEventListener('click', handlePlayCustomSeed);
    this.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handlePlayCustomSeed();
      }
    });

    const copyLinkBtn = this.seedModalOverlay.querySelector('#seed-copy-link-btn')!;
    copyLinkBtn.addEventListener('click', () => {
      this.copyShareLink();
    });

    const winnableBtn = this.seedModalOverlay.querySelector('#seed-winnable-btn')!;
    winnableBtn.addEventListener('click', () => {
      this.callbacks.onNewWinnableGame();
      this.closeSeedModal();
    });

    // Card Back Modal Events
    const cardBackCloseBtn = this.cardBackModalOverlay.querySelector('#cardback-modal-close')!;
    cardBackCloseBtn.addEventListener('click', () => {
      this.closeCardBackModal();
    });

    const cardBackDoneBtn = this.cardBackModalOverlay.querySelector('#cardback-done-btn')!;
    cardBackDoneBtn.addEventListener('click', () => {
      this.closeCardBackModal();
    });

    this.cardBackModalOverlay.addEventListener('click', (e) => {
      if (e.target === this.cardBackModalOverlay) {
        this.closeCardBackModal();
      }
    });

    // Suit symbol buttons
    this.cardBackSymbolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const symbol = btn.dataset.symbol as CardBackSymbol;
        if (symbol) {
          this.applyCardBackChange({
            ...this.currentCardBackSettings,
            symbol
          });
        }
      });
    });

    // Color swatches
    this.cardBackSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        if (color) {
          this.applyCardBackChange({
            ...this.currentCardBackSettings,
            color
          });
        }
      });
    });

    // Color picker input: live preview while dragging, persist once on commit
    this.cardBackCustomColorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (color) {
        this.applyCardBackChange({
          ...this.currentCardBackSettings,
          color
        }, false);
      }
    });
    this.cardBackCustomColorInput.addEventListener('change', () => {
      this.callbacks.onCardBackChanged?.(this.getCardBackSettings(), true);
    });

    // Reset Default
    const cardBackResetBtn = this.cardBackModalOverlay.querySelector('#cardback-reset-btn')!;
    cardBackResetBtn.addEventListener('click', () => {
      this.applyCardBackChange({ ...DEFAULT_CARD_BACK_SETTINGS });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.seedModalOverlay.style.display !== 'none') {
          this.closeSeedModal();
        }
        if (this.cardBackModalOverlay.style.display !== 'none') {
          this.closeCardBackModal();
        }
      }
    });
  }

  public setCardBackSettings(settings: CardBackSettings): void {
    this.currentCardBackSettings = { ...settings };
    this.updateCardBackUI();
  }

  public getCardBackSettings(): CardBackSettings {
    return { ...this.currentCardBackSettings };
  }

  private applyCardBackChange(settings: CardBackSettings, commit = true): void {
    this.currentCardBackSettings = { ...settings };
    this.updateCardBackUI();
    this.callbacks.onCardBackChanged?.(this.getCardBackSettings(), commit);
  }

  private updateCardBackUI(): void {
    if (this.cardBackPreviewCanvas) {
      CardMeshFactory.drawCardBackToCanvas(this.cardBackPreviewCanvas, this.currentCardBackSettings);
    }

    if (this.cardBackCustomColorInput) {
      this.cardBackCustomColorInput.value = this.currentCardBackSettings.color;
    }

    if (this.cardBackColorHexEl) {
      this.cardBackColorHexEl.textContent = this.currentCardBackSettings.color.toUpperCase();
    }

    this.cardBackSymbolBtns.forEach((btn) => {
      const isActive = btn.dataset.symbol === this.currentCardBackSettings.symbol;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    this.cardBackSwatches.forEach((btn) => {
      const isActive = btn.dataset.color?.toLowerCase() === this.currentCardBackSettings.color.toLowerCase();
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  public openCardBackModal(): void {
    this.closeSeedModal();
    this.updateCardBackUI();
    this.cardBackModalOverlay.style.display = 'flex';
  }

  public closeCardBackModal(): void {
    this.cardBackModalOverlay.style.display = 'none';
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

  public updateSeed(seed: number | string): void {
    this.currentSeed = seed;
    if (this.seedValEl) {
      this.seedValEl.textContent = String(seed);
    }
    if (this.seedModalCurrent) {
      this.seedModalCurrent.textContent = String(seed);
    }
  }

  public openSeedModal(): void {
    if (this.seedModalCurrent) {
      this.seedModalCurrent.textContent = String(this.currentSeed);
    }
    if (this.seedInput) {
      this.seedInput.value = '';
    }
    this.seedModalOverlay.style.display = 'flex';
  }

  public closeSeedModal(): void {
    this.seedModalOverlay.style.display = 'none';
  }

  public copyShareLink(): void {
    if (!this.currentSeed || this.currentSeed === '---') {
      this.showToast('No active seed to share');
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(this.currentSeed));
    const shareUrl = url.toString();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast('Share link copied to clipboard!');
      }).catch(() => {
        this.fallbackCopyText(shareUrl);
      });
    } else {
      this.fallbackCopyText(shareUrl);
    }
  }

  private fallbackCopyText(text: string): void {
    try {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.showToast('Share link copied to clipboard!');
    } catch {
      this.showToast(`Seed URL: ?seed=${this.currentSeed}`);
    }
  }
}

