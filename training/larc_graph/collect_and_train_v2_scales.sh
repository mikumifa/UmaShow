#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

data_dir="training/larc_graph/data/selfplay-v2"
checkpoint_dir="training/larc_graph/checkpoints"
model_dir="training/larc_graph/models"
games="${GAMES:-32768}"
searches="${SEARCHES:-128}"
collection_workers="${COLLECTION_WORKERS:-8}"
training_workers="${TRAINING_WORKERS:-2}"
batch_size="${BATCH_SIZE:-1024}"
epochs="${EPOCHS:-10}"
seed="${SEED:-20260908}"

mkdir -p "$data_dir" "$checkpoint_dir" "$model_dir"

collection_marker="$data_dir/.handwritten-${games}-games-${searches}-searches.complete"
if [[ -f "$collection_marker" ]]; then
  echo "collection already complete: $collection_marker"
else
  uv run --extra larc-graph python training/larc_graph/generate_selfplay.py \
    --games "$games" --searches "$searches" \
    --workers "$collection_workers" --threads 1 \
    --shard-size 2048 \
    --output-dir "$data_dir"
  touch "$collection_marker"
fi

train_scale() {
  local name="$1"
  local hidden_dim="$2"
  local message_layers="$3"
  local attention_heads="$4"
  local checkpoint="$checkpoint_dir/larc_graph-v2-${name}.pt"
  local model="$model_dir/larc_graph-v2-${name}.onnx"
  local marker="$checkpoint_dir/.larc_graph-v2-${name}.complete"

  if [[ -f "$marker" ]]; then
    echo "training already complete: $name"
    return
  fi

  echo "training $name: hidden=$hidden_dim layers=$message_layers heads=$attention_heads"
  uv run --extra larc-graph python training/larc_graph/train.py \
    "$data_dir/*.npz" \
    --output "$checkpoint" \
    --hidden-dim "$hidden_dim" \
    --message-layers "$message_layers" \
    --attention-heads "$attention_heads" \
    --batch-size "$batch_size" \
    --epochs "$epochs" \
    --workers "$training_workers" \
    --seed "$seed" \
    --training-round 2 \
    --streaming

  uv run --extra larc-graph python training/larc_graph/export_onnx.py \
    "$checkpoint" "$model"
  touch "$marker"
}

# About 1.0M, 1.8M and 5.5M parameters. Train serially to avoid duplicating
# the decompressed dataset and competing for GPU memory.
train_scale small 96 2 4
train_scale base 128 2 4
train_scale medium 192 3 6

echo "all v2 scale trainings completed"
