# 桌面端打包说明 (Electron + React UI)

本项目可打包为桌面应用，使用 Electron 作为桌面壳，`apps/dsa-web` 的 React UI 作为界面。

## 架构说明

- React UI（Vite 构建）由本地 FastAPI 服务托管
- Electron 启动时自动拉起后端服务，等待 `/api/health` 就绪后加载 UI
- 用户配置文件 `.env`、数据库和日志统一写入系统应用数据目录（持久模式）
- 首次启动会自动检查关键配置；若缺少自选股列表或 AI 模型能力，会强制进入初始化向导，完成最小配置后才可进入主界面

## 本地开发

一键启动（开发模式）：

```bash
powershell -ExecutionPolicy Bypass -File scripts\run-desktop.ps1
```

或手动执行：

1) 构建 React UI（输出到 `static/`）

```bash
cd apps/dsa-web
npm install
npm run build
```

2) 启动 Electron 应用（自动拉起后端）

```bash
cd apps/dsa-desktop
npm install
npm run dev
```

首次运行时会自动从 `.env.example` 复制生成 `.env`。

## 打包 (Windows)

### 前置条件

- Node.js 18+
- Python 3.10+
- 开启 Windows 开发者模式（electron-builder 需要创建符号链接）
  - 设置 -> 隐私和安全性 -> 开发者选项 -> 开发者模式

### 一键打包

```bash
powershell -ExecutionPolicy Bypass -File scripts\build-all.ps1
```

该脚本会依次执行：
1. 构建 React UI
2. 安装 Python 依赖
3. PyInstaller 打包后端
4. electron-builder 打包桌面应用

## GitHub CI 自动打包并发布 Release

仓库已支持通过 GitHub Actions 自动构建桌面端并上传到 GitHub Releases：

- 工作流：`.github/workflows/desktop-release.yml`
- 触发方式：
  - 推送语义化 tag（如 `v3.2.12`）后自动触发
  - 在 Actions 页面手动触发并指定 `release_tag`
- 产物：
  - Windows 安装包：`xiuhu-windows-installer-<tag>.exe`
  - Windows 免安装包：`xiuhu-windows-noinstall-<tag>.zip`
  - macOS Intel：`xiuhu-macos-x64-<tag>.dmg`
  - macOS Apple Silicon：`xiuhu-macos-arm64-<tag>.dmg`

建议发布流程：

1. 合并代码到 `main`
2. 由自动打 tag 工作流生成版本（或手动创建 tag）
3. `desktop-release` 工作流自动构建并把两个平台安装包附加到对应 GitHub Release

### 分步打包

1) 构建 React UI

```bash
cd apps/dsa-web
npm install
npm run build
```

2) 打包 Python 后端

```bash
pip install pyinstaller
pip install -r requirements.txt
python -m PyInstaller --name stock_analysis --onefile --noconsole --add-data "static;static" --hidden-import=multipart --hidden-import=multipart.multipart main.py
```

将生成的 exe 复制到 `dist/backend/`：

```bash
mkdir dist\backend
copy dist\stock_analysis.exe dist\backend\stock_analysis.exe
```

3) 打包 Electron 桌面应用

```bash
cd apps/dsa-desktop
npm install
npm run build
```

打包产物位于 `apps/dsa-desktop/dist/`。

## 目录结构

应用安装目录仅存放程序文件；运行时配置、数据库与日志写入系统应用数据目录。

典型目录示例：

```
Windows:
  %APPDATA%/daily-stock-analysis-desktop/
    .env
    data/stock_analysis.db
    logs/desktop.log

macOS:
  ~/Library/Application Support/daily-stock-analysis-desktop/
    .env
    data/stock_analysis.db
    logs/desktop.log
```

> 兼容性说明：桌面端显示名称已更新为“绣虎”，但为了确保已安装用户升级后仍能保留原有 `.env`、数据库和日志，运行时数据目录继续沿用 `daily-stock-analysis-desktop`。

## 配置文件说明

- `.env` 仍然作为桌面端底层配置存储格式，但默认不再要求用户手动编辑文件
- 首次启动时会自动生成 `.env`，并检查以下关键配置：
  - `STOCK_LIST`：自选股列表（逗号分隔）
  - 至少一种 AI 模型能力：例如 `LLM_CHANNELS`、`LITELLM_CONFIG`、`OPENAI_API_KEY`、`GEMINI_API_KEY`
- 如果缺少关键配置，桌面端会直接进入初始化向导页
- 初始化向导默认要求补齐：
  - `STOCK_LIST`
  - 一套可用主模型配置：`OpenAI`、`Gemini` 或 `Custom / OpenAI-Compatible`
- `Custom / OpenAI-Compatible` 向导项会映射到现有 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 配置字段
- 初始化向导中可直接填写 `provider`、`model`、`API Key`、`baseUrl`，也可以进入高级配置页继续补充渠道、fallback 和其他高级参数
- 初始化向导内置 `测试连接` 按钮，会按当前 `provider / model / API Key / baseUrl` 发起一次最小模型请求，帮助在真正保存前先确认主模型连通性
- 配置保存后会持久保留在系统应用数据目录中；更新安装包、替换 `.app` / `.exe` 或重新安装时，已有配置默认会继续保留
- 从旧版“安装目录旁 `.env`”升级到新版时，桌面端会在首次启动时尝试自动迁移旧 `.env`、`data/` 和 `logs/`

### 桌面端备份 / 恢复 `.env`

- 从 `系统设置 -> 配置备份` 可以直接看到 `导出 .env` 和 `导入 .env` 按钮
- `导出 .env` 会导出当前**已保存**的 `.env` 备份文件；页面上尚未点击“保存配置”的本地草稿不会被导出
- `导入 .env` 会读取备份文件中的键值并合并到当前桌面端配置中，导入后会立即触发配置重载
- 导入是“键级覆盖”而不是整文件替换：备份文件中出现的键会覆盖当前值，未出现的键保持不变
- 如果当前页面还有未保存草稿，导入前会先提示确认，避免把本地草稿和已保存配置混在一起

> 说明：导入 / 导出 `.env` 现在主要用于跨设备迁移、人工备份或回滚；正常的升级 / 重装流程会直接复用系统应用数据目录中的现有配置。

## 常见问题

### 启动后一直显示 "Preparing backend..."

1. 检查 `logs/desktop.log` 查看错误信息
2. 确认已在初始化向导或“系统设置”中补齐自选股列表和至少一种 AI 模型配置
3. 确认端口 8188-8198 未被占用

### 后端启动报 ModuleNotFoundError

PyInstaller 打包时缺少模块，需要在 `scripts/build-backend.ps1` 中增加 `--hidden-import`。

### UI 加载空白

确认 `static/index.html` 存在，如不存在需重新构建 React UI。

### 升级后如何保留配置？

当前桌面端默认把 `.env`、数据库和日志存放在系统应用数据目录，而不是安装目录本身，所以正常更新、替换 `.app` / `.exe` 或重新安装时，配置会自动保留。

如果是从旧版便携模式升级：

1. 首次启动新版时，程序会尝试自动迁移旧 `.env`、`data/`、`logs/`
2. 若旧版本目录已被手工删除，仍可使用“系统设置 -> 配置备份”中的 `导入 .env` 恢复备份
3. 导入完成后等待设置页重新加载即可

## 分发给用户

将 `apps/dsa-desktop/dist/win-unpacked/` 整个文件夹打包发给用户即可。用户只需：

1. 解压文件夹
2. 双击 `绣虎.exe` 启动
3. 首次启动若缺配置，按初始化向导补齐股票列表与主模型配置；如需更复杂的 provider/channel 设置，可进入高级配置页继续完成
