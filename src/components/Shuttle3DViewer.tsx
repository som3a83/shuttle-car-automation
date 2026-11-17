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
  resetKey: number;
  onSelectPart: (part: EngineeringPart) => void;
  fallback: React.ReactNode;
}

const isPart = (value: unknown): value is EngineeringPart =>
  value === 'chassis' || value === 'drive' || value === 'wheels' || value === 'battery' || value === 'sensors';

export default function Shuttle3DViewer({
  manufacturer, shuttleId, status, view, exploded, animated, selectedPart, zoom, resetKey, onSelectPart, fallback
}: Shuttle3DViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x0b121a, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = 'shuttle-webgl-canvas';
    renderer.domElement.setAttribute('aria-label', `Interactive conceptual 3D shuttle model ${shuttleId}`);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
    camera.zoom = zoom;
    cameraRef.current = camera;
    const root = new THREE.Group();
    root.rotation.set(0.12, -0.48, 0);
    scene.add(root);
    rootRef.current = root;

    scene.fog = new THREE.FogExp2(0x0b121a, 0.018);
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
    const fastenerMaterial = new THREE.MeshStandardMaterial({ color: 0xb5c2ca, metalness: 0.92, roughness: 0.22 });
    const rubberDetail = new THREE.MeshStandardMaterial({ color: 0x28343d, metalness: 0.1, roughness: 0.72 });
    const safetyMaterial = new THREE.MeshStandardMaterial({ color: 0xf0ad47, emissive: 0x75400d, emissiveIntensity: 0.42, metalness: 0.35 });

    const addBox = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const addCylinder = (parent: THREE.Object3D, radiusTop: number, radiusBottom: number, height: number, position: [number, number, number], material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y') => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24), material.clone());
      mesh.position.set(...position);
      if (axis === 'x') mesh.rotation.z = Math.PI / 2;
      if (axis === 'z') mesh.rotation.x = Math.PI / 2;
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
    // Reinforced longitudinal box-section rails and cross-members.
    [-1.48, 1.48].forEach(z => {
      addBox(chassis, [6.65, 0.22, 0.24], [0, -0.55, z], metal);
      addBox(chassis, [6.2, 0.075, 0.08], [0, -0.4, z], accentMaterial);
      for (let x = -2.8; x <= 2.81; x += 0.7) {
        addCylinder(chassis, 0.055, 0.055, 0.045, [x, -0.39, z], fastenerMaterial);
      }
    });
    [-2.55, -0.85, 0.85, 2.55].forEach(x => {
      addBox(chassis, [0.2, 0.24, 2.9], [x, -0.54, 0], metal);
      addBox(chassis, [0.08, 0.08, 2.72], [x, -0.38, 0], accentMaterial);
    });
    // Load-deck reinforcement ribs and captive fasteners.
    for (let x = -2.85; x <= 2.86; x += 0.38) {
      addBox(chassis, [0.045, 0.055, 2.45], [x, 0.12, 0], metal);
    }
    [-2.8, 2.8].forEach(x => [-1.15, 1.15].forEach(z => {
      addCylinder(chassis, 0.075, 0.075, 0.035, [x, 0.16, z], fastenerMaterial);
      addCylinder(chassis, 0.022, 0.022, 0.04, [x, 0.185, z], darkMetal);
    }));
    // Low-profile guide rollers along both sides of the chassis.
    [-1, 1].forEach(side => {
      for (let x = -2.35; x <= 2.36; x += 1.18) {
        addCylinder(chassis, 0.19, 0.19, 0.28, [x, -0.44, side * 1.68], rubberDetail, 'z');
        addCylinder(chassis, 0.08, 0.08, 0.3, [x, -0.44, side * 1.68], fastenerMaterial, 'z');
      }
    });
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
      addCylinder(drive, 0.31, 0.31, 0.11, [side * 2.15, -0.2, side * 0.88], fastenerMaterial, 'x');
      addCylinder(drive, 0.17, 0.17, 0.8, [side * 1.55, -0.2, side * 0.88], darkMetal, 'x');
      for (let fin = 0; fin < 7; fin += 1) {
        addCylinder(drive, 0.32, 0.32, 0.045, [side * (1.82 + fin * 0.11), -0.2, side * 0.88], metal, 'x');
      }
      // Gearbox inspection cover and mounting bolts.
      const cover = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), fastenerMaterial.clone());
      cover.position.set(side * 2.66, -0.18, side * 0.88);
      cover.rotation.y = Math.PI / 2;
      drive.add(cover);
      [-0.13, 0.13].forEach(y => [-0.13, 0.13].forEach(z => addCylinder(drive, 0.035, 0.035, 0.05, [side * 2.7, -0.18 + y, side * 0.88 + z], fastenerMaterial, 'x')));
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
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 32), fastenerMaterial.clone());
      rim.rotation.y = Math.PI / 2;
      rim.position.set(position[0] + (position[0] > 0 ? 0.18 : -0.18), position[1], position[2]);
      wheels.add(rim);
      // Molded tread blocks and hub bolts give the wheels a serviceable mechanical profile.
      for (let tread = 0; tread < 20; tread += 1) {
        const angle = (tread / 20) * Math.PI * 2;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.09), rubberDetail.clone());
        pad.position.set(position[0], position[1] + Math.cos(angle) * 0.54, position[2] + Math.sin(angle) * 0.54);
        pad.rotation.x = -angle;
        wheels.add(pad);
      }
      for (let bolt = 0; bolt < 8; bolt += 1) {
        const angle = (bolt / 8) * Math.PI * 2;
        addCylinder(wheels, 0.035, 0.035, 0.045, [position[0] + 0.2, position[1] + Math.cos(angle) * 0.22, position[2] + Math.sin(angle) * 0.22], fastenerMaterial, 'x');
      }
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
    // Removable tray rails, locking lugs and electrical service points.
    [-0.82, 0.82].forEach(z => {
      addBox(battery, [2.05, 0.12, 0.12], [0, 0.32, z], fastenerMaterial);
      [-0.72, 0.72].forEach(x => addCylinder(battery, 0.08, 0.08, 0.1, [x, 0.38, z], safetyMaterial));
    });
    addBox(battery, [0.35, 0.22, 0.28], [-0.88, 0.64, 0.42], darkMetal);
    addCylinder(battery, 0.09, 0.09, 0.18, [-0.88, 0.76, 0.42], fastenerMaterial);

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
    // Protected corner bumpers and an amber status beacon; all are illustrative.
    [[-3.18, 0.05, -1.42], [-3.18, 0.05, 1.42], [3.18, 0.05, -1.42], [3.18, 0.05, 1.42]].forEach(p => {
      addCylinder(sensors, 0.18, 0.18, 0.32, [p[0], p[1], p[2]], rubberDetail, 'z');
    });
    addCylinder(sensors, 0.12, 0.12, 0.3, [0, 0.48, 0], safetyMaterial);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), safetyMaterial.clone());
    beacon.position.set(0, 0.66, 0);
    sensors.add(beacon);

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
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.65, 1.8);
      camera.updateProjectionMatrix();
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
      const frustumHeight = width < 640 ? 4.45 : 5.4;
      const aspect = width / height;
      camera.left = -frustumHeight * aspect;
      camera.right = frustumHeight * aspect;
      camera.top = frustumHeight;
      camera.bottom = -frustumHeight;
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
    const distance = 13;
    camera.zoom = zoom;
    const positions: Record<ModelView, THREE.Vector3> = {
      iso: new THREE.Vector3(distance * 0.78, distance * 0.62, distance * 0.78),
      side: new THREE.Vector3(0, distance * 0.25, distance),
      front: new THREE.Vector3(distance, distance * 0.25, 0),
      top: new THREE.Vector3(0, distance, 0.001)
    };
    camera.position.copy(positions[view]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [view, zoom]);

  useEffect(() => {
    rootRef.current?.rotation.set(0.12, -0.48, 0);
    const camera = cameraRef.current;
    if (camera) {
      const distance = 13;
      camera.zoom = zoom;
      const positions: Record<ModelView, THREE.Vector3> = {
        iso: new THREE.Vector3(distance * 0.78, distance * 0.62, distance * 0.78),
        side: new THREE.Vector3(0, distance * 0.25, distance),
        front: new THREE.Vector3(distance, distance * 0.25, 0),
        top: new THREE.Vector3(0, distance, 0.001)
      };
      camera.position.copy(positions[view]);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [resetKey]);

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
      <div className="shuttle-cad-overlay" aria-hidden="true">
        <span><i/>LOAD DECK / FRAME</span><span><i/>DRIVE TRAIN</span><span><i/>TRACTION SET</span><span><i/>ENERGY TRAY</span><span><i/>SAFETY SENSORS</span>
      </div>
      <div className="shuttle-cad-crosshair" aria-hidden="true">+</div>
      <svg className="shuttle-dimension-overlay" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="shuttle-dim-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="#83aabd" strokeWidth="1"/></marker></defs>
        <g fill="none" stroke="#83aabd" strokeWidth="1.2" opacity=".82">
          <path d="M170 500 V535 M830 500 V535 M170 526 H830" markerStart="url(#shuttle-dim-arrow)" markerEnd="url(#shuttle-dim-arrow)"/>
          <path d="M860 190 H890 M860 420 H890 M880 190 V420" markerStart="url(#shuttle-dim-arrow)" markerEnd="url(#shuttle-dim-arrow)"/>
        </g>
      </svg>
      <div className="shuttle-dimension-label shuttle-dimension-length">REF 660 × 310 mm · L × W</div>
      <div className="shuttle-dimension-label shuttle-dimension-width">3.10 MU · DECK WIDTH</div>
      <div className="shuttle-cad-stamp">ORTHOGRAPHIC / {view.toUpperCase()} / REF GEOMETRY</div>
      {status === 'Unknown' && <div className="three-viewer-unknown">EQUIPMENT STATE · UNKNOWN</div>}
    </div>
  );
}
