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
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/evaluate_lightzero.py \
  training/larc_graph/runs/stochastic-muzero-chance-v1/ckpt/ckpt_best.pth.tar \
  --games 20 --lightzero-envs 4 --simulations 64 \
  --builtin-workers 4 --builtin-threads 1 --builtin-searches 128 \
  --output training/larc_graph/evaluations/lightzero-smoke.json
```

内置 baseline 不是单步贪心的纯手写策略，而是先对每个合法根行动做
`--builtin-searches` 次完整 Monte Carlo 模拟，模拟中的后续行动再使用手写
rollout 策略。因此 `128` 表示“每个合法根行动 128 次”，不能与 LightZero 的
`64` 次 latent MCTS simulation 直接视为相同算力。结果以
`recommendationScore` 为主指标，同时报告 `finalScore`、成对分差、胜率和置信区间。
当 `--builtin-searches` 不能被 `--builtin-threads` 整除时，原生搜索会向上取整到线程数
的整数倍；JSON 会同时记录 requested 和 actual 搜索数。

建议先跑 20 局确认 checkpoint、环境和统计输出均正常；100 局只用于观察效果方向；
需要据此判断模型优劣时应跑 300～500 局，并结合成对均值差的置信区间，而不是只看
胜负次数。正式评估宜使用未参与训练和在线 evaluator 的 held-out `--seed`。

每一对使用相同 seed，因而角色、卡组、继承、目标上限和环境随机流的初始状态相同，
脚本也会逐项校验开局。不过两种策略选出不同行动后，模拟器可能沿不同分支消耗随机数，
所以这属于 common-random-seed 的成对比较，并不保证分叉后的每个随机事件逐项相同。
此外，当前 LightZero CTree 的 chance node 使用未暴露 seed 的随机采样；即使关闭根噪声，
重复运行也可能得到不同的搜索轨迹。脚本会在控制台和 JSON 明确记录这一点。

旧 manifest 没有 `chanceSearch` 字段时，说明该 checkpoint 训练和运行时的 MCTS
实际只展开历史默认的 2 个 chance outcome；即使模型配置写着更大的
`chance_space_size`，也不代表搜索使用了全部 chance。评估脚本会警告并默认还原这项
历史行为。`--chance-search-space` 可用于诊断性覆盖，但覆盖后的结果不再是旧策略的
原样复现。应用 learned-chance 梯度和 configured-root 修复后的正式训练，应使用新的
`--experiment-dir` 从头训练，不要在旧 checkpoint 上续训并混合两种行为。

## 从旧版图模型热启动

`README_LEGACY.md` 生成的 `larc_graph-v*.pt` 不能直接传给 LightZero：
两套网络的输入、动作头和 checkpoint 格式都不同。可以复用旧版自博弈
NPZ 中的搜索 policy 和终局 value，先离线训练 LightZero 的根节点
representation/prediction 网络：

```bash
env -u LD_LIBRARY_PATH .venv/bin/python \
  training/larc_graph/pretrain_lightzero_from_legacy.py \
  "training/larc_graph/data/selfplay-v0/*.npz" \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --output training/larc_graph/checkpoints/lightzero-legacy-init.pth.tar \
  --epochs 10 --batch-size 512
```

如果还没有 `selfplay-v1`，删除对应输入参数即可。预训练会把旧版最多 48 个
动态行动槽转换成 LightZero 的固定 40 个行动 ID，并将旧版绝对终局分转换成
与增量奖励一致的剩余回报。随后开启一个新的在线训练实验：

```bash
env -u LD_LIBRARY_PATH .venv/bin/python training/larc_graph/train_lightzero.py \
  --games 2000 --collector-envs 8 --evaluator-envs 8 \
  --simulations 64 --batch-size 256 \
  --updates-per-collect 16 --reanalyze-ratio 0 \
  --init-weights training/larc_graph/checkpoints/lightzero-legacy-init.pth.tar \
  --checkpoint-every 2000 \
  --experiment-dir training/larc_graph/runs/stochastic-muzero-legacy-warm-v1
```

`--init-weights`（别名 `--warm-start`）只提供根节点网络的离线初始化；
dynamics、chance encoder、optimizer 和 replay buffer 都由新的在线实验重新开始。
完整 LightZero checkpoint 的继续训练仍使用 `--resume`，两者不能同时指定。

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
.venv/bin/python -m unittest \
  training.larc_graph.test_lightzero_model \
  training.larc_graph.test_lightzero_checkpoint \
  training.larc_graph.test_lightzero_pretrain \
  training.larc_graph.test_lightzero_evaluate
```

原来的分片自博弈与小型图网络流程仍保留在 [README_LEGACY.md](README_LEGACY.md)。
