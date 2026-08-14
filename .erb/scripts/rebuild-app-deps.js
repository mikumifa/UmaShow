const path = require('path');
const { spawnSync } = require('child_process');

const electronPath = require('electron');
const rebuildEntry = require.resolve('@electron/rebuild');
const rebuildCli = path.join(path.dirname(rebuildEntry), 'cli.js');
const appDir = path.resolve('release/app');

const result = spawnSync(
  electronPath,
  [
    rebuildCli,
    '--force',
    '--types',
    'prod,dev,optional',
    '--module-dir',
    appDir,
  ],
  {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
