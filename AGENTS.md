# multranslate（多意）

Chrome / Edge MV3 扩展：打开网页时自动注入全页目标语言对照（正文分块 / 导航单行 / 控件翻译）。
语言：English / 简体中文 / 한국어 / 日本語 / Español / Français，源语言自动检测或手动指定。

## 用途与 Target 判定

浏览器扩展：英文网页自动多语对照

- 移动端：不适用
- 智能硬件：不适用

## 目标平台

本目录**不是**需双 Target 交付的消费级 App。Safari 通过 Tampermonkey userscript（`safari/`）提供。

## 技术栈

- Manifest V3 content script + service worker
- 共享逻辑：`tools/lib/bilingual/`（`browser/` 为页面脚本，顶层为 ES module）
- 语言注册表：`tools/lib/bilingual/languages.js`（edge/mm 语言码、script 校验、源/目标归一化）
- 源语言检测：`browser/page-detect.js` `detectPageLang()`（html lang + 语种抽样，跳过自身 overlay）
- 翻译：Microsoft Edge Translate API（background，`from`/`to` 按语言对），MyMemory 兜底（userscript）
- 翻译缓存按 `source>target\ntext` 键隔离，兼容旧 en→zh 裸键缓存
- 内置 UI 词表（glossary）仅对 en 源生效；其他源语言走 API

## 命令

```bash
# Chrome → 扩展程序 → 加载已解压的扩展程序 → 选本目录
npm run sync-lib      # 同步 tools/lib/bilingual → lib/
npm run build:userscript
npm test
```

## 助手约束

- Loop：先定可验证 Done；每切片过验证环；详见 docs/LOOP_ENGINEERING.md
- Harness：Guide=本文件；Sensor=npm test；同类失误二次须沉淀规则或测试
- 共享逻辑改 `tools/lib/bilingual/` 后须 `npm run sync-lib`；改 `browser/` 后还要 `npm run build:userscript`
- 新增目标语言须同步改 `languages.js`、`glossary.js` 词表、`build-userscript.mjs` 内嵌 LANGUAGES

## 验证环 / Done

```bash
npm test
```

**Done 示例**：smoke 测试通过 + manifest 与 lib 文件齐全 + README 安装步骤可复现。
