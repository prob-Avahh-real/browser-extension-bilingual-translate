# 多意 MulTranslate

Chrome / Edge / Arc 等 Chromium 浏览器扩展：打开网页时**自动**注入目标语言对照。

## 功能

- 语言：English / 简体中文 / 한국어 / 日本語 / Español / Français
- 源语言：自动检测（`html lang` + 正文语种抽样），也可在弹窗中手动指定
- 目标语言：弹窗或页面工具栏切换；源 = 目标时自动跳过
- 正文：译文在上、原文在下（卡片式分块）
- 导航 / 目录 / 侧栏：单行 `译文 · 原文`
- 表单控件：原地换译文标签，悬停看原文
- SPA 站内跳转、前进后退、动态内容自动重跑
- 翻译缓存按 `源>目标` 语言对隔离；切换语言后自动重译本页
- 弹窗：全局开关、源/目标语言、站点黑名单、手动「立即翻译」

支持任意语言对互译，例如 English→한국어、中文→日本語、Français→English 等。

## 安装（Chrome / Edge）

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」
4. 选择本目录：`multranslate`

之后每开受支持语言的页面会自动翻译；未识别语种的页面不会触发。

## 弹窗操作

- **自动翻译**：全局开关（默认开）
- **源语言**：自动检测或手动指定
- **目标语言**：选择译文语言，切换后自动重译当前页
- **立即翻译本页**：手动重跑当前标签
- **禁用当前站点**：加入黑名单

翻译完成后，顶部工具栏也有一个语言下拉框，可直接在页面内切换目标语言。

## Safari（Tampermonkey）

见 [`safari/README.md`](safari/README.md)。安装 Tampermonkey 后导入 `safari/multranslate.user.js`；页面工具栏同样支持切换语言（保存在 `GM_setValue('bi-target-lang')`）。

生成最新 userscript：

```bash
npm run build:userscript
```

## 开发

共享 DOM 逻辑源文件在 [`tools/lib/bilingual/browser/`](../tools/lib/bilingual/browser/)，
语言注册表与翻译管线在 [`tools/lib/bilingual/`](../tools/lib/bilingual/)。

修改共享逻辑后同步到扩展：

```bash
npm run sync-lib
```

Playwright CLI（调试用）：`node ../tools/bilingual-translate.mjs [url] [target] [source]`，
target/source 均可选，默认 target=zh-Hans、source=auto（页面检测）。

## 测试

```bash
npm test
```
