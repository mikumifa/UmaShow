# 凯旋门模型训练

这里使用 LightZero 的 Stochastic MuZero。训练会自动循环执行“自博弈搜索 → 更新网络 → 用新网络继续搜索”，训练依赖只属于 `larc-graph` extra，不会进入 Electron 安装包。

建议在 Linux x86_64 GPU 服务器训练，首版使用默认的 100,000 局。依赖已固定为 CUDA 12.4 的 `torch 2.6.0`、cuDNN 9.1.0、NCCL 2.21.5，以及配套的 `torchvision 0.21.0`、`torchaudio 2.6.0`。

如果旧 `.venv` 已经混装或出现 `libcudnn.so.9` 缺失，普通 `uv sync` 可能只显示 `Audited`，不会修复损坏的包文件。应把旧环境移走，再创建干净环境：

```bash
deactivate 2>/dev/null || true
mv .venv ".venv-broken-$(date +%Y%m%d-%H%M%S)"
uv venv --python 3.10
uv sync --extra larc-graph
env -u LD_LIBRARY_PATH .venv/bin/python -c \
  "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())"
env -u LD_LIBRARY_PATH .venv/bin/python python/build_monte_carlo.py --target larc
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/train_lightzero.py \
  --games 100000 --collector-envs 8 --evaluator-envs 4 \
  --simulations 128 --batch-size 256
```

训练时直接调用 `.venv/bin/python`，不要改回 `uv run`。DI-engine 即使关闭日志上传也会导入旧版 WandB；训练入口已经自动设置仅用于该导入的 protobuf 兼容模式。不要把项目 protobuf 降到 3.20，否则 UmaShow 当前生成的数据库协议代码将无法加载。WandB 已关闭，这个兼容处理不参与模型计算或 C++ 环境通信。

训练结果位于 `training/larc_graph/runs/stochastic-muzero/ckpt/`。中断后可从 checkpoint 继续；模型、目标网络和优化器会恢复，内存回放池会重新积累：

```bash
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/train_lightzero.py \
  --games 100000 \
  --resume training/larc_graph/runs/stochastic-muzero/ckpt/iteration_最新编号.pth.tar
```

导出给 UmaShow 使用的 ONNX：

```bash
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/export_lightzero_onnx.py \
  training/larc_graph/runs/stochastic-muzero/ckpt/ckpt_final.pth.tar \
  training/larc_graph/models/larc-stochastic-v1.onnx
```

最后在 UmaShow 的推荐设置里选择导出的 `.onnx` 文件即可。

原来的分片自博弈与小型图网络流程仍保留在 [README_LEGACY.md](README_LEGACY.md)。
