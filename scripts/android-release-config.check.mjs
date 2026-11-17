import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prepare-android-release.mjs');

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shuttle-release-config-'));
  fs.mkdirSync(path.join(root, 'android', 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'android', 'variables.gradle'),
    'ext {\n    minSdkVersion = 23\n    compileSdkVersion = 35\n    targetSdkVersion = 35\n}\n'
  );
  fs.writeFileSync(
    path.join(root, 'android', 'app', 'build.gradle'),
    'android {\n    defaultConfig {\n        versionCode 1\n        versionName "0.1.0"\n    }\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}\n'
  );
  return root;
}

const signingEnvironment = {
  ANDROID_KEYSTORE_FILE: 'upload-key.jks',
  ANDROID_KEYSTORE_PASSWORD: 'test-only-password',
  ANDROID_KEY_ALIAS: 'test-alias',
  ANDROID_KEY_PASSWORD: 'test-only-password'
};

test('prepares API 36, release version, and upload signing configuration', () => {
  const root = createFixture();
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...signingEnvironment,
        APP_VERSION: '1.2.3',
        APP_VERSION_CODE: '1002003'
      }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const variables = fs.readFileSync(path.join(root, 'android', 'variables.gradle'), 'utf8');
    const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
    assert.match(variables, /compileSdkVersion\s*=\s*36/);
    assert.match(variables, /targetSdkVersion\s*=\s*36/);
    assert.match(gradle, /versionCode\s+1002003/);
    assert.match(gradle, /versionName\s+"1\.2\.3"/);
    assert.match(gradle, /signingConfigs\s*\{[\s\S]*release\s*\{/);
    const signingAssignment = gradle.indexOf('signingConfig signingConfigs.release');
    const buildTypesStart = gradle.indexOf('buildTypes {');
    const signingConfigsStart = gradle.indexOf('signingConfigs {');
    assert.ok(signingAssignment > buildTypesStart, 'signing assignment must be inside buildTypes');
    assert.ok(!gradle.slice(signingConfigsStart, buildTypesStart).includes('signingConfig signingConfigs.release'),
      'signing assignment must not be nested inside signingConfigs.release');
    assert.equal(gradle.match(/signingConfig signingConfigs\.release/g)?.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects non-numeric Android version codes', () => {
  const root = createFixture();
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...signingEnvironment,
        APP_VERSION: '1.0.0',
        APP_VERSION_CODE: '1-preview'
      }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APP_VERSION_CODE must contain only a positive integer/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
