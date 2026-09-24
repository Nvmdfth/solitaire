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
  public static COL_SPACING = 1.06;
  public static TOP_ROW_Y = 2.6;
  public static TABLEAU_ROW_Y = 0.95;
  public static TABLEAU_CARD_OFFSET_Y = 0.36; // Ample vertical spacing between face-up tableau cards
  public static TABLEAU_HIDDEN_OFFSET_Y = 0.14; // Spacing between face-down cards
  public static CARD_STACK_Z_OFFSET = 0.012; // Distinct physical elevation between stacked cards

  constructor() {
    this.mesh = new THREE.Group();
    this.createFeltTable();
    this.createSlots();
  }

  private createFeltTable(): void {
    const tableGeom = new THREE.PlaneGeometry(16, 22);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x093016, // Rich emerald casino green felt
      roughness: 0.9,
      metalness: 0.02
    });

    const feltMesh = new THREE.Mesh(tableGeom, tableMat);
    feltMesh.receiveShadow = true;
    feltMesh.position.z = -0.01;
    this.mesh.add(feltMesh);
  }

  private createSlotMesh(label: string, icon: string = '', subtitle: string = ''): THREE.Mesh {
    const w = CardMeshFactory.CARD_WIDTH;
    const h = CardMeshFactory.CARD_HEIGHT;
    const geom = new THREE.PlaneGeometry(w, h);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 370;
    const ctx = canvas.getContext('2d')!;

    // Draw high-contrast rounded slot outline
    const rx = 10;
    const ry = 10;
    const rw = canvas.width - 20;
    const rh = canvas.height - 20;
    const radius = 24;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 10]);

    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill subtle inner tint for slot visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();

    // Center icon
    if (icon) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, canvas.width / 2, canvas.height / 2 - (subtitle ? 18 : 0));
    }

    // Subtitle label
    if (subtitle) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 24px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(subtitle, canvas.width / 2, canvas.height - 24);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = 0.001;
    mesh.name = `slot_${label}`;
    return mesh;
  }

  private createSlots(): void {
    if (typeof document === 'undefined') return;

    // Stock Slot (Top Left - Col 0)
    const stockSlot = this.createSlotMesh('stock', '↻', 'STOCK');
    const stockPos = this.getSlotPosition({ type: 'stock', index: 0 });
    stockSlot.position.set(stockPos.x, stockPos.y, stockPos.z);
    this.mesh.add(stockSlot);
    this.slotMeshes.set('stock', stockSlot);

    // Waste Slot (Top Left - Col 1)
    const wasteSlot = this.createSlotMesh('waste', '', 'WASTE');
    const wastePos = this.getSlotPosition({ type: 'waste', index: 0 });
    wasteSlot.position.set(wastePos.x, wastePos.y, wastePos.z);
    this.mesh.add(wasteSlot);
    this.slotMeshes.set('waste', wasteSlot);

    // 4 Foundations (Top Right - Cols 3, 4, 5, 6)
    const suitIcons = ['♥', '♦', '♣', '♠'];
    const suitLabels = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
    for (let f = 0; f < 4; f++) {
      const fSlot = this.createSlotMesh(`foundation_${f}`, suitIcons[f], suitLabels[f]);
      const pos = this.getSlotPosition({ type: 'foundation', index: f });
      fSlot.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(fSlot);
      this.slotMeshes.set(`foundation_${f}`, fSlot);
    }

    // 7 Tableau column markers
    for (let col = 0; col < 7; col++) {
      const tSlot = this.createSlotMesh(`tableau_${col}`, 'K', `COL ${col + 1}`);
      const pos = this.getSlotPosition({ type: 'tableau', index: col });
      tSlot.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(tSlot);
      this.slotMeshes.set(`tableau_${col}`, tSlot);
    }
  }

  public getSlotPosition(location: PileLocation): SlotCoordinates {
    const startX = -3 * Tabletop.COL_SPACING;

    switch (location.type) {
      case 'stock':
        return { x: startX + 0 * Tabletop.COL_SPACING, y: Tabletop.TOP_ROW_Y, z: 0.002 };
      case 'waste':
        return { x: startX + 1 * Tabletop.COL_SPACING, y: Tabletop.TOP_ROW_Y, z: 0.002 };
      case 'foundation':
        return { x: startX + (3 + location.index) * Tabletop.COL_SPACING, y: Tabletop.TOP_ROW_Y, z: 0.002 };
      case 'tableau':
        return { x: startX + location.index * Tabletop.COL_SPACING, y: Tabletop.TABLEAU_ROW_Y, z: 0.002 };
    }
  }

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
      const hiddenCount = Math.max(0, cardIndexInPile - faceUpCountBefore);
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
