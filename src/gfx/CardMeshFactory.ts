import * as THREE from 'three';
import { Card, Rank, Suit } from '../core/types';
import { getCardColor, getRankSymbol, getSuitSymbol } from '../core/Card';
import { Card3D } from './Card3D';

export class CardMeshFactory {
  private static cardGeometry: THREE.BufferGeometry | null = null;
  private static backTexture: THREE.CanvasTexture | null = null;
  private static edgeMaterial: THREE.MeshStandardMaterial | null = null;
  private static backMaterial: THREE.MeshStandardMaterial | null = null;
  private static frontTextureCache: Map<string, THREE.CanvasTexture> = new Map();

  public static CARD_WIDTH = 1.0;
  public static CARD_HEIGHT = 1.4;
  public static CARD_THICKNESS = 0.008;
  public static CORNER_RADIUS = 0.06;

  /**
   * Generates a shared 3D rounded card geometry with physical thickness
   */
  public static getCardGeometry(): THREE.BufferGeometry {
    if (this.cardGeometry) {
      return this.cardGeometry;
    }

    const w = this.CARD_WIDTH;
    const h = this.CARD_HEIGHT;
    const r = this.CORNER_RADIUS;
    const shape = new THREE.Shape();

    // Rounded rectangle shape centered at origin
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
    geom.center(); // Center the 3D geometry around origin

    // Normalize UV coordinates for front and back faces (0 to 1)
    const uvAttr = geom.attributes.uv;
    const posAttr = geom.attributes.position;
    if (uvAttr && posAttr) {
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        // Map [-w/2, w/2] to [0, 1] and [-h/2, h/2] to [0, 1]
        uvAttr.setXY(i, (px + w / 2) / w, (py + h / 2) / h);
      }
      uvAttr.needsUpdate = true;
    }

    this.cardGeometry = geom;
    return geom;
  }

  /**
   * Generates procedural canvas texture for card back
   */
  public static getBackTexture(): THREE.CanvasTexture {
    if (this.backTexture) {
      return this.backTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    const ctx = canvas.getContext('2d')!;

    // Background base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer border
    ctx.fillStyle = '#0a235c'; // Deep navy blue
    const margin = 24;
    ctx.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

    // Inner white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(margin + 12, margin + 12, canvas.width - (margin + 12) * 2, canvas.height - (margin + 12) * 2);

    // Intricate geometric lattice pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    const step = 20;
    for (let x = margin + 20; x < canvas.width - margin - 20; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, margin + 20);
      ctx.lineTo(x + step * 4, canvas.height - margin - 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, canvas.height - margin - 20);
      ctx.lineTo(x + step * 4, margin + 20);
      ctx.stroke();
    }

    // Center circular medallion
    ctx.fillStyle = '#0e3180';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 90, 130, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Medallion inner emblem
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♠', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.backTexture = texture;
    return texture;
  }

  /**
   * Generates procedural canvas texture for card front face
   */
  public static getFrontTexture(card: Card): THREE.CanvasTexture {
    const key = `${card.suit}_${card.rank}`;
    if (this.frontTextureCache.has(key)) {
      return this.frontTextureCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 716;
    const ctx = canvas.getContext('2d')!;

    // Clean white paper with subtle gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f9f9fa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle hairline inner border
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    const color = getCardColor(card.suit) === 'red' ? '#d32f2f' : '#1a1a1a';
    const rankSymbol = getRankSymbol(card.rank);
    const suitSymbol = getSuitSymbol(card.suit);

    // Draw Corner Indices (Top-Left & Bottom-Right)
    const drawCorner = (x: number, y: number, isBottom: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      if (isBottom) {
        ctx.rotate(Math.PI);
      }
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Rank symbol
      ctx.font = 'bold 52px "Trebuchet MS", Arial, sans-serif';
      ctx.fillText(rankSymbol, 0, 0);

      // Suit symbol
      ctx.font = '40px sans-serif';
      ctx.fillText(suitSymbol, 0, 54);
      ctx.restore();
    };

    drawCorner(54, 40, false);
    drawCorner(canvas.width - 54, canvas.height - 40, true);

    // Center Illustration or Pips
    if (card.rank >= 11) {
      // Court Cards (Jack, Queen, King)
      this.drawCourtCard(ctx, card.rank, card.suit, color);
    } else if (card.rank === 1) {
      // Ace: Giant ornate center suit symbol
      ctx.fillStyle = color;
      ctx.font = '160px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suitSymbol, canvas.width / 2, canvas.height / 2);
    } else {
      // Number Cards (2-10): Standard Pip Distributions
      this.drawPips(ctx, card.rank, suitSymbol, color);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.frontTextureCache.set(key, texture);
    return texture;
  }

  private static drawPips(ctx: CanvasRenderingContext2D, rank: Rank, suitSymbol: string, color: string) {
    ctx.fillStyle = color;
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = 256;
    const cy = 358;
    const colL = 170;
    const colR = 342;
    const rowT = 180;
    const rowM = 270;
    const rowC = 358;
    const rowB = 446;
    const rowBot = 536;

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

  private static drawCourtCard(ctx: CanvasRenderingContext2D, rank: Rank, suit: Suit, color: string) {
    const cx = 256;
    const cy = 358;
    const w = 240;
    const h = 380;

    // Court portrait frame
    ctx.strokeStyle = '#c5a059'; // Gold frame
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    // Frame background fill
    ctx.fillStyle = '#fffdfa';
    ctx.fillRect(cx - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4);

    const title = rank === 11 ? 'JACK' : rank === 12 ? 'QUEEN' : 'KING';
    const crown = rank === 11 ? '⚔' : rank === 12 ? '♛' : '♚';

    ctx.fillStyle = color;
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, cx, cy - 80);

    ctx.font = '80px sans-serif';
    ctx.fillText(crown, cx, cy);

    ctx.font = '60px sans-serif';
    ctx.fillText(getSuitSymbol(suit), cx, cy + 80);
  }

  /**
   * Creates a complete 3D card mesh with front, back, and edge materials
   */
  public static createCardMesh(card: Card): Card3D {
    // In headless or test environments where window/document/WebGL might be mock
    if (typeof document === 'undefined') {
      return new Card3D(card);
    }

    const geom = this.getCardGeometry();

    if (!this.edgeMaterial) {
      this.edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f0,
        roughness: 0.8,
        metalness: 0.05
      });
    }

    if (!this.backMaterial) {
      this.backMaterial = new THREE.MeshStandardMaterial({
        map: this.getBackTexture(),
        roughness: 0.35,
        metalness: 0.05
      });
    }

    const frontMaterial = new THREE.MeshStandardMaterial({
      map: this.getFrontTexture(card),
      roughness: 0.35,
      metalness: 0.05
    });

    // Mesh setup: Materials array: [Side/Bevel, Front/Back]
    // ExtrudeGeometry groups: 0 is front/back faces, 1 is side extrusion
    const materials = [frontMaterial, this.edgeMaterial];
    const cardMesh = new THREE.Mesh(geom, materials);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;

    // Create back face plate slightly offset to render back texture when flipped
    const backPlateGeom = new THREE.PlaneGeometry(this.CARD_WIDTH - 0.02, this.CARD_HEIGHT - 0.02);
    const backPlateMesh = new THREE.Mesh(backPlateGeom, this.backMaterial);
    backPlateMesh.rotation.y = Math.PI; // Face outwards on back
    backPlateMesh.position.z = -(this.CARD_THICKNESS / 2 + 0.001);
    backPlateMesh.castShadow = false;
    backPlateMesh.receiveShadow = true;

    const group = new THREE.Group();
    group.add(cardMesh);
    group.add(backPlateMesh);

    // Initial rotation: If face-down, rotate 180 deg around Y
    if (!card.isFaceUp) {
      group.rotation.y = Math.PI;
    }

    return new Card3D(card, group);
  }
}
