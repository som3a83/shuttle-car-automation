import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Battery, Language } from '../types';

type BatteryView = 'iso' | 'side' | 'front' | 'top';
type BatteryPart = 'enclosure' | 'cells' | 'electronics' | 'terminals';

const BATTERY_PARTS: { id: BatteryPart; en: string; ar: string }[] = [
  { id: 'enclosure', en: 'Battery enclosure', ar: 'هيكل البطارية' },
  { id: 'cells', en: 'Battery cells', ar: 'خلايا البطارية' },
  { id: 'electronics', en: 'BMS and electronics', ar: 'نظام إدارة البطارية والإلكترونيات' },
  { id: 'terminals', en: 'Power terminals', ar: 'أطراف القدرة والتوصيل' }
];

const isBatteryPart = (value: unknown): value is BatteryPart =>
  value === 'enclosure' || value === 'cells' || value === 'electronics' || value === 'terminals';

interface Battery3DViewerProps {
  battery: Battery;
  fallback: React.ReactNode;
  language?: Language;
}

export default function Battery3DViewer({ battery, fallback, language = 'en' }: Battery3DViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const partGroupsRef = useRef<Partial<Record<BatteryPart, THREE.Group>>>({});
  const [available, setAvailable] = useState<boolean | null>(null);
  const [view, setView] = useState<BatteryView>('iso');
  const [exploded, setExploded] = useState(false);
  const [selectedPart, setSelectedPart] = useState<BatteryPart>('enclosure');
  const [zoom, setZoom] = useState(1);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof window.WebGLRenderingContext === 'undefined') {
      setAvailable(false);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x0b121a, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'battery-webgl-canvas';
    renderer.domElement.setAttribute('aria-label', 'Interactive conceptual lithium battery assembly. Drag or use arrow keys to rotate; press Home to reset the view.');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe0efff, 0x25333c, 2.2));
    const key = new THREE.DirectionalLight(0xffe3c4, 3);
    key.position.set(6, 9, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6bb9dc, 1.8);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 80);
    camera.position.set(8.8, 7.2, 9.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    const root = new THREE.Group();
    root.rotation.y = -0.45;
    rootRef.current = root;
    scene.add(root);
    const addPart = (part: BatteryPart) => {
      const group = new THREE.Group();
      group.userData.part = part;
      root.add(group);
      partGroupsRef.current[part] = group;
      return group;
    };
    const enclosure = addPart('enclosure');
    const cells = addPart('cells');
    const electronics = addPart('electronics');
    const terminals = addPart('terminals');

    const shell = new THREE.MeshStandardMaterial({ color: 0x354957, metalness: 0.78, roughness: 0.34 });
    const inner = new THREE.MeshStandardMaterial({ color: 0x182831, metalness: 0.55, roughness: 0.48 });
    const cell = new THREE.MeshStandardMaterial({ color: 0x568f7d, metalness: 0.32, roughness: 0.42 });
    const bus = new THREE.MeshStandardMaterial({ color: 0xc58a4c, metalness: 0.82, roughness: 0.25 });
    const board = new THREE.MeshStandardMaterial({ color: 0x275c50, metalness: 0.25, roughness: 0.62 });
    const connector = new THREE.MeshStandardMaterial({ color: 0x171d22, metalness: 0.6, roughness: 0.35 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x79d5b0, emissive: 0x174c39, emissiveIntensity: 0.6 });
    const fastener = new THREE.MeshStandardMaterial({ color: 0xb7c4ca, metalness: 0.92, roughness: 0.2 });
    const insulator = new THREE.MeshStandardMaterial({ color: 0x171d25, metalness: 0.18, roughness: 0.68 });
    const warning = new THREE.MeshStandardMaterial({ color: 0xe5aa48, emissive: 0x6b3f0a, emissiveIntensity: 0.32, metalness: 0.3 });

    const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const cylinder = (parent: THREE.Object3D, radius: number, height: number, position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Open-top enclosure: conceptual geometry only, not a manufacturer battery drawing.
    box(enclosure, [6.8, 0.34, 3.7], [0, -0.72, 0], shell);
    box(enclosure, [6.8, 1.18, 0.18], [0, -0.08, -1.76], shell);
    box(enclosure, [6.8, 1.18, 0.18], [0, -0.08, 1.76], shell);
    box(enclosure, [0.18, 1.18, 3.5], [-3.31, -0.08, 0], shell);
    box(enclosure, [0.18, 1.18, 3.5], [3.31, -0.08, 0], shell);
    box(enclosure, [6.25, 0.06, 3.15], [0, -0.48, 0], inner);
    // Reinforced enclosure lips, insulated cell rails and removable service cover rails.
    box(enclosure, [6.45, 0.09, 0.12], [0, 0.52, -1.55], fastener);
    box(enclosure, [6.45, 0.09, 0.12], [0, 0.52, 1.55], fastener);
    box(enclosure, [0.12, 0.09, 3.0], [-3.05, 0.52, 0], fastener);
    box(enclosure, [0.12, 0.09, 3.0], [3.05, 0.52, 0], fastener);
    [-0.82, 0.82].forEach(z => box(enclosure, [5.9, 0.12, 0.12], [0, -0.32, z], insulator));

    // Twelve prismatic lithium cells arranged in two banks.
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const x = -2.55 + col * 1.02;
        const z = row === 0 ? -0.82 : 0.82;
        box(cells, [0.82, 0.88, 1.32], [x, 0.02, z], cell);
        box(cells, [0.3, 0.035, 0.22], [x, 0.49, z], bus);
        cylinder(cells, 0.075, 0.055, [x, 0.56, z], fastener);
        box(cells, [0.58, 0.025, 0.055], [x, 0.61, z + (row === 0 ? 0.26 : -0.26)], insulator);
      }
    }

    // Bus bars, BMS board, terminals, service connector and handles.
    box(electronics, [5.85, 0.09, 0.16], [0, 0.57, -0.82], bus);
    box(electronics, [5.85, 0.09, 0.16], [0, 0.57, 0.82], bus);
    box(electronics, [1.4, 0.16, 1.0], [2.18, 0.62, 0.05], board);
    // BMS controller, balancing components, fuse block and service harness.
    box(electronics, [0.5, 0.12, 0.38], [2.18, 0.76, 0.05], shell);
    box(electronics, [0.18, 0.08, 0.18], [1.8, 0.76, -0.2], insulator);
    box(electronics, [0.18, 0.08, 0.18], [2.52, 0.76, 0.22], insulator);
    for (let i = 0; i < 5; i += 1) box(electronics, [0.12, 0.04, 0.12], [1.72 + i * 0.22, 0.73, -0.18], glow);
    for (let i = 0; i < 4; i += 1) cylinder(electronics, 0.07, 0.14, [1.82 + i * 0.2, 0.78, 0.25], warning);
    box(electronics, [0.52, 0.18, 0.32], [2.78, 0.64, -0.64], connector);
    box(electronics, [0.08, 0.08, 0.78], [2.78, 0.78, -0.64], fastener);
    box(electronics, [0.62, 0.36, 0.5], [-2.65, 0.58, 0], connector);
    const terminal = (x: number, color: number) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 20), new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.22 }));
      post.position.set(x, 0.72, 1.28);
      terminals.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), connector.clone());
      cap.position.set(x, 0.88, 1.28);
      terminals.add(cap);
    };
    terminal(-2.7, 0xc94d4d);
    terminal(-2.0, 0x4d83c9);
    // Terminal collars, insulating boots and a protected main fuse.
    cylinder(terminals, 0.24, 0.12, [-2.7, 0.94, 1.28], warning);
    cylinder(terminals, 0.24, 0.12, [-2.0, 0.94, 1.28], insulator);
    box(terminals, [0.62, 0.26, 0.44], [-1.15, 0.67, 1.25], shell);
    box(terminals, [0.42, 0.12, 0.2], [-1.15, 0.84, 1.25], warning);
    // Perimeter fasteners are visible service points, not dimensional callouts.
    [-2.95, -1.45, 0, 1.45, 2.95].forEach(x => [-1.58, 1.58].forEach(z => cylinder(terminals, 0.055, 0.055, [x, 0.58, z], fastener)));
    [-2.6, 2.6].forEach((x) => {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 10, 28, Math.PI), shell.clone());
      handle.rotation.z = Math.PI / 2;
      handle.position.set(x, 0.64, -1.45);
      terminals.add(handle);
    });

    const grid = new THREE.GridHelper(16, 32, 0x526779, 0x263744);
    grid.position.y = -0.94;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragging = false;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true;
      if (dragging) {
        root.rotation.y += dx * 0.008;
        root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.004, -0.35, 0.45);
        down = { ...down, x: event.clientX, y: event.clientY };
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      if (!dragging) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(root.children, true)[0]?.object;
        let node: THREE.Object3D | null = hit || null;
        while (node && !isBatteryPart(node.userData.part)) node = node.parent;
        if (node && isBatteryPart(node.userData.part)) setSelectedPart(node.userData.part);
      }
      down = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(current => THREE.MathUtils.clamp(current * (event.deltaY > 0 ? 0.92 : 1.08), 0.65, 1.8));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const step = 0.14;
      if (event.key === 'ArrowLeft') root.rotation.y -= step;
      else if (event.key === 'ArrowRight') root.rotation.y += step;
      else if (event.key === 'ArrowUp') root.rotation.x = THREE.MathUtils.clamp(root.rotation.x - step, -0.35, 0.45);
      else if (event.key === 'ArrowDown') root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + step, -0.35, 0.45);
      else if (event.key === 'Home') {
        root.rotation.set(0, -0.45, 0);
        setView('iso');
        setZoom(1);
        setExploded(false);
      } else return;
      event.preventDefault();
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('keydown', onKeyDown);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      const frustumHeight = 5.2;
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
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('keydown', onKeyDown);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      rootRef.current = null;
      cameraRef.current = null;
      partGroupsRef.current = {};
    };
  }, [battery.id]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const distance = 13;
    const positions: Record<BatteryView, THREE.Vector3> = {
      iso: new THREE.Vector3(distance * 0.68, distance * 0.55, distance * 0.72),
      side: new THREE.Vector3(0, distance * 0.22, distance),
      front: new THREE.Vector3(distance, distance * 0.22, 0),
      top: new THREE.Vector3(0, distance, 0.001)
    };
    camera.position.copy(positions[view]);
    camera.zoom = zoom;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [view, zoom]);

  useEffect(() => {
    rootRef.current?.rotation.set(0, -0.45, 0);
  }, [resetVersion]);

  useEffect(() => {
    rootRef.current?.rotation.set(0, view === 'iso' ? -0.45 : 0, 0);
  }, [view]);

  useEffect(() => {
    const offsets: Record<BatteryPart, number> = {
      enclosure: 0,
      cells: exploded ? 0.9 : 0,
      electronics: exploded ? 1.8 : 0,
      terminals: exploded ? 2.65 : 0
    };
    (Object.keys(offsets) as BatteryPart[]).forEach(part => {
      const group = partGroupsRef.current[part];
      if (group) group.position.y = offsets[part];
    });
  }, [exploded]);

  useEffect(() => {
    (Object.keys(partGroupsRef.current) as BatteryPart[]).forEach(part => {
      const group = partGroupsRef.current[part];
      if (group) group.scale.setScalar(part === selectedPart ? 1.025 : 1);
    });
  }, [selectedPart]);

  const ar = language === 'ar';
  const viewLabels: Record<BatteryView, string> = ar
    ? { iso: 'منظور مجسم', side: 'جانبي', front: 'أمامي', top: 'علوي' }
    : { iso: 'Isometric', side: 'Side', front: 'Front', top: 'Top' };

  return (
    <div className="battery-3d-shell">
      <div className="battery-engineering-controls">
        <div className="battery-engineering-toolbar" role="group" aria-label={ar ? 'مناظير البطارية' : 'Battery orthographic views'}>
          {(['iso', 'side', 'front', 'top'] as BatteryView[]).map(nextView => (
            <button
              key={nextView}
              type="button"
              className={view === nextView ? 'selected' : ''}
              aria-label={viewLabels[nextView] + ' view'}
              aria-pressed={view === nextView}
              onClick={() => setView(nextView)}
            >{viewLabels[nextView]}</button>
          ))}
          <button
            type="button"
            className={exploded ? 'selected' : ''}
            aria-label="Explode battery assembly"
            aria-pressed={exploded}
            onClick={() => setExploded(value => !value)}
          >{ar ? 'تفكيك المجموعة' : 'Exploded view'}</button>
          <button
            type="button"
            aria-label="Reset battery view"
            onClick={() => {
              setView('iso');
              setZoom(1);
              setExploded(false);
              setSelectedPart('enclosure');
              setResetVersion(value => value + 1);
            }}
          >{ar ? 'إعادة ضبط' : 'Reset view'}</button>
        </div>
        <label className="battery-engineering-zoom">
          <span>{ar ? 'تكبير الرسم' : 'Engineering zoom'}</span>
          <input aria-label="Battery zoom" type="range" min="0.65" max="1.8" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))}/>
          <output>{Math.round(zoom * 100)}%</output>
        </label>
        <div className="battery-part-picker" role="group" aria-label={ar ? 'اختيار مكونات البطارية' : 'Select battery component'}>
          {BATTERY_PARTS.map(part => (
            <button
              key={part.id}
              type="button"
              className={selectedPart === part.id ? 'selected' : ''}
              aria-label={part.en}
              aria-pressed={selectedPart === part.id}
              onClick={() => setSelectedPart(part.id)}
            >{ar ? part.ar : part.en}</button>
          ))}
        </div>
      </div>
      <div ref={hostRef} className="battery-3d-host" style={{ display: available === false ? 'none' : 'block' }} />
      {available === false && <div className="battery-3d-fallback">{fallback}</div>}
      <div className="battery-3d-caption">LITHIUM PACK · CONCEPTUAL INTERNAL ASSEMBLY</div>
      <div className="battery-3d-id">{battery.id}</div>
      <div className="battery-3d-help" aria-hidden="true">DRAG / ARROWS TO ROTATE · WHEEL TO ZOOM</div>
      <div className="battery-cad-overlay" aria-hidden="true">
        <span><i/>PRISMATIC CELL BANKS</span><span><i/>BMS / BALANCING</span><span><i/>BUS BAR NETWORK</span><span><i/>SERVICE TERMINALS</span>
      </div>
      <div className="battery-cad-crosshair" aria-hidden="true">+</div>
      <svg className="battery-dimension-overlay" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="battery-dim-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="#83aabd" strokeWidth="1"/></marker></defs>
        <g fill="none" stroke="#83aabd" strokeWidth="1.2" opacity=".82">
          <path d="M170 485 V520 M830 485 V520 M170 510 H830" markerStart="url(#battery-dim-arrow)" markerEnd="url(#battery-dim-arrow)"/>
          <path d="M860 180 H890 M860 405 H890 M880 180 V405" markerStart="url(#battery-dim-arrow)" markerEnd="url(#battery-dim-arrow)"/>
        </g>
      </svg>
      <div className="battery-dimension-label battery-dimension-length">REF 680 × 370 mm · L × W</div>
      <div className="battery-dimension-label battery-dimension-width">3.70 MU · PACK WIDTH</div>
      <div className="battery-cad-stamp">ORTHOGRAPHIC / INTERNAL REFERENCE GEOMETRY</div>
    </div>
  );
}
