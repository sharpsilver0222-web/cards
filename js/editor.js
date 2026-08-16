/**
 * editor.js - 编辑弹窗 / 删除确认 / 导入预览
 */
(function (global) {
  'use strict';

  // 卡片 6 种配色预设定义（对应 themes.css）
  const CARD_COLORS = [
    { key: 'theme_default', label: '跟随主题', swatchBg: 'var(--color-surface)' },
    { key: 'pure_black', label: '纯黑', swatchBg: 'rgba(0,0,0,0.75)' },
    { key: 'dark_gray', label: '深灰', swatchBg: 'rgba(40,40,42,0.75)' },
    { key: 'matrix_green', label: '矩阵绿', swatchBg: 'rgba(0,28,10,0.78)' },
    { key: 'deep_indigo', label: '深靛蓝', swatchBg: 'rgba(12,20,50,0.8)' },
    { key: 'dark_wine', label: '暗酒红', swatchBg: 'rgba(48,12,22,0.8)' },
  ];

  const Editor = {
    /* ============================================================
     * 通用：创建/关闭模态
     * ============================================================ */
    _openMask(panel, maskClass) {
      const mask = Utils.$el('div', {
        class: 'modal-mask' + (maskClass ? ' ' + maskClass : ''),
        onclick: (e) => {
          // 点击蒙层空白处关闭
          if (e.target === mask) this._close(mask);
        },
      });
      mask.appendChild(panel);
      document.body.appendChild(mask);
      // ESC 关闭
      const escHandler = (ev) => {
        if (ev.key === 'Escape') {
          this._close(mask);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
      mask._escHandler = escHandler;
      return mask;
    },

    _close(mask) {
      if (!mask || !mask.parentNode) return;
      if (mask._escHandler)
        document.removeEventListener('keydown', mask._escHandler);
      // 淡出
      mask.style.transition = 'opacity 0.2s';
      mask.style.opacity = '0';
      const panel = mask.querySelector('.modal-panel');
      if (panel) {
        panel.style.transition =
          'transform 0.2s, opacity 0.2s';
        panel.style.opacity = '0';
        panel.style.transform = 'scale(0.95)';
      }
      setTimeout(() => {
        if (mask.parentNode) mask.parentNode.removeChild(mask);
      }, 200);
    },

    /* ============================================================
     * 编辑弹窗：新建 / 编辑
     * ============================================================ */
    openNew() {
      this._renderEditModal(null);
    },

    openEdit(id) {
      const card = Storage.getCard(id);
      if (!card) {
        Utils.toast('卡片不存在或已删除', 'error');
        return;
      }
      this._renderEditModal(card);
    },

    /* ============================================================
     * 查看弹窗：只读展示 + 入口按钮
     * ============================================================ */
    openView(id) {
      const card = Storage.getCard(id);
      if (!card) {
        Utils.toast('卡片不存在或已删除', 'error');
        return;
      }

      const closeBtn = Utils.$el(
        'button',
        { class: 'modal-close', title: '关闭 (Esc)', 'aria-label': '关闭' },
        '×'
      );

      /* ---------- Header ---------- */
      const header = Utils.$el('div', { class: 'modal-header' }, [
        Utils.$el('h3', { class: 'modal-title' }, [
          '👁️',
          Utils.$el('span', { class: 'modal-title-accent' }, ' 查看灵感'),
        ]),
        closeBtn,
      ]);

      /* ---------- Body ---------- */
      const titleEl = Utils.$el('h2', { class: 'view-title' },
        card.title ? Utils.escapeHtml(card.title) : '（无标题）'
      );
      const metaEl = Utils.$el('div', { class: 'view-meta' }, [
        Utils.$el('div', { class: 'view-meta-time' }, [
          Utils.$el('span', {}, '📅 创建：' + Utils.formatTime(card.createdAt)),
          Utils.$el('span', {}, '✏️ 修改：' + Utils.formatTime(card.updatedAt)),
        ]),
        card.cardColor && card.cardColor !== 'theme_default'
          ? Utils.$el('span', {}, '🎨 配色：' +
              (CARD_COLORS.find(c => c.key === card.cardColor)?.label || ''))
          : null,
      ]);
      const contentEl = Utils.$el('pre', { class: 'view-content' },
        Utils.escapeHtml(card.content || '')
      );
      let tagsEl;
      if (card.tags && card.tags.length) {
        tagsEl = Utils.$el('div', { class: 'view-tags' });
        card.tags.forEach(t => {
          tagsEl.appendChild(Utils.$el('span', { class: 'view-tag' },
            '#' + Utils.escapeHtml(t)
          ));
        });
      } else {
        tagsEl = Utils.$el('div', { class: 'view-tags' }, [
          Utils.$el('span', { class: 'view-tag-empty' }, '（无标签）'),
        ]);
      }
      const body = Utils.$el('div', { class: 'modal-body' }, [
        Utils.$el('div', { class: 'view-body' }, [
          titleEl,
          metaEl,
          contentEl,
          tagsEl,
        ]),
      ]);

      /* ---------- Footer ---------- */
      const footer = Utils.$el('div', { class: 'modal-footer' }, [
        Utils.$el(
          'button',
          {
            class: 'btn btn-danger',
            onclick: () => {
              this._close(mask);
              setTimeout(() => this.openDeleteConfirm(card.id), 180);
            },
          },
          '🗑 删除'
        ),
        Utils.$el(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => this._close(mask),
          },
          '关闭'
        ),
        Utils.$el(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            onclick: () => {
              this._close(mask);
              setTimeout(() => this.openEdit(card.id), 160);
            },
          },
          '✏️ 编辑'
        ),
      ]);

      const panel = Utils.$el('div', { class: 'modal-panel modal-md' }, [
        header, body, footer,
      ]);
      const mask = this._openMask(panel);
      closeBtn.onclick = () => this._close(mask);
    },

    _renderEditModal(card) {
      const isNew = !card;
      const data = card
        ? {
            id: card.id,
            title: card.title || '',
            content: card.content || '',
            tags: (card.tags || []).slice(),
            cardColor: card.cardColor || 'theme_default',
          }
        : {
            id: null,
            title: '',
            content: '',
            tags: [],
            cardColor: 'theme_default',
          };

      /* ---------- Header ---------- */
      const closeBtn = Utils.$el(
        'button',
        { class: 'modal-close', title: '关闭 (Esc)', 'aria-label': '关闭' },
        '×'
      );
      const header = Utils.$el('div', { class: 'modal-header' }, [
        Utils.$el('h3', { class: 'modal-title' }, [
          isNew ? '✨' : '📝',
          Utils.$el('span', { class: 'modal-title-accent' },
            isNew ? ' 新建灵感' : ' 编辑灵感'
          ),
        ]),
        closeBtn,
      ]);

      /* ---------- Body ---------- */
      // 标题
      const titleInput = Utils.$el('input', {
        class: 'form-input',
        type: 'text',
        placeholder: '灵感标题（可选）',
        maxlength: 200,
        value: data.title,
      });
      const titleRow = Utils.$el('div', { class: 'form-row' }, [
        Utils.$el('label', { class: 'form-label' }, '标题'),
        titleInput,
      ]);

      // 正文
      const contentInput = Utils.$el('textarea', {
        class: 'form-textarea',
        placeholder: '在这里写下你的灵感... 💡',
        rows: 8,
        maxlength: 10000,
      }, data.content);
      const contentRow = Utils.$el('div', { class: 'form-row' }, [
        Utils.$el('label', { class: 'form-label' }, [
          '内容',
          Utils.$el('span', { class: 'req' }, '*'),
        ]),
        contentInput,
      ]);

      // 标签输入
      const tagsEditor = this._buildTagsEditor(data.tags);
      const tagsRow = Utils.$el('div', { class: 'form-row' }, [
        Utils.$el('label', { class: 'form-label' }, '标签'),
        tagsEditor.wrap,
        Utils.$el('div', { class: 'tags-hint' },
          '按回车或逗号确认，多个标签可分别输入；点击标签 × 可删除'
        ),
      ]);

      // 卡片配色
      const colorPicker = this._buildColorPicker(data.cardColor);
      const colorRow = Utils.$el('div', { class: 'form-row' }, [
        Utils.$el('label', { class: 'form-label' }, '卡片配色'),
        colorPicker.wrap,
      ]);

      const body = Utils.$el('div', { class: 'modal-body' }, [
        titleRow,
        contentRow,
        tagsRow,
        colorRow,
      ]);

      /* ---------- Footer ---------- */
      const actions = [];
      if (!isNew) {
        actions.push(
          Utils.$el(
            'button',
            {
              class: 'btn btn-danger',
              onclick: () => {
                // 先关编辑弹窗，再开删除确认
                this._close(mask);
                setTimeout(() => this.openDeleteConfirm(data.id), 180);
              },
            },
            '🗑 删除'
          )
        );
      }
      actions.push(
        Utils.$el(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => this._close(mask),
          },
          '取消'
        ),
        Utils.$el(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            onclick: () => {
              const newVal = {
                title: titleInput.value,
                content: contentInput.value,
                tags: tagsEditor.getTags(),
                cardColor: colorPicker.getSelected(),
              };
              let ok = false;
              if (isNew) {
                ok = CardsManager.createCard(newVal);
              } else {
                ok = CardsManager.updateCard(data.id, newVal);
              }
              if (ok) this._close(mask);
            },
          },
          isNew ? '✓ 保存灵感' : '✓ 保存修改'
        )
      );
      const footer = Utils.$el('div', { class: 'modal-footer' }, actions);

      /* ---------- 组装 ---------- */
      const panel = Utils.$el('div', { class: 'modal-panel' }, [
        header,
        body,
        footer,
      ]);
      const mask = this._openMask(panel);
      closeBtn.onclick = () => this._close(mask);

      // 自动聚焦：内容输入框
      setTimeout(() => {
        contentInput.focus();
        // 光标移到末尾
        const len = contentInput.value.length;
        contentInput.setSelectionRange(len, len);
      }, 120);

      // Ctrl+Enter / Cmd+Enter 快捷保存
      contentInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          footer.querySelector('.btn-primary').click();
        }
      });
      titleInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          footer.querySelector('.btn-primary').click();
        }
      });
    },

    /* ---------- 标签编辑器 ---------- */
    _buildTagsEditor(initialTags) {
      const wrap = Utils.$el('div', { class: 'tags-editor' });
      const input = Utils.$el('input', {
        type: 'text',
        placeholder: '输入标签，按回车添加...',
        maxlength: 30,
      });

      const renderTagList = () => {
        // 移除旧标签（保留最后一个 input）
        Array.from(wrap.querySelectorAll('.tag-item')).forEach((el) =>
          el.remove()
        );
        const tags = this._currentTags;
        tags.forEach((t, i) => {
          const el = Utils.$el('span', { class: 'tag-item' }, [
            Utils.escapeHtml(t),
            Utils.$el('span', {
              class: 'tag-item-remove',
              title: '删除',
              onclick: () => {
                tags.splice(i, 1);
                renderTagList();
              },
            }, '×'),
          ]);
          wrap.insertBefore(el, input);
        });
      };

      this._currentTags = (initialTags || []).slice();
      // 先把 input 加入 wrap，否则 renderTagList 里的 insertBefore(el, input) 会报错
      wrap.appendChild(input);
      renderTagList();

      const addFromInput = () => {
        const v = input.value.trim();
        if (!v) return;
        // 支持逗号分隔一次输入多个
        v.split(/[,，]/).forEach((seg) => {
          const s = seg.trim();
          if (s && this._currentTags.indexOf(s) === -1) {
            this._currentTags.push(s);
          }
        });
        input.value = '';
        renderTagList();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
          e.preventDefault();
          addFromInput();
        } else if (e.key === 'Backspace' && !input.value && this._currentTags.length) {
          // 退格删除最后一个标签
          this._currentTags.pop();
          renderTagList();
        }
      });
      input.addEventListener('blur', addFromInput);

      return {
        wrap,
        getTags: () => this._currentTags.slice().filter(Boolean),
      };
    },

    /* ---------- 卡片配色选择 ---------- */
    _buildColorPicker(selectedKey) {
      const wrap = Utils.$el('div', { class: 'card-color-picker' });
      const options = [];
      CARD_COLORS.forEach((c) => {
        const el = Utils.$el('div', {
          class:
            'card-color-option' +
            (c.key === selectedKey ? ' selected' : ''),
          'data-key': c.key,
          onclick: () => {
            options.forEach((o) => o.classList.remove('selected'));
            el.classList.add('selected');
          },
        }, [
          Utils.$el('div', {
            class: 'card-color-swatch',
            style: { background: c.swatchBg },
          }),
          c.label,
        ]);
        options.push(el);
        wrap.appendChild(el);
      });
      return {
        wrap,
        getSelected: () => {
          const sel = wrap.querySelector('.card-color-option.selected');
          return sel ? sel.getAttribute('data-key') : 'theme_default';
        },
      };
    },

    /* ============================================================
     * 删除确认弹窗
     * ============================================================ */
    openDeleteConfirm(id) {
      const card = Storage.getCard(id);
      if (!card) {
        Utils.toast('卡片不存在或已删除', 'error');
        return;
      }
      const preview =
        (card.title ? card.title + '：' : '') +
        Utils.truncate(card.content || '', 50) || '(空内容)';

      const closeBtn = Utils.$el(
        'button',
        { class: 'modal-close', title: '关闭' },
        '×'
      );
      const panel = Utils.$el('div', { class: 'modal-panel modal-sm' }, [
        Utils.$el('div', { class: 'modal-header' }, [
          Utils.$el('h3', { class: 'modal-title' }, [
            '⚠️',
            Utils.$el('span', { style: { color: 'var(--color-danger)' } },
              ' 确认删除'
            ),
          ]),
          closeBtn,
        ]),
        Utils.$el('div', { class: 'modal-body' }, [
          Utils.$el('p', {
            style: {
              margin: '0 0 14px',
              color: 'var(--color-text)',
              fontSize: '14.5px',
            },
          }, '确定要删除这条灵感吗？此操作不可撤销。'),
          Utils.$el('div', {
            style: {
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-dim)',
              fontSize: '13px',
              lineHeight: '1.55',
            },
          }, Utils.escapeHtml(preview)),
        ]),
        Utils.$el('div', { class: 'modal-footer' }, [
          Utils.$el(
            'button',
            {
              class: 'btn',
              onclick: () => this._close(mask),
            },
            '取消'
          ),
          Utils.$el(
            'button',
            {
              class: 'btn btn-danger',
              onclick: () => {
                CardsManager.deleteCard(id);
                this._close(mask);
              },
            },
            '确认删除'
          ),
        ]),
      ]);
      const mask = this._openMask(panel);
      closeBtn.onclick = () => this._close(mask);
    },

    /* ============================================================
     * 导入预览弹窗
     * ============================================================ */
    openImportPicker() {
      const input = document.getElementById('import-file-input');
      if (input) input.click();
    },

    /**
     * 用户选择文件后，解析并打开预览弹窗
     */
    async handleImportFile(file) {
      Utils.showLoading('正在解析备份文件...');
      try {
        const result = await Storage.parseImportFile(file);
        Utils.hideLoading();
        this._openImportPreview(result);
      } catch (err) {
        Utils.hideLoading();
        Utils.toast(err.message || '导入失败', 'error', 3500);
      }
    },

    _openImportPreview({ summary, data }) {
      let mode = 'overwrite'; // 默认覆盖

      const closeBtn = Utils.$el(
        'button',
        { class: 'modal-close', title: '关闭' },
        '×'
      );

      const summaryEl = Utils.$el('div', { class: 'import-summary' }, [
        Utils.$el('div', { class: 'import-summary-row' }, [
          Utils.$el('span', { class: 'import-summary-label' }, '文件名称'),
          Utils.$el('span', { class: 'import-summary-value' },
            Utils.escapeHtml(summary.fileName)
          ),
        ]),
        Utils.$el('div', { class: 'import-summary-row' }, [
          Utils.$el('span', { class: 'import-summary-label' }, '数据版本'),
          Utils.$el('span', { class: 'import-summary-value' },
            Utils.escapeHtml(summary.version)
          ),
        ]),
        Utils.$el('div', { class: 'import-summary-row' }, [
          Utils.$el('span', { class: 'import-summary-label' }, '灵感卡片数'),
          Utils.$el('span', { class: 'import-summary-value' },
            summary.cardCount + ' 条'
          ),
        ]),
        Utils.$el('div', { class: 'import-summary-row' }, [
          Utils.$el('span', { class: 'import-summary-label' }, '包含配置'),
          Utils.$el('span', { class: 'import-summary-value' },
            summary.hasConfig ? '✓ 是' : '— 否'
          ),
        ]),
      ]);

      const optOverwrite = Utils.$el('div', {
        class: 'import-mode-option selected',
        onclick: () => {
          mode = 'overwrite';
          optOverwrite.classList.add('selected');
          optMerge.classList.remove('selected');
        },
      }, [
        Utils.$el('div', { class: 'import-mode-title' },
          '🗂 覆盖模式（推荐用于恢复备份）'
        ),
        Utils.$el('div', { class: 'import-mode-desc' },
          '清空当前所有数据，完全替换为导入的内容，包括配置与卡片。'
        ),
      ]);
      const optMerge = Utils.$el('div', {
        class: 'import-mode-option',
        onclick: () => {
          mode = 'merge';
          optMerge.classList.add('selected');
          optOverwrite.classList.remove('selected');
        },
      }, [
        Utils.$el('div', { class: 'import-mode-title' },
          '➕ 合并模式（推荐用于多设备同步）'
        ),
        Utils.$el('div', { class: 'import-mode-desc' },
          '按卡片 ID 去重，导入中新的卡片追加到现有数据中，已存在的不覆盖。'
        ),
      ]);

      const body = Utils.$el('div', { class: 'modal-body' }, [
        Utils.$el('div', {
          style: {
            margin: '0 0 12px',
            fontWeight: '600',
            color: 'var(--color-text)',
            fontSize: '14.5px',
          },
        }, '📋 导入预览'),
        summaryEl,
        Utils.$el('div', {
          style: {
            margin: '16px 0 8px',
            fontWeight: '600',
            color: 'var(--color-text)',
            fontSize: '14.5px',
          },
        }, '⚙️ 选择导入方式'),
        Utils.$el('div', { class: 'import-mode-group' }, [
          optOverwrite,
          optMerge,
        ]),
        Utils.$el('div', {
          style: {
            marginTop: '14px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            lineHeight: '1.6',
          },
        }, '⚠️ 提示：覆盖模式会删除当前所有灵感，建议操作前先导出一份备份。'),
      ]);

      const footer = Utils.$el('div', { class: 'modal-footer' }, [
        Utils.$el(
          'button',
          { class: 'btn', onclick: () => this._close(mask) },
          '取消'
        ),
        Utils.$el(
          'button',
          {
            class: 'btn btn-primary',
            onclick: () => {
              const ok = Storage.executeImport(mode, data);
              if (ok) {
                CardsManager.reloadAll();
                // 若导入了配置，也重新加载主题/字体
                if (data.config) {
                  const cfg = Storage.getConfig();
                  ThemeManager.applyTheme(cfg.theme);
                  ThemeManager.applyFont(cfg.fontFamily);
                }
                this._close(mask);
              }
            },
          },
          '开始导入'
        ),
      ]);

      const panel = Utils.$el('div', { class: 'modal-panel modal-md' }, [
        Utils.$el('div', { class: 'modal-header' }, [
          Utils.$el('h3', { class: 'modal-title' }, [
            '📥',
            Utils.$el('span', { class: 'modal-title-accent' },
              ' 导入灵感备份'
            ),
          ]),
          closeBtn,
        ]),
        body,
        footer,
      ]);
      const mask = this._openMask(panel);
      closeBtn.onclick = () => this._close(mask);
    },
  };

  global.Editor = Editor;
})(window);
