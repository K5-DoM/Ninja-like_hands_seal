---
title: Ninja-like Seal Web Demo
emoji: 🦊
colorFrom: orange
colorTo: yellow
sdk: static
pinned: false
app_file: index.html
---

# Ninja-like Seal Web Demo

この Space は静的フロントエンド配信用です。

## 構成
- `index.html`
- `assets/`（JS・画像・音声・演出素材）
- `models/`（`hand_landmarker.task`, `idx_to_class.json`, `model.onnx`）

## メモ
- `sdk: static` のため、サーバー実行はありません。
- モデル読み込みパスは `models/...` を前提にしてください。
- Vite ビルド成果物（`web/dist`）をそのまま同期する運用を推奨します。
