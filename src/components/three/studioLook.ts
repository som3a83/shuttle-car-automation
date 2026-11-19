import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function applyStudioRenderer(renderer: THREE.WebGLRenderer, exposure = 1.1): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

export function applyStudioEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.6): () => void {
  const environmentScene = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(environmentScene, 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = intensity;
  generator.dispose();
  environmentScene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  return () => {
    scene.environment = null;
    target.dispose();
  };
}

export function configureKeyLightShadow(light: THREE.DirectionalLight, extent: number, mapSize = 1024): void {
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  const camera = light.shadow.camera as THREE.OrthographicCamera;
  camera.left = -extent;
  camera.right = extent;
  camera.top = extent;
  camera.bottom = -extent;
  camera.near = 1;
  camera.far = 40;
  camera.updateProjectionMatrix();
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.02;
  light.shadow.radius = 3;
}

export function createShadowCatcher(size: number, y: number, opacity = 0.38): THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity, transparent: true }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}
