import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type ModelView = 'iso' | 'side' | 'front' | 'top';
type EngineeringPart = 'chassis' | 'drive' | 'wheels' | 'battery' | 'sensors';

interface Shuttle3DViewerProps {
  manufacturer: string;
  shuttleId: string;
  status: string;
  view: ModelView;
  exploded: boolean;
  animated: boolean;
  selectedPart: EngineeringPart;
  zoom: number;
  onSelectPart: (part: EngineeringPart) => void;
  fallback: React.ReactNode;
}

const isPart = (value: unknown): value is EngineeringPart =>
  value === 'chassis' || value === 'drive' || value === 'wheels' || value === 'battery' || value === 'sensors';

export default function Shuttle3DViewer({
  manufacturer, shuttleId, status, view, exploded, animated, selectedPart, zoom, onSelectPart, fallback
}: Shuttle3DViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const partGroupsRef = useRef<Partial<Record<EngineeringPart, THREE.Group>>>({});
  const wheelMeshesRef = useRef<THREE.Mesh[]>([]);
  const callbackRef = useRef(onSelectPart);
  const animatedRef = useRef(animated);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => { callbackRef.current = onSelectPart; }, [onSelectPart]);
  useEffect(() => { animatedRef.current = animated; }, [animated]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof window.WebGLRenderingContext === 'undefined') {
      setWebglAvailable(false);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setWebglAvailable(false);
      return;
    }

    setWebglAvailable(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x0b121a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = 'shuttle-webgl-canvas';
    renderer.domElement.setAttribute('aria-label', `Interactive conceptual 3D shuttle model ${shuttleId}`);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    cameraRef.current = camera;
    const root = new THREE.Group();
    root.rotation.set(0.12, -0.48, 0);
    scene.add(root);
    rootRef.current = root;

    scene.add(new THREE.HemisphereLight(0xdcecff, 0x26313b, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffe0bd, 3.0);
    keyLight.position.set(7, 10, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x77b8e7, 1.7);
    rimLight.position.set(-7, 4, -6);
    scene.add(rimLight);
    const fillLight = new THREE.PointLight(0xd28b4b, 1.2, 20);
    fillLight.position.set(0, 3, 5);
    scene.add(fillLight);

    const floor = new THREE.GridHelper(18, 36, 0x526779, 0x263744);
    floor.position.y = -1.05;
    (floor.material as THREE.Material).transparent = true;
    (floor.material as THREE.Material).opacity = 0.42;
    scene.add(floor);

    const accent = manufacturer === 'Cassioli' ? 0xd28b4b : manufacturer === 'Craftsman' ? 0x45b8d2 : 0xa58af5;
    const metal = new THREE.MeshStandardMaterial({ color: 0x526575, metalness: 0.82, roughness: 0.3 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c2934, metalness: 0.72, roughness: 0.4 });
    const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x82919c, metalness: 0.78, roughness: 0.32 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.58, roughness: 0.3 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.88 });
    const batteryMaterial = new THREE.MeshStandardMaterial({ color: 0x243b3b, metalness: 0.45, roughness: 0.45 });
    const cellMaterial = new THREE.MeshStandardMaterial({ color: 0x4e9c82, metalness: 0.25, roughness: 0.48 });
    const sensorMaterial = new THREE.MeshStandardMaterial({ color: 0x7bd5ef, emissive: 0x17485c, emissiveIntensity: 0.65, metalness: 0.4 });

    const addBox = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const addPart = (part: EngineeringPart) => {
      const group = new THREE.Group();
      group.userData.part = part;
      root.add(group);
      partGroupsRef.current[part] = group;
      return group;
    };

    const chassis = addPart('chassis');
    addBox(chassis, [6.6, 0.48, 3.1], [0, -0.34, 0], darkMetal);
    addBox(chassis, [6.25, 0.12, 2.78], [0, -0.04, 0], deckMaterial);
    [-1.28, 1.28].forEach((z) => addBox(chassis, [6.45, 0.24, 0.16], [0, 0.12, z], accentMaterial));
    [-2.45, -0.85, 0.85, 2.45].forEach((x) => addBox(chassis, [0.12, 0.34, 2.65], [x, -0.12, 0], metal));
    for (let x = -2.7; x <= 2.7; x += 0.45) {
      addBox(chassis, [0.035, 0.018, 2.55], [x, 0.035, 0], darkMetal);
    }

    const drive = addPart('drive');
    [-1, 1].forEach((side) => {
      const housing = addBox(drive, [1.0, 0.64, 0.78], [side * 2.15, -0.18, side * 0.88], metal);
      housing.rotation.y = side * 0.16;
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.72, 24), accentMaterial.clone());
      motor.rotation.z = Math.PI / 2;
      motor.position.set(side * 2.15, -0.2, side * 0.88);
      drive.add(motor);
      addBox(drive, [0.42, 0.12, 0.55], [side * 1.55, -0.48, side * 0.9], darkMetal);
    });

    const wheels = addPart('wheels');
    const wheelPositions: [number, number, number][] = [
      [-2.45, -0.64, -1.45], [-2.45, -0.64, 1.45],
      [2.45, -0.64, -1.45], [2.45, -0.64, 1.45]
    ];
    wheelPositions.forEach((position) => {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.34, 32), rubber.clone());
      tire.rotation.z = Math.PI / 2;
      tire.position.set(...position);
      wheels.add(tire);
      wheelMeshesRef.current.push(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 24), accentMaterial.clone());
      hub.rotation.z = Math.PI / 2;
      hub.position.set(...position);
      wheels.add(hub);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 20), deckMaterial.clone());
      cap.rotation.z = Math.PI / 2;
      cap.position.set(...position);
      wheels.add(cap);
    });

    const battery = addPart('battery');
    addBox(battery, [1.8, 0.88, 1.25], [0, 0.63, 0], batteryMaterial);
    addBox(battery, [1.45, 0.08, 1.0], [0, 1.1, 0], accentMaterial);
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        addBox(battery, [0.25, 0.32, 0.3], [-0.54 + col * 0.36, 0.85, -0.24 + row * 0.48], cellMaterial);
      }
    }
    addBox(battery, [0.38, 0.12, 0.18], [0.72, 0.62, 0.72], sensorMaterial);

    const sensors = addPart('sensors');
    [[-3.12, 0.2, -1.28], [-3.12, 0.2, 1.28], [3.12, 0.2, -1.28], [3.12, 0.2, 1.28]].forEach((p) => {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 18), darkMetal.clone());
      body.position.set(p[0], p[1], p[2]);
      sensors.add(body);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), sensorMaterial.clone());
      lens.position.set(p[0], p[1] + 0.13, p[2]);
      sensors.add(lens);
    });
    addBox(sensors, [0.22, 0.16, 0.22], [0, 0.34, -1.45], sensorMaterial);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragging = false;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true;
      if (dragging) {
        root.rotation.y += dx * 0.008;
        root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.004, -0.38, 0.42);
        down = { ...down, x: event.clientX, y: event.clientY };
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      if (!dragging) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(root.children, true)[0]?.object;
        let node: THREE.Object3D | null = hit || null;
        while (node && !isPart(node.userData.part)) node = node.parent;
        if (node && isPart(node.userData.part)) callbackRef.current(node.userData.part);
      }
      down = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.position.multiplyScalar(event.deltaY > 0 ? 1.08 : 0.92);
      const distance = camera.position.length();
      if (distance < 7) camera.position.setLength(7);
      if (distance > 24) camera.position.setLength(24);
      camera.lookAt(0, 0, 0);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(host);
    resize();

    let frame = 0;
    const renderFrame = () => {
      frame = window.requestAnimationFrame(renderFrame);
      if (animatedRef.current) wheelMeshesRef.current.forEach((wheel) => { wheel.rotation.x += 0.018; });
      renderer.render(scene, camera);
    };
    renderFrame();

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      cameraRef.current = null;
      rootRef.current = null;
      partGroupsRef.current = {};
      wheelMeshesRef.current = [];
    };
  }, [manufacturer, shuttleId]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const distance = 13 / zoom;
    const positions: Record<ModelView, THREE.Vector3> = {
      iso: new THREE.Vector3(distance * 0.78, distance * 0.62, distance * 0.78),
      side: new THREE.Vector3(0, distance * 0.25, distance),
      front: new THREE.Vector3(distance, distance * 0.25, 0),
      top: new THREE.Vector3(0, distance, 0.001)
    };
    camera.position.copy(positions[view]);
    camera.lookAt(0, 0, 0);
  }, [view, zoom]);

  useEffect(() => {
    const groups = partGroupsRef.current;
    const offsets: Record<EngineeringPart, THREE.Vector3> = {
      chassis: new THREE.Vector3(0, 0, 0),
      drive: new THREE.Vector3(0, exploded ? -0.75 : 0, 0),
      wheels: new THREE.Vector3(0, exploded ? -0.55 : 0, 0),
      battery: new THREE.Vector3(0, exploded ? 1.35 : 0, 0),
      sensors: new THREE.Vector3(0, exploded ? 0.8 : 0, 0)
    };
    (Object.keys(offsets) as EngineeringPart[]).forEach((part) => {
      const group = groups[part];
      if (group) group.position.copy(offsets[part]);
    });
  }, [exploded]);

  useEffect(() => {
    (Object.keys(partGroupsRef.current) as EngineeringPart[]).forEach((part) => {
      const group = partGroupsRef.current[part];
      group?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.emissive.set(part === selectedPart ? 0x6b3515 : 0x000000);
            material.emissiveIntensity = part === selectedPart ? 0.38 : 0;
          }
        });
      });
    });
  }, [selectedPart]);

  return (
    <div className="three-viewer-shell">
      <div ref={hostRef} className="three-canvas-host" style={{ display: webglAvailable === false ? 'none' : 'block' }} />
      {webglAvailable === false && <div className="three-fallback">{fallback}</div>}
      <div className="three-viewer-badge"><span className="three-live-dot" />{animated ? 'SIMULATION PREVIEW' : 'STATIC ENGINEERING VIEW'}</div>
      <div className="three-viewer-id">{manufacturer.toUpperCase()} / {shuttleId}</div>
      {status === 'Unknown' && <div className="three-viewer-unknown">EQUIPMENT STATE · UNKNOWN</div>}
    </div>
  );
}
