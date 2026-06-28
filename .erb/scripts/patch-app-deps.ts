import fs from 'fs';
import path from 'path';
import webpackPaths from '../configs/webpack.paths';

const candidatePaths = [
  path.join(webpackPaths.appNodeModulesPath, 'extract-file-icon'),
  path.join(
    webpackPaths.appNodeModulesPath,
    'node-window-manager',
    'node_modules',
    'extract-file-icon',
  ),
];

const stubPackageJson = JSON.stringify(
  {
    name: 'extract-file-icon',
    version: '0.3.2',
    description: 'Stub for builds that do not use window icons',
    main: 'index.js',
    license: 'MIT',
  },
  null,
  2,
);

const stubIndexJs = `'use strict';

module.exports = function extractFileIconStub() {
  throw new Error('extract-file-icon is not available in this build');
};
`;

candidatePaths.forEach((extractFileIconPath) => {
  if (!fs.existsSync(extractFileIconPath)) {
    return;
  }

  fs.rmSync(extractFileIconPath, { recursive: true, force: true });
  fs.mkdirSync(extractFileIconPath, { recursive: true });
  fs.writeFileSync(path.join(extractFileIconPath, 'package.json'), stubPackageJson);
  fs.writeFileSync(path.join(extractFileIconPath, 'index.js'), stubIndexJs);
});
