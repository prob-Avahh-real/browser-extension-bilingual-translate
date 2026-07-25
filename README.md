# 全页中英对照 Bilingual Translate

Chrome / Edge / Arc 等 Chromium 浏览器扩展：打开英文网页时**自动**注入中英对照。

## 功能

- 正文：中文在上、英文在下（卡片式分块）
- 导航 / 目录 / 侧栏：单行 `中文 · English`
- 表单控件：原地换中文标签，悬停看英文
- 自动检测英文页（`html lang` + 正文抽样）
- SPA 站内跳转、前进后退、动态内容自动重跑
- 弹窗：全局开关、站点黑名单、手动「立即翻译」

## 安装（Chrome / Edge）

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」
4. 选择本目录：`browser-extension-bilingual-translate`

之后每开英文页会自动翻译；中文页（如 `zh.wikipedia.org`）不会触发。

## 弹窗操作

- **自动翻译英文页**：全局开关（默认开）
- **立即翻译本页**：手动重跑当前标签
- **禁用当前站点**：加入黑名单

## Safari（Tampermonkey）

见 [`safari/README.md`](safari/README.md)。安装 Tampermonkey 后导入 `safari/bilingual-translate.user.js`。

生成最新 userscript：

```bash
npm run build:userscript
```

## 开发

共享 DOM 逻辑源文件在 [`tools/lib/bilingual/browser/`](../tools/lib/bilingual/browser/)。

修改 browser 模块后同步到扩展：

```bash
npm run sync-lib
```

Playwright CLI（调试用）：

```bash
node ../tools/bilingual-translate.mjs "https://en.wikipedia.org/wiki/Artificial_intelligence"
```

## 测试

```bash
npm test
```
