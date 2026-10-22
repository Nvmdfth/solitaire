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
    const tableGeom = new THREE.PlaneGeometry(18, 24);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x0a351a, // Rich emerald casino green felt
      roughness: 0.88,
      metalness: 0.03
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

    const rx = 10;
    const ry = 10;
    const rw = canvas.width - 20;
    const rh = canvas.height - 20;
    const radius = 24;

    const traceRoundRect = (x: number, y: number, width: number, height: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // Deep recessed baize well
    traceRoundRect(rx, ry, rw, rh, radius);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();

    // Outer subtle gold-leaf rim
    ctx.strokeStyle = 'rgba(245, 196, 81, 0.42)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner delicate inset hairline
    traceRoundRect(rx + 8, ry + 8, rw - 16, rh - 16, radius - 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    const isRedSuit = icon === '♥' || icon === '♦';

    // Center watermark medallion & icon
    if (icon) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - (subtitle ? 16 : 0), 54, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = isRedSuit ? 'rgba(248, 113, 113, 0.22)' : 'rgba(245, 196, 81, 0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = isRedSuit ? 'rgba(248, 113, 113, 0.55)' : 'rgba(245, 196, 81, 0.48)';
      ctx.font = 'bold 82px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, canvas.width / 2, canvas.height / 2 - (subtitle ? 14 : 0));
      ctx.restore();
    }

    // Subtitle label
    if (subtitle) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(subtitle, canvas.width / 2, canvas.height - 22);
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
