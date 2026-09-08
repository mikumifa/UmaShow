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

### 一键收集 v2 手写数据并训练不同规模

下面的脚本先追加收集 32768 局手写策略数据（每项模拟 128 次），成功后使用完全相同的训练参数，依次训练 small、base 和 medium 三档模型，并自动导出 ONNX：

```bash
bash training/larc_graph/collect_and_train_v2_scales.sh
```

三档网络约为 100 万、180 万和 550 万参数。训练使用流式分片读取，避免一次性把全部 v2 数据解压进内存。数据收集或某档训练被中断时，不会继续执行后续阶段；成功阶段会写入完成标记，重新运行脚本时自动跳过。

## 2. 训练

```bash
uv run --extra larc-graph python training/larc_graph/train.py \
  "training/larc_graph/data/selfplay-v0/*.npz" \
  --output training/larc_graph/checkpoints/larc_graph-v0.pt \
  --batch-size 256 --epochs 30
```

```bash
uv run --extra larc-graph python training/larc_graph/train.py \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --output training/larc_graph/checkpoints/larc_graph-v1.pt \
  --batch-size 1024 --epochs 30
```

继续上一轮权重：

```bash
uv run --extra larc-graph python training/larc_graph/train.py \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --init-checkpoint training/larc_graph/checkpoints/larc_graph-v0.pt \
  --output training/larc_graph/checkpoints/larc_graph-v1.pt \
  --training-round 1 --batch-size 1024 --epochs 30
```

使用多个数据源吧

```bash
uv run --extra larc-graph python training/larc_graph/train.py \
  "training/larc_graph/data/selfplay-v0/*.npz" \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --init-checkpoint training/larc_graph/checkpoints/larc_graph-v1.pt \
  --output training/larc_graph/checkpoints/larc_graph-v2.1.pt \
  --training-round 2 \
  --learning-rate 1e-4 \
  --batch-size 256 \
  --epochs 15 \
  --workers 4 \
  --device cuda
```

## 导出 ONNX

```bash
uv run --extra larc-graph python training/larc_graph/export_onnx.py \
  training/larc_graph/checkpoints/larc_graph-v0.pt \
  training/larc_graph/models/larc_graph-v0.onnx
```

```bash
uv run --extra larc-graph python training/larc_graph/export_onnx.py \
  training/larc_graph/checkpoints/larc_graph-v1.pt \
  training/larc_graph/models/larc_graph-v1.onnx
```

## 比较模型

```bash
uv run --extra larc-graph python training/larc_graph/compare_legacy_models.py \
  training/larc_graph/checkpoints/larc_graph-v0.pt \
  training/larc_graph/checkpoints/larc_graph-v1.pt \
  --games 100 --workers 4 \
  --nodes 64 --depth 8 --top-k 8 --chance-outcomes 8 \
  --root-selection gumbel \
  --gumbel-max-actions 16 --gumbel-scale 0 \
  --output training/larc_graph/evaluations/larc_graph-v0-vs-v1.json

```
