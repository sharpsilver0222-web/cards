/**
 * theme.js - 主题切换 + 字体切换
 */
(function (global) {
  'use strict';

  const THEMES = [
    { key: 'green', label: '黑客绿', icon: '🟢' },
    { key: 'blue', label: '赛博蓝', icon: '🔵' },
    { key: 'purple', label: '暗紫', icon: '🟣' },
    { key: 'amber', label: '琥珀橙', icon: '🟠' },
  ];

  const FONTS = [
    { key: 'mono', label: '等宽字体' },
    { key: 'sans', label: '无衬线黑体' },
    { key: 'serif', label: '衬线宋体' },
    { key: 'kaiti', label: '楷体' },
  ];

  const ThemeManager = {
    THEMES,
    FONTS,

    init(config) {
      this.applyTheme(config.theme || 'green', false);
      this.applyFont(config.fontFamily || 'mono', false);
    },

    /**
     * 应用主题
     * @param {string} key
     * @param {boolean} [persist] 是否持久化保存
     */
    applyTheme(key, persist) {
      const exist = THEMES.find((t) => t.key === key);
      if (!exist) key = 'green';
      document.documentElement.setAttribute('data-theme', key);
      if (persist !== false) {
        Storage.saveConfig({ theme: key });
      }
      // 同步主题下拉
      const sel = document.getElementById('theme-select');
      if (sel) sel.value = key;
    },

    applyFont(key, persist) {
      const exist = FONTS.find((f) => f.key === key);
      if (!exist) key = 'mono';
      document.documentElement.setAttribute('data-font', key);
      if (persist !== false) {
        Storage.saveConfig({ fontFamily: key });
      }
      const sel = document.getElementById('font-select');
      if (sel) sel.value = key;
    },

    /**
     * 生成 <select> 的 option 选项 HTML 片段
     */
    getThemeOptionsHtml(selectedKey) {
      return THEMES.map(
        (t) =>
          '<option value="' +
          t.key +
          '" ' +
          (t.key === selectedKey ? 'selected' : '') +
          '>' +
          t.icon +
          ' ' +
          t.label +
          '</option>'
      ).join('');
    },

    getFontOptionsHtml(selectedKey) {
      return FONTS.map(
        (f) =>
          '<option value="' +
          f.key +
          '" ' +
          (f.key === selectedKey ? 'selected' : '') +
          '>' +
          f.label +
          '</option>'
      ).join('');
    },
  };

  global.ThemeManager = ThemeManager;
})(window);
