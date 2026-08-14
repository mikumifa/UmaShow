const fs = require('fs');
const path = require('path');

const buildDir = path.resolve('release/build');
const unpackedDirs = fs.existsSync(buildDir)
  ? fs
      .readdirSync(buildDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          (entry.name === 'mac' || entry.name.endsWith('-unpacked')),
      )
      .map((entry) => path.join(buildDir, entry.name))
  : [];

if (unpackedDirs.length === 0) {
  throw new Error(`没有找到可校验的解包产物：${buildDir}`);
}

const requiredFiles = [
  'node_modules/better-sqlite3/package.json',
  'node_modules/better-sqlite3/lib/index.js',
  'node_modules/node-window-manager/package.json',
];

for (const unpackedDir of unpackedDirs) {
  const resourcesDir = path.join(
    unpackedDir,
    process.platform === 'darwin' ? 'Contents/Resources' : 'resources',
  );
  const asarUnpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
  const missingFiles = requiredFiles.filter(
    (relativePath) => !fs.existsSync(path.join(asarUnpackedDir, relativePath)),
  );
  const nativeFiles = fs.existsSync(asarUnpackedDir)
    ? findNativeFiles(asarUnpackedDir)
    : [];

  if (missingFiles.length > 0 || nativeFiles.length === 0) {
    throw new Error(
      [
        `打包产物缺少运行依赖：${unpackedDir}`,
        ...missingFiles.map((file) => `- ${file}`),
        ...(nativeFiles.length === 0 ? ['- 没有找到任何 .node 原生模块'] : []),
      ].join('\n'),
    );
  }
}

console.log('Packaged native dependencies verified.');

function findNativeFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findNativeFiles(entryPath));
    } else if (entry.name.endsWith('.node')) {
      files.push(entryPath);
    }
  }
  return files;
}
