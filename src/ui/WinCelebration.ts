export class WinCelebration {
  private container: HTMLElement;
  private modalEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public show(
    score: number,
    moves: number,
    timeSeconds: number,
    onPlayAgain: () => void
  ): void {
    this.hide();

    const minutes = Math.floor(timeSeconds / 60);
    const seconds = timeSeconds % 60;
    const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'win-modal-overlay';
    this.modalEl.innerHTML = `
      <div class="win-modal-card">
        <div class="win-trophy">🏆</div>
        <h1 class="win-title">YOU WON!</h1>
        <p class="win-subtitle">Congratulations, Solitaire Master!</p>
        
        <div class="win-stats-grid">
          <div class="win-stat-item">
            <span class="win-stat-label">Final Score</span>
            <span class="win-stat-val">${score}</span>
          </div>
          <div class="win-stat-item">
            <span class="win-stat-label">Total Moves</span>
            <span class="win-stat-val">${moves}</span>
          </div>
          <div class="win-stat-item">
            <span class="win-stat-label">Time</span>
            <span class="win-stat-val">${timeFormatted}</span>
          </div>
        </div>

        <button class="win-btn-play" id="btn-play-again">PLAY AGAIN</button>
      </div>
    `;

    this.container.appendChild(this.modalEl);

    const btn = this.modalEl.querySelector('#btn-play-again');
    if (btn) {
      btn.addEventListener('click', () => {
        this.hide();
        onPlayAgain();
      });
    }
  }

  public hide(): void {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }
}
