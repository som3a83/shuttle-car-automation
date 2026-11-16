import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Battery } from '../types';

interface Battery3DViewerProps {
  battery: Battery;
  fallback: React.ReactNode;
}

export default function Battery3DViewer({ battery, fallback }: Battery3DViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

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
    renderer.domElement.setAttribute('aria-label', 'Interactive conceptual lithium battery assembly');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe0efff, 0x25333c, 2.2));
    const key = new THREE.DirectionalLight(0xffe3c4, 3);
    key.position.set(6, 9, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6bb9dc, 1.8);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 80);
    camera.position.set(8.8, 7.2, 9.2);
    camera.lookAt(0, 0, 0);
    const root = new THREE.Group();
    root.rotation.y = -0.45;
    scene.add(root);

    const shell = new THREE.MeshStandardMaterial({ color: 0x354957, metalness: 0.78, roughness: 0.34 });
    const inner = new THREE.MeshStandardMaterial({ color: 0x182831, metalness: 0.55, roughness: 0.48 });
    const cell = new THREE.MeshStandardMaterial({ color: 0x568f7d, metalness: 0.32, roughness: 0.42 });
    const bus = new THREE.MeshStandardMaterial({ color: 0xc58a4c, metalness: 0.82, roughness: 0.25 });
    const board = new THREE.MeshStandardMaterial({ color: 0x275c50, metalness: 0.25, roughness: 0.62 });
    const connector = new THREE.MeshStandardMaterial({ color: 0x171d22, metalness: 0.6, roughness: 0.35 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x79d5b0, emissive: 0x174c39, emissiveIntensity: 0.6 });

    const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Open-top enclosure: conceptual geometry only, not a manufacturer battery drawing.
    box(root, [6.8, 0.34, 3.7], [0, -0.72, 0], shell);
    box(root, [6.8, 1.18, 0.18], [0, -0.08, -1.76], shell);
    box(root, [6.8, 1.18, 0.18], [0, -0.08, 1.76], shell);
    box(root, [0.18, 1.18, 3.5], [-3.31, -0.08, 0], shell);
    box(root, [0.18, 1.18, 3.5], [3.31, -0.08, 0], shell);
    box(root, [6.25, 0.06, 3.15], [0, -0.48, 0], inner);

    // Twelve prismatic lithium cells arranged in two banks.
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const x = -2.55 + col * 1.02;
        const z = row === 0 ? -0.82 : 0.82;
        box(root, [0.82, 0.88, 1.32], [x, 0.02, z], cell);
        box(root, [0.3, 0.035, 0.22], [x, 0.49, z], bus);
      }
    }

    // Bus bars, BMS board, terminals, service connector and handles.
    box(root, [5.85, 0.09, 0.16], [0, 0.57, -0.82], bus);
    box(root, [5.85, 0.09, 0.16], [0, 0.57, 0.82], bus);
    box(root, [1.4, 0.16, 1.0], [2.18, 0.62, 0.05], board);
    for (let i = 0; i < 5; i += 1) box(root, [0.12, 0.04, 0.12], [1.72 + i * 0.22, 0.73, -0.18], glow);
    box(root, [0.62, 0.36, 0.5], [-2.65, 0.58, 0], connector);
    const terminal = (x: number, color: number) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 20), new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.22 }));
      post.position.set(x, 0.72, 1.28);
      root.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), connector.clone());
      cap.position.set(x, 0.88, 1.28);
      root.add(cap);
    };
    terminal(-2.7, 0xc94d4d);
    terminal(-2.0, 0x4d83c9);
    [-2.6, 2.6].forEach((x) => {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 10, 28, Math.PI), shell.clone());
      handle.rotation.z = Math.PI / 2;
      handle.position.set(x, 0.64, -1.45);
      root.add(handle);
    });

    const grid = new THREE.GridHelper(16, 32, 0x526779, 0x263744);
    grid.position.y = -0.94;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    let down: { x: number; y: number; id: number } | null = null;
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, id: event.pointerId };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      root.rotation.y += (event.clientX - down.x) * 0.008;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + (event.clientY - down.y) * 0.004, -0.35, 0.45);
      down = { ...down, x: event.clientX, y: event.clientY };
    };
    const onUp = () => { down = null; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.position.multiplyScalar(event.deltaY > 0 ? 1.08 : 0.92);
      camera.position.clampLength(7, 22);
      camera.lookAt(0, 0, 0);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
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
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      root.rotation.y += 0.0008;
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
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [battery.id]);

  return (
    <div className="battery-3d-shell">
      <div ref={hostRef} className="battery-3d-host" style={{ display: available === false ? 'none' : 'block' }} />
      {available === false && <div className="battery-3d-fallback">{fallback}</div>}
      <div className="battery-3d-caption">LITHIUM PACK · CONCEPTUAL INTERNAL ASSEMBLY</div>
      <div className="battery-3d-id">{battery.id}</div>
    </div>
  );
}
