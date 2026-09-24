import * as THREE from 'three';
import { Card3D } from './Card3D';

interface ActiveTween {
  update(delta: number): boolean; // returns true when completed
}

export class AnimationManager {
  private activeTweens: ActiveTween[] = [];
  private isCascadeRunning: boolean = false;
  private cascadeParticles: { mesh: THREE.Object3D; vx: number; vy: number; vz: number; vrx: number; vry: number }[] = [];

  /**
   * Main update tick called in requestAnimationFrame
   */
  public update(delta: number): void {
    // Delta clamped to avoid huge jumps
    const dt = Math.min(delta, 0.1);

    for (let i = this.activeTweens.length - 1; i >= 0; i--) {
      const isDone = this.activeTweens[i].update(dt);
      if (isDone) {
        this.activeTweens.splice(i, 1);
      }
    }

    if (this.isCascadeRunning) {
      this.updateCascade(dt);
    }
  }

  public get hasActiveAnimations(): boolean {
    return this.activeTweens.length > 0;
  }

  /**
   * Smooth Bezier card flight animation
   */
  public animateMove(
    card3D: Card3D,
    targetPos: { x: number; y: number; z: number },
    duration: number = 0.22,
    arcHeight: number = 0.5
  ): Promise<void> {
    if (!card3D.mesh) {
      card3D.setTargetPosition(targetPos.x, targetPos.y, targetPos.z);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startPos = card3D.mesh!.position.clone();
      const endPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
      let elapsed = 0;

      const tween: ActiveTween = {
        update: (dt: number) => {
          elapsed += dt;
          const progress = Math.min(elapsed / duration, 1.0);
          // Ease Out Quad
          const t = progress * (2 - progress);

          // Linear interpolation in X and Y
          const curX = THREE.MathUtils.lerp(startPos.x, endPos.x, t);
          const curY = THREE.MathUtils.lerp(startPos.y, endPos.y, t);

          // Quadratic Bezier arc for Z elevation
          const baseZ = THREE.MathUtils.lerp(startPos.z, endPos.z, t);
          const arcZ = Math.sin(progress * Math.PI) * arcHeight;
          const curZ = baseZ + arcZ;

          card3D.mesh!.position.set(curX, curY, curZ);

          if (progress >= 1.0) {
            card3D.setTargetPosition(endPos.x, endPos.y, endPos.z);
            card3D.mesh!.position.copy(endPos);
            resolve();
            return true;
          }
          return false;
        }
      };

      this.activeTweens.push(tween);
    });
  }

  /**
   * Smooth card flip animation with rotation around Y and subtle Z lift
   */
  public animateFlip(
    card3D: Card3D,
    targetFaceUp: boolean,
    duration: number = 0.2
  ): Promise<void> {
    if (!card3D.mesh) {
      card3D.setFaceUp(targetFaceUp);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startRotY = card3D.mesh!.rotation.y;
      const targetRotY = targetFaceUp ? 0 : Math.PI;
      const startZ = card3D.mesh!.position.z;
      let elapsed = 0;

      const tween: ActiveTween = {
        update: (dt: number) => {
          elapsed += dt;
          const progress = Math.min(elapsed / duration, 1.0);
          // Ease in-out sine
          const t = 0.5 * (1 - Math.cos(Math.PI * progress));

          card3D.mesh!.rotation.y = THREE.MathUtils.lerp(startRotY, targetRotY, t);
          // Lift slightly in Z during flip
          const liftZ = Math.sin(progress * Math.PI) * 0.2;
          card3D.mesh!.position.z = startZ + liftZ;

          if (progress >= 1.0) {
            card3D.mesh!.rotation.y = targetRotY;
            card3D.mesh!.position.z = startZ;
            card3D.setFaceUp(targetFaceUp);
            resolve();
            return true;
          }
          return false;
        }
      };

      this.activeTweens.push(tween);
    });
  }

  /**
   * Cascade win celebration with physics bounce
   */
  public startWinCascade(cards: Card3D[]): void {
    this.isCascadeRunning = true;
    this.cascadeParticles = [];

    // Stagger release of cards from foundations
    cards.forEach((c3d, idx) => {
      if (!c3d.mesh) return;

      setTimeout(() => {
        if (!c3d.mesh) return;
        const vx = (Math.random() - 0.5) * 8;
        const vy = (Math.random() * 4) + 6;
        const vz = (Math.random() * 2) + 1;
        const vrx = (Math.random() - 0.5) * 6;
        const vry = (Math.random() - 0.5) * 6;

        this.cascadeParticles.push({
          mesh: c3d.mesh,
          vx,
          vy,
          vz,
          vrx,
          vry
        });
      }, idx * 120);
    });
  }

  public stopWinCascade(): void {
    this.isCascadeRunning = false;
    this.cascadeParticles = [];
  }

  private updateCascade(dt: number): void {
    const gravity = -18.0;
    const floorY = -6.0;

    for (const p of this.cascadeParticles) {
      p.vy += gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      p.mesh.rotation.x += p.vrx * dt;
      p.mesh.rotation.y += p.vry * dt;

      // Bounce off bottom floor
      if (p.mesh.position.y < floorY) {
        p.mesh.position.y = floorY;
        p.vy = -p.vy * 0.75; // restitution bounce
        p.vx *= 0.85;
      }
    }
  }
}
