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

建议单独创建虚拟环境：

```powershell
cd training/larc_graph
python -m venv .venv
.venv/Scripts/Activate.ps1
python -m pip install -r requirements.txt
```

这些依赖不需要安装到 UmaShow 的 Node/Electron 环境。

## 1. 收集 teacher 数据

先运行仓库根目录的 `python python/build_monte_carlo.py`。准备 JSONL，每行是一个 `MonteCarloCapturedState`（含 `state` 字段）或直接的凯旋门推荐状态，然后运行：

```powershell
python collect_teacher.py states.jsonl data/teacher-0001.npz --searches 4096 --threads 8
```

特征由 C++ 模拟器按协议直接导出，Python 不重复实现游戏字段转换。初始 teacher 是当前完整终局搜索；后续可通过 `--model-path model.onnx` 收集新模型搜索结果，逐轮摆脱旧手写策略上限。

## 2. 训练

```powershell
python train.py "data/*.npz" --output checkpoints/larc_graph.pt --batch-size 256 --epochs 30
```

损失包含：搜索访问分布的 Policy 交叉熵、Q/Value Quantile Huber、原始最终分数辅助损失，以及 Q/Value 一致性损失。

## 3. 导出 ONNX

```powershell
python export_onnx.py checkpoints/larc_graph.pt models/larc_graph.onnx
```

导出器会写入协议版本、剧本和评分缩放元数据，并使用 ONNX Runtime 做一次 CPU 烟雾测试。之后在 UmaShow 的“推荐设置”中选择该文件即可。

## 数据协议

固定尺寸在 `schema.py`，当前版本为 `2`。C++ 会同时校验输入输出名称、形状、float32 类型和 ONNX 元数据；任何不匹配都会给出原因并回退到内置推荐。
