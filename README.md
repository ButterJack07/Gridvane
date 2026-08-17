# Gridvane - 卡牌效应

Gridvane 是一款运行在浏览器中的回合制卡牌走棋游戏。玩家在随机生成的 6 x 6 地图中抽取行动卡，选择使用卡牌功能或按方向移动，通过探索房间、争夺空投、积累积分及与 AI 战斗推进对局。

在线地址：<https://butterjack07.github.io/Gridvane/>

## 当前内容

- 单人挑战与人机对抗
- 22-26 个房间组成的随机连通研究所地图
- 地图迷雾、房间事件、通道与空投机制
- 运动员、战士、学者、赏金猎人四个角色
- 普通行动卡、稀有成长卡、干扰卡与冲刺协议
- 基础 AI 决策与随机兜底逻辑
- 桌面端、手机横屏及 CSS 直接旋转布局
- GitHub Pages 静态部署，无需后端服务器

## 技术栈

- React
- TypeScript
- Vite
- CSS
- GitHub Pages

## 本地运行

环境要求：Node.js 20 或更高版本，推荐 Node.js 22。

```bash
npm install
npm run dev
```

开发服务器默认地址：

```text
http://localhost:5176/
```

## 构建检查

推送前至少运行一次生产构建：

```bash
npm run build
```

构建输出位于 `dist/`，该目录不会提交到 `main` 分支。

可在本地预览生产版本：

```bash
npm run preview
```

## 版本号

标题页版本号定义在 `src/App.css`：

```css
.lobby h1 em::after { content: "v1.0.0"; }
```

每次发布前先更新版本号：

- 修复和小调整：`v1.0.0 -> v1.0.1`
- 新增兼容功能：`v1.0.0 -> v1.1.0`
- 不兼容的大版本：`v1.0.0 -> v2.0.0`

## 推送到 GitHub

仓库地址：<https://github.com/ButterJack07/Gridvane>

### 日常推送

先检查当前修改：

```bash
git status
git diff
```

更新版本号并确认构建通过后，提交和推送：

```bash
npm run build
git add .
git commit -m "Describe the update"
git push origin main
```

如果出现以下错误：

```text
Failed to connect to github.com port 443
```

说明当前网络无法连接 GitHub。提交仍保存在本地，网络恢复后重新执行：

```bash
git push origin main
```

不要重复创建相同提交，也不要使用强制推送。

### 首次配置远程仓库

仅在新下载且尚未配置远程仓库时执行：

```bash
git remote add origin https://github.com/ButterJack07/Gridvane.git
git branch -M main
git push -u origin main
```

检查远程仓库：

```bash
git remote -v
```

## 发布 GitHub Pages

本项目的 Vite 基础路径已经在 `vite.config.ts` 中设置为：

```ts
base: '/Gridvane/'
```

因此生产资源会从 `/Gridvane/assets/` 加载。不要将其改为 `/`，否则 GitHub Pages 可能白屏。

### 手动发布

源码推送成功后执行：

```bash
npm run build
npx --yes gh-pages -d dist -b gh-pages
```

该命令会把 `dist/` 的生产文件发布到 `gh-pages` 分支。

GitHub 仓库的 Pages 设置应为：

1. 打开 `Settings -> Pages`
2. `Source` 选择 `Deploy from a branch`
3. 分支选择 `gh-pages`
4. 目录选择 `/ (root)`
5. 保存并等待部署完成

不要选择 `main / root`。`main` 中的 `index.html` 是 Vite 开发入口，会引用 `/src/main.tsx`，GitHub Pages 无法直接编译 TypeScript，使用它会导致白屏。

### 完整发布流程

```bash
# 1. 更新 src/App.css 中的版本号
# 2. 验证构建
npm run build

# 3. 提交源码
git add .
git commit -m "Release Gridvane v1.0.1"

# 4. 推送源码
git push origin main

# 5. 发布静态生产文件
npx --yes gh-pages -d dist -b gh-pages

# 6. 检查状态
git status
```

发布后访问：

```text
https://butterjack07.github.io/Gridvane/
```

浏览器仍显示旧版本时，可以等待 GitHub Pages 缓存更新，并使用强制刷新：

- Windows：`Ctrl + F5`
- macOS：`Command + Shift + R`
- 手机：关闭页面后重新打开，必要时清理该站点缓存

## 常见问题

### GitHub Pages 白屏

检查线上 HTML 是否引用类似以下生产资源：

```html
<script type="module" src="/Gridvane/assets/index-xxxx.js"></script>
```

如果仍引用 `/src/main.tsx`，说明 Pages 发布了 `main` 分支源码，而不是 `gh-pages` 分支的生产构建。

### 手机无法自动横屏

移动浏览器不能保证修改系统方向。游戏提供三种方案：

1. 关闭手机方向锁定并旋转设备
2. 点击“尝试全屏横屏”
3. 点击“直接旋转界面”使用 CSS 旋转布局

### 本地端口被占用

开发服务器使用固定端口 `5176`。先关闭占用该端口的旧 Vite 进程，再运行：

```bash
npm run dev
```

## 项目结构

```text
Gridvane/
|- .github/workflows/deploy.yml
|- public/
|- src/
|  |- App.tsx
|  |- App.css
|  |- index.css
|  `- main.tsx
|- index.html
|- package.json
|- vite.config.ts
`- README.md
```
