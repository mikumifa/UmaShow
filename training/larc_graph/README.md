# 凯旋门模型训练

```bash
uv venv --python 3.10
uv sync --extra larc-graph
python python/build_monte_carlo.py --target larc
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/train_lightzero.py \
  --games 2000 --collector-envs 8 --evaluator-envs 8 \
  --simulations 64 --batch-size 256 \
  --updates-per-collect 16 --reanalyze-ratio 0 \
  --checkpoint-every 2000 \
  --experiment-dir training/larc_graph/runs/stochastic-muzero-chance-v1
```

该环境每回合的合法动作集合都会变化；训练入口会按 LightZero 的
`varied_action_space` 模式把 MCTS 的合法动作访问分布还原成固定 40 维训练目标。
上面的 2,000 局配置用于确认修复后的训练和评估曲线正常；验证通过后再把
`--games` 提高到 10,000～20,000。日志、配置和 checkpoint 写入传给
`--experiment-dir` 的目录。

## 与内置策略做整局评估

使用独立评估脚本把 LightZero checkpoint 与模拟器内置策略放在成对开局上比较：

```bash
python training/larc_graph/evaluate_lightzero.py \
  training/larc_graph/runs/stochastic-muzero-chance-v1/ckpt/ckpt_best.pth.tar \
  --games 20 --lightzero-envs 4 --simulations 64 \
  --builtin-workers 4 --builtin-threads 1 --builtin-searches 128 \
  --output training/larc_graph/evaluations/lightzero-smoke.json
```

## 从旧版图模型热启动

```bash
python \
  training/larc_graph/pretrain_lightzero_from_legacy.py \
  "training/larc_graph/data/selfplay-v0/*.npz" \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --output training/larc_graph/checkpoints/lightzero-legacy-init.pth.tar \
  --epochs 10 --batch-size 512
```

```bash
python training/larc_graph/train_lightzero.py \
  --games 2000 --collector-envs 8 --evaluator-envs 8 \
  --simulations 64 --batch-size 256 \
  --updates-per-collect 16 --reanalyze-ratio 0 \
  --init-weights training/larc_graph/checkpoints/lightzero-legacy-init.pth.tar \
  --checkpoint-every 2000 \
  --experiment-dir training/larc_graph/runs/stochastic-muzero-legacy-warm-v1
```

```bash
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/train_lightzero.py \
  --games 2000 --collector-envs 8 --evaluator-envs 8 \
  --simulations 64 --batch-size 256 \
  --updates-per-collect 16 --reanalyze-ratio 0 \
  --resume training/larc_graph/runs/stochastic-muzero-chance-v1/ckpt/iteration_最新编号.pth.tar \
  --experiment-dir training/larc_graph/runs/stochastic-muzero-chance-v1-resumed
```

导出给 UmaShow 使用的 ONNX：

```bash
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/export_lightzero_onnx.py \
  training/larc_graph/runs/stochastic-muzero/ckpt/ckpt_final.pth.tar \
  training/larc_graph/models/larc-stochastic-v1.onnx
```

最后在 UmaShow 的推荐设置里选择导出的 `.onnx` 文件即可。

## Learned chance 梯度修复

```bash
.venv/bin/python -m unittest \
  training.larc_graph.test_lightzero_model \
  training.larc_graph.test_lightzero_checkpoint \
  training.larc_graph.test_lightzero_pretrain \
  training.larc_graph.test_lightzero_evaluate
```

原来的分片自博弈与小型图网络流程仍保留在 [README_LEGACY.md](README_LEGACY.md)。
