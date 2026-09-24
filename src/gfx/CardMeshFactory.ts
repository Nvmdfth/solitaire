import * as THREE from 'three';
import { Card, Rank, Suit } from '../core/types';
import { getCardColor, getRankSymbol, getSuitSymbol } from '../core/Card';
import { Card3D } from './Card3D';

export class CardMeshFactory {
  private static cardGeometry: THREE.BufferGeometry | null = null;
  private static plateGeometry: THREE.BufferGeometry | null = null;
  private static backTexture: THREE.CanvasTexture | null = null;
  private static edgeMaterial: THREE.MeshStandardMaterial | null = null;
  private static backMaterial: THREE.MeshStandardMaterial | null = null;
  private static frontTextureCache: Map<string, THREE.CanvasTexture> = new Map();

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

  public static getBackTexture(): THREE.CanvasTexture {
    if (this.backTexture) {
      return this.backTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 740;
    const ctx = canvas.getContext('2d')!;

    // Clean white border base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer dark separator border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Deep Royal Navy Pattern Background
    const margin = 22;
    ctx.fillStyle = '#0f2b5c';
    ctx.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

    // Inner bright gold frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 10;
    ctx.strokeRect(margin + 12, margin + 12, canvas.width - (margin + 12) * 2, canvas.height - (margin + 12) * 2);

    // Diamond lattice mesh pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 4;
    const step = 26;
    for (let x = margin + 16; x < canvas.width - margin - 16; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, margin + 16);
      ctx.lineTo(x + step * 5, canvas.height - margin - 16);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, canvas.height - margin - 16);
      ctx.lineTo(x + step * 5, margin + 16);
      ctx.stroke();
    }

    // Center Gold/Blue Medallion
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 115, 155, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Center Spades Emblem
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♠', canvas.width / 2, canvas.height / 2);

    // Bottom dark stack separator line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvas.height - 12, canvas.width, 12);

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

    // Clean pure white paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Distinct dark outer border around every card (defines stack lines clearly)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Inner hairline frame
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Bottom dark stack separator line (ensures clear visibility when stacked)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, canvas.height - 12, canvas.width, 12);

    const isRed = getCardColor(card.suit) === 'red';
    const color = isRed ? '#dc2626' : '#020617'; // Vibrant bold Red or Jet Black
    const rankSymbol = getRankSymbol(card.rank);
    const suitSymbol = getSuitSymbol(card.suit);

    // Draw Giant Corner Indices (Top-Left & Bottom-Right)
    const drawCorner = (x: number, y: number, isBottom: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      if (isBottom) {
        ctx.rotate(Math.PI);
      }
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Giant Bold Rank Number
      ctx.font = '900 148px "Trebuchet MS", "Arial Black", Arial, sans-serif';
      ctx.fillText(rankSymbol, 0, 0);

      // Giant Crisp Suit Symbol
      ctx.font = 'bold 120px sans-serif';
      ctx.fillText(suitSymbol, 0, 130);
      ctx.restore();
    };

    drawCorner(82, 16, false);
    drawCorner(canvas.width - 82, canvas.height - 16, true);

    // Center Graphics
    if (card.rank >= 11) {
      // Royal Court Cards (Jack, Queen, King)
      this.drawCourtCard(ctx, card.rank, card.suit, color, isRed);
    } else if (card.rank === 1) {
      // Ace: Giant Center Emblem
      ctx.fillStyle = color;
      ctx.font = 'bold 320px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suitSymbol, canvas.width / 2, canvas.height / 2);
    } else {
      // Numbered Cards (2-10): Giant High-Contrast Pips
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
    const w = 260;
    const h = 430;

    // Outer Court Portrait Frame
    ctx.fillStyle = isRed ? '#fef2f2' : '#f8fafc';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 8;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    const title = rank === 11 ? 'JACK' : rank === 12 ? 'QUEEN' : 'KING';
    const crown = rank === 11 ? '⚔' : rank === 12 ? '♛' : '♚';

    // Royal Banner Header
    ctx.fillStyle = isRed ? '#b91c1c' : '#0f172a';
    ctx.fillRect(cx - w / 2 + 10, cy - 135, w - 20, 56);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, cx, cy - 107);

    // Royal Center Crown / Weapon
    ctx.fillStyle = color;
    ctx.font = '150px sans-serif';
    ctx.fillText(crown, cx, cy);

    // Royal Bottom Suit
    ctx.font = 'bold 118px sans-serif';
    ctx.fillText(getSuitSymbol(suit), cx, cy + 120);
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
