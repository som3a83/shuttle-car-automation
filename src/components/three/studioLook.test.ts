import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyStudioRenderer, configureKeyLightShadow, createShadowCatcher } from './studioLook';

describe('studioLook', () => {
  it('applies ACES, sRGB and PCF shadow renderer settings', () => {
    const renderer = { outputColorSpace: null, toneMapping: 0, toneMappingExposure: 0, shadowMap: { enabled: false, type: 0 } } as unknown as THREE.WebGLRenderer;
    applyStudioRenderer(renderer, 1.1);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.1);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(THREE.PCFShadowMap);
  });

  it('configures bounded directional key-light shadows', () => {
    const light = new THREE.DirectionalLight(0xffffff, 2.6);
    configureKeyLightShadow(light, 9, 2048);
    expect(light.castShadow).toBe(true);
    expect(light.shadow.mapSize.width).toBe(2048);
    expect(light.shadow.camera.left).toBe(-9);
    expect(light.shadow.camera.right).toBe(9);
    expect(light.shadow.camera.top).toBe(9);
    expect(light.shadow.camera.bottom).toBe(-9);
    expect(light.shadow.camera.near).toBe(1);
    expect(light.shadow.camera.far).toBe(40);
    expect(light.shadow.bias).toBe(-0.0004);
    expect(light.shadow.normalBias).toBe(0.02);
    expect(light.shadow.radius).toBe(3);
  });

  it('creates a horizontal receiver plane with configurable opacity', () => {
    const catcher = createShadowCatcher(18, -1.04, 0.38);
    expect(catcher.geometry.parameters.width).toBe(18);
    expect(catcher.geometry.parameters.height).toBe(18);
    expect(catcher.position.y).toBe(-1.04);
    expect(catcher.receiveShadow).toBe(true);
    expect(catcher.material.opacity).toBe(0.38);
    catcher.geometry.dispose();
    catcher.material.dispose();
  });
});
