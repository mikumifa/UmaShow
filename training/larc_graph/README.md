```bash
python training/larc_graph/pretrain_lightzero_from_legacy.py \
  "training/larc_graph/data/selfplay-v0/*.npz" \
  "training/larc_graph/data/selfplay-v1/*.npz" \
  --output training/larc_graph/checkpoints/lightzero-legacy-v1-init.pth.tar \
  --epochs 10 --batch-size 512 --device cuda
```

完成后启动正式 LightZero 训练：

```bash
python training/larc_graph/train_lightzero.py \
  --games 10000 \
  --collector-envs 8 --evaluator-envs 8 \
  --simulations 64 --batch-size 256 \
  --updates-per-collect 16 --reanalyze-ratio 0 \
  --chance-space-size 32 --latent-state-dim 256 \
  --learning-rate 3e-4 \
  --eval-freq 250 --checkpoint-every 1000 \
  --init-weights training/larc_graph/checkpoints/lightzero-legacy-v1-init.pth.tar \
  --experiment-dir training/larc_graph/runs/stochastic-muzero-legacy-v1-chancefix
```
