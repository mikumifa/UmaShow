# UmaShow

<p align="center">
  <img src="assets/icon.png" alt="UmaShow Icon" width="160">
</p>

<h1 align="center">UmaShow</h1>

<p align="center">
  专为《闪耀 优俊少女》打造的游戏助手，集实时监控、比赛复盘于一体。
</p>

## 目录

- [快速上手](#快速上手)
- [使用场景](#使用场景)
- [开发](#开发)
- [LICENSE](#LICENSE)

## 快速上手

1. 安装https://github.com/mikumifa/umamusume-localify-android-zh，配置端口为4639
2. `release` 目录获取对应安装包。
3. 开始游戏

## 使用场景

- **育成信息展示**：在训练界面随时查看体力与事件提示。
- **复盘**： 分析比赛结果。

## 开发

> 想要二次开发或自行构建？以下流程可作为快速参考。

- **环境要求**：Node.js 14+、npm 7+；如需重新生成 protobuf 类型，请提前安装 `protoc`。
- **安装依赖并启动开发模式**：
  ```bash
  npm install
  npm start
  ```
- **构建与打包**：
  ```bash
  npm run build
  npm run package
  ```
- **更新 protobuf 类型**：`npm run proto:gen`

## LICENSE

本项目使用 [MIT License](LICENSE) 授权。
