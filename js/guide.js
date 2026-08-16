/**
 * guide.js - 首次启动 5 步蒙层引导
 *   - 无高亮步骤：面板居中
 *   - 有高亮步骤：4 块挖空蒙层 + 闪烁跑马灯边框 + 指向箭头
 * 可通过 Guide.start() 手动重看
 */
(function (global) {
  'use strict';

  const STEPS = [
    {
      title: '欢迎使用 <span>灵感记录卡</span> 👋',
      emoji: '💡',
      content:
        '这是一款完全<strong>本地化</strong>的灵感记录工具，你的想法只会保存在<strong>当前浏览器</strong>中，不会上传到任何服务器。<br><br>让我们用几个步骤快速熟悉核心功能吧。',
      highlightSelector: null,
    },
    {
      title: '记录你的每一个 <span>灵感</span>',
      emoji: '✍️',
      content:
        '点击右上角的 <code>+ 新建</code> 按钮，即可创建一张新的灵感卡片。<br>在弹窗里填写标题、内容，还可以打上标签、选择喜欢的配色，<br>按 <code>Ctrl + Enter</code> 可快速保存。',
      highlightSelector: '#btn-new',
    },
    {
      title: '<span>标签化</span> 管理与检索',
      emoji: '🏷',
      content:
        '为灵感添加一个或多个<strong>标签</strong>，点击卡片上或顶部标签云中的标签，即可快速筛选同类内容。<br>也可以使用顶部的 <code>搜索框</code> 对标题、内容、标签做关键词搜索。',
      highlightSelector: '#tagcloud, #search-input',
    },
    {
      title: '打造你的 <span>专属风格</span>',
      emoji: '🎨',
      content:
        '在顶部工具栏切换 <code>主题配色</code>：黑客绿 / 赛博蓝 / 暗紫 / 琥珀橙 4 套数据流配色。<br>切换 <code>字体</code>：等宽字体（黑客风）、黑体、宋体、楷体；<br>切换 <code>布局</code>：自适应或 1/2/3/4 列手动列数。',
      highlightSelector: '#theme-select, #font-select, #cols-select',
    },
    {
      title: '<span>数据安全</span> 与备份',
      emoji: '🔐',
      content:
        '所有数据仅存储在<strong>本地浏览器 localStorage</strong>，若清理浏览器缓存会丢失。<br>记得定期点击 <code>导出</code> 按钮下载 <code>.json</code> 备份文件。<br>更换设备时使用 <code>导入</code> 功能即可恢复或合并数据。',
      highlightSelector: '#btn-export, #btn-import',
    },
  ];

  const Guide = {
    STEPS,

    /**
     * 启动引导（首次自动或手动重看）
     */
    start() {
      const mask = document.createElement('div');
      mask.className = 'guide-mask';
      document.body.appendChild(mask);
      // 引导激活时解锁滚动限制（card-scroll-mode 会锁住 main 的 overflow）
      document.body.classList.add('guide-active');

      // resize / scroll 时重新计算挖空与位置（防抖）
      mask._refreshHl = Utils.debounce(() => {
        if (!mask.parentNode) return;
        const idx = Number(mask.getAttribute('data-step-idx') || 0);
        const panel = mask.querySelector('.guide-panel');
        const step = STEPS[idx];
        if (!panel || !step) return;
        this._applyHighlight(mask, panel, step);
      }, 90);
      mask._onResize = () => mask._refreshHl();
      mask._onScroll = () => mask._refreshHl();
      window.addEventListener('resize', mask._onResize);
      window.addEventListener('scroll', mask._onScroll, true);

      this._buildStep(mask, 0);

      // ESC 跳过
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this._finish(mask);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
      mask._escHandler = escHandler;

      // 轮询：用户关闭操作弹窗（新建/编辑/查看/导入等）后，自动恢复引导亮度
      // （解决「点完新建引导变暗且关弹窗后不亮，下一步看不见」的体验问题）
      mask._restoreTimer = setInterval(() => {
        if (!mask.parentNode) {
          clearInterval(mask._restoreTimer);
          return;
        }
        const modals = document.querySelectorAll('.modal-mask');
        let anyVisible = false;
        for (let i = 0; i < modals.length; i++) {
          // offsetParent === null 等同于 display:none 或元素 detached
          if (modals[i].offsetParent !== null) { anyVisible = true; break; }
        }
        if (!anyVisible && mask.classList.contains('minimized')) {
          mask.classList.remove('minimized');
        }
      }, 380);
    },

    /**
     * 检查并在首次启动时自动展示
     */
    checkFirstRun(config) {
      if (!config || !config.hasShownGuide) {
        // 延迟一点，等主界面渲染完毕再显示
        setTimeout(() => this.start(), 500);
      }
    },

    _buildStep(mask, idx) {
      // 先移除上一步对页面目标元素绑定的点击监听（避免残留 + 内存泄漏）
      if (mask._targetListeners) {
        mask._targetListeners.forEach((pair) => {
          try { pair.el.removeEventListener('click', pair.fn, true); } catch (_) {}
        });
        mask._targetListeners = [];
      }
      // 步骤切换时：从上一步的 minimized 后退状态恢复为正常高亮
      mask.classList.remove('minimized');
      mask.setAttribute('data-step-idx', String(idx));
      mask.innerHTML = '';
      const step = STEPS[idx];
      if (!step) {
        this._finish(mask);
        return;
      }

      // --- 挖空 / 高亮 / 箭头：先清空旧的（这些都放在 mask 外更好，因为有 with-highlight 模式 mask 是 pointer-events none。
      //   实际上，pieces / box / arrow 我们直接 append 到 mask 内即可（z-index 已在 CSS 中）。
      // 旧的样式：mask 现在切换 with-highlight 类；并创建 pieces。
      // ---

      // 构建引导面板
      const dots = STEPS.map((_, i) =>
        Utils.$el('span', {
          class: 'guide-dot' + (i === idx ? ' active' : ''),
        })
      );
      const indicator = Utils.$el(
        'div',
        { class: 'guide-step-indicator' },
        dots
      );

      const isFirst = idx === 0;
      const isLast = idx === STEPS.length - 1;

      const panel = Utils.$el('div', { class: 'guide-panel' }, [
        indicator,
        Utils.$el('div', { class: 'guide-emoji' }, step.emoji),
        Utils.$el('h2', { class: 'guide-title' }, ''),
        Utils.$el('p', { class: 'guide-content' }, ''),
        Utils.$el('div', { class: 'guide-footer' }, [
          Utils.$el(
            'button',
            {
              class: 'guide-skip',
              onclick: () => this._finish(mask),
            },
            isLast ? '跳过' : '跳过引导'
          ),
          Utils.$el('div', { class: 'guide-nav' }, [
            !isFirst
              ? Utils.$el(
                  'button',
                  {
                    class: 'btn',
                    onclick: () => this._buildStep(mask, idx - 1),
                  },
                  '← 上一步'
                )
              : null,
            Utils.$el(
              'button',
              {
                class: 'btn btn-primary',
                onclick: () => {
                  if (isLast) this._finish(mask);
                  else this._buildStep(mask, idx + 1);
                },
              },
              isLast ? '🚀 立即开始' : '下一步 →'
            ),
          ]),
        ]),
      ]);
      panel.querySelector('.guide-title').innerHTML = step.title;
      panel.querySelector('.guide-content').innerHTML = step.content;

      mask.appendChild(panel);

      // 应用高亮（挖空 + 闪烁边框 + 指向箭头），并定位面板位置
      this._applyHighlight(mask, panel, step);
    },

    /**
     * 根据 step.highlightSelector 计算联合矩形，
     * 生成 4 块挖空蒙层 + 跑马灯边框 + 箭头，并将面板放在目标附近。
     */
    _applyHighlight(mask, panel, step) {
      // 先移除旧的 pieces / box / arrow
      this._clearPieces(mask);

      const sel = step.highlightSelector;
      if (!sel) {
        // 无高亮：面板居中，普通深色蒙层
        mask.classList.remove('with-highlight');
        return;
      }

      // --- 收集选中元素，计算 union 矩形（包含 padding 外扩） ---
      const selectors = sel
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const targets = [];
      selectors.forEach((s) => {
        document.querySelectorAll(s).forEach((el) => targets.push(el));
      });
      if (targets.length === 0) {
        mask.classList.remove('with-highlight');
        return;
      }
      const PAD = 8; // 高亮 padding
      const union = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.left < union.left) union.left = r.left;
        if (r.top < union.top) union.top = r.top;
        if (r.right > union.right) union.right = r.right;
        if (r.bottom > union.bottom) union.bottom = r.bottom;
      });
      union.left   = Math.max(0, union.left - PAD);
      union.top    = Math.max(0, union.top  - PAD);
      union.right  = Math.min(window.innerWidth,  union.right  + PAD);
      union.bottom = Math.min(window.innerHeight, union.bottom + PAD);
      const w = Math.max(1, union.right - union.left);
      const h = Math.max(1, union.bottom - union.top);

      // mask 切换到 with-highlight（背景透明，让页面透出）
      mask.classList.add('with-highlight');

      // --- 4 块挖空蒙层：围住目标矩形，其余区域全被遮罩 ---
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const topPiece    = this._makePiece({ left: 0,    top: 0,           width: vw,  height: union.top });
      const bottomPiece = this._makePiece({ left: 0,    top: union.bottom, width: vw,  height: Math.max(0, vh - union.bottom) });
      const leftPiece   = this._makePiece({ left: 0,    top: union.top,    width: union.left, height: h });
      const rightPiece  = this._makePiece({ left: union.right, top: union.top, width: Math.max(0, vw - union.right), height: h });
      [topPiece, bottomPiece, leftPiece, rightPiece].forEach((p) => mask.appendChild(p));

      // --- 闪烁跑马灯边框 ---
      const box = Utils.$el('div', { class: 'guide-highlight-box' });
      box.style.left   = union.left + 'px';
      box.style.top    = union.top + 'px';
      box.style.width  = w + 'px';
      box.style.height = h + 'px';
      mask.appendChild(box);

      // --- 面板定位（优先下方，其次上方，再其次左右），并生成箭头 ---
      this._placePanelAndArrow(mask, panel, union);

      // --- 监听高亮目标点击，操作成功后给反馈（不自动推进，避免挡弹窗）---
      const boxEl = mask.querySelector('.guide-highlight-box');
      const arrowEl = mask.querySelector('.guide-arrow');
      const primaryBtn = panel.querySelector('.guide-nav .btn-primary');
      // 记录原按钮文字（供后续步骤切换时恢复）
      if (primaryBtn && !primaryBtn.dataset.origText) {
        primaryBtn.dataset.origText = primaryBtn.textContent;
      }
      // 防重复触发：用户连点不会叠加 banner/多次切换状态
      let alreadyDone = false;
      const markDone = () => {
        if (alreadyDone) return;
        alreadyDone = true;
        if (boxEl && !boxEl.classList.contains('done')) boxEl.classList.add('done');
        if (arrowEl) arrowEl.style.display = 'none';
        // 点击后引导整体后退半透明，不挡住操作弹窗
        if (!mask.classList.contains('minimized')) {
          mask.classList.add('minimized');
        }
        // 给 panel 加一个提示条（加在 footer 上面）
        if (panel && !panel.querySelector('.guide-step-hint')) {
          const footer = panel.querySelector('.guide-footer');
          const hint = Utils.$el('div', { class: 'guide-step-hint' },
            '✓ 已按引导完成操作，关闭弹窗后点击高亮的「下一步」继续 →'
          );
          if (footer) panel.insertBefore(hint, footer);
        }
        if (primaryBtn && !primaryBtn.classList.contains('ready')) {
          primaryBtn.classList.add('ready');
          const orig = primaryBtn.dataset.origText || primaryBtn.textContent;
          if (orig.indexOf('✓') !== 0) {
            primaryBtn.textContent = '✓ ' + orig;
          }
        }
        // ====== 核弹级全屏成功横幅（z=99999，100% 可见）======
        try {
          const banner = document.createElement('div');
          banner.className = 'guide-success-banner';
          banner.innerHTML =
            '操作成功！<span class="sub">弹窗操作完毕后，点击高亮的绿色「下一步」按钮继续引导</span>';
          document.body.appendChild(banner);
          setTimeout(() => {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
          }, 3400);
        } catch (_) { /* ignore */ }
      };
      targets.forEach((el) => {
        el.addEventListener('click', markDone, { once: true, capture: true });
      });
      // 存下来以便步骤推进时能移除监听（避免内存泄漏）
      mask._targetListeners = mask._targetListeners || [];
      mask._targetListeners.forEach((pair) => {
        try { pair.el.removeEventListener('click', pair.fn, true); } catch (_) {}
      });
      mask._targetListeners = targets.map((el) => ({ el, fn: markDone }));
    },

    _makePiece(rect) {
      const el = Utils.$el('div', { class: 'guide-mask-piece' });
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
      return el;
    },

    /**
     * 面板定位 + 箭头生成。
     * 策略：
     *  - 优先下方：若 target.bottom + 20 + 面板最大高度 < vh，放下方，箭头 ↑
     *  - 再上方：若 target.top - 20 - 面板最大高度 > 0，放上方，箭头 ↓
     *  - 再右方：target.right + 20 + 面板最大宽度 < vw，箭头 ←
     *  - 最后左方：箭头 →
     */
    _placePanelAndArrow(mask, panel, u) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 先移除旧箭头
      mask.querySelectorAll('.guide-arrow').forEach(n => n.remove());
      // 先把面板加到 mask 里测量一次
      panel.style.visibility = 'hidden';
      panel.style.position = 'fixed';
      panel.style.left = '0';
      panel.style.top = '0';
      panel.style.margin = '0';
      panel.style.width = 'auto';
      panel.style.maxWidth = '520px';
      // 若未在 mask 里（应该已 append），跳过追加

      const panelW = panel.offsetWidth || 520;
      const panelH = panel.offsetHeight || 320;
      const GAP = 22;

      let pos = null; // { left, top, arrowSym, arrowDx, arrowDy }
      // 下方
      if (u.bottom + GAP + panelH < vh - 10) {
        const left = Math.max(
          12,
          Math.min(vw - panelW - 12, (u.left + u.right) / 2 - panelW / 2)
        );
        pos = {
          left,
          top: u.bottom + GAP,
          arrowSym: '▲',
          // 箭头位置：面板顶部居中偏上一点
          arrowLeft: Math.max(16, Math.min(vw - 64, (u.left + u.right) / 2 - 24)),
          arrowTop:  u.bottom + 2,
          arrowDx: '0',
          arrowDy: '-8px', // 箭头向上弹跳
        };
      }
      // 上方
      else if (u.top - GAP - panelH > 10) {
        const left = Math.max(
          12,
          Math.min(vw - panelW - 12, (u.left + u.right) / 2 - panelW / 2)
        );
        pos = {
          left,
          top: u.top - GAP - panelH,
          arrowSym: '▼',
          arrowLeft: Math.max(16, Math.min(vw - 64, (u.left + u.right) / 2 - 24)),
          arrowTop:  u.top - 48 - 2,
          arrowDx: '0',
          arrowDy: '8px',
        };
      }
      // 右方
      else if (u.right + GAP + panelW < vw - 10) {
        const top = Math.max(
          12,
          Math.min(vh - panelH - 12, (u.top + u.bottom) / 2 - panelH / 2)
        );
        pos = {
          left: u.right + GAP,
          top,
          arrowSym: '◀',
          arrowLeft: u.right + 2,
          arrowTop:  Math.max(16, Math.min(vh - 64, (u.top + u.bottom) / 2 - 24)),
          arrowDx: '-8px',
          arrowDy: '0',
        };
      }
      // 左方
      else {
        const top = Math.max(
          12,
          Math.min(vh - panelH - 12, (u.top + u.bottom) / 2 - panelH / 2)
        );
        pos = {
          left: Math.max(12, u.left - GAP - panelW),
          top,
          arrowSym: '▶',
          arrowLeft: u.left - 48 - 2,
          arrowTop:  Math.max(16, Math.min(vh - 64, (u.top + u.bottom) / 2 - 24)),
          arrowDx: '8px',
          arrowDy: '0',
        };
      }

      panel.style.left = pos.left + 'px';
      panel.style.top  = pos.top + 'px';
      panel.style.visibility = 'visible';
      panel.style.maxWidth = 'calc(100vw - 32px)';
      panel.style.maxHeight = 'calc(100vh - 32px)';

      // 箭头
      const arrow = Utils.$el('div', { class: 'guide-arrow' }, pos.arrowSym);
      arrow.style.left = pos.arrowLeft + 'px';
      arrow.style.top  = pos.arrowTop  + 'px';
      arrow.style.setProperty('--arrow-dx', pos.arrowDx);
      arrow.style.setProperty('--arrow-dy', pos.arrowDy);
      mask.appendChild(arrow);
    },

    _clearPieces(mask) {
      if (!mask) return;
      mask.querySelectorAll('.guide-mask-piece').forEach(n => n.remove());
      mask.querySelectorAll('.guide-highlight-box').forEach(n => n.remove());
      mask.querySelectorAll('.guide-arrow').forEach(n => n.remove());
    },

    _finish(mask) {
      // 清理目标元素的监听
      if (mask._targetListeners) {
        mask._targetListeners.forEach((pair) => {
          try { pair.el.removeEventListener('click', pair.fn, true); } catch (_) {}
        });
        mask._targetListeners = [];
      }
      // 清理轮询定时器
      if (mask._restoreTimer) clearInterval(mask._restoreTimer);
      this._clearPieces(mask);
      if (mask._onResize) window.removeEventListener('resize', mask._onResize);
      if (mask._onScroll) window.removeEventListener('scroll', mask._onScroll, true);
      if (mask._escHandler) {
        document.removeEventListener('keydown', mask._escHandler);
      }
      // 淡出
      mask.style.transition = 'opacity 0.3s';
      mask.style.opacity = '0';
      setTimeout(() => {
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        document.body.classList.remove('guide-active');
      }, 280);
      // 保存已看过标记
      Storage.saveConfig({ hasShownGuide: true });
    },
  };

  global.Guide = Guide;
})(window);
