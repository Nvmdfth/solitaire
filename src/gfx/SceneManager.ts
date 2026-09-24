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
    this.scene.background = new THREE.Color(0x051a0c); // Dark high-contrast background

    // Perspective Camera setup
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.updateCameraForViewport();

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    // Setup Lighting
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
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Primary directional light casting deep crisp card shadows for stack definition
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(-2, 5, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -5.5;
    dirLight.shadow.camera.right = 5.5;
    dirLight.shadow.camera.top = 5.5;
    dirLight.shadow.camera.bottom = -5.5;
    dirLight.shadow.bias = -0.0003;
    this.scene.add(dirLight);

    // Secondary fill light
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.35);
    fillLight.position.set(4, -3, 5);
    this.scene.add(fillLight);
  }

  public updateCameraForViewport(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;

    // Desired visible width matches 7 columns (7 * 1.06 = ~7.42) + generous side margins
    const targetWidth = aspect < 1.0 ? 8.6 : 9.6;
    const fovInRad = (this.camera.fov * Math.PI) / 180;

    let targetZ = (targetWidth / (2 * Math.tan(fovInRad / 2))) / aspect;
    targetZ = Math.max(9.2, targetZ);

    const targetY = aspect < 1.0 ? 0.9 : 0.7;
    this.camera.position.set(0, targetY, targetZ);
    this.camera.lookAt(0, targetY - 0.25, 0);

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
