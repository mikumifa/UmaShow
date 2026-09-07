# 凯旋门模型训练


```bash
uv venv --python 3.10
uv sync --extra larc-graph
python python/build_monte_carlo.py --target larc
python training/larc_graph/train_lightzero.py \
  --games 100000 --collector-envs 8 --evaluator-envs 4 \
  --simulations 128 --batch-size 256
```

该环境每回合的合法动作集合都会变化；训练入口会按 LightZero 的
`varied_action_space` 模式把 MCTS 的合法动作访问分布还原成固定 40 维训练目标。
日志、配置和 checkpoint 都写入 `training/larc_graph/runs/stochastic-muzero/`。

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
