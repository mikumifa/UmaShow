/* eslint-disable no-use-before-define, import/prefer-default-export, no-eval */
import fs from 'fs';
import path from 'path';
import { dialog, type IpcMain } from 'electron';
import log from 'electron-log';

type VenusOnnxManifest = {
  format: 'umarl.onnx.v1';
  featureSize: number;
  featureNames: string[];
  actionIds: number[];
  targetStatus?: Record<string, number>;
  metadata?: Record<string, unknown>;
  files: {
    value: string;
    policy: string;
  };
  outputs?: {
    value?: string;
    policy?: string;
  };
};

type LoadedVenusModel = {
  manifestPath: string;
  modelDir: string;
  manifest: VenusOnnxManifest;
  valueSession: any;
  policySession: any;
};

let loadedVenusModel: LoadedVenusModel | null = null;

export function handleVenusModel(ipcMain: IpcMain) {
  ipcMain.handle('venus-model:open', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 Venus ONNX 模型 manifest',
      properties: ['openFile'],
      filters: [{ name: 'UmaRL Venus ONNX Manifest', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return modelInfo();
    }
    return loadModel(result.filePaths[0]);
  });

  ipcMain.handle('venus-model:load-path', async (_, manifestPath: string) => {
    return loadModel(manifestPath);
  });

  ipcMain.handle('venus-model:clear', () => {
    loadedVenusModel = null;
    return modelInfo();
  });

  ipcMain.handle('venus-model:info', () => modelInfo());

  ipcMain.handle('venus-model:predict', async (_, features: number[]) => {
    if (!loadedVenusModel) {
      throw new Error('尚未加载 Venus ONNX 模型');
    }
    const { manifest, valueSession, policySession } = loadedVenusModel;
    if (!Array.isArray(features) || features.length !== manifest.featureSize) {
      throw new Error(
        `模型输入维度 ${manifest.featureSize} 与当前特征 ${features?.length ?? 0} 不一致`,
      );
    }
    const ort = loadOnnxRuntime();
    const tensor = new ort.Tensor('float32', Float32Array.from(features), [
      1,
      manifest.featureSize,
    ]);
    const valueOutputName = manifest.outputs?.value ?? 'value';
    const policyOutputName = manifest.outputs?.policy ?? 'logits';
    const [valueResult, policyResult] = await Promise.all([
      valueSession.run({ features: tensor }),
      policySession.run({ features: tensor }),
    ]);
    return {
      value: Array.from(valueResult[valueOutputName].data as Float32Array),
      logits: Array.from(policyResult[policyOutputName].data as Float32Array),
    };
  });
}

async function loadModel(manifestPath: string) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`模型 manifest 不存在: ${manifestPath}`);
  }
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8'),
  ) as VenusOnnxManifest;
  if (manifest.format !== 'umarl.onnx.v1') {
    throw new Error('模型 manifest 格式不是 umarl.onnx.v1');
  }
  const modelDir = path.dirname(manifestPath);
  const valuePath = path.join(modelDir, manifest.files.value);
  const policyPath = path.join(modelDir, manifest.files.policy);
  if (!fs.existsSync(valuePath)) {
    throw new Error(`value ONNX 不存在: ${valuePath}`);
  }
  if (!fs.existsSync(policyPath)) {
    throw new Error(`policy ONNX 不存在: ${policyPath}`);
  }

  const ort = loadOnnxRuntime();
  const [valueSession, policySession] = await Promise.all([
    ort.InferenceSession.create(valuePath),
    ort.InferenceSession.create(policyPath),
  ]);
  loadedVenusModel = {
    manifestPath,
    modelDir,
    manifest,
    valueSession,
    policySession,
  };
  log.info('[VenusModel] loaded', manifestPath);
  return modelInfo();
}

function loadOnnxRuntime(): any {
  const packageName = ['onnxruntime', 'node'].join('-');
  const runtimeRequire = eval('require') as (moduleName: string) => any;
  return runtimeRequire(packageName);
}

function modelInfo() {
  if (!loadedVenusModel) {
    return { loaded: false };
  }
  const { manifestPath, modelDir, manifest } = loadedVenusModel;
  return {
    loaded: true,
    manifestPath,
    modelDir,
    featureSize: manifest.featureSize,
    featureNames: manifest.featureNames,
    actionIds: manifest.actionIds,
    targetStatus: manifest.targetStatus,
    metadata: manifest.metadata,
  };
}
