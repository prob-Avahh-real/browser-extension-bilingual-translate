export const TOC_GLOSSARY = {
  top: '顶部',
  contents: '目录',
  goals: '目标',
  techniques: '技术',
  applications: '应用',
  ethics: '伦理学',
  history: '历史',
  philosophy: '哲学',
  future: '未来',
  'in fiction': '虚构作品中',
  'see also': '参见',
  'explanatory notes': '说明性注释',
  notes: '注释',
  references: '参考文献',
  'further reading': '延伸阅读',
  'external links': '外部链接',
  donate: '捐赠',
  'create account': '创建账户',
  'log in': '登录',
  search: '搜索',
  article: '条目',
  talk: '讨论',
  read: '阅读',
  'view source': '查看源代码',
  'view history': '查看历史',
  hide: '隐藏',
  appearance: '外观',
  text: '文字',
  small: '小',
  standard: '标准',
  large: '大',
  width: '宽度',
  wide: '宽',
  color: '颜色',
  automatic: '自动',
  light: '浅色',
  dark: '深色',
  ai: '人工智能',
  'a.i.': '人工智能',
  youtube: 'YouTube（油管）',
  facebook: 'Facebook（脸书）',
  twitter: 'Twitter（推特）',
  google: '谷歌',
  microsoft: '微软',
  openai: 'OpenAI',
  chatgpt: 'ChatGPT',
  gpt: 'GPT（生成式预训练变换模型）',
  'gpt-4': 'GPT-4',
  'gpt-3': 'GPT-3',
  llm: '大语言模型',
  wikipedia: '维基百科',
  'the free encyclopedia': '自由的百科全书',
  vte: '查看/讨论/编辑',
  'v t e': '查看/讨论/编辑',
  tools: '工具',
  'main menu': '主菜单',
  'main page': '首页',
  'random article': '随机条目',
  'about wikipedia': '关于维基百科',
  'contact us': '联系我们',
  help: '帮助',
  'what links here': '链入页面',
  'related changes': '相关更改',
  'upload file': '上传文件',
  'special pages': '特殊页面',
  'permanent link': '固定链接',
  'page information': '页面信息',
  'cite this page': '引用本页',
  'get shortened url': '获取短链接',
  'download as pdf': '下载为 PDF',
  'printable version': '可打印版本',
  'in other projects': '其他项目',
  wikimedia: '维基媒体',
  wiktionary: '维基词典',
  wikibooks: '维基教科书',
  wikiquote: '维基语录',
  wikisource: '维基文库',
  wikiversity: '维基学院',
  wikivoyage: '维基导游',
  wikinews: '维基新闻',
  commons: '共享资源',
  wikidata: '维基数据',
  mediawiki: 'MediaWiki',
  disambiguation: '消歧义',
  'edit links': '编辑链接',
  languages: '语言',
  'add languages': '添加语言',
  contributions: '贡献',
  sandbox: '沙盒',
  preferences: '参数设置',
  'beta features': '测试功能',
  watchlist: '监视列表',
  'log out': '退出',
  'not logged in': '未登录',
  'learn more': '了解更多',
  'got it': '知道了',
  'move to sidebar': '移到侧栏',
  show: '显示',
  toggle: '切换',
  subsection: '子章节',
};

export function hasChinese(s) {
  return /[\u4e00-\u9fff]/.test(s || '');
}

export function glossaryLookup(text) {
  const key = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (TOC_GLOSSARY[key]) return TOC_GLOSSARY[key];
  const bare = key
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();
  return TOC_GLOSSARY[bare] || null;
}

export function acceptTranslation(en, zh) {
  const e = (en || '').trim();
  const z = (zh || '').trim();
  if (!z) return { ok: false, reason: 'empty' };
  if (!hasChinese(z)) {
    const g = glossaryLookup(e);
    if (g) return { ok: true, zh: g, reason: 'glossary-after-latin' };
    const versioned = e.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9+._-]{1,20})$/);
    if (versioned) {
      const name = versioned[2];
      const nameZh = glossaryLookup(name) || `${name}（专有名词）`;
      return { ok: true, zh: `${versioned[1]} ${nameZh}`, reason: 'versioned-label' };
    }
    if (/^(gpt|llm|api|url|pdf|html|css|http|https|cpu|gpu)([- ]?\d+)?$/i.test(e)) {
      const base = e.replace(/[- ]?\d+$/i, '').trim();
      const g2 = glossaryLookup(base) || glossaryLookup(e);
      if (g2) return { ok: true, zh: g2, reason: 'tech-acronym' };
      return { ok: true, zh: `${e}（专有名词）`, reason: 'tech-acronym-keep' };
    }
    if (e.length <= 16 && /^[A-Za-z0-9.+\/_-]+$/.test(e)) {
      return { ok: true, zh: `${e}（专有名词）`, reason: 'proper-noun-keep' };
    }
    return { ok: false, reason: 'no-chinese', zh: z };
  }
  if (z.toLowerCase() === e.toLowerCase()) {
    const g = glossaryLookup(e);
    if (g) return { ok: true, zh: g, reason: 'glossary-echo' };
    return { ok: false, reason: 'echo-english', zh: z };
  }
  return { ok: true, zh: z, reason: 'ok' };
}
