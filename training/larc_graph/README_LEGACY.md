# 凯旋门小型图网络训练（旧版流程）

这个目录只负责离线训练，不会被 Electron 前端或安装包加载。UmaShow 运行时只需要导出的 `.onnx` 文件；没有模型、模型不兼容或推理失败时，会自动继续使用内置推荐逻辑。

这套“C++ 搜索生成分片数据 → 独立监督训练图网络”的旧版流程继续完整保留，与新的 LightZero 训练互不冲突。

## 网络结构

- 全局状态 Token：体力、干劲、五维、实际上限与用户目标、继承距离、远征、适性、SS/SSS、友人阶段等。
- 18 个人物 Token：人物动态状态与对应支援卡静态参数合并编码。
- 5 个训练 Token：即时收益、失败率、人数、彩圈、充电和适性点等。
- 最多 48 个动态行动 Token：一次行动完整表示为“训练/休息/外出/SS + 本回合购买项”。
- 两层稀疏人物—训练消息传递，训练节点对当前在场人物做 4 头注意力；不存在人物间全连接。
- 输出 Policy、每个行动的 32 分位 Q、每个行动的原始分数分布，以及局面的 Value/原始分数分布。

默认配置约 200 万参数。长期规划由 C++ 随机树搜索负责，网络提供行动先验、Q 和叶子估值。

## 环境

```bash
uv sync --extra larc-graph
```

## 1. 生成首版自博弈数据

```bash
uv run python/build_monte_carlo.py
```

```bash
uv run --extra larc-graph python training/larc_graph/generate_selfplay.py \
  --games 2048 --searches 128 --workers 8 --threads 1 \
  --shard-size 2048 \
  --output-dir training/larc_graph/data/selfplay-v0
```

`--workers 8 --threads 1` 表示同时运行 8 局，每局内部使用 1 个线程，避免每个行动反复创建大量短生命周期线程。总并行度约为 `workers × threads`，应不超过服务器可用 CPU 数。同一命令可以再次运行，新的分片会接着已有编号写入。中途按 `Ctrl+C` 时，会保存已经完成的样本。首版 teacher 使用当前完整终局搜索；以后可以增加 `--model-path 模型.onnx`，用已有模型参与下一轮自博弈。

`collect_teacher.py` 仍保留为以后使用真实回合状态校准模拟器的可选工具，但首版训练不依赖它。

## 2. 训练

```bash
uv run --extra larc-graph python training/larc_graph/train.py \
  "training/larc_graph/data/selfplay-v0/*.npz" \
  --output training/larc_graph/checkpoints/larc_graph-v0.pt \
  --batch-size 256 --epochs 30
```

损失包含：搜索访问分布的 Policy 交叉熵、Q/Value Quantile Huber、原始最终分数辅助损失，以及 Q/Value 一致性损失。

继续上一轮权重：

```bash
uv run --extra larc-graph python training/larc_graph/train.py \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --init-checkpoint training/larc_graph/checkpoints/larc_graph-v0.pt \
  --output training/larc_graph/checkpoints/larc_graph-v1.pt \
  --training-round 1 --batch-size 256 --epochs 30
```

## 3. 导出 ONNX

```bash
uv run --extra larc-graph python training/larc_graph/export_onnx.py \
  training/larc_graph/checkpoints/larc_graph-v0.pt \
  training/larc_graph/models/larc_graph-v0.onnx
```

导出器会写入协议版本、剧本和评分缩放元数据。Python 版 ONNX Runtime 仅用于可选的导出检查，默认训练依赖不再安装它，因此 Python 3.10 也不会被其轮子版本阻塞；之后在 UmaShow 的“推荐设置”中选择该文件即可。

## 4. 与内置手写策略做整局评估

训练集验证损失只能说明模型拟合了 teacher，不能说明整局育成效果。使用相同的角色、卡组、继承、目标和环境随机种子，分别让旧版图模型与内置手写蒙特卡洛策略完成整局育成：

```bash
uv run --extra larc-graph python training/larc_graph/evaluate_legacy.py \
  training/larc_graph/models/larc_graph-v0.onnx \
  --games 100 --workers 8 --threads 1 \
  --builtin-searches 128 --model-nodes 128 \
  --output training/larc_graph/evaluations/larc_graph-v0.json
```

评估时会关闭探索、温度采样和根节点噪声。结果同时报告：

- `finalScore`：不截断目标属性的模拟器终局总分。
- `recommendationScore`：按用户目标属性截断后的推荐分，设置目标时应优先看这个指标。
- 成对分差、胜负次数、去除平局后的胜率、均值差 95% 区间与每局耗时。
- 新版推荐组件还会返回双方平均五维、技能点和估算技能分。

默认会随机生成覆盖不同角色、卡组、继承和部分目标上限的开局。固定目标可使用 `--target-speed/--target-stamina/--target-power/--target-guts/--target-wisdom`；只想测不设目标的总分时加 `--no-random-targets`。这是模拟器内“旧模型 vs 内置手写策略”的 A/B，并不等同于真实玩家手养记录；若要比较真人手养，还需要把真人每回合选择或终局记录作为另一份输入数据。

## 数据协议

固定尺寸在 `schema.py`，当前版本为 `2`。C++ 会同时校验输入输出名称、形状、float32 类型和 ONNX 元数据；任何不匹配都会给出原因并回退到内置推荐。
