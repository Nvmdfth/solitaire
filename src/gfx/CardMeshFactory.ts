import * as THREE from 'three';
import { Card, Rank, Suit, CardBackSettings, CARD_BACK_SUIT_SYMBOLS, DEFAULT_CARD_BACK_SETTINGS } from '../core/types';
import { getCardColor, getRankSymbol, getSuitSymbol } from '../core/Card';
import { Card3D } from './Card3D';

export class CardMeshFactory {
  private static cardGeometry: THREE.BufferGeometry | null = null;
  private static plateGeometry: THREE.BufferGeometry | null = null;
  private static backCanvas: HTMLCanvasElement | null = null;
  private static backTexture: THREE.CanvasTexture | null = null;
  private static edgeMaterial: THREE.MeshStandardMaterial | null = null;
  private static backMaterial: THREE.MeshStandardMaterial | null = null;
  private static frontTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  private static currentCardBackSettings: CardBackSettings = { ...DEFAULT_CARD_BACK_SETTINGS };


  public static CARD_WIDTH = 0.92;
  public static CARD_HEIGHT = 1.36;
  public static CARD_THICKNESS = 0.012;
  public static CORNER_RADIUS = 0.06;

  public static getCardGeometry(): THREE.BufferGeometry {
    if (this.cardGeometry) {
      return this.cardGeometry;
    }

    const w = this.CARD_WIDTH;
    const h = this.CARD_HEIGHT;
    const r = this.CORNER_RADIUS;
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

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: this.CARD_THICKNESS,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.004,
      bevelThickness: 0.002,
      curveSegments: 16
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.center();
    this.cardGeometry = geom;
    return geom;
  }

  public static getPlateGeometry(): THREE.BufferGeometry {
    if (this.plateGeometry) {
      return this.plateGeometry;
    }
    const geom = new THREE.PlaneGeometry(this.CARD_WIDTH - 0.02, this.CARD_HEIGHT - 0.02);
    this.plateGeometry = geom;
    return geom;
  }

  public static drawCardBackToCanvas(canvas: HTMLCanvasElement, settings: CardBackSettings = DEFAULT_CARD_BACK_SETTINGS): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseW = 512;
    const baseH = 740;
    const sx = canvas.width / baseW;
    const sy = canvas.height / baseH;

    ctx.save();
    ctx.scale(sx, sy);

    // 1. Crisp warm ivory border base
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, baseW, baseH);

    // 2. Subtle outer slate bevel border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, baseW - 8, baseH - 8);

    // 3. Custom color Pattern Background
    const margin = 22;
    const baseCol = settings.color || DEFAULT_CARD_BACK_SETTINGS.color;
    ctx.fillStyle = baseCol;
    ctx.fillRect(margin, margin, baseW - margin * 2, baseH - margin * 2);

    // 4. Double metallic gold filigree frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(margin + 10, margin + 10, baseW - (margin + 10) * 2, baseH - (margin + 10) * 2);

    ctx.strokeStyle = 'rgba(254, 243, 199, 0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(margin + 20, margin + 20, baseW - (margin + 20) * 2, baseH - (margin + 20) * 2);

    // 5. Diamond lattice mesh pattern bounded inside inner frame
    const bx0 = margin + 22;
    const by0 = margin + 22;
    const bx1 = baseW - margin - 22;
    const by1 = baseH - margin - 22;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 3;
    const step = 32;
    ctx.beginPath();
    for (let x = bx0 - (by1 - by0); x < bx1; x += step) {
      ctx.moveTo(x, by0);
      ctx.lineTo(x + (by1 - by0), by1);
      ctx.moveTo(x, by1);
      ctx.lineTo(x + (by1 - by0), by0);
    }
    ctx.stroke();
    ctx.restore();

    // Corner gold rosettes
    const corners = [
      [margin + 36, margin + 36],
      [baseW - margin - 36, margin + 36],
      [margin + 36, baseH - margin - 36],
      [baseW - margin - 36, baseH - margin - 36]
    ];
    ctx.fillStyle = '#fbbf24';
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Center Medallion with luminous gradient and double gold ring
    const centerX = baseW / 2;
    const centerY = baseH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 112, 152, 0, 0, Math.PI * 2);
    ctx.fillStyle = baseCol;
    ctx.fill();

    const grad = ctx.createRadialGradient(centerX, centerY - 24, 10, centerX, centerY, 145);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 9;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 98, 138, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(254, 243, 199, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 7. Center Suit Emblem
    const suitSymbol = CARD_BACK_SUIT_SYMBOLS[settings.symbol] || '♠';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 92px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitSymbol, centerX, centerY + 3);
    ctx.restore();

    // 8. Bottom dark stack separator line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, baseH - 12, baseW, 12);

    ctx.restore();
  }

  public static getCardBackSettings(): CardBackSettings {
    return { ...this.currentCardBackSettings };
  }

  public static setCardBackSettings(settings: CardBackSettings): void {
    this.currentCardBackSettings = { ...settings };
    if (this.backCanvas) {
      this.drawCardBackToCanvas(this.backCanvas, this.currentCardBackSettings);
      if (this.backTexture) {
        this.backTexture.needsUpdate = true;
      }
      if (this.backMaterial) {
        this.backMaterial.needsUpdate = true;
      }
    }
  }

  public static getBackTexture(): THREE.CanvasTexture {
    if (this.backTexture) {
      return this.backTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 740;
    this.backCanvas = canvas;
    this.drawCardBackToCanvas(canvas, this.currentCardBackSettings);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    this.backTexture = texture;
    return texture;
  }


  public static getFrontTexture(card: Card): THREE.CanvasTexture {
    const key = `${card.suit}_${card.rank}`;
    if (this.frontTextureCache.has(key)) {
      return this.frontTextureCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 740;
    const ctx = canvas.getContext('2d')!;

    // Warm ivory casino card paper
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Distinct dark outer border around every card (defines stack lines clearly)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Inner delicate gold-tinted hairline frame
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    // Bottom dark stack separator line (ensures clear visibility when stacked)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, canvas.height - 12, canvas.width, 12);

    const isRed = getCardColor(card.suit) === 'red';
    const color = isRed ? '#c81e1e' : '#0f172a'; // Rich crimson or deep obsidian ink
    const rankSymbol = getRankSymbol(card.rank);
    const suitSymbol = getSuitSymbol(card.suit);

    // Draw Crisp Corner Indices (Top-Left & Bottom-Right)
    const drawCorner = (x: number, y: number, isBottom: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      if (isBottom) {
        ctx.rotate(Math.PI);
      }
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Bold Rank Number (tighter width for '10')
      ctx.font = rankSymbol === '10'
        ? '900 124px -apple-system, BlinkMacSystemFont, "Trebuchet MS", "Arial Black", sans-serif'
        : '900 136px -apple-system, BlinkMacSystemFont, "Trebuchet MS", "Arial Black", sans-serif';
      ctx.fillText(rankSymbol, 0, 0);

      // Crisp Suit Symbol
      ctx.font = 'bold 108px Georgia, serif';
      ctx.fillText(suitSymbol, 0, 128);
      ctx.restore();
    };

    drawCorner(76, 20, false);
    drawCorner(canvas.width - 76, canvas.height - 20, true);

    // Center Graphics
    if (card.rank >= 11) {
      // Royal Court Cards (Jack, Queen, King)
      this.drawCourtCard(ctx, card.rank, card.suit, color, isRed);
    } else if (card.rank === 1) {
      // Ace: Ornate Center Emblem with subtle gold halo
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 128, 0, Math.PI * 2);
      ctx.fillStyle = isRed ? 'rgba(200, 30, 30, 0.05)' : 'rgba(15, 23, 42, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 290px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suitSymbol, canvas.width / 2, canvas.height / 2 + 8);
      ctx.restore();
    } else {
      // Numbered Cards (2-10): High-Contrast Pips
      this.drawPips(ctx, card.rank, suitSymbol, color);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    this.frontTextureCache.set(key, texture);
    return texture;
  }

  private static drawPips(ctx: CanvasRenderingContext2D, rank: Rank, suitSymbol: string, color: string) {
    ctx.fillStyle = color;
    ctx.font = 'bold 126px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = 256;
    const cy = 370;
    const colL = 185;
    const colR = 327;
    const rowT = 190;
    const rowM = 280;
    const rowC = 370;
    const rowB = 460;
    const rowBot = 550;

    const drawPip = (x: number, y: number, inverted: boolean = false) => {
      ctx.save();
      ctx.translate(x, y);
      if (inverted) ctx.rotate(Math.PI);
      ctx.fillText(suitSymbol, 0, 0);
      ctx.restore();
    };

    switch (rank) {
      case 2:
        drawPip(cx, rowT);
        drawPip(cx, rowBot, true);
        break;
      case 3:
        drawPip(cx, rowT);
        drawPip(cx, rowC);
        drawPip(cx, rowBot, true);
        break;
      case 4:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
      case 5:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(cx, cy);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
      case 6:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(colL, rowC);
        drawPip(colR, rowC);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
      case 7:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(cx, (rowT + rowC) / 2);
        drawPip(colL, rowC);
        drawPip(colR, rowC);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
      case 8:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(cx, (rowT + rowC) / 2);
        drawPip(colL, rowC);
        drawPip(colR, rowC);
        drawPip(cx, (rowC + rowBot) / 2, true);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
      case 9:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(colL, rowM);
        drawPip(colR, rowM);
        drawPip(cx, cy);
        drawPip(colL, rowB, true);
        drawPip(colR, rowB, true);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
      case 10:
        drawPip(colL, rowT);
        drawPip(colR, rowT);
        drawPip(cx, (rowT + rowM) / 2);
        drawPip(colL, rowM);
        drawPip(colR, rowM);
        drawPip(colL, rowB, true);
        drawPip(colR, rowB, true);
        drawPip(cx, (rowB + rowBot) / 2, true);
        drawPip(colL, rowBot, true);
        drawPip(colR, rowBot, true);
        break;
    }
  }

  private static drawCourtCard(
    ctx: CanvasRenderingContext2D,
    rank: Rank,
    suit: Suit,
    color: string,
    isRed: boolean
  ) {
    const cx = 256;
    const cy = 370;
    const w = 256;
    const h = 424;

    // Outer Royal Portrait Frame
    ctx.fillStyle = isRed ? '#fef2f2' : '#f8fafc';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    // Double Gold Filigree Border
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 7;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20);

    const title = rank === 11 ? 'JACK' : rank === 12 ? 'QUEEN' : 'KING';
    const crown = rank === 11 ? '⚔' : rank === 12 ? '♛' : '♚';

    // Royal Banner Header
    ctx.fillStyle = isRed ? '#991b1b' : '#0f172a';
    ctx.fillRect(cx - w / 2 + 16, cy - 156, w - 32, 48);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - w / 2 + 16, cy - 156, w - 32, 48);

    ctx.fillStyle = '#fef3c7';
    ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, cx, cy - 131);

    // Center Medallion Halo
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 76, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Royal Center Crown / Weapon
    ctx.fillStyle = color;
    ctx.font = '136px Georgia, serif';
    ctx.fillText(crown, cx, cy - 6);

    // Royal Bottom Suit
    ctx.font = 'bold 104px Georgia, serif';
    ctx.fillText(getSuitSymbol(suit), cx, cy + 128);
  }

  public static createCardMesh(card: Card): Card3D {
    if (typeof document === 'undefined') {
      return new Card3D(card);
    }

    const cardBodyGeom = this.getCardGeometry();
    const plateGeom = this.getPlateGeometry();

    if (!this.edgeMaterial) {
      this.edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.0
      });
    }

    if (!this.backMaterial) {
      this.backMaterial = new THREE.MeshStandardMaterial({
        map: this.getBackTexture(),
        roughness: 0.3,
        metalness: 0.05,
        side: THREE.FrontSide
      });
    }

    const frontMaterial = new THREE.MeshStandardMaterial({
      map: this.getFrontTexture(card),
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.FrontSide
    });

    // 1. Solid Card Paper Core
    const cardBodyMesh = new THREE.Mesh(cardBodyGeom, this.edgeMaterial);
    cardBodyMesh.castShadow = true;
    cardBodyMesh.receiveShadow = true;

    // 2. Front Face Plate (Offset slightly forward on +Z to prevent z-fighting)
    const frontPlateMesh = new THREE.Mesh(plateGeom, frontMaterial);
    frontPlateMesh.position.z = this.CARD_THICKNESS / 2 + 0.003;
    frontPlateMesh.castShadow = false;
    frontPlateMesh.receiveShadow = true;

    // 3. Back Face Plate (Offset slightly backward on -Z to prevent z-fighting)
    const backPlateMesh = new THREE.Mesh(plateGeom, this.backMaterial);
    backPlateMesh.rotation.y = Math.PI;
    backPlateMesh.position.z = -(this.CARD_THICKNESS / 2 + 0.003);
    backPlateMesh.castShadow = false;
    backPlateMesh.receiveShadow = true;

    const group = new THREE.Group();
    group.add(cardBodyMesh);
    group.add(frontPlateMesh);
    group.add(backPlateMesh);

    // Initial rotation strictly synced with isFaceUp
    group.rotation.set(0, card.isFaceUp ? 0 : Math.PI, 0);

    return new Card3D(card, group);
  }
}
