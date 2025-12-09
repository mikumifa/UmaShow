import { app } from 'electron';
import path from 'path';

export const ASSETS_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

export const APP_PATH = app.getAppPath();
