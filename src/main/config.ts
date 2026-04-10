import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export const DEFAULT_SERVER_PORT = 4639;
export const SERVER_PORT_OPTIONS = [4639, 4640, 5000, 8000, 8080] as const;

interface AppSettings {
  serverPort?: number;
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function isValidPort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
  );
}

function readSettings(): AppSettings {
  const settingsPath = getSettingsPath();
  try {
    if (!fs.existsSync(settingsPath)) {
      return {};
    }
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw) as AppSettings;
  } catch (error) {
    console.error('Failed to read settings:', error);
    return {};
  }
}

function writeSettings(settings: AppSettings) {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

export function getServerPort() {
  const settings = readSettings();
  return isValidPort(settings.serverPort)
    ? settings.serverPort
    : DEFAULT_SERVER_PORT;
}

export function setServerPort(port: number) {
  if (!isValidPort(port)) {
    throw new Error(`Invalid port: ${port}`);
  }
  const settings = readSettings();
  settings.serverPort = port;
  writeSettings(settings);
}
