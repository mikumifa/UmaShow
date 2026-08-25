import fs from 'fs';
import os from 'os';
import path from 'path';
import archiveNameKey from './RaceArchiveName';
import { createRaceArchive } from './RaceInfo';

const mockRaceDir = path.join(
  os.tmpdir(),
  `umashow-race-archive-test-${process.pid}`,
);

jest.mock('main/paths', () => {
  const nodeOs = jest.requireActual<typeof import('os')>('os');
  const nodePath = jest.requireActual<typeof import('path')>('path');
  return {
    RACE_DIR: nodePath.join(
      nodeOs.tmpdir(),
      `umashow-race-archive-test-${process.pid}`,
    ),
  };
});
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

beforeEach(() => {
  fs.rmSync(mockRaceDir, { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(mockRaceDir, { recursive: true, force: true });
});

describe('archiveNameKey', () => {
  test('groups equivalent archive names together', () => {
    expect(archiveNameKey('  练习 柏市纪念  模拟2 ')).toBe(
      archiveNameKey('练习 柏市纪念 模拟2'),
    );
    expect(archiveNameKey('ＡＢＣ')).toBe(archiveNameKey('abc'));
  });

  test('keeps different archive names separate', () => {
    expect(archiveNameKey('练习 柏市纪念 模拟1')).not.toBe(
      archiveNameKey('练习 柏市纪念 模拟2'),
    );
  });
});

describe('createRaceArchive', () => {
  test('reuses an archive with an equivalent name', () => {
    const first = createRaceArchive('ＡＢＣ');
    const second = createRaceArchive(' abc ');

    expect(second.id).toBe(first.id);
    const config = JSON.parse(
      fs.readFileSync(
        path.join(mockRaceDir, 'race_archives.config.json'),
        'utf-8',
      ),
    );
    expect(config.archives).toHaveLength(2);
  });

  test('merges existing same-name archives without overwriting records', () => {
    const archivesDir = path.join(mockRaceDir, 'archives');
    const targetDir = path.join(archivesDir, 'archive-a');
    const sourceDir = path.join(archivesDir, 'archive-b');
    const filename = 'race_info_1_r1_0.json';
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(
      path.join(mockRaceDir, 'race_archives.config.json'),
      JSON.stringify({
        archives: [
          { id: 'default', name: '默认', createdAt: 0 },
          { id: 'archive-a', name: '练习 A', createdAt: 1 },
          { id: 'archive-b', name: ' 练习　A ', createdAt: 2 },
        ],
      }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(targetDir, filename),
      JSON.stringify({ filename, archiveId: 'archive-a' }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(sourceDir, filename),
      JSON.stringify({
        filename,
        archiveId: 'archive-b',
        fullPath: path.join(sourceDir, filename),
      }),
      'utf-8',
    );

    const archive = createRaceArchive('练习 A');

    expect(archive.id).toBe('archive-a');
    const config = JSON.parse(
      fs.readFileSync(
        path.join(mockRaceDir, 'race_archives.config.json'),
        'utf-8',
      ),
    );
    expect(config.archives.map(({ id }: { id: string }) => id)).toEqual([
      'default',
      'archive-a',
    ]);
    expect(fs.existsSync(path.join(sourceDir, filename))).toBe(false);
    const mergedFilename = 'race_info_1_r1_0_merged_archive-b_1.json';
    const mergedPath = path.join(targetDir, mergedFilename);
    const mergedRecord = JSON.parse(fs.readFileSync(mergedPath, 'utf-8'));
    expect(mergedRecord).toMatchObject({
      archiveId: 'archive-a',
      filename: mergedFilename,
      fullPath: mergedPath,
    });
  });
});
