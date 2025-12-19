<p align="center">
  <img src="assets/icon.png" alt="UmaShow Icon" width="160">
</p>

<h1 align="center">UmaShow</h1>
<p align="center">
  <!-- GitHub Downloads -->
  <a href="https://github.com/mikumifa/UmaShow/releases">
    <img src="https://img.shields.io/github/downloads/mikumifa/UmaShow/total" alt="GitHub all releases">
  </a>
  <!-- GitHub Release Version -->
  <a href="https://github.com/mikumifa/UmaShow/releases">
    <img src="https://img.shields.io/github/v/release/mikumifa/UmaShow" alt="GitHub release (with filter)">
  </a>
  <!-- GitHub Issues -->
  <a href="https://github.com/mikumifa/UmaShow/issues">
    <img src="https://img.shields.io/github/issues/mikumifa/UmaShow" alt="GitHub issues">
  </a>
  <!-- GitHub Stars -->
  <a href="https://github.com/mikumifa/UmaShow/stargazers">
    <img src="https://img.shields.io/github/stars/mikumifa/UmaShow" alt="GitHub Repo stars">
  </a>
</p>
<p align="center">
  专为《闪耀 优俊少女》打造的游戏助手，集实时监控、比赛复盘于一体。
</p>

## 目录

- [快速上手](#快速上手)
- [使用场景](#使用场景)
- [Development](#Development)
- [LICENSE](#LICENSE)

## 快速上手

1. 安装https://github.com/mikumifa/umamusume-localify-android-zh  配置端口为4639
2. `release` 目录获取对应安装包。
3. 开始游戏

## 使用场景

- **育成信息展示**：在训练界面随时查看体力与事件提示。
- **复盘**： 分析比赛结果。

## Development

> This section provides guidelines for developers who intend to build UmaShow from source or extend its functionality.

- **Prerequisites**

  - Node.js 14 or later
  - npm 7 or later
  - `protoc` (required only when regenerating protobuf definitions)

- **Install dependencies and start the development environment**
  ```bash
  npm install
  npm start
  ```

* **Build and package the application**

  ```bash
  npm run build
  npm run package
  ```

* **Regenerate protobuf definitions**

  ```bash
  npm run proto:gen
  ```

## LICENSE

本项目使用 [MIT License](LICENSE) 授权。
