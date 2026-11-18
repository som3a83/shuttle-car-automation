import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Battery, Language } from '../types';

type BatteryView = 'iso' | 'front' | 'side' | 'top';
type BatteryPart = 'enclosure' | 'cells' | 'busbars' | 'bms' | 'terminals' | 'cover';

interface Battery3DViewerProps {
  battery: Battery;
  language: Language;
  fallback: React.ReactNode;
}

const PARTS: BatteryPart[] = ['enclosure', 'cells', 'busbars', 'bms', 'terminals', 'cover'];

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
    detailAr: 'يظهر الغطاء منفصلًا في العرض التفكيكي. لا تفتح البطارية إلا بواسطة فني مؤهل ومصرح له.'
  }
};

const VIEW_COPY: Record<BatteryView, { en: string; ar: string }> = {
  iso: { en: 'Isometric', ar: 'منظور مجسم' },
  front: { en: 'Front', ar: 'أمامي' },
  side: { en: 'Side', ar: 'جانبي' },
  top: { en: 'Top', ar: 'علوي' }
};

export default function Battery3DViewer({ battery, language, fallback }: Battery3DViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const groupsRef = useRef<Partial<Record<BatteryPart, THREE.Group>>>({});
  const selectedRef = useRef<BatteryPart>('cells');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [view, setView] = useState<BatteryView>('iso');
  const [zoom, setZoom] = useState(1);
  const [exploded, setExploded] = useState(false);
  const [selectedPart, setSelectedPart] = useState<BatteryPart>('cells');

  useEffect(() => { selectedRef.current = selectedPart; }, [selectedPart]);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x0b121a, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'battery-webgl-canvas';
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Interactive conceptual battery assembly. Drag or use arrow keys to rotate; press Home to reset.');
    renderer.domElement.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b121a, 0.02);
    scene.add(new THREE.HemisphereLight(0xdcecff, 0x26313b, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffe0bd, 2.7);
    keyLight.position.set(7, 9, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x76b9e8, 1.5);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const camera = new THREE.OrthographicCamera(-7, 7, 4.5, -4.5, 0.1, 100);
    camera.zoom = zoom;
    camera.position.set(9, 7, 9);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const root = new THREE.Group();
    scene.add(root);
    root.rotation.set(0.12, -0.5, 0);
    rootRef.current = root;

    const grid = new THREE.GridHelper(17, 34, 0x526779, 0x263744);
    grid.position.y = -1.08;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.32;
    scene.add(grid);

    const shell = new THREE.MeshStandardMaterial({ color: 0x526575, metalness: 0.78, roughness: 0.34 });
    const darkShell = new THREE.MeshStandardMaterial({ color: 0x1d2b36, metalness: 0.62, roughness: 0.42 });
    const cellMaterial = new THREE.MeshStandardMaterial({ color: 0x4c927c, metalness: 0.3, roughness: 0.42 });
    const cellCap = new THREE.MeshStandardMaterial({ color: 0x9aaab5, metalness: 0.72, roughness: 0.28 });
    const copper = new THREE.MeshStandardMaterial({ color: 0xd28b4b, metalness: 0.68, roughness: 0.28 });
    const board = new THREE.MeshStandardMaterial({ color: 0x1c684f, metalness: 0.3, roughness: 0.48 });
    const chip = new THREE.MeshStandardMaterial({ color: 0x17232d, metalness: 0.55, roughness: 0.3 });
    const fastener = new THREE.MeshStandardMaterial({ color: 0xb8c4cc, metalness: 0.9, roughness: 0.22 });
    const translucentCover = new THREE.MeshStandardMaterial({
      color: 0x8bb1c4, metalness: 0.42, roughness: 0.3, transparent: true, opacity: 0.18,
      depthWrite: false
    });

    const addPart = (part: BatteryPart): THREE.Group => {
      const group = new THREE.Group();
      group.userData.part = part;
      root.add(group);
      groupsRef.current[part] = group;
      return group;
    };
    const addBox = (
      parent: THREE.Object3D,
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const addCylinder = (
      parent: THREE.Object3D,
      radiusTop: number,
      radiusBottom: number,
      height: number,
      position: [number, number, number],
      material: THREE.Material
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

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

    const busbars = addPart('busbars');
    for (let row = 0; row < 3; row += 1) {
      const z = -1.05 + row * 1.05;
      for (let column = 0; column < 3; column += 1) {
        const x = -1.4 + column * 1.4;
        addBox(busbars, [0.72, 0.075, 0.14], [x, 0.78, z], copper);
      }
      addBox(busbars, [4.6, 0.055, 0.08], [0, 0.82, z + 0.31], fastener);
    }

    const bms = addPart('bms');
    addBox(bms, [1.55, 0.12, 0.92], [2.35, 0.48, 1.15], board);
    addBox(bms, [0.46, 0.12, 0.42], [2.1, 0.61, 1.15], chip);
    addBox(bms, [0.3, 0.08, 0.28], [2.62, 0.6, 1.15], chip);
    for (let pin = 0; pin < 6; pin += 1) {
      addBox(bms, [0.07, 0.035, 0.12], [1.75 + pin * 0.22, 0.57, 0.65], copper);
    }

    const terminals = addPart('terminals');
    addBox(terminals, [0.78, 0.18, 0.52], [-2.8, 0.58, 1.25], darkShell);
    addCylinder(terminals, 0.2, 0.2, 0.22, [-2.95, 0.78, 1.25], copper);
    addCylinder(terminals, 0.2, 0.2, 0.22, [-2.58, 0.78, 1.25], fastener);
    addBox(terminals, [0.58, 0.32, 0.45], [-2.7, 0.28, 1.25], shell);

    const cover = addPart('cover');
    addBox(cover, [6.55, 0.12, 3.55], [0, 1.08, 0], translucentCover);
    [-2.65, 2.65].forEach((x) => [-1.35, 1.35].forEach((z) => {
      addCylinder(cover, 0.055, 0.055, 0.08, [x, 1.01, z], fastener);
    }));

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number; id: number } | null = null;
    let dragging = false;

    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragging = false;
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true;
      if (!dragging) return;
      root.rotation.y += dx * 0.008;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.004, -0.42, 0.48);
      down = { ...down, x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      if (!dragging) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(root.children, true)[0]?.object;
        let node: THREE.Object3D | null = hit || null;
        while (node && typeof node.userData.part !== 'string') node = node.parent;
        if (node && PARTS.includes(node.userData.part as BatteryPart)) {
          selectedRef.current = node.userData.part as BatteryPart;
          setSelectedPart(node.userData.part as BatteryPart);
        }
      }
      down = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.6, 1.9);
      camera.updateProjectionMatrix();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const step = 0.14;
      if (event.key === 'ArrowLeft') root.rotation.y -= step;
      else if (event.key === 'ArrowRight') root.rotation.y += step;
      else if (event.key === 'ArrowUp') root.rotation.x = THREE.MathUtils.clamp(root.rotation.x - step, -0.42, 0.48);
      else if (event.key === 'ArrowDown') root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + step, -0.42, 0.48);
      else if (event.key === 'Home') root.rotation.set(0.12, -0.5, 0);
      else return;
      event.preventDefault();
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('keydown', onKeyDown);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      const frustumHeight = width < 640 ? 4.5 : 5.25;
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
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
      groupsRef.current = {};
    };
  }, [battery.id]);

  useEffect(() => {
    rootRef.current?.rotation.set(
      view === 'iso' ? 0.12 : 0,
      view === 'iso' ? -0.5 : 0,
      0
    );
    cameraRef.current?.up.set(0, view === 'top' ? 0 : 1, view === 'top' ? -1 : 0);
  }, [view]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const distance = 12.5;
    const positions: Record<BatteryView, THREE.Vector3> = {
      iso: new THREE.Vector3(distance * 0.75, distance * 0.58, distance * 0.75),
      front: new THREE.Vector3(0, distance * 0.22, distance),
      side: new THREE.Vector3(distance, distance * 0.22, 0),
      top: new THREE.Vector3(0, distance, 0.001)
    };
    camera.position.copy(positions[view]);
    camera.lookAt(0, 0, 0);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [view, zoom]);

  useEffect(() => {
    const offsets: Record<BatteryPart, THREE.Vector3> = {
      enclosure: new THREE.Vector3(0, 0, 0),
      cells: new THREE.Vector3(0, exploded ? 0.62 : 0, 0),
      busbars: new THREE.Vector3(0, exploded ? 1.05 : 0, 0),
      bms: new THREE.Vector3(0.15, exploded ? 1.55 : 0, 0.25),
      terminals: new THREE.Vector3(-0.15, exploded ? 1.85 : 0, 0),
      cover: new THREE.Vector3(0, exploded ? 2.65 : 0, 0)
    };
    PARTS.forEach((part) => groupsRef.current[part]?.position.copy(offsets[part]));
  }, [exploded]);

  useEffect(() => {
    PARTS.forEach((part) => {
      groupsRef.current[part]?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.emissive.set(part === selectedPart ? 0x623719 : 0x000000);
            material.emissiveIntensity = part === selectedPart ? 0.32 : 0;
          }
        });
      });
    });
  }, [selectedPart]);

  const partTitle = (part: BatteryPart) => PART_COPY[part][language];
  const partDetail = (part: BatteryPart) => PART_COPY[part][language === 'ar' ? 'detailAr' : 'detailEn'];

  return (
    <div className="battery-3d-shell">
      <div className="battery-toolbar">
        <div className="battery-view-tabs" role="group" aria-label={language === 'ar' ? 'منظور البطارية' : 'Battery model view'}>
          {(['iso', 'front', 'side', 'top'] as BatteryView[]).map((item) => (
            <button type="button" key={item} className={view === item ? 'active' : ''} aria-pressed={view === item} onClick={() => setView(item)}>
              {VIEW_COPY[item][language]}
            </button>
          ))}
        </div>
        <div className="battery-view-actions">
          <button type="button" className={exploded ? 'tool-active' : ''} aria-pressed={exploded} onClick={() => setExploded((value) => !value)}>
            {language === 'ar' ? (exploded ? 'إعادة التجميع' : 'تفكيك المكونات') : (exploded ? 'Reassemble' : 'Exploded assembly')}
          </button>
          <button type="button" onClick={() => { setView('iso'); setZoom(1); setExploded(false); setSelectedPart('cells'); rootRef.current?.rotation.set(0.12, -0.5, 0); }}>
            {language === 'ar' ? 'إعادة ضبط' : 'Reset view'}
          </button>
        </div>
      </div>
      <div ref={hostRef} className="battery-3d-host" style={{ display: available === false ? 'none' : 'block' }} />
      {available === false && <div className="battery-3d-fallback">{fallback}</div>}
      <div className="battery-viewer-caption">
        <span>{battery.id} · {battery.model || (language === 'ar' ? 'موديل غير مسجل' : 'MODEL NOT RECORDED')}</span>
        <strong>{battery.soc === null ? (language === 'ar' ? 'الشحن غير مؤكد' : 'SOC NOT VERIFIED') : (language === 'ar' ? `شحن مسجل ${battery.soc}%` : `RECORDED SOC ${battery.soc}%`)}</strong>
        <small>{language === 'ar' ? 'تجميعة مرجعية تصورية وليست رسم مصنع معتمدًا' : 'CONCEPTUAL REFERENCE ASSEMBLY · NOT OEM CAD'}</small>
      </div>
      <div className="battery-inspection-layout">
        <div className="battery-component-grid" aria-label={language === 'ar' ? 'مكونات البطارية' : 'Battery components'}>
          {PARTS.map((part, index) => (
            <button type="button" key={part} className={selectedPart === part ? 'selected' : ''} aria-pressed={selectedPart === part} onClick={() => setSelectedPart(part)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{partTitle(part)}</strong>
            </button>
          ))}
        </div>
        <section className="battery-part-inspector" aria-live="polite">
          <span className="eyebrow">{language === 'ar' ? 'فاحص المكون المحدد' : 'SELECTED COMPONENT INSPECTOR'}</span>
          <h4>{partTitle(selectedPart)}</h4>
          <p>{partDetail(selectedPart)}</p>
        </section>
      </div>
      <p className="battery-viewer-safety-note">
        {language === 'ar'
          ? 'المكونات والأبعاد توضيحية فقط. اعتمد على رقم موديل البطارية ومستندات الشركة المصنعة قبل أي فحص أو صيانة كهربائية.'
          : 'Components and proportions are illustrative only. Use the verified battery model and manufacturer documentation before electrical inspection or service.'}
      </p>
      <label className="battery-zoom-control">
        <span>{language === 'ar' ? 'تكبير النموذج' : 'Model zoom'}</span>
        <input aria-label={language === 'ar' ? 'تكبير النموذج' : 'Model zoom'} type="range" min="0.7" max="1.55" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/>
        <output>{Math.round(zoom * 100)}%</output>
      </label>
    </div>
  );
}
