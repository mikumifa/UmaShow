# 凯旋门小型图网络训练

这个目录只负责离线训练，不会被 Electron 前端或安装包加载。UmaShow 运行时只需要导出的 `.onnx` 文件；没有模型、模型不兼容或推理失败时，会自动继续使用内置推荐逻辑。

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
uv run --extra larc-graph python training/larc_graph/generate_selfplay.py --games 2048 --searches 128 --workers 8 --threads 1 --shard-size 2048 --output-dir training/larc_graph/data/selfplay-v0
```

`--workers 8 --threads 1` 表示同时运行 8 局，每局内部使用 1 个线程，避免每个行动反复创建大量短生命周期线程。总并行度约为 `workers × threads`，应不超过服务器可用 CPU 数。同一命令可以再次运行，新的分片会接着已有编号写入。中途按 `Ctrl+C` 时，会保存已经完成的样本。首版 teacher 使用当前完整终局搜索；以后可以增加 `--model-path 模型.onnx`，用已有模型参与下一轮自博弈。

`collect_teacher.py` 仍保留为以后使用真实回合状态校准模拟器的可选工具，但首版训练不依赖它。

## 2. 训练

```powershell
uv run --extra larc-graph python training/larc_graph/train.py "training/larc_graph/data/selfplay-v0/*.npz" --output training/larc_graph/checkpoints/larc_graph-v0.pt --batch-size 256 --epochs 30
```

损失包含：搜索访问分布的 Policy 交叉熵、Q/Value Quantile Huber、原始最终分数辅助损失，以及 Q/Value 一致性损失。

## 3. 导出 ONNX

```powershell
uv run --extra larc-graph python training/larc_graph/export_onnx.py training/larc_graph/checkpoints/larc_graph-v0.pt training/larc_graph/models/larc_graph-v0.onnx
```

导出器会写入协议版本、剧本和评分缩放元数据。Python 版 ONNX Runtime 仅用于可选的导出检查，默认训练依赖不再安装它，因此 Python 3.10 也不会被其轮子版本阻塞；之后在 UmaShow 的“推荐设置”中选择该文件即可。

## 数据协议

固定尺寸在 `schema.py`，当前版本为 `2`。C++ 会同时校验输入输出名称、形状、float32 类型和 ONNX 元数据；任何不匹配都会给出原因并回退到内置推荐。
