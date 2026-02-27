import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcManifestPath = path.join(rootDir, 'manifest.json');
const distDir = path.join(rootDir, 'dist');
const distManifestPath = path.join(distDir, 'manifest.json');

if (!fs.existsSync(srcManifestPath)) {
  throw new Error(`Source manifest not found: ${srcManifestPath}`);
}

if (!fs.existsSync(distDir)) {
  throw new Error(`Dist directory not found: ${distDir}`);
}

const manifest = JSON.parse(fs.readFileSync(srcManifestPath, 'utf8'));

manifest.action = manifest.action || {};
manifest.action.default_popup = 'src/popup/index.html';

if (manifest.action.default_icons) {
  delete manifest.action.default_icons;
}

manifest.web_accessible_resources = [
  {
    resources: ['src/popup/index.html', 'popup.js'],
    matches: ['<all_urls>']
  }
];

fs.writeFileSync(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(rootDir, distManifestPath)}`);
