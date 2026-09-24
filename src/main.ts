import { GameState } from './core/GameState';
import { Card, PileLocation } from './core/types';
import { CommandManager } from './core/Commands';
import { ScoreManager } from './core/Scoring';
import { findBestMove } from './core/HintEngine';
import { SceneManager } from './gfx/SceneManager';
import { CardMeshFactory } from './gfx/CardMeshFactory';
import { Card3D } from './gfx/Card3D';
import { AnimationManager } from './gfx/AnimationManager';
import { InteractionManager } from './input/InteractionManager';
import { SoundEffects } from './audio/SoundEffects';
import { HUD } from './ui/HUD';
import { WinCelebration } from './ui/WinCelebration';

class SolitaireApp {
  private game: GameState;
  private commandManager: CommandManager;
  private scoreManager: ScoreManager;
  private soundEffects: SoundEffects;
  private sceneManager: SceneManager;
  private animationManager: AnimationManager;
  public interactionManager: InteractionManager;
  private hud: HUD;
  private winCelebration: WinCelebration;

  private cardMap: Map<string, Card3D> = new Map();
  private isAutoCompleting: boolean = false;
  private initialDeck: Card[] = [];
  private lastTime: number = performance.now();

  constructor() {
    const canvasContainer = document.getElementById('canvas-container')!;
    const hudContainer = document.getElementById('hud-container')!;

    this.game = new GameState({
      onCardMoved: this.handleCardMoved.bind(this),
      onCardFlipped: this.handleCardFlipped.bind(this),
      onStockDrawn: this.handleStockDrawn.bind(this),
      onWasteRecycled: this.handleWasteRecycled.bind(this),
      onGameWon: this.handleGameWon.bind(this)
    });

    this.commandManager = new CommandManager();
    this.scoreManager = new ScoreManager();
    this.soundEffects = new SoundEffects();
    this.sceneManager = new SceneManager(canvasContainer);
    this.animationManager = new AnimationManager();

    this.hud = new HUD(hudContainer, this.soundEffects, {
      onUndo: this.handleUndo.bind(this),
      onHint: this.handleHint.bind(this),
      onRestart: this.handleRestart.bind(this),
      onNewGame: this.handleNewGame.bind(this),
      onAutoComplete: this.handleStartAutoComplete.bind(this),
      onToggleDrawMode: this.handleToggleDrawMode.bind(this)
    });

    this.winCelebration = new WinCelebration(hudContainer);

    this.interactionManager = new InteractionManager(
      this.game,
      this.commandManager,
      this.scoreManager,
      this.sceneManager,
      this.animationManager,
      this.cardMap,
      {
        onCardMoved: () => this.soundEffects.playSnap(),
        onStockDrawn: () => this.soundEffects.playDeal(),
        onWasteRecycled: () => this.soundEffects.playFlip(),
        onInvalidMove: () => {}
      }
    );

    this.startNewGame();
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const loop = (time: number) => {
      requestAnimationFrame(loop);
      const delta = (time - this.lastTime) / 1000;
      this.lastTime = time;

      this.animationManager.update(delta);
      this.sceneManager.render();

      // Update HUD stats
      this.hud.updateStats(
        this.scoreManager.getScore(),
        this.scoreManager.getMoves(),
        this.scoreManager.getElapsedTime()
      );
      this.hud.setUndoEnabled(this.commandManager.canUndo());
      this.hud.setAutoCompleteVisible(this.game.canAutoComplete() && !this.isAutoCompleting);
    };

    requestAnimationFrame(loop);
  }

  public renderNow(): void {
    this.sceneManager.render();
  }

  private startNewGame(customDeck?: Card[]): void {
    this.winCelebration.hide();
    this.animationManager.stopWinCascade();
    this.isAutoCompleting = false;
    this.commandManager.clear();
    this.scoreManager.reset();

    // Clear existing 3D card meshes from scene
    this.cardMap.forEach((c3d) => {
      if (c3d.mesh) {
        this.sceneManager.scene.remove(c3d.mesh);
      }
    });
    this.cardMap.clear();

    // Initialize state
    this.game.initGame(this.game.drawMode, customDeck);

    // Save initial deck for restart capability
    if (!customDeck) {
      this.saveInitialDeck();
    }

    // Spawn 52 3D Card Meshes
    const allCards: Card[] = [
      ...this.game.stock,
      ...this.game.waste,
      ...this.game.foundations.flat(),
      ...this.game.tableau.flat()
    ];

    allCards.forEach((card) => {
      const card3D = CardMeshFactory.createCardMesh(card);
      this.cardMap.set(card.id, card3D);
      if (card3D.mesh) {
        this.sceneManager.scene.add(card3D.mesh);
      }
    });

    // Start dealing animation from stock position to layout
    this.animateDealSequence();
  }

  private saveInitialDeck(): void {
    this.initialDeck = [
      ...this.game.stock.map(c => ({ ...c })),
      ...this.game.tableau.map(col => col.map(c => ({ ...c }))).flat()
    ];
  }

  private async animateDealSequence(): Promise<void> {
    // Place all stock cards in stock pile
    this.game.stock.forEach((card, idx) => {
      const c3d = this.cardMap.get(card.id);
      if (c3d && c3d.mesh) {
        const pos = this.sceneManager.tabletop.getCardPositionInPile({ type: 'stock', index: 0 }, idx, 0);
        c3d.mesh.position.set(pos.x, pos.y, pos.z);
        c3d.setTargetPosition(pos.x, pos.y, pos.z);
        c3d.mesh.rotation.set(0, Math.PI, 0);
        c3d.isFaceUp = false;
      }
    });

    // Place and reveal all tableau cards across all 7 columns
    for (let col = 0; col < 7; col++) {
      const colCards = this.game.tableau[col];
      for (let row = 0; row < colCards.length; row++) {
        const card = colCards[row];
        const c3d = this.cardMap.get(card.id);
        if (!c3d || !c3d.mesh) continue;

        const isTop = row === colCards.length - 1;
        const targetPos = this.sceneManager.tabletop.getCardPositionInPile(
          { type: 'tableau', index: col },
          row,
          isTop ? 1 : 0
        );

        c3d.mesh.position.set(targetPos.x, targetPos.y, targetPos.z);
        c3d.setTargetPosition(targetPos.x, targetPos.y, targetPos.z);
        c3d.mesh.rotation.set(0, card.isFaceUp ? 0 : Math.PI, 0);
        c3d.isFaceUp = card.isFaceUp;
      }
    }
    
    this.soundEffects.playDeal();
  }

  private handleCardMoved(source: PileLocation, target: PileLocation, cards: Card[]): void {
    this.syncPileVisuals(source);
    this.syncPileVisuals(target);

    // Animate moving cards to their target slots
    cards.forEach((card) => {
      const c3d = this.cardMap.get(card.id);
      if (c3d) {
        const targetPile = this.game.getPile(target);
        const cardIdx = targetPile.indexOf(card);
        const faceUpBefore = target.type === 'tableau' 
          ? targetPile.slice(0, cardIdx).filter(c => c.isFaceUp).length + 1
          : 0;
        const targetPos = this.sceneManager.tabletop.getCardPositionInPile(target, cardIdx, faceUpBefore);
        this.animationManager.animateMove(c3d, targetPos, 0.18, 0.4);
      }
    });
  }

  private handleCardFlipped(card: Card, isFaceUp: boolean): void {
    const c3d = this.cardMap.get(card.id);
    if (c3d) {
      this.soundEffects.playFlip();
      this.animationManager.animateFlip(c3d, isFaceUp, 0.16);
    }
  }

  private handleStockDrawn(drawnCards: Card[]): void {
    this.syncPileVisuals({ type: 'stock', index: 0 });
    this.syncPileVisuals({ type: 'waste', index: 0 });

    drawnCards.forEach((card, idx) => {
      const c3d = this.cardMap.get(card.id);
      if (c3d) {
        const wasteIdx = this.game.waste.length - drawnCards.length + idx;
        const targetPos = this.sceneManager.tabletop.getCardPositionInPile({ type: 'waste', index: 0 }, wasteIdx, 0);
        this.animationManager.animateMove(c3d, targetPos, 0.16, 0.3);
        this.animationManager.animateFlip(c3d, true, 0.14);
      }
    });
  }

  private handleWasteRecycled(): void {
    this.syncPileVisuals({ type: 'stock', index: 0 });
    this.syncPileVisuals({ type: 'waste', index: 0 });

    this.game.stock.forEach((card, idx) => {
      const c3d = this.cardMap.get(card.id);
      if (c3d) {
        const targetPos = this.sceneManager.tabletop.getCardPositionInPile({ type: 'stock', index: 0 }, idx, 0);
        this.animationManager.animateMove(c3d, targetPos, 0.14, 0.2);
        this.animationManager.animateFlip(c3d, false, 0.12);
      }
    });
  }

  private handleGameWon(): void {
    this.soundEffects.playWinFanfare();
    const allFoundationCards: Card3D[] = [];
    this.game.foundations.forEach((f) => {
      f.forEach((c) => {
        const c3d = this.cardMap.get(c.id);
        if (c3d) allFoundationCards.push(c3d);
      });
    });

    this.animationManager.startWinCascade(allFoundationCards);
    this.winCelebration.show(
      this.scoreManager.getScore(),
      this.scoreManager.getMoves(),
      this.scoreManager.getElapsedTime(),
      () => this.startNewGame()
    );
  }

  private syncPileVisuals(location: PileLocation): void {
    const pile = this.game.getPile(location);
    pile.forEach((card, idx) => {
      const c3d = this.cardMap.get(card.id);
      if (c3d && !this.animationManager.hasActiveAnimations && !c3d.isDragging) {
        const faceUpBefore = location.type === 'tableau' 
          ? pile.slice(0, idx).filter(c => c.isFaceUp).length + (card.isFaceUp ? 1 : 0)
          : 0;
        const pos = this.sceneManager.tabletop.getCardPositionInPile(location, idx, faceUpBefore);
        c3d.setTargetPosition(pos.x, pos.y, pos.z);
        c3d.mesh?.position.set(pos.x, pos.y, pos.z);
        c3d.mesh?.rotation.set(0, card.isFaceUp ? 0 : Math.PI, 0);
        c3d.isFaceUp = card.isFaceUp;
      }
    });
  }

  private handleUndo(): void {
    if (this.commandManager.canUndo()) {
      this.soundEffects.playUndo();
      this.commandManager.undo();
      this.syncAllPiles();
    }
  }

  private handleHint(): void {
    const hint = findBestMove(this.game);
    if (hint) {
      this.soundEffects.playHintChime();
      this.hud.showToast(hint.description);
      const c3d = this.cardMap.get(hint.card.id);
      if (c3d && c3d.mesh) {
        // Quick subtle nudge animation
        const origZ = c3d.mesh.position.z;
        c3d.mesh.position.z += 0.25;
        setTimeout(() => {
          if (c3d.mesh) c3d.mesh.position.z = origZ;
        }, 300);
      }
    } else {
      this.hud.showToast('No more useful moves found! Try drawing from stock.');
    }
  }

  private handleRestart(): void {
    this.startNewGame(this.initialDeck.map(c => ({ ...c })));
  }

  private handleNewGame(): void {
    this.startNewGame();
  }

  private handleToggleDrawMode(mode: 1 | 3): void {
    this.game.drawMode = mode;
    this.startNewGame();
  }

  private async handleStartAutoComplete(): Promise<void> {
    if (this.isAutoCompleting) return;
    this.isAutoCompleting = true;

    while (this.game.canAutoComplete() && this.isAutoCompleting) {
      const ok = this.game.autoCompleteStep();
      if (!ok) break;
      this.soundEffects.playSnap();
      await new Promise(r => setTimeout(r, 140));
    }
    this.isAutoCompleting = false;
  }

  private syncAllPiles(): void {
    this.syncPileVisuals({ type: 'stock', index: 0 });
    this.syncPileVisuals({ type: 'waste', index: 0 });
    for (let f = 0; f < 4; f++) {
      this.syncPileVisuals({ type: 'foundation', index: f });
    }
    for (let col = 0; col < 7; col++) {
      this.syncPileVisuals({ type: 'tableau', index: col });
    }
  }
}

// Bootstrap application on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new SolitaireApp();
  (window as any).__solitaire = app;
});
