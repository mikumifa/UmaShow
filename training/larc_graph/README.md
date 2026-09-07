# 凯旋门模型训练

这里使用 LightZero 的 Stochastic MuZero。训练会自动循环执行“自博弈搜索 → 更新网络 → 用新网络继续搜索”，训练依赖只属于 `larc-graph` extra，不会进入 Electron 安装包。

建议在 Linux x86_64 GPU 服务器训练，首版使用默认的 100,000 局。依赖已固定为 CUDA 12.4 的 `torch 2.6.0`、`torchvision 0.21.0`、`torchaudio 2.6.0` 和 NCCL 2.21.5。

如果旧 `.venv` 已经混装，先执行 `mv .venv .venv-broken`。然后创建干净环境：

```bash
uv venv --python 3.10
uv sync --extra larc-graph
env -u LD_LIBRARY_PATH .venv/bin/python python/build_monte_carlo.py --target larc
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/train_lightzero.py \
  --games 100000 --collector-envs 8 --evaluator-envs 4 \
  --simulations 128 --batch-size 256
```

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
