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

训练直接使用仓库根目录的 `uv` 环境，依赖位于可选的 `larc-graph` extra 中。所有命令都从仓库根目录执行；首次使用时 `uv` 会按需安装训练依赖：

```powershell
uv sync --extra larc-graph
```

也可以不预先同步，直接在各条训练命令中使用 `uv run --extra larc-graph`。Torch、ONNX 等训练依赖不会进入 Electron 安装包；普通的 `uv run`、`npm run package` 和 `.github/workflows/publish.yml` 都没有启用这个 extra，因此不会下载或安装 Torch。`uv.lock` 中保留可选依赖的版本与文件元数据，不代表发布环境会安装它们。

## 1. 生成首版自博弈数据

先构建仓库中的推荐组件：

```powershell
uv run python/build_monte_carlo.py
```

该命令在 Windows 上生成 `assets/native/UmaShowMonteCarloLArc.exe`，在 Linux x86_64/aarch64 上则默认只构建本训练需要的 `assets/native/UmaShowMonteCarloLArc`，并把对应的 `libonnxruntime.so` 放在同一目录。Linux 需要预先安装 CMake 和支持 C++20 的 GCC/Clang；不需要安装 Torch，也不需要 Wine：

```bash
uv run python/build_monte_carlo.py
```

因此自博弈数据生成、GPU 训练和 ONNX 导出可以全部在同一台 Linux 机器完成。后续命令与 Windows 相同；训练脚本的 `--device auto` 会优先使用 CUDA，也可以显式传入 `--device cuda --workers 4`。

不需要准备 JSONL，也不会读取本地育成历史。模拟器会从合法凯旋门开局开始，随机选择育成角色、支援卡、继承与用户属性目标；训练分布、SS、充电、事件结果等都沿模拟器规则逐回合随机产生。每个决策回合先搜索各个合法行动，再用带温度和少量随机探索的策略继续整局。

首版建议生成约 2048 局。每局通常产生 55～65 个决策状态，最终约为 11 万～13 万条样本，适合作为当前约 200 万参数网络的第一版训练集。`128` 次搜索用于兼顾 teacher 标签质量和总生成时间：

```powershell
uv run --extra larc-graph python training/larc_graph/generate_selfplay.py --games 2048 --searches 128 --threads 8 --shard-size 2048 --output-dir training/larc_graph/data/selfplay-v0
```

同一命令可以再次运行，新的分片会接着已有编号写入。中途按 `Ctrl+C` 时，会保存已经完成的样本。首版 teacher 使用当前完整终局搜索；以后可以增加 `--model-path 模型.onnx`，用已有模型参与下一轮自博弈。

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
