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

当前固定的 LightZero 版本在没有真实 chance label 时存在两处断梯度：
learned chance code 会经过 `argmax().long()` 后重新 one-hot，任务损失无法回传；
commitment loss 的 straight-through target 未 detach，两个 MSE 梯度会精确抵消。

训练入口会显式使用仓库内的 `LArcStochasticMuZeroModelMLP`：前向仍是相同的
hard one-hot chance code，但 dynamics 使用保留梯度的 STE one-hot，commitment
target 使用 detached one-hot。补丁不修改模型参数名称或形状，因此导出器仍可用
LightZero 原模型严格加载 checkpoint。

补丁启用前的 checkpoint 中 chance encoder 通常已经退化，不建议用于正式续训。
修复后的实验应使用新的 `--experiment-dir` 从头开始；已经运行的 Python 进程也必须
重启后才会加载修复。

验证补丁：

```bash
.venv/bin/python -m unittest training.larc_graph.test_lightzero_model
```

原来的分片自博弈与小型图网络流程仍保留在 [README_LEGACY.md](README_LEGACY.md)。
