import * as THREE from 'three';
import { PileLocation } from '../core/types';
import { CardMeshFactory } from './CardMeshFactory';

export interface SlotCoordinates {
  x: number;
  y: number;
  z: number;
}

export class Tabletop {
  public mesh: THREE.Group;
  public slotMeshes: Map<string, THREE.Mesh> = new Map();

  // Board layout constants (normalized in 3D units)
  public static COL_SPACING = 1.25;
  public static TOP_ROW_Y = 2.4;
  public static TABLEAU_ROW_Y = 0.8;
  public static TABLEAU_CARD_OFFSET_Y = 0.28; // Vertical spacing between face-up tableau cards
  public static TABLEAU_HIDDEN_OFFSET_Y = 0.12; // Vertical spacing between face-down cards
  public static CARD_STACK_Z_OFFSET = 0.005;

  constructor() {
    this.mesh = new THREE.Group();
    this.createFeltTable();
    this.createSlots();
  }

  private createFeltTable(): void {
    // Large felt plane
    const tableGeom = new THREE.PlaneGeometry(16, 20);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x0f4a24, // Casino green felt
      roughness: 0.9,
      metalness: 0.05
    });

    const feltMesh = new THREE.Mesh(tableGeom, tableMat);
    feltMesh.receiveShadow = true;
    feltMesh.position.z = -0.01;
    this.mesh.add(feltMesh);
  }

  private createSlotMesh(label: string, icon: string = ''): THREE.Mesh {
    const w = CardMeshFactory.CARD_WIDTH;
    const h = CardMeshFactory.CARD_HEIGHT;
    const r = CardMeshFactory.CORNER_RADIUS;

    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;

    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    const geom = new THREE.ShapeGeometry(shape);

    // Canvas texture with subtle border and icon
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 358;
    const ctx = canvas.getContext('2d')!;

    // Transparent with ghost outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    if (icon) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, canvas.width / 2, canvas.height / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.8
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = 0.001;
    mesh.name = `slot_${label}`;
    return mesh;
  }

  private createSlots(): void {
    if (typeof document === 'undefined') return;

    // Stock Slot (Top Left - Col 0)
    const stockSlot = this.createSlotMesh('stock', '↻');
    const stockPos = this.getSlotPosition({ type: 'stock', index: 0 });
    stockSlot.position.set(stockPos.x, stockPos.y, stockPos.z);
    this.mesh.add(stockSlot);
    this.slotMeshes.set('stock', stockSlot);

    // Waste Slot (Top Left - Col 1)
    const wasteSlot = this.createSlotMesh('waste');
    const wastePos = this.getSlotPosition({ type: 'waste', index: 0 });
    wasteSlot.position.set(wastePos.x, wastePos.y, wastePos.z);
    this.mesh.add(wasteSlot);
    this.slotMeshes.set('waste', wasteSlot);

    // 4 Foundations (Top Right - Cols 3, 4, 5, 6)
    const suitIcons = ['♥', '♦', '♣', '♠'];
    for (let f = 0; f < 4; f++) {
      const fSlot = this.createSlotMesh(`foundation_${f}`, suitIcons[f]);
      const pos = this.getSlotPosition({ type: 'foundation', index: f });
      fSlot.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(fSlot);
      this.slotMeshes.set(`foundation_${f}`, fSlot);
    }

    // 7 Tableau column markers
    for (let col = 0; col < 7; col++) {
      const tSlot = this.createSlotMesh(`tableau_${col}`, 'K');
      const pos = this.getSlotPosition({ type: 'tableau', index: col });
      tSlot.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(tSlot);
      this.slotMeshes.set(`tableau_${col}`, tSlot);
    }
  }

  /**
   * Calculates slot base coordinates in 3D scene space
   */
  public getSlotPosition(location: PileLocation): SlotCoordinates {
    const startX = -3 * Tabletop.COL_SPACING;

    switch (location.type) {
      case 'stock':
        return { x: startX + 0 * Tabletop.COL_SPACING, y: Tabletop.TOP_ROW_Y, z: 0.002 };
      case 'waste':
        return { x: startX + 1 * Tabletop.COL_SPACING, y: Tabletop.TOP_ROW_Y, z: 0.002 };
      case 'foundation':
        // Foundations at cols 3, 4, 5, 6
        return { x: startX + (3 + location.index) * Tabletop.COL_SPACING, y: Tabletop.TOP_ROW_Y, z: 0.002 };
      case 'tableau':
        return { x: startX + location.index * Tabletop.COL_SPACING, y: Tabletop.TABLEAU_ROW_Y, z: 0.002 };
    }
  }

  /**
   * Calculates specific card position within a pile
   */
  public getCardPositionInPile(location: PileLocation, cardIndexInPile: number, faceUpCountBefore: number = 0): SlotCoordinates {
    const base = this.getSlotPosition(location);

    if (location.type === 'stock') {
      return {
        x: base.x,
        y: base.y,
        z: base.z + cardIndexInPile * Tabletop.CARD_STACK_Z_OFFSET
      };
    }

    if (location.type === 'waste') {
      return {
        x: base.x,
        y: base.y,
        z: base.z + cardIndexInPile * Tabletop.CARD_STACK_Z_OFFSET
      };
    }

    if (location.type === 'foundation') {
      return {
        x: base.x,
        y: base.y,
        z: base.z + cardIndexInPile * Tabletop.CARD_STACK_Z_OFFSET
      };
    }

    if (location.type === 'tableau') {
      const hiddenCount = cardIndexInPile - faceUpCountBefore;
      const offsetY = hiddenCount * Tabletop.TABLEAU_HIDDEN_OFFSET_Y + faceUpCountBefore * Tabletop.TABLEAU_CARD_OFFSET_Y;
      return {
        x: base.x,
        y: base.y - offsetY,
        z: base.z + cardIndexInPile * Tabletop.CARD_STACK_Z_OFFSET
      };
    }

    return base;
  }
}
