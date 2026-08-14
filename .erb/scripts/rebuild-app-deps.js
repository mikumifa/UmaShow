const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const electronPath = ensureElectronInstalled();
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

function ensureElectronInstalled() {
  const electronPackageDir = path.dirname(
    require.resolve('electron/package.json'),
  );
  const electronPathFile = path.join(electronPackageDir, 'path.txt');
  const executableName = fs.existsSync(electronPathFile)
    ? fs.readFileSync(electronPathFile, 'utf8').trim()
    : '';
  const executablePath = executableName
    ? path.join(electronPackageDir, 'dist', executableName)
    : '';

  if (!executablePath || !fs.existsSync(executablePath)) {
    console.log('Electron binary is missing; downloading it now...');
    const installResult = spawnSync(
      process.execPath,
      [path.join(electronPackageDir, 'install.js')],
      {
        cwd: electronPackageDir,
        env: process.env,
        stdio: 'inherit',
      },
    );

    if (installResult.error) {
      throw installResult.error;
    }
    if (installResult.status !== 0) {
      process.exit(installResult.status ?? 1);
    }
  }

  return require('electron');
}
