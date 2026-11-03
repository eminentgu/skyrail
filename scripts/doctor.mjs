import {execFileSync} from 'node:child_process';
import {accessSync, constants} from 'node:fs';
import {createRequire} from 'node:module';
import net from 'node:net';
import path from 'node:path';

// Read-only diagnostics. Never call requestPermissions, observe, input or a model.
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/doctor.mjs [--json]\nRead-only prerequisites and permission preflight. No screenshots, grants or model calls.\nExit 1: missing UI/test prerequisite; exit 0: prerequisites found (optional features may be unavailable).');
  process.exit(0);
}
if (args.some(arg => arg !== '--json')) {
  console.error('Unknown option. Use --help.');
  process.exit(2);
}
const checks = [];
const add = (id, status, message, required = false) => checks.push({id, status, message, required});
const exists = (relative, executable = false) => {
  try {accessSync(path.join(root, relative), executable ? constants.X_OK : constants.R_OK); return true;}
  catch {return false;}
};
const run = (file, argv, input) => execFileSync(file, argv, {
  cwd: root, encoding: 'utf8', timeout: 8000, maxBuffer: 16384,
  stdio: ['pipe', 'pipe', 'pipe'], ...(input === undefined ? {} : {input}),
}).trim();
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOK = major > 22 || major === 22 && minor >= 12;
add('node', nodeOK ? 'pass' : 'fail', `Node ${process.version}; requires 22.12+ (CI: 22).`, true);
const missing = ['react', 'react-dom', 'vite', 'ws', 'typescript'].filter(name => {
  try {require.resolve(name); return false;} catch {return true;}
});
add('dependencies', missing.length ? 'fail' : 'pass', missing.length ? 'Run npm ci to install project dependencies.' : 'Core runtime/build dependencies resolve.', true);
add('build', exists('dist/index.html') ? 'pass' : 'warn', exists('dist/index.html') ? 'Frontend build found; freshness is not checked.' : 'Run npm run build before built-asset or managed service mode.');
try {
  const version = run(process.env.CODEX_BIN || 'codex', ['--version']);
  const validated = /^codex-cli 0\.165\.0-alpha\.1\.2$/.test(version);
  add('codex', validated ? 'pass' : 'warn', validated ? 'Validated Codex CLI version found; login and model execution are not checked.' : 'Codex executable responded, but its version is not the validated version; login is not checked.');
} catch {add('codex', 'warn', 'Codex did not answer --version. Install it or set CODEX_BIN. Real chat is not verified.');}

if (process.platform !== 'darwin') {
  add('macos', 'warn', 'Native Mac features are unavailable on this platform. UI/tests/build can still be evaluated.');
} else {
  try {
    const version = run('/usr/bin/sw_vers', ['-productVersion']);
    add('macos', Number(version.split('.')[0]) >= 14 ? 'pass' : 'warn', `macOS ${version}; native features require 14+.`);
  } catch {add('macos', 'warn', 'Could not determine macOS version.');}
  try {run('/usr/bin/xcrun', ['--find', 'swiftc']); add('swift', 'pass', 'Swift compiler found; compilation is not checked.');}
  catch {add('swift', 'warn', 'Xcode Command Line Tools are needed to build native helpers.');}
  const helper = '.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac';
  if (!exists(helper, true)) {
    add('native-helper', 'warn', 'Native helper missing. Run npm run setup:mac only when evaluating native features.');
    add('gui-permissions', 'info', 'Unknown: permission grants cannot be checked until the helper is built.');
  } else {
    add('native-helper', 'pass', 'Native helper found; signature stability is not checked.');
    try {
      const health = JSON.parse(run(path.join(root, helper), [], '{"method":"health"}\n'));
      if (typeof health.accessibility !== 'boolean' || typeof health.screenRecording !== 'boolean') throw Error('Invalid health');
      add('accessibility', health.accessibility ? 'pass' : 'warn', health.accessibility ? 'Accessibility preflight granted for this launch.' : 'Accessibility not granted for this launch; app input is unavailable.');
      add('screen-recording', health.screenRecording ? 'pass' : 'warn', health.screenRecording ? 'Screen Recording preflight granted for this launch; capture not tested.' : 'Screen Recording not granted for this launch; app capture is unavailable.');
      if (Number.isInteger(health.activeDisplays)) add('displays', health.activeDisplays > 0 ? 'pass' : 'warn', `${health.activeDisplays} display(s) reported; rendering/capture is not tested.`);
    } catch {add('gui-permissions', 'warn', 'Helper health unavailable or invalid; permissions are unknown, not confirmed denied.');}
  }
  if (exists('.data/SkyrailSessionStatus', true)) {
    try {
      const state = JSON.parse(run(path.join(root, '.data/SkyrailSessionStatus'), []));
      if (typeof state.locked !== 'boolean' || typeof state.available !== 'boolean') throw Error('Invalid status');
      add('session', state.available && !state.locked ? 'pass' : 'warn', state.available ? (state.locked ? 'Mac session is locked; app input/capture pauses.' : 'Mac session reports unlocked; no input tested.') : 'Lock state is unavailable; native actions fail closed.');
    } catch {add('session', 'warn', 'Session status unreadable. Native actions fail closed; try npm run setup:session.');}
  } else add('session', 'warn', 'Session status helper missing; run npm run setup:session for native features.');
  const rfb = await new Promise(resolve => {
    const socket = net.connect({host: '127.0.0.1', port: 5900});
    let buffer = Buffer.alloc(0), done = false;
    const finish = ok => {if (done) return; done = true; socket.destroy(); resolve(ok);};
    socket.setTimeout(800, () => finish(false));
    socket.on('error', () => finish(false));
    socket.on('end', () => finish(false));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 12) finish(/^RFB \d{3}\.\d{3}\n$/.test(buffer.subarray(0, 12).toString('ascii')));
    });
  });
  add('screen-sharing', rfb ? 'pass' : 'warn', rfb ? 'Loopback Screen Sharing RFB banner received; no authentication/input tested.' : 'No Screen Sharing RFB banner on loopback 5900; manual desktop control is unavailable or not responding.');
}
const ready = !checks.some(check => check.required && check.status === 'fail');
const report = {uiPrerequisitesFound: ready, preflightOnly: true, checks};
if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log('Skyrail doctor / 环境诊断 — read-only preflight / 只读预检\n');
  for (const check of checks) console.log(`[${check.status.toUpperCase()}] ${check.id}: ${check.message}`);
  console.log(`\nUI/test prerequisites / 网页测试前置条件: ${ready ? 'found / 已找到' : 'incomplete / 不完整'}`);
  console.log('Optional warnings do not block chat-only evaluation. No model, screenshot, input or desktop login was tested.\n可选功能缺失不影响纯聊天试用。未测试模型、截图、输入或桌面登录。');
}
process.exitCode = ready ? 0 : 1;
