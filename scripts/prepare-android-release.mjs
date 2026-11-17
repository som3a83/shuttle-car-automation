import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const versionName = process.env.APP_VERSION || '1.0.0';
const versionCode = Number.parseInt(process.env.APP_VERSION_CODE || '1', 10);
const requiredSecrets = [
  'ANDROID_KEYSTORE_FILE',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD'
];

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) {
  throw new Error(`Invalid APP_VERSION: ${versionName}`);
}
if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
  throw new Error('APP_VERSION_CODE must be a positive integer.');
}
for (const name of requiredSecrets) {
  if (!process.env[name]) throw new Error(`Missing required release signing variable: ${name}`);
}

const variablesPath = path.join(root, 'android', 'variables.gradle');
const appGradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (!fs.existsSync(variablesPath) || !fs.existsSync(appGradlePath)) {
  throw new Error('Generated Capacitor Android project is incomplete: expected android/variables.gradle and android/app/build.gradle.');
}

let variables = fs.readFileSync(variablesPath, 'utf8');
function setGradleInteger(source, name, value) {
  const patterns = [
    new RegExp('(\\b' + name + '\\s*=\\s*)\\d+'),
    new RegExp('(\\b' + name + '\\s+)\\d+')
  ];
  let changed = false;
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      source = source.replace(pattern, (_match, prefix) => prefix + value);
      changed = true;
      break;
    }
  }
  if (!changed) throw new Error(`Could not locate ${name} in android/variables.gradle; inspect the Capacitor Android template before releasing.`);
  return source;
}

variables = setGradleInteger(variables, 'compileSdkVersion', 36);
variables = setGradleInteger(variables, 'targetSdkVersion', 36);
fs.writeFileSync(variablesPath, variables);

let appGradle = fs.readFileSync(appGradlePath, 'utf8');
if (!/\\bversionCode\\s+\\d+/.test(appGradle)) throw new Error('Could not locate versionCode in android/app/build.gradle.');
if (!/\\bversionName\\s+['"][^'"]+['"]/.test(appGradle)) throw new Error('Could not locate versionName in android/app/build.gradle.');
appGradle = appGradle.replace(/(\\bversionCode\\s+)\\d+/, `$1${versionCode}`);
appGradle = appGradle.replace(/(\\bversionName\\s+)['"][^'"]+['"]/, `$1"${versionName}"`);

const signingBlock = `
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;
if (!appGradle.includes('signingConfigs')) {
  if (!/\\bbuildTypes\\s*\\{/.test(appGradle)) throw new Error('Could not locate buildTypes block in android/app/build.gradle.');
  appGradle = appGradle.replace(/(\\bbuildTypes\\s*\\{)/, signingBlock + '    $1');
}
if (!/signingConfig\\s+signingConfigs\\.release/.test(appGradle)) {
  if (!/\\brelease\\s*\\{/.test(appGradle)) throw new Error('Could not locate release build type in android/app/build.gradle.');
  appGradle = appGradle.replace(/(\\brelease\\s*\\{)/, '$1\\n            signingConfig signingConfigs.release');
}
fs.writeFileSync(appGradlePath, appGradle);

if (!/targetSdkVersion\\s*=\\s*36/.test(variables) || !/compileSdkVersion\\s*=\\s*36/.test(variables)) {
  throw new Error('Android API 36 enforcement did not verify after patching.');
}
if (!appGradle.includes(`versionCode ${versionCode}`) || !appGradle.includes(`versionName "${versionName}"`)) {
  throw new Error('Android version metadata did not verify after patching.');
}
console.log(`Prepared signed Play release ${versionName} (${versionCode}) with compile/target API 36.`);
