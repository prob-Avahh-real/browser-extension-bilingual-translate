# browser-extension-bilingual-translate

Chrome / Edge MV3 扩展：打开英文网页时自动注入全页中英对照（正文分块 / 导航单行 / 控件中文）。

## 用途与 Target 判定

浏览器扩展：英文网页自动中英对照

- 移动端：不适用
- 智能硬件：不适用

## 目标平台

本目录**不是**需双 Target 交付的消费级 App。Safari 通过 Tampermonkey userscript（`safari/`）提供。

## 技术栈

- Manifest V3 content script + service worker
- 共享逻辑：`tools/lib/bilingual/`
- 翻译：Microsoft Edge Translate API（background）

## 命令

```bash
# Chrome → 扩展程序 → 加载已解压的扩展程序 → 选本目录
npm run sync-lib      # 从 tools/lib/bilingual/browser 同步 lib/
npm run build:userscript
npm test
```

## 助手约束

- Loop：先定可验证 Done；每切片过验证环；详见 docs/LOOP_ENGINEERING.md
- Harness：Guide=本文件；Sensor=npm test；同类失误二次须沉淀规则或测试
- 共享逻辑改 `tools/lib/bilingual/browser/` 后须 `npm run sync-lib`

## 验证环 / Done

```bash
npm test
```

**Done 示例**：smoke 测试通过 + manifest 与 lib 文件齐全 + README 安装步骤可复现。
