import * as THREE from 'three';

export class DragPlane {
  private plane: THREE.Plane;
  private raycaster: THREE.Raycaster;

  constructor(elevationZ: number = 0.35) {
    // Horizontal plane at z = elevationZ with normal facing camera (0, 0, 1)
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -elevationZ);
    this.raycaster = new THREE.Raycaster();
  }

  public setElevation(z: number): void {
    this.plane.constant = -z;
  }

  /**
   * Projects normalized screen coordinates onto the 3D drag plane
   */
  public getIntersection(
    normalizedX: number,
    normalizedY: number,
    camera: THREE.Camera
  ): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(normalizedX, normalizedY), camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.plane, target);
    return hit ? target : null;
  }
}
