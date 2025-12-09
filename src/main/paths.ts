import { app } from 'electron';
import path from 'path';

export const __assets = app.isPackaged
	? path.join(process.resourcesPath, 'assets')
	: path.join(__dirname, '../../assets');

export const __app = app.getAppPath();
