import * as THREE from 'three';
import { Card } from '../core/types';

export class Card3D {
  public card: Card;
  public mesh: THREE.Mesh | THREE.Group | null = null;
  public targetPosition: THREE.Vector3 = new THREE.Vector3();
  public targetRotation: THREE.Euler = new THREE.Euler();
  public isFaceUp: boolean = false;
  public isDragging: boolean = false;
  public dragOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(card: Card, mesh?: THREE.Mesh | THREE.Group) {
    this.card = card;
    this.isFaceUp = card.isFaceUp;
    if (mesh) {
      this.mesh = mesh;
      (mesh as any).userData = { card3D: this, cardId: card.id };
    }
  }

  public setFaceUp(faceUp: boolean): void {
    this.isFaceUp = faceUp;
    this.card.isFaceUp = faceUp;
  }

  public setTargetPosition(x: number, y: number, z: number): void {
    this.targetPosition.set(x, y, z);
  }

  public setTargetRotation(x: number, y: number, z: number): void {
    this.targetRotation.set(x, y, z);
  }

  public updateMeshTransform(): void {
    if (this.mesh) {
      this.mesh.position.copy(this.targetPosition);
      this.mesh.rotation.copy(this.targetRotation);
    }
  }
}
