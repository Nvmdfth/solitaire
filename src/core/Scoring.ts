export class ScoreManager {
  private score: number = 0;
  private moves: number = 0;
  private startTime: number = Date.now();
  private isPaused: boolean = false;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.score = 0;
    this.moves = 0;
    this.startTime = Date.now();
    this.isPaused = false;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
  }

  public restoreStats(score: number, moves: number, elapsedSeconds: number): void {
    this.score = Math.max(0, score);
    this.moves = Math.max(0, moves);
    this.startTime = Date.now() - (Math.max(0, elapsedSeconds) * 1000);
    this.isPaused = false;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
  }

  public addScore(delta: number): void {
    this.score = Math.max(0, this.score + delta);
  }

  public recordMove(): void {
    this.moves++;
  }

  public getScore(): number {
    return this.score;
  }

  public getMoves(): number {
    return this.moves;
  }

  public getElapsedTime(): number {
    if (this.isPaused) {
      return Math.floor((this.pauseStartTime - this.startTime - this.pausedDuration) / 1000);
    }
    return Math.max(0, Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000));
  }

  public pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.pauseStartTime = Date.now();
    }
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.pausedDuration += Date.now() - this.pauseStartTime;
    }
  }
}
