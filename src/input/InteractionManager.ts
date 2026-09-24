import * as THREE from 'three';
import { GameState } from '../core/GameState';
import { Card, PileLocation } from '../core/types';
import { CommandManager, MoveCardsCommand, DrawStockCommand, RecycleWasteCommand } from '../core/Commands';
import { ScoreManager } from '../core/Scoring';
import { SceneManager } from '../gfx/SceneManager';
import { Card3D } from '../gfx/Card3D';
import { Tabletop } from '../gfx/Tabletop';
import { AnimationManager } from '../gfx/AnimationManager';
import { DragPlane } from './DragPlane';

export interface InteractionCallbacks {
  onCardMoved?: () => void;
  onStockDrawn?: () => void;
  onWasteRecycled?: () => void;
  onCardTapped?: (card: Card) => void;
  onInvalidMove?: () => void;
}

export class InteractionManager {
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private pointer: THREE.Vector2 = new THREE.Vector2();
  private dragPlane: DragPlane = new DragPlane(0.4);

  // Drag state tracking
  private isPointerDown: boolean = false;
  private isDragging: boolean = false;
  private pointerDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private pointerDownTime: number = 0;
  private activePointerId: number | null = null;

  // Selected / Dragged cards
  private draggedCards: Card3D[] = [];
  private dragSourceLocation: PileLocation | null = null;
  private dragStartPositions: THREE.Vector3[] = [];
  private dragOffset: THREE.Vector3 = new THREE.Vector3();

  // Highlight indicator
  private highlightMesh: THREE.Mesh | null = null;

  constructor(
    private game: GameState,
    private commandManager: CommandManager,
    private scoreManager: ScoreManager,
    private sceneManager: SceneManager,
    private animationManager: AnimationManager,
    private cardMap: Map<string, Card3D>,
    private callbacks: InteractionCallbacks = {}
  ) {
    this.initEventListeners();
    this.createHighlightMesh();
  }

  private createHighlightMesh(): void {
    const geom = new THREE.PlaneGeometry(1.15, 1.55);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.highlightMesh = new THREE.Mesh(geom, mat);
    this.highlightMesh.position.z = 0.003;
    this.highlightMesh.visible = false;
    this.sceneManager.scene.add(this.highlightMesh);
  }

  private initEventListeners(): void {
    const dom = this.sceneManager.renderer.domElement;
    dom.style.touchAction = 'none'; // Prevent default browser touch scrolling/gestures

    dom.addEventListener('pointerdown', this.onPointerDown.bind(this));
    dom.addEventListener('pointermove', this.onPointerMove.bind(this));
    dom.addEventListener('pointerup', this.onPointerUp.bind(this));
    dom.addEventListener('pointercancel', this.onPointerUp.bind(this));
  }

  private updatePointerCoords(event: PointerEvent): void {
    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.animationManager.hasActiveAnimations) return;
    if (this.isPointerDown) return;

    this.isPointerDown = true;
    this.activePointerId = event.pointerId;
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
    this.pointerDownTime = Date.now();
    this.isDragging = false;

    this.updatePointerCoords(event);
    this.raycaster.setFromCamera(this.pointer, this.sceneManager.camera);

    // 1. Check if stock slot or stock card was clicked
    const stockSlot = this.sceneManager.tabletop.slotMeshes.get('stock');
    if (stockSlot) {
      const stockHits = this.raycaster.intersectObject(stockSlot);
      if (stockHits.length > 0) {
        // Tap on empty stock slot -> recycle waste
        if (this.game.stock.length === 0 && this.game.waste.length > 0) {
          const recycleCmd = new RecycleWasteCommand(this.game, this.scoreManager);
          this.commandManager.execute(recycleCmd);
          if (this.callbacks.onWasteRecycled) this.callbacks.onWasteRecycled();
          this.isPointerDown = false;
          return;
        }
      }
    }

    // 2. Intersect with card meshes
    const cardMeshes: THREE.Object3D[] = [];
    this.cardMap.forEach((c3d) => {
      if (c3d.mesh) {
        cardMeshes.push(c3d.mesh);
      }
    });

    const hits = this.raycaster.intersectObjects(cardMeshes, true);
    if (hits.length > 0) {
      // Find the top-most card hit
      let hitObject = hits[0].object;
      while (hitObject.parent && !(hitObject as any).userData?.card3D) {
        hitObject = hitObject.parent;
      }

      const card3D: Card3D | undefined = (hitObject as any)?.userData?.card3D;
      if (!card3D) return;

      const location = this.findCardLocation(card3D.card);
      if (!location) return;

      // Click on Stock Pile
      if (location.type === 'stock') {
        const drawCmd = new DrawStockCommand(this.game, this.scoreManager);
        this.commandManager.execute(drawCmd);
        if (this.callbacks.onStockDrawn) this.callbacks.onStockDrawn();
        this.isPointerDown = false;
        return;
      }

      // Can only drag / interact with face-up cards
      if (!card3D.card.isFaceUp) return;

      // Setup dragged stack
      this.dragSourceLocation = location;
      this.draggedCards = [];
      this.dragStartPositions = [];

      const sourcePile = this.game.getPile(location);
      const cardIndex = sourcePile.indexOf(card3D.card);

      if (location.type === 'tableau') {
        // Pick up all face-up cards below this card in the column
        const stackCards = sourcePile.slice(cardIndex);
        stackCards.forEach((c) => {
          const c3d = this.cardMap.get(c.id);
          if (c3d && c3d.mesh) {
            this.draggedCards.push(c3d);
            this.dragStartPositions.push(c3d.mesh.position.clone());
          }
        });
      } else {
        // Single card from Waste or Foundation
        this.draggedCards.push(card3D);
        this.dragStartPositions.push(card3D.mesh!.position.clone());
      }

      // Calculate initial drag intersection offset
      const planeIntersect = this.dragPlane.getIntersection(this.pointer.x, this.pointer.y, this.sceneManager.camera);
      if (planeIntersect && card3D.mesh) {
        this.dragOffset.copy(card3D.mesh.position).sub(planeIntersect);
      }
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isPointerDown || this.draggedCards.length === 0) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;

    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Drag threshold of 6 pixels
    if (!this.isDragging && dist > 6) {
      this.isDragging = true;
    }

    if (this.isDragging) {
      this.updatePointerCoords(event);
      const intersect = this.dragPlane.getIntersection(this.pointer.x, this.pointer.y, this.sceneManager.camera);
      if (intersect) {
        const leadPos = intersect.clone().add(this.dragOffset);
        leadPos.z = 0.55; // Elevated above table and stacks

        // Dynamic tilt based on movement velocity
        const tiltX = THREE.MathUtils.clamp(-dy * 0.003, -0.2, 0.2);
        const tiltY = THREE.MathUtils.clamp(dx * 0.003, -0.2, 0.2);

        this.draggedCards.forEach((c3d, idx) => {
          if (c3d.mesh) {
            const cardY = leadPos.y - idx * Tabletop.TABLEAU_CARD_OFFSET_Y;
            const cardZ = leadPos.z + idx * Tabletop.CARD_STACK_Z_OFFSET;
            c3d.mesh.position.set(leadPos.x, cardY, cardZ);
            c3d.mesh.rotation.x = tiltX;
            c3d.mesh.rotation.z = -tiltY;
          }
        });

        // Highlight potential target slot
        this.updateDropHighlight(leadPos.x, leadPos.y);
      }
    }
  }

  private onPointerUp(_event: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.activePointerId = null;
    this.hideDropHighlight();

    if (this.draggedCards.length === 0 || !this.dragSourceLocation) {
      this.cleanupDrag();
      return;
    }

    const elapsed = Date.now() - this.pointerDownTime;
    const leadCard3D = this.draggedCards[0];

    // Single Tap detection (fast click with minimal movement)
    if (!this.isDragging && elapsed < 350) {
      this.handleSingleTap(leadCard3D);
      this.cleanupDrag();
      return;
    }

    // Drag and drop release
    if (this.isDragging && leadCard3D.mesh) {
      const dropTarget = this.findDropTarget(leadCard3D.mesh.position.x, leadCard3D.mesh.position.y);

      if (dropTarget && this.game.canMoveCards(this.dragSourceLocation, dropTarget, this.draggedCards.length)) {
        // Execute valid move command
        const moveCmd = new MoveCardsCommand(
          this.game,
          this.scoreManager,
          this.dragSourceLocation,
          this.dropTargetToPileLocation(dropTarget),
          this.draggedCards.length
        );
        this.commandManager.execute(moveCmd);
        if (this.callbacks.onCardMoved) this.callbacks.onCardMoved();
      } else {
        // Snap back to original position
        this.snapBack();
        if (this.callbacks.onInvalidMove) this.callbacks.onInvalidMove();
      }
    } else {
      this.snapBack();
    }

    this.cleanupDrag();
  }

  private handleSingleTap(card3D: Card3D): void {
    if (!this.dragSourceLocation) return;
    const autoTarget = this.game.findAutoMoveTarget(this.dragSourceLocation, card3D.card);

    if (autoTarget) {
      const count = this.draggedCards.length;
      const moveCmd = new MoveCardsCommand(
        this.game,
        this.scoreManager,
        this.dragSourceLocation,
        autoTarget,
        count
      );
      this.commandManager.execute(moveCmd);
      if (this.callbacks.onCardMoved) this.callbacks.onCardMoved();
    } else {
      if (this.callbacks.onCardTapped) this.callbacks.onCardTapped(card3D.card);
      this.snapBack();
    }
  }

  private snapBack(): void {
    this.draggedCards.forEach((c3d, idx) => {
      if (c3d.mesh && this.dragStartPositions[idx]) {
        this.animationManager.animateMove(c3d, this.dragStartPositions[idx], 0.15, 0.1);
        c3d.mesh.rotation.x = 0;
        c3d.mesh.rotation.z = 0;
      }
    });
  }

  private cleanupDrag(): void {
    this.draggedCards.forEach((c3d) => {
      if (c3d.mesh) {
        c3d.mesh.rotation.x = 0;
        c3d.mesh.rotation.z = 0;
      }
    });
    this.draggedCards = [];
    this.dragStartPositions = [];
    this.dragSourceLocation = null;
    this.isDragging = false;
  }

  private findDropTarget(x: number, y: number): PileLocation | null {
    const colSpacing = Tabletop.COL_SPACING;
    const startX = -3 * colSpacing;
    const thresholdX = colSpacing * 0.6;

    // Check Foundations (Top Row, y > 1.6)
    if (y > 1.6) {
      for (let f = 0; f < 4; f++) {
        const fx = startX + (3 + f) * colSpacing;
        if (Math.abs(x - fx) < thresholdX) {
          return { type: 'foundation', index: f };
        }
      }
    }

    // Check Tableau Columns (y < 2.0)
    for (let col = 0; col < 7; col++) {
      const colX = startX + col * colSpacing;
      if (Math.abs(x - colX) < thresholdX) {
        return { type: 'tableau', index: col };
      }
    }

    return null;
  }

  private dropTargetToPileLocation(target: PileLocation): PileLocation {
    return target;
  }

  private updateDropHighlight(x: number, y: number): void {
    const target = this.findDropTarget(x, y);
    if (target && this.dragSourceLocation && this.highlightMesh) {
      const isValid = this.game.canMoveCards(this.dragSourceLocation, target, this.draggedCards.length);
      if (isValid) {
        const slotPos = this.sceneManager.tabletop.getSlotPosition(target);
        this.highlightMesh.position.set(slotPos.x, slotPos.y, 0.004);
        (this.highlightMesh.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e); // Green
        this.highlightMesh.visible = true;
        return;
      }
    }
    this.hideDropHighlight();
  }

  private hideDropHighlight(): void {
    if (this.highlightMesh) {
      this.highlightMesh.visible = false;
    }
  }

  private findCardLocation(card: Card): PileLocation | null {
    if (this.game.stock.some(c => c.id === card.id)) {
      return { type: 'stock', index: 0 };
    }
    if (this.game.waste.some(c => c.id === card.id)) {
      return { type: 'waste', index: 0 };
    }
    for (let f = 0; f < 4; f++) {
      if (this.game.foundations[f].some(c => c.id === card.id)) {
        return { type: 'foundation', index: f };
      }
    }
    for (let col = 0; col < 7; col++) {
      if (this.game.tableau[col].some(c => c.id === card.id)) {
        return { type: 'tableau', index: col };
      }
    }
    return null;
  }
}
