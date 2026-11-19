import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { applyStudioEnvironment, applyStudioRenderer, configureKeyLightShadow, createShadowCatcher } from './three/studioLook';
import type { Battery, Language } from '../types';

type BatteryView = 'iso' | 'side' | 'front' | 'top';
type BatteryPart = 'enclosure' | 'cells' | 'busbars' | 'bms' | 'terminals' | 'cover';

const BATTERY_PARTS: { id: BatteryPart; en: string; ar: string }[] = [
  { id: 'enclosure', en: 'Battery enclosure', ar: 'هيكل البطارية' },
  { id: 'cells', en: 'Cell bank', ar: 'مجموعة الخلايا' },
  { id: 'busbars', en: 'Busbar network', ar: 'قضبان التوصيل' },
  { id: 'bms', en: 'Battery management system', ar: 'نظام إدارة البطارية' },
  { id: 'terminals', en: 'Power terminals', ar: 'أطراف القدرة' },
  { id: 'cover', en: 'Service cover', ar: 'غطاء الصيانة' }
];

const PART_COPY: Record<BatteryPart, { en: string; ar: string; detailEn: string; detailAr: string }> = {
  enclosure: {
    en: 'Battery enclosure',
    ar: 'هيكل البطارية',
    detailEn: 'Inspect the enclosure, mounting points, seals and signs of impact or moisture ingress.',
    detailAr: 'افحص الهيكل ونقاط التثبيت ووسائل الإحكام وأي آثار صدمات أو دخول رطوبة.'
  },
  cells: {
    en: 'Cell bank',
    ar: 'مجموعة الخلايا',
    detailEn: 'Cell chemistry, count and arrangement are conceptual placeholders until verified against the pack label and OEM documentation.',
    detailAr: 'نوع الخلايا وعددها وترتيبها عناصر توضيحية حتى يتم التحقق من ملصق البطارية ومستندات الشركة المصنعة.'
  },
  busbars: {
    en: 'Busbar network',
    ar: 'قضبان التوصيل',
    detailEn: 'Inspect approved conductor routing, insulation, clearances and terminal torque using the manufacturer procedure.',
    detailAr: 'افحص مسارات الموصلات والعزل والخلوصات وعزم ربط الأطراف وفق إجراء الشركة المصنعة المعتمد.'
  },
  bms: {
    en: 'Battery management system',
    ar: 'نظام إدارة البطارية',
    detailEn: 'The BMS board is represented for layout guidance only. No BMS signals or protection states are connected to this model.',
    detailAr: 'لوحة نظام إدارة البطارية مرسومة للتوضيح فقط. لا توجد إشارات BMS أو حالات حماية متصلة بهذا النموذج.'
  },
  terminals: {
    en: 'Power terminals',
    ar: 'أطراف القدرة',
    detailEn: 'Verify polarity, connector condition, interlocks and isolation using the approved electrical safety procedure.',
    detailAr: 'تحقق من القطبية وحالة الموصلات والتشابكات والعزل باستخدام إجراء السلامة الكهربائية المعتمد.'
  },
  cover: {
    en: 'Service cover',
    ar: 'غطاء الصيانة',
    detailEn: 'The removable cover is shown separately in the exploded view. Do not open a pack unless qualified and authorized.',
    detailAr: 'الغطاء القابل للإزالة يُshown بشكل منفصل في طريقة العرض المفككة. لا تفتح العبوة إلا إذا كنت مؤهلًا ومخولًا.'
  }
};

const isBatteryPart = (value: unknown): value is BatteryPart =>
  value === 'enclosure' || value === 'cells' || value === 'busbars' || value === 'bms' || value === 'terminals' || value === 'cover';

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
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const ar = language === 'ar';
  const partInfo = PART_COPY[selectedPart];

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setClearColor(0x0b121a, 0);
    applyStudioRenderer(renderer, 1.1);
    renderer.domElement.className = 'battery-webgl-canvas';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-label', 'Interactive conceptual lithium battery assembly. Drag or use arrow keys to rotate; press Home to reset the view.');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const disposeEnvironment = applyStudioEnvironment(renderer, scene, 0.6);
    scene.add(new THREE.HemisphereLight(0xe0efff, 0x25333c, 1.0));
    const key = new THREE.DirectionalLight(0xffe3c4, 2.6);
    key.position.set(6, 9, 7);
    configureKeyLightShadow(key, 9);
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
    const darkShell = 0x161c24;
    const shell = 0x33404d;
    const cellMaterial = 0x2d3a48;
    const cellCap = 0x1f2a36;
    const copper = 0xb87333;
    const fastener = 0x4d5a6a;
    const board = 0x242e3a;
    const chip = 0x3a4756;
    const translucentCover = 0x6b7a8a;

    const addBox = (parent: THREE.Group, size: [number, number, number], pos: [number, number, number], color: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }));
      mesh.position.set(pos[0], pos[1], pos[2]);
      parent.add(mesh);
      return mesh;
    };
    const addCylinder = (parent: THREE.Group, rTop: number, rBottom: number, h: number, pos: [number, number, number], color: number) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 16), new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }));
      mesh.position.set(pos[0], pos[1], pos[2]);
      parent.add(mesh);
      return mesh;
    };

    // Enclosure — main pack housing with mounting points and seals.
    const enclosure = addPart('enclosure');
    addBox(enclosure, [6.8, 0.34, 3.8], [0, -0.72, 0], darkShell);
    addBox(enclosure, [6.8, 1.28, 0.18], [0, -0.03, -1.82], shell);
    addBox(enclosure, [6.8, 1.28, 0.18], [0, -0.03, 1.82], shell);
    addBox(enclosure, [0.18, 1.28, 3.5], [-3.31, -0.03, 0], shell);
    addBox(enclosure, [0.18, 1.28, 3.5], [3.31, -0.03, 0], shell);
    [-2.75, 2.75].forEach((x) => [-1.5, 1.5].forEach((z) => {
      addCylinder(enclosure, 0.075, 0.075, 0.1, [x, -0.49, z], fastener);
    }));
    [-1, 1].forEach((side) => {
      addBox(enclosure, [5.9, 0.12, 0.1], [0, -0.43, side * 1.55], fastener);
    });

    // Cells — 3 rows × 4 columns of prismatic cells with caps and connectors.
    const cells = addPart('cells');
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const x = -2.1 + column * 1.4;
        const z = -1.05 + row * 1.05;
        addBox(cells, [1.02, 1.05, 0.78], [x, 0.02, z], cellMaterial);
        addBox(cells, [0.82, 0.08, 0.62], [x, 0.59, z], cellCap);
        addCylinder(cells, 0.065, 0.065, 0.08, [x - 0.25, 0.67, z], copper);
        addCylinder(cells, 0.065, 0.065, 0.08, [x + 0.25, 0.67, z], fastener);
      }
    }

    // Busbars — three rows of copper bus connectors.
    const busbars = addPart('busbars');
    for (let row = 0; row < 3; row += 1) {
      const z = -1.05 + row * 1.05;
      for (let column = 0; column < 3; column += 1) {
        const x = -1.4 + column * 1.4;
        addBox(busbars, [0.72, 0.075, 0.14], [x, 0.78, z], copper);
      }
      addBox(busbars, [4.6, 0.055, 0.08], [0, 0.82, z + 0.31], fastener);
    }

    // BMS — controller board with chips and sense pins.
    const bms = addPart('bms');
    addBox(bms, [1.55, 0.12, 0.92], [2.35, 0.48, 1.15], board);
    addBox(bms, [0.46, 0.12, 0.42], [2.1, 0.61, 1.15], chip);
    addBox(bms, [0.3, 0.08, 0.28], [2.62, 0.6, 1.15], chip);
    for (let pin = 0; pin < 6; pin += 1) {
      addBox(bms, [0.07, 0.035, 0.12], [1.75 + pin * 0.22, 0.57, 0.65], copper);
    }

    // Terminals — main power posts.
    const terminals = addPart('terminals');
    addBox(terminals, [0.78, 0.18, 0.52], [-2.8, 0.58, 1.25], darkShell);
    addCylinder(terminals, 0.2, 0.2, 0.22, [-2.95, 0.78, 1.25], copper);
    addCylinder(terminals, 0.2, 0.2, 0.22, [-2.58, 0.78, 1.25], fastener);
    addBox(terminals, [0.58, 0.32, 0.45], [-2.7, 0.28, 1.25], shell);

    // Cover — removable service cover.
    const cover = addPart('cover');
    const serviceCover = addBox(cover, [6.55, 0.12, 3.55], [0, 1.08, 0], translucentCover);
    const serviceCoverMaterial = serviceCover.material as THREE.MeshStandardMaterial;
    serviceCoverMaterial.transparent = true;
    serviceCoverMaterial.opacity = 0.18;
    serviceCoverMaterial.depthWrite = false;
    serviceCoverMaterial.roughness = 0.22;
    [-2.65, 2.65].forEach((x) => [-1.35, 1.35].forEach((z) => {
      addCylinder(cover, 0.055, 0.055, 0.08, [x, 1.01, z], fastener);
    }));

    const grid = new THREE.GridHelper(16, 32, 0x526779, 0x263744);
    grid.position.y = -0.94;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);
    scene.add(createShadowCatcher(22, -1.05));
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const activePointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    let pinchDistance = 0;
    const distanceBetweenPointers = () => {
      const points = Array.from(activePointers.values());
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    const onDown = (event: PointerEvent) => {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size === 1) {
        down = { x: event.clientX, y: event.clientY, id: event.pointerId };
        dragging = false;
      } else {
        down = null;
        dragging = true;
        pinchDistance = distanceBetweenPointers();
      }
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!activePointers.has(event.pointerId)) return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        const nextDistance = distanceBetweenPointers();
        if (pinchDistance > 0 && nextDistance > 0) {
          setZoom(current => THREE.MathUtils.clamp(current * (nextDistance / pinchDistance), 0.65, 1.8));
        }
        pinchDistance = nextDistance;
        return;
      }
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
      const wasTap = down?.id === event.pointerId && !dragging && activePointers.size === 1;
      if (wasTap) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(root.children, true)[0]?.object;
        let node: THREE.Object3D | null = hit || null;
        while (node && !isBatteryPart(node.userData.part)) node = node.parent;
        if (node && isBatteryPart(node.userData.part)) {
          setSelectedPart(node.userData.part);
          setInspectorOpen(true);
        }
      }
      activePointers.delete(event.pointerId);
      if (activePointers.size === 0) {
        down = null;
        dragging = false;
        pinchDistance = 0;
      } else if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.entries())[0];
        down = { x: remaining[1].x, y: remaining[1].y, id: remaining[0] };
        dragging = true;
        pinchDistance = 0;
      }
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
      disposeEnvironment();
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
      cells: exploded ? -0.85 : 0,
      busbars: exploded ? 0.85 : 0,
      bms: exploded ? 1.35 : 0,
      terminals: exploded ? -1.35 : 0,
      cover: exploded ? 1.6 : 0
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
            aria-label={exploded ? 'Reassemble' : 'Exploded assembly'}
            aria-pressed={exploded}
            onClick={() => setExploded(value => !value)}
          >{exploded ? (ar ? 'إعادة التجميع' : 'Reassemble') : (ar ? 'تفكيك المجموعة' : 'Exploded assembly')}</button>
          <button
            type="button"
            aria-label="Reset battery view"
            onClick={() => {
              setView('iso');
              setZoom(1);
              setExploded(false);
              setSelectedPart('enclosure');
              setInspectorOpen(false);
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
              onClick={() => { setSelectedPart(part.id); setInspectorOpen(true); }}
            >{ar ? part.ar : part.en}</button>
          ))}
        </div>
        {inspectorOpen && (
          <div className="battery-inspector-panel">
            <span className="eyebrow">{ar ? 'فحص المكوّن المحدد' : 'SELECTED COMPONENT INSPECTOR'}</span>
            <h3>{ar ? partInfo.ar : partInfo.en}</h3>
            <p>{ar ? partInfo.detailAr : partInfo.detailEn}</p>
            <p className="inspector-note">{ar ? 'مرجع توضيحي فقط — لا توجد قراءات BMS متصلة بهذا النموذج.' : 'Conceptual reference only — no BMS readings are connected to this model.'}</p>
          </div>
        )}
      </div>
      <div className="battery-3d-stage">
        <div ref={hostRef} className="battery-3d-host" style={{ display: available === false ? 'none' : 'block' }} />
        {available === false && <div className="battery-3d-fallback">{fallback}</div>}
        <div className="battery-3d-caption">LITHIUM PACK · CONCEPTUAL INTERNAL ASSEMBLY</div>
        <div className="battery-3d-id">{battery.id}</div>
        <div className="battery-3d-help" aria-hidden="true">DRAG TO ROTATE · PINCH / WHEEL TO ZOOM</div>
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
        <div className="battery-dimension-label battery-dimension-width">WIDTH · REFERENCE ONLY</div>
        <div className="battery-cad-stamp">ORTHOGRAPHIC / INTERNAL REFERENCE GEOMETRY</div>
      </div>
    </div>
  );
}
