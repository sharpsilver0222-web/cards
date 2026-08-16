/**
 * app.js - 应用入口：初始化 + 全局事件绑定
 * 依赖加载顺序（已在 index.html 中保证）：
 *   utils -> storage -> theme -> matrix-bg -> editor -> cards -> guide -> app
 */
(function () {
  'use strict';

  function boot() {
    // 1. 加载配置
    const config = Storage.getConfig();

    // 2. 填充主题/字体/列数下拉选项（先填 HTML，再初始化 manager 选中）
    const themeSel = document.getElementById('theme-select');
    const fontSel = document.getElementById('font-select');
    const colsSel = document.getElementById('cols-select');
    if (themeSel) themeSel.innerHTML = ThemeManager.getThemeOptionsHtml(config.theme);
    if (fontSel) fontSel.innerHTML = ThemeManager.getFontOptionsHtml(config.fontFamily);
    if (colsSel) colsSel.innerHTML = getColsOptionsHtml(config.cols);
    // 列数直接作用到 html[data-cols]
    applyCols(config.cols);

    // 3. 初始化各模块
    ThemeManager.init(config);
    MatrixBG.init();
    CardsManager.init(config);

    // 4. 绑定顶栏控件事件
    bindTopbarEvents();

    // 5. 全局快捷键
    bindHotkeys();

    // 6. 窗口 resize 时，重新判断是否启用浮动模式
    window.addEventListener(
      'resize',
      Utils.debounce(() => {
        // 触发一次 refresh 让卡片重新判定浮动
        const sortSel = document.getElementById('sort-select');
        if (sortSel && document.body.classList.contains('card-float-mode')) {
          // 仅在浮动模式下刷新判断
          CardsManager.refresh();
        }
      }, 260)
    );

    // 7. 首次启动引导
    Guide.checkFirstRun(config);

    console.log(
      '%c💡 灵感记录卡 已就绪',
      'color:#00ff41;font-size:14px;font-weight:bold;'
    );
  }

  function bindTopbarEvents() {
    // 新建
    const btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.addEventListener('click', () => Editor.openNew());

    // 导出
    const btnExport = document.getElementById('btn-export');
    if (btnExport)
      btnExport.addEventListener('click', () => Storage.exportData());

    // 导入（按钮 + 文件选择）
    const btnImport = document.getElementById('btn-import');
    const fileInput = document.getElementById('import-file-input');
    if (btnImport)
      btnImport.addEventListener('click', () => Editor.openImportPicker());
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) Editor.handleImportFile(f);
        // 清空 input，允许重复选择相同文件
        fileInput.value = '';
      });
    }

    // 重新查看引导
    const btnGuide = document.getElementById('btn-guide');
    if (btnGuide) btnGuide.addEventListener('click', () => Guide.start());

    // 滚动暂停/继续
    const btnScrollToggle = document.getElementById('btn-scroll-toggle');
    if (btnScrollToggle) btnScrollToggle.addEventListener('click', () => CardsManager.toggleScroll());

    // 主题切换
    const themeSel = document.getElementById('theme-select');
    if (themeSel) {
      themeSel.addEventListener('change', (e) => {
        ThemeManager.applyTheme(e.target.value);
        Utils.toast('已切换主题：' +
          (ThemeManager.THEMES.find(t => t.key === e.target.value)?.label || ''),
          'info', 1500
        );
      });
    }

    // 字体切换
    const fontSel = document.getElementById('font-select');
    if (fontSel) {
      fontSel.addEventListener('change', (e) => {
        ThemeManager.applyFont(e.target.value);
        Utils.toast('已切换字体：' +
          (ThemeManager.FONTS.find(f => f.key === e.target.value)?.label || ''),
          'info', 1500
        );
      });
    }

    // 布局列数切换
    const colsSel = document.getElementById('cols-select');
    if (colsSel) {
      colsSel.addEventListener('change', (e) => {
        const v = e.target.value;
        applyCols(v);
        Storage.setConfig({ cols: v });
        // 列数变化需要重新判定滚动高度，也刷新一次
        CardsManager.refresh();
        const label = ({
          'auto':'自适应','1':'1 列','2':'2 列','3':'3 列','4':'4 列'
        })[v] || v;
        Utils.toast('已切换布局：' + label, 'info', 1400);
      });
    }
  }

  function bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target && e.target.isContentEditable);

      // Ctrl / Cmd + N：新建
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        Editor.openNew();
        return;
      }

      // Ctrl / Cmd + K 或 /：聚焦搜索
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) ||
        (e.key === '/' && !isTyping)
      ) {
        e.preventDefault();
        const search = document.getElementById('search-input');
        if (search) {
          search.focus();
          search.select();
        }
        return;
      }

      // Ctrl + Shift + E：导出
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        Storage.exportData();
        return;
      }
    });
  }

  function getColsOptionsHtml(selected) {
    const opts = [
      { key: 'auto', label: '🎚 自适应' },
      { key: '1',    label: '▮ 1 列' },
      { key: '2',    label: '▮▮ 2 列' },
      { key: '3',    label: '▮▮▮ 3 列' },
      { key: '4',    label: '▮▮▮▮ 4 列' },
    ];
    return opts.map(o =>
      `<option value="${o.key}" ${o.key === selected ? 'selected' : ''}>${o.label}</option>`
    ).join('');
  }

  function applyCols(cols) {
    const html = document.documentElement;
    const valid = ['auto','1','2','3','4'].includes(cols) ? cols : 'auto';
    if (valid === 'auto') {
      html.removeAttribute('data-cols');
    } else {
      html.setAttribute('data-cols', valid);
    }
  }

  // DOM 已就绪（脚本都在 body 末尾加载，所以 DOMContentLoaded 大概率已触发，兜底判断）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
