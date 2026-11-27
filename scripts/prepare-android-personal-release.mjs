import fs from 'node:fs';

const versionName = process.env.APP_VERSION_INPUT || '8.0.0';
const versionCodeRaw = process.env.APP_VERSION_CODE_INPUT || '8000000';

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) {
  throw new Error('APP_VERSION_INPUT must be a semantic version such as 8.0.0.');
}
if (!/^[1-9]\d*$/.test(versionCodeRaw)) {
  throw new Error('APP_VERSION_CODE_INPUT must contain only a positive integer.');
}
const versionCode = Number(versionCodeRaw);
if (!Number.isSafeInteger(versionCode)) {
  throw new Error('APP_VERSION_CODE_INPUT must be a safe positive integer.');
}

const variablesPath = 'android/variables.gradle';
const appGradlePath = 'android/app/build.gradle';
if (!fs.existsSync(variablesPath) || !fs.existsSync(appGradlePath)) {
  throw new Error('Generated Capacitor Android project is incomplete.');
}

let variables = fs.readFileSync(variablesPath, 'utf8');
for (const name of ['compileSdkVersion', 'targetSdkVersion']) {
  const pattern = new RegExp('(' + name + '\\s*=\\s*)\\d+');
  if (!pattern.test(variables)) throw new Error('Could not locate ' + name + ' in android/variables.gradle.');
  variables = variables.replace(pattern, '$1' + 36);
}
fs.writeFileSync(variablesPath, variables);

let gradle = fs.readFileSync(appGradlePath, 'utf8');
if (!/\bversionCode\s+\d+/.test(gradle) || !/\bversionName\s+['"][^'"]+['"]/.test(gradle)) {
  throw new Error('Could not locate Android version fields in app/build.gradle.');
}
gradle = gradle.replace(/(\bversionCode\s+)\d+/, '$1' + versionCode);
gradle = gradle.replace(/(\bversionName\s+)['"][^'"]+['"]/, '$1"' + versionName + '"');
if (/signingConfig\s+signingConfigs\.release/.test(gradle)) {
  throw new Error('Unexpected release signing configuration in the unsigned personal build.');
}
fs.writeFileSync(appGradlePath, gradle);

if (!/compileSdkVersion\s*=\s*36/.test(variables) || !/targetSdkVersion\s*=\s*36/.test(variables)) {
  throw new Error('Android API 36 configuration did not verify.');
}
if (!gradle.includes('versionCode ' + versionCode) || !gradle.includes('versionName "' + versionName + '"')) {
  throw new Error('Android version metadata did not verify.');
}
console.log('Prepared unsigned personal APK ' + versionName + ' (' + versionCode + '); no keystore or signing secrets required.');
