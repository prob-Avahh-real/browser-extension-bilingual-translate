# Safari：全页中英对照

Safari 不能直接使用 Chrome 的「加载已解压扩展程序」。可用 **Tampermonkey** 运行 userscript。

## 安装

1. 在 Safari 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 打开 Tampermonkey → 添加新脚本
3. 粘贴或导入本目录的 [`bilingual-translate.user.js`](bilingual-translate.user.js)
4. 保存并启用

## 更新 userscript

共享逻辑变更后，在扩展目录执行：

```bash
cd browser-extension-bilingual-translate
npm run build:userscript
```

会重新生成 `safari/bilingual-translate.user.js`。

## 说明

- 翻译优先使用 Edge Translate API（经 `GM_xmlhttpRequest` 绕过 CORS）
- 失败时回退 MyMemory 单条翻译
- 行为与 Chrome 扩展一致：英文页自动对照、SPA 导航重跑

## 正式 Safari Web Extension（可选）

若需 App Store / 无 Tampermonkey 分发，可用 Xcode「Safari Web Extension Converter」将 `browser-extension-bilingual-translate/` 打包为 `.appex`，业务 JS 与 Chrome 版共用 `lib/`。
