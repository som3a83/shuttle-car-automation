import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Shuttle } from '../types';

interface Props { shuttles: Shuttle[]; language: 'ar' | 'en'; }

export default function ImmersiveWarehouse({ shuttles, language }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(shuttles[0]?.id ?? 'SC-01');
  const [simulation, setSimulation] = useState(false);
  const [view, setView] = useState<'overview' | 'aisle'>('overview');
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const selectedRef = useRef(selectedId);
  const simulationRef = useRef(simulation);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { simulationRef.current = simulation; }, [simulation]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window.WebGLRenderingContext === 'undefined') { setWebgl(false); return; }
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); }
    catch { setWebgl(false); return; }
    setWebgl(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x09131d, 1);
    renderer.domElement.className = 'immersive-warehouse-canvas';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-label', language === 'ar' ? 'مشهد ثلاثي الأبعاد توضيحي لمخزن آلي. اسحب للتدوير واستخدم إصبعين للتقريب.' : 'Conceptual 3D automated warehouse. Drag to rotate and pinch to zoom.');
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x09131d, 24, 75);
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 120);
    camera.position.set(15, 13, 22);
    const root = new THREE.Group();
    scene.add(root);
    scene.add(new THREE.HemisphereLight(0xd7eaff, 0x26303a, 2.1));
    const key = new THREE.DirectionalLight(0xffd8ad, 2.7); key.position.set(8, 18, 12); scene.add(key);
    const rim = new THREE.PointLight(0x3ca8d5, 24, 38); rim.position.set(-12, 8, -9); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 34), new THREE.MeshStandardMaterial({ color: 0x172633, metalness: .42, roughness: .72 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.12; root.add(floor);
    const grid = new THREE.GridHelper(42, 42, 0x476174, 0x253c4e); grid.position.y = -.1; root.add(grid);

    const steel = new THREE.MeshStandardMaterial({ color: 0x647887, metalness: .78, roughness: .3 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x263b4b, metalness: .7, roughness: .36 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xd88743, metalness: .52, roughness: .34 });
    const palletMat = new THREE.MeshStandardMaterial({ color: 0xb28a5d, roughness: .86 });
    const cartonMats = [0x567b91, 0x7c9d9c, 0x9a7859, 0x6b7592].map(color => new THREE.MeshStandardMaterial({ color, roughness: .82 }));
    const rackRows = [-7, 0, 7];
    rackRows.forEach((z, row) => {
      for (let bay = 0; bay < 6; bay++) {
        const x = -10 + bay * 4;
        for (let level = 0; level < 4; level++) {
          const y = 1.15 + level * 2.25;
          const beam = new THREE.Mesh(new THREE.BoxGeometry(3.75, .13, .18), orange);
          beam.position.set(x, y, z); root.add(beam);
          for (const side of [-1, 1]) {
            const upright = new THREE.Mesh(new THREE.BoxGeometry(.16, 8.4, .18), steel);
            upright.position.set(x + side * 1.85, 4.05, z); root.add(upright);
          }
          const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.7, .16, 1.65), palletMat);
          pallet.position.set(x, y + .16, z); root.add(pallet);
          const carton = new THREE.Mesh(new THREE.BoxGeometry(2.25, .9, 1.3), cartonMats[(bay + level + row) % cartonMats.length]);
          carton.position.set(x, y + .72, z); root.add(carton);
          const band = new THREE.Mesh(new THREE.BoxGeometry(2.3, .06, 1.34), orange);
          band.position.set(x, y + 1.19, z); root.add(band);
        }
      }
    });
    const shuttleGroups: THREE.Group[] = [];
    const shuttlePickables: THREE.Object3D[] = [];
    shuttles.slice(0, 5).forEach((shuttle, index) => {
      const car = new THREE.Group();
      car.position.set(-8 + index * 4, .5, index % 2 === 0 ? -3.5 : 3.5);
      car.userData.shuttleId = shuttle.id;
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.25, .42, 1.35), darkSteel);
      base.userData.shuttleId = shuttle.id; car.add(base); shuttlePickables.push(base);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.72, .2, 1.05), orange);
      top.position.y = .3; top.userData.shuttleId = shuttle.id; car.add(top); shuttlePickables.push(top);
      for (const x of [-.78, .78]) for (const z of [-.52, .52]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .16, 20), steel);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -.16, z); car.add(wheel);
      }
      const light = new THREE.Mesh(new THREE.BoxGeometry(.22, .1, .12), new THREE.MeshBasicMaterial({ color: 0x68d8ff }));
      light.position.set(0, .55, .58); car.add(light);
      root.add(car); shuttleGroups.push(car);
    });

    const activePointers = new Map<number, { x: number; y: number }>();
    let previous: { x: number; y: number; id: number } | null = null;
    let pinchDistance = 0;
    let moved = false;
    const distance = () => { const p = Array.from(activePointers.values()); return p.length < 2 ? 0 : Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); };
    const down = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) { previous = { x:e.clientX, y:e.clientY, id:e.pointerId }; moved = false; }
      else { previous = null; pinchDistance = distance(); }
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if (activePointers.size > 1) {
        const next = distance();
        if (pinchDistance > 0 && next > 0) camera.position.multiplyScalar(THREE.MathUtils.clamp(pinchDistance / next, .94, 1.06));
        pinchDistance = next; return;
      }
      if (!previous || previous.id !== e.pointerId) return;
      const dx=e.clientX-previous.x, dy=e.clientY-previous.y;
      if (Math.abs(dx)+Math.abs(dy)>3) moved=true;
      root.rotation.y += dx*.006;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy*.003, -.28, .3);
      previous = { ...previous, x:e.clientX, y:e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!moved && activePointers.size === 1) {
        const rect=renderer.domElement.getBoundingClientRect();
        const pointer=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
        const raycaster=new THREE.Raycaster(); raycaster.setFromCamera(pointer,camera);
        const hit=raycaster.intersectObjects(shuttlePickables,false)[0]?.object;
        const id=hit?.userData.shuttleId;
        if (typeof id === 'string') setSelectedId(id);
      }
      activePointers.delete(e.pointerId);
      if (!activePointers.size) { previous=null; pinchDistance=0; }
      else if (activePointers.size===1) { const p=Array.from(activePointers.entries())[0]; previous={x:p[1].x,y:p[1].y,id:p[0]}; pinchDistance=0; }
    };
    const wheel=(e:WheelEvent)=>{e.preventDefault();camera.position.multiplyScalar(e.deltaY>0?1.06:.94);};
    renderer.domElement.addEventListener('pointerdown',down);
    renderer.domElement.addEventListener('pointermove',move);
    renderer.domElement.addEventListener('pointerup',up);
    renderer.domElement.addEventListener('pointercancel',up);
    renderer.domElement.addEventListener('wheel',wheel,{passive:false});
    let frame=0;
    const clock=new THREE.Clock();
    const render=()=>{
      frame=requestAnimationFrame(render);
      const t=clock.getElapsedTime();
      if(simulationRef.current) shuttleGroups.forEach((car,index)=>{car.position.x=-8+index*4+Math.sin(t*.75+index)*.7;car.rotation.y=Math.sin(t*.75+index)*.025;});
      shuttleGroups.forEach((car)=>{const selected=car.userData.shuttleId===selectedRef.current;(car.children[0] as THREE.Mesh).material=selected?orange:darkSteel;});
      renderer.render(scene,camera);
    };
    render();
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    const observer=new ResizeObserver(resize); observer.observe(host);
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);
      renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);
      renderer.domElement.removeEventListener('wheel',wheel);
      scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(mat=>mat.dispose());}});
      renderer.dispose();renderer.domElement.remove();
    };
  }, [language, shuttles]);

  const ar = language === 'ar';
  return <section className="page-content immersive-warehouse-page">
    <div className="immersive-warehouse-heading">
      <div><span className="eyebrow">DIGITAL TWIN / VISUAL SIMULATION</span><h1>{ar ? 'المخزن الآلي ثلاثي الأبعاد' : 'Immersive automated warehouse'}</h1><p>{ar ? 'استكشف الممرات والرفوف والطبالي وعربات الشاتل باللمس.' : 'Explore aisles, racking, pallets and shuttle cars with touch controls.'}</p></div>
      <span className="warehouse-demo-chip">{ar ? 'مشهد توضيحي · ليس تحكمًا حيًا' : 'CONCEPT SCENE · NOT LIVE CONTROL'}</span>
    </div>
    <div className="warehouse-toolbar">
      <div className="warehouse-segment"><button className={view==='overview'?'active':''} onClick={()=>setView('overview')}>{ar?'نظرة عامة':'Overview'}</button><button className={view==='aisle'?'active':''} onClick={()=>setView('aisle')}>{ar?'داخل الممر':'Aisle view'}</button></div>
      <button className={simulation?'active':''} onClick={()=>setSimulation(v=>!v)}>{simulation?(ar?'إيقاف المحاكاة':'Stop simulation'):(ar?'تشغيل حركة توضيحية':'Run visual simulation')}</button>
      <button onClick={()=>{setSelectedId(shuttles[0]?.id??'SC-01');setSimulation(false);}}>{ar?'إعادة ضبط':'Reset'}</button>
    </div>
    <div className="immersive-warehouse-stage">
      {webgl===false ? <div className="warehouse-fallback">{ar?'تعذر تشغيل الرسوم ثلاثية الأبعاد على هذا الجهاز.':'3D graphics are unavailable on this device.'}</div> : <div ref={hostRef} className="immersive-warehouse-canvas-host"><div className="warehouse-loading">{ar?'جارٍ تجهيز المشهد ثلاثي الأبعاد…':'Preparing 3D scene…'}</div></div>}
      <div className="warehouse-overlay warehouse-overlay-top"><span>ASRS / RACK SYSTEM</span><span>{ar?'وضع المحاكاة':'SIMULATION MODE'}</span></div>
      <div className="warehouse-overlay warehouse-overlay-bottom"><span>{ar?'المعدة المحددة':'SELECTED SHUTTLE'} · {selectedId}</span><span>{ar?'اسحب للتدوير · إصبعان للتقريب':'DRAG ROTATE · PINCH ZOOM'}</span></div>
    </div>
    <div className="warehouse-asset-strip">{shuttles.slice(0,5).map(s=><button key={s.id} className={selectedId===s.id?'selected':''} onClick={()=>setSelectedId(s.id)}><strong>{s.id}</strong><span>{s.manufacturer}</span><small>{s.status}</small></button>)}</div>
    <p className="warehouse-disclaimer">{ar?'الأرفف والطبالي وتوزيع العربات هنا نموذج بصري للمحاكاة، وليست خريطة مخزن فعلية أو أوامر تشغيل للمعدات.':'Racks, pallets and shuttle positions are a visual simulation, not a surveyed warehouse map or equipment control commands.'}</p>
  </section>;
}
