# Safari：多意 MulTranslate

Safari 不能直接使用 Chrome 的「加载已解压扩展程序」。可用 **Tampermonkey** 运行 userscript。

## 安装

1. 在 Safari 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 打开 Tampermonkey → 添加新脚本
3. 粘贴或导入本目录的 [`multranslate.user.js`](multranslate.user.js)
4. 保存并启用

## 语言

支持 English / 简体中文 / 한국어 / 日本語 / Español / Français。

源语言自动检测（`html lang` + 正文语种抽样），与目标语言相同时自动跳过。

翻译完成后，页面顶部工具栏有语言下拉框，切换后自动重译并通过
`GM_setValue('bi-target-lang')` 记住选择。

## 更新 userscript

共享逻辑变更后，在扩展目录执行：

```bash
cd multranslate
npm run build:userscript
```

会重新生成 `safari/multranslate.user.js`。

## 说明

- 翻译优先使用 Edge Translate API（经 `GM_xmlhttpRequest` 绕过 CORS，`from`/`to` 按检测到的语言对）
- 失败时回退 MyMemory 单条翻译（langpair 为 `源|目标`，如 `zh-CN|ko`）
- 行为与 Chrome 扩展一致：受支持语言页面自动对照、SPA 导航重跑、页面内切换目标语言

## 正式 Safari Web Extension（可选）

若需 App Store / 无 Tampermonkey 分发，可用 Xcode「Safari Web Extension Converter」将 `multranslate/` 打包为 `.appex`，业务 JS 与 Chrome 版共用 `lib/`。
