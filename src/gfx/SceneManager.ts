import * as THREE from 'three';
import { Tabletop } from './Tabletop';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public tabletop: Tabletop;
  public container: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a2916); // Deep background

    // Perspective Camera setup
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.updateCameraForViewport();

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.appendChild(this.renderer.domElement);

    // Add Lights
    this.setupLighting();

    // Add Tabletop
    this.tabletop = new Tabletop();
    this.scene.add(this.tabletop.mesh);

    // Resize handling
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(container);
    }
  }

  private setupLighting(): void {
    // Balanced ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    // Directional main light casting soft card shadows
    const dirLight = new THREE.DirectionalLight(0xfffaed, 0.9);
    dirLight.position.set(-3, 6, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Secondary fill light from opposite corner
    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.35);
    fillLight.position.set(4, -4, 6);
    this.scene.add(fillLight);
  }

  /**
   * Adapts camera Z distance and Y tilt according to screen aspect ratio
   */
  public updateCameraForViewport(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;

    // Desired board visible width in 3D units is ~9.5 units (7 columns + margins)
    // In portrait mode (aspect < 1), we pull the camera further back so the full width fits
    const targetWidth = 9.8;
    const fovInRad = (this.camera.fov * Math.PI) / 180;

    let targetZ = (targetWidth / (2 * Math.tan(fovInRad / 2))) / aspect;
    targetZ = Math.max(10.5, targetZ); // Minimum distance

    // Position camera looking straight/subtly tilted at center of tableau
    const targetY = aspect < 1.0 ? 0.3 : 0.6;
    this.camera.position.set(0, targetY, targetZ);
    this.camera.lookAt(0, targetY - 0.2, 0);

    this.camera.updateProjectionMatrix();
  }

  public handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.updateCameraForViewport();
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.renderer.dispose();
  }
}
