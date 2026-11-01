import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:{'skyrail-novnc-logging':fileURLToPath(new URL('./util/logging.js',import.meta.resolve('@novnc/novnc')))}}});
