/**
 * cards.js - 卡片管理：获取、渲染（瀑布流）、排序、搜索、标签筛选、浮动动画判定
 * 依赖：Storage / Utils / ThemeManager / Editor
 */
(function (global) {
  'use strict';

  const SORT_OPTIONS = [
    { key: 'updatedAt_desc', label: '按修改时间 ↓' },
    { key: 'updatedAt_asc', label: '按修改时间 ↑' },
    { key: 'createdAt_desc', label: '按创建时间 ↓' },
    { key: 'createdAt_asc', label: '按创建时间 ↑' },
  ];

  const CardsManager = {
    // 当前视图状态
    state: {
      sortBy: 'updatedAt_desc',
      searchKw: '',
      activeTag: null, // 选中的标签（单标签筛选）
      allCards: [],
    },

    SORT_OPTIONS,

    /* ----------------- 初始化 ----------------- */
    init(config) {
      this.state.sortBy = config.sortBy || 'updatedAt_desc';
      this.state.allCards = Storage.getCards();
      this._renderSortOptions();
      this.refresh();
      // 搜索输入（防抖）
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener(
          'input',
          Utils.debounce((e) => {
            this.state.searchKw = (e.target.value || '').trim().toLowerCase();
            this.refresh();
          }, 180)
        );
      }
      // 排序切换
      const sortSel = document.getElementById('sort-select');
      if (sortSel) {
        sortSel.value = this.state.sortBy;
        sortSel.addEventListener('change', (e) => {
          this.state.sortBy = e.target.value;
          Storage.saveConfig({ sortBy: this.state.sortBy });
          this.refresh();
        });
      }
    },

    _renderSortOptions() {
      const sel = document.getElementById('sort-select');
      if (!sel) return;
      sel.innerHTML = SORT_OPTIONS.map(
        (o) =>
          '<option value="' +
          o.key +
          '" ' +
          (o.key === this.state.sortBy ? 'selected' : '') +
          '>' +
          o.label +
          '</option>'
      ).join('');
    },

    /* ----------------- 核心：刷新渲染 ----------------- */
    refresh() {
      const filtered = this._getFilteredCards();
      this._renderTagCloud();
      this._renderCards(filtered);
      // 显示模式（浮动 / 滚动 互斥）：下一帧布局稳定后判定
      requestAnimationFrame(() => this._toggleDisplayMode(filtered));
    },

    /**
     * 筛选 + 排序后的卡片列表
     */
    _getFilteredCards() {
      let list = this.state.allCards.slice();

      // 标签筛选
      if (this.state.activeTag) {
        const tag = this.state.activeTag;
        list = list.filter((c) => (c.tags || []).indexOf(tag) !== -1);
      }

      // 搜索关键词（标题 + 内容 + 标签）
      const kw = this.state.searchKw;
      if (kw) {
        list = list.filter((c) => {
          const hay =
            (c.title || '') +
            '\n' +
            (c.content || '') +
            '\n' +
            (c.tags || []).join(' ');
          return hay.toLowerCase().indexOf(kw) !== -1;
        });
      }

      // 排序
      const [key, dir] = this.state.sortBy.split('_');
      list.sort((a, b) => {
        const av = a[key] || 0;
        const bv = b[key] || 0;
        return dir === 'desc' ? bv - av : av - bv;
      });

      return list;
    },

    /* ----------------- 标签云 ----------------- */
    _renderTagCloud() {
      const container = document.getElementById('tagcloud');
      if (!container) return;
      const wrap = container;
      wrap.innerHTML = '';

      // 统计标签使用次数
      const counter = {};
      this.state.allCards.forEach((c) => {
        (c.tags || []).forEach((t) => {
          if (!t) return;
          counter[t] = (counter[t] || 0) + 1;
        });
      });
      const tags = Object.keys(counter).sort(
        (a, b) => counter[b] - counter[a] || a.localeCompare(b)
      );

      if (tags.length === 0) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = 'flex';

      wrap.appendChild(
        Utils.$el('div', { class: 'tagcloud-label' }, '标签：')
      );

      // 全部标签
      tags.forEach((t) => {
        const chip = Utils.$el(
          'span',
          {
            class: 'tagchip' + (this.state.activeTag === t ? ' active' : ''),
            onclick: () => {
              this.state.activeTag =
                this.state.activeTag === t ? null : t;
              this.refresh();
            },
          },
          [
            '#' + Utils.escapeHtml(t),
            Utils.$el(
              'span',
              { class: 'tagchip-count' },
              '×' + counter[t]
            ),
          ]
        );
        wrap.appendChild(chip);
      });

      // 清除筛选
      if (this.state.activeTag) {
        wrap.appendChild(
          Utils.$el(
            'span',
            {
              class: 'tagchip-clear',
              onclick: () => {
                this.state.activeTag = null;
                this.refresh();
              },
            },
            '✕ 清除筛选'
          )
        );
      }
    },

    /* ----------------- 卡片渲染 ----------------- */
    _renderCards(cards) {
      const container = document.getElementById('waterfall');
      const emptyState = document.getElementById('empty-state');
      if (!container) return;
      container.innerHTML = '';

      if (cards.length === 0) {
        if (emptyState) {
          emptyState.style.display = '';
          // 根据是否有源数据、是否有筛选条件，显示不同的空状态文案
          const hasFilter = this.state.searchKw || this.state.activeTag;
          const total = this.state.allCards.length;
          const titleEl = emptyState.querySelector('.empty-title');
          const descEl = emptyState.querySelector('.empty-desc');
          const hintEl = emptyState.querySelector('.empty-hint');
          if (total === 0) {
            titleEl.textContent = '还没有灵感记录';
            descEl.textContent =
              '点击右上角「+ 新建」按钮，捕捉你的第一个想法吧。';
            hintEl.textContent = '所有数据仅保存在当前浏览器，请定期导出备份。';
          } else if (hasFilter) {
            titleEl.textContent = '没有匹配的灵感';
            descEl.textContent = '试试换一个关键词，或清除当前筛选条件。';
            hintEl.textContent =
              '当前共有 ' + total + ' 条灵感，其中 ' +
              cards.length + ' 条符合条件。';
          } else {
            titleEl.textContent = '暂无数据';
            descEl.textContent = '';
            hintEl.textContent = '';
          }
        }
        return;
      }
      if (emptyState) emptyState.style.display = 'none';

      // 渲染每张卡片
      cards.forEach((card, i) => {
        container.appendChild(this._createCardEl(card, i));
      });
    },

    _createCardEl(card, idx) {
      const el = Utils.$el('div', {
        class: 'card card-enter',
        'data-card-id': card.id,
        'data-card-color': card.cardColor || 'theme_default',
        'data-float-idx': String(idx % 8),
        onclick: (e) => {
          // 排除点击到删除按钮时触发编辑
          if (e.target.closest('.card-del-btn')) return;
          if (e.target.closest('.card-tag')) {
            const tag = e.target.textContent.replace(/^#/, '').trim();
            if (tag) {
              this.state.activeTag =
                this.state.activeTag === tag ? null : tag;
              this.refresh();
              return;
            }
          }
          // 先查看再编辑
          Editor.openView(card.id);
        },
      });

      // 标题
      if (card.title) {
        el.appendChild(
          Utils.$el(
            'h3',
            { class: 'card-title' },
            Utils.truncate(Utils.escapeHtml(card.title), 60)
          )
        );
      }

      // 正文
      el.appendChild(
        Utils.$el(
          'p',
          { class: 'card-content' },
          Utils.escapeHtml(card.content)
        )
      );

      // 标签
      if (card.tags && card.tags.length) {
        const tagWrap = Utils.$el('div', { class: 'card-tags' });
        card.tags.forEach((t) => {
          tagWrap.appendChild(
            Utils.$el(
              'span',
              {
                class: 'card-tag',
                title: '点击筛选标签：' + t,
              },
              '#' + Utils.escapeHtml(t)
            )
          );
        });
        el.appendChild(tagWrap);
      }

      // Footer：时间 + 删除按钮
      const footer = Utils.$el('div', { class: 'card-footer' });
      footer.appendChild(
        Utils.$el(
          'span',
          {
            class: 'card-time',
            title: '创建：' +
              Utils.formatTime(card.createdAt) +
              '\n修改：' +
              Utils.formatTime(card.updatedAt),
          },
          Utils.relativeTime(card.updatedAt)
        )
      );
      const delBtn = Utils.$el('button', {
        class: 'card-del-btn',
        title: '删除',
        onclick: (e) => {
          e.stopPropagation();
          Editor.openDeleteConfirm(card.id);
        },
      }, '🗑');
      footer.appendChild(delBtn);
      el.appendChild(footer);

      return el;
    },

    /* ----------------- 浮动 / 滚动 模式判定（互斥） ----------------- */
    _toggleDisplayMode(filtered) {
      const body = document.body;
      const scrollWrap = document.querySelector('.scroll-wrap');
      const waterfall = document.getElementById('waterfall');
      if (!scrollWrap || !waterfall) return;

      const visibleCount = filtered.length;
      if (visibleCount === 0) {
        body.classList.remove('card-float-mode', 'card-scroll-mode');
        this._teardownScrollMode();
        this._hideScrollToggle();
        return;
      }

      // 有卡片就显示暂停按钮
      this._showScrollToggle();

      // 内容高度：以 waterfall 实际高度为准
      const contentH = waterfall.scrollHeight || waterfall.offsetHeight || 0;
      const wrapH = scrollWrap.clientHeight || (window.innerHeight - 140);

      // 判定优先级：
      // 1) 若内容高度 < wrapH × 1.1：用浮动模式（一屏能装下，缓慢跃动）
      // 2) 否则：用纵向自动循环滚动模式
      const fitsOneScreen = contentH > 0 && contentH < wrapH * 1.1 && visibleCount < 12;

      if (fitsOneScreen) {
        // ===== 浮动模式 =====
        body.classList.remove('card-scroll-mode');
        this._teardownScrollMode();
        body.classList.add('card-float-mode');
      } else {
        // ===== 滚动模式 =====
        body.classList.remove('card-float-mode');
        body.classList.add('card-scroll-mode');
        this._setupScrollMode(contentH, wrapH);
        this._showScrollToggle();
      }
    },

    _showScrollToggle() {
      const btn = document.getElementById('btn-scroll-toggle');
      if (!btn) return;
      btn.style.display = '';
      btn.textContent = '⏸';
      const isFloat = document.body.classList.contains('card-float-mode');
      btn.title = isFloat ? '暂停浮动' : '暂停滚动';
    },

    _hideScrollToggle() {
      const btn = document.getElementById('btn-scroll-toggle');
      if (!btn) return;
      btn.style.display = 'none';
    },

    toggleScroll() {
      const body = document.body;
      const btn = document.getElementById('btn-scroll-toggle');
      if (!btn) return;
      const isFloat = body.classList.contains('card-float-mode');

      if (isFloat) {
        // 浮动模式：暂停/恢复卡片浮动动画
        const cards = document.querySelectorAll('.card');
        const isPaused = body.dataset.floatPaused === 'true';
        if (isPaused) {
          body.dataset.floatPaused = 'false';
          cards.forEach(c => { c.style.animationPlayState = 'running'; });
          btn.textContent = '⏸';
          btn.title = '暂停浮动';
        } else {
          body.dataset.floatPaused = 'true';
          cards.forEach(c => { c.style.animationPlayState = 'paused'; });
          btn.textContent = '▶';
          btn.title = '继续浮动';
        }
      } else {
        // 滚动模式：暂停/恢复滚动
        const si = document.querySelector('.scroll-inner');
        if (!si) return;
        const isPaused = si.dataset.userPaused === 'true';
        if (isPaused) {
          si.dataset.userPaused = 'false';
          si.style.animationPlayState = 'running';
          btn.textContent = '⏸';
          btn.title = '暂停滚动';
        } else {
          si.dataset.userPaused = 'true';
          si.style.animationPlayState = 'paused';
          btn.textContent = '▶';
          btn.title = '继续滚动';
        }
      }
    },

    _setupScrollMode(contentH, wrapH) {
      const scrollInner = document.querySelector('.scroll-inner');
      const waterfall = document.getElementById('waterfall');
      if (!scrollInner || !waterfall) return;

      // 保证 .scroll-inner 里只有 1 份或 2 份 waterfall（id 保留第一个唯一）
      // 先移除除第一个 #waterfall 以外的克隆节点
      const clones = scrollInner.querySelectorAll('.waterfall-clone');
      clones.forEach(n => n.remove());

      // 克隆 1 份，放在后面（不需要保留 id，避免重复）
      const clone = waterfall.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.add('waterfall-clone');
      // 克隆卡片里的 onclick 绑定（cloneNode 不会复制事件监听，我们重新渲染时绑定的是 HTML onclick 属性，可以用但 cloneNode 的 onclick 是字符串，所以这里要手动重新绑定？
      // 我们原来的事件是通过 Utils.$el({ onclick: fn }) 挂在 element.onclick 属性上的，cloneNode(true) **不会**复制 element.onclick 这种直接属性。
      // 解决方案：对克隆出来的每张 card，从原 card 里找到相同 id 的 onclick handler，重新绑定。
      const origCards = waterfall.querySelectorAll('.card');
      const clonedCards = clone.querySelectorAll('.card');
      clonedCards.forEach((cEl) => {
        const id = cEl.getAttribute('data-card-id');
        if (!id) return;
        // 原节点绑定的 onclick
        const orig = Array.from(origCards).find(
          (x) => x.getAttribute('data-card-id') === id
        );
        if (orig && orig.onclick) {
          cEl.onclick = orig.onclick;
        }
        // 克隆 card-tag 的 click（通过事件冒泡到 .card 里已处理，OK）
        // 克隆 card-del-btn 的 onclick（直接属性）
        const delBtn = cEl.querySelector('.card-del-btn');
        const origDel = orig && orig.querySelector('.card-del-btn');
        if (delBtn && origDel && origDel.onclick) {
          delBtn.onclick = origDel.onclick;
        }
        // tagchip（没有），card-tag 是冒泡到 parent，OK
      });
      scrollInner.appendChild(clone);

      // 设置动画时长：速度约 42 px / s（内容越长时间越长）
      const speedPxPerSec = 42;
      const totalH = Math.max(contentH + 24, 1);
      const durationSec = Math.max(22, Math.ceil(totalH / speedPxPerSec));
      scrollInner.style.animationDuration = durationSec + 's';
      // 若之前暂停了，恢复播放
      scrollInner.style.animationPlayState = 'running';

      // 悬停暂停：用 JS 事件代替 CSS :hover（更可靠，不受 pointer-events/层叠影响）
      const scrollWrap = document.querySelector('.scroll-wrap');
      if (scrollWrap) {
        // 先移除旧监听（避免重复绑定）
        scrollWrap.onmouseenter = null;
        scrollWrap.onmouseleave = null;
        scrollWrap.onmouseenter = function () {
          scrollInner.style.animationPlayState = 'paused';
          const btn = document.getElementById('btn-scroll-toggle');
          if (btn) { btn.textContent = '▶'; btn.title = '继续滚动'; }
        };
        scrollWrap.onmouseleave = function () {
          // 只有用户没有手动暂停时才恢复
          if (scrollInner.dataset.userPaused !== 'true') {
            scrollInner.style.animationPlayState = 'running';
            const btn = document.getElementById('btn-scroll-toggle');
            if (btn) { btn.textContent = '⏸'; btn.title = '暂停滚动'; }
          }
        };
      }
    },

    _teardownScrollMode() {
      const scrollInner = document.querySelector('.scroll-inner');
      if (!scrollInner) return;
      const clones = scrollInner.querySelectorAll('.waterfall-clone');
      clones.forEach(n => n.remove());
      scrollInner.style.animationDuration = '';
      scrollInner.style.animationPlayState = '';
      // 清理 hover 事件
      const scrollWrap = document.querySelector('.scroll-wrap');
      if (scrollWrap) {
        scrollWrap.onmouseenter = null;
        scrollWrap.onmouseleave = null;
      }
    },

    /* ----------------- 外部调用的 CRUD 封装 ----------------- */
    /**
     * 创建新卡片
     * @param {{title?:string, content:string, tags?:string[], cardColor?:string}} data
     */
    createCard(data) {
      if (!data || !String(data.content || '').trim()) {
        Utils.toast('灵感内容不能为空', 'error');
        return false;
      }
      const now = Date.now();
      const card = {
        id: Utils.uuid(),
        title: String(data.title || '').trim(),
        content: String(data.content).trim(),
        tags: Utils.unique(
          (data.tags || [])
            .map((t) => String(t || '').trim())
            .filter(Boolean)
        ),
        cardColor: data.cardColor || 'theme_default',
        createdAt: now,
        updatedAt: now,
      };
      const ok = Storage.addCard(card);
      if (ok) {
        this.state.allCards = Storage.getCards();
        this.refresh();
        Utils.toast('已保存灵感 ✓', 'success');
      }
      return ok;
    },

    /**
     * 更新卡片
     */
    updateCard(id, patch) {
      if (patch.content != null && !String(patch.content).trim()) {
        Utils.toast('灵感内容不能为空', 'error');
        return false;
      }
      const toSave = {};
      if (patch.title !== undefined) toSave.title = String(patch.title).trim();
      if (patch.content !== undefined)
        toSave.content = String(patch.content).trim();
      if (patch.tags !== undefined)
        toSave.tags = Utils.unique(
          patch.tags.map((t) => String(t || '').trim()).filter(Boolean)
        );
      if (patch.cardColor) toSave.cardColor = patch.cardColor;
      const ok = Storage.updateCard(id, toSave);
      if (ok) {
        this.state.allCards = Storage.getCards();
        this.refresh();
        Utils.toast('已更新 ✓', 'success');
      }
      return ok;
    },

    /**
     * 删除卡片（带动画）
     */
    deleteCard(id) {
      const el = document.querySelector(
        '.card[data-card-id="' + id + '"]'
      );
      const doRemove = () => {
        const ok = Storage.deleteCard(id);
        if (ok) {
          this.state.allCards = Storage.getCards();
          this.refresh();
          Utils.toast('已删除', 'info');
        }
      };
      if (el) {
        el.classList.remove('card-enter');
        el.classList.add('card-leave');
        setTimeout(doRemove, 330);
      } else {
        doRemove();
      }
    },

    /**
     * 外部强制刷新（如导入数据后）
     */
    reloadAll() {
      this.state.allCards = Storage.getCards();
      this.refresh();
    },
  };

  global.CardsManager = CardsManager;
})(window);
