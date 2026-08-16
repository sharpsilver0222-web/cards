/**
 * storage.js - 本地存储（localStorage）读写 + 导入导出 JSON
 */
(function (global) {
  'use strict';

  // 支持测试文件通过 window.INSPIRE_KEY_CARDS / INSPIRE_KEY_CONFIG 注入独立命名空间，
  // 避免测试预置数据污染 index.html 的真实数据（同 origin 下 localStorage 共享）
  const KEY_CARDS = global.INSPIRE_KEY_CARDS || 'inspire_cards_v1';
  const KEY_CONFIG = global.INSPIRE_KEY_CONFIG || 'inspire_config_v1';
  const DATA_VERSION = '1.0';

  const DEFAULT_CONFIG = {
    theme: 'green',
    fontFamily: 'mono',
    sortBy: 'updatedAt_desc',
    cols: 'auto', // 布局列数：auto/1/2/3/4
    hasShownGuide: false,
  };

  const Storage = {
    /* ----------------- 配置读写 ----------------- */
    getConfig() {
      try {
        const raw = localStorage.getItem(KEY_CONFIG);
        if (!raw) return Object.assign({}, DEFAULT_CONFIG);
        const cfg = JSON.parse(raw);
        return Object.assign({}, DEFAULT_CONFIG, cfg);
      } catch (e) {
        console.warn('[Storage] 读取配置失败，使用默认值：', e);
        return Object.assign({}, DEFAULT_CONFIG);
      }
    },

    saveConfig(cfg) {
      try {
        const merged = Object.assign({}, this.getConfig(), cfg);
        localStorage.setItem(KEY_CONFIG, JSON.stringify(merged));
        return true;
      } catch (e) {
        console.error('[Storage] 保存配置失败：', e);
        Utils.toast('保存配置失败：存储空间不足', 'error');
        return false;
      }
    },

    /* ----------------- 卡片读写 ----------------- */
    getCards() {
      try {
        const raw = localStorage.getItem(KEY_CARDS);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        console.error('[Storage] 读取卡片失败：', e);
        Utils.toast('读取本地数据失败，可能已损坏', 'error');
        return [];
      }
    },

    saveCards(cards) {
      try {
        localStorage.setItem(KEY_CARDS, JSON.stringify(cards));
        return true;
      } catch (e) {
        console.error('[Storage] 保存卡片失败：', e);
        Utils.toast('保存失败：浏览器存储空间可能已满，请清理或导出备份', 'error');
        return false;
      }
    },

    /* ----------------- 单条卡片操作 ----------------- */
    addCard(card) {
      const cards = this.getCards();
      cards.unshift(card);
      return this.saveCards(cards);
    },

    updateCard(id, patch) {
      const cards = this.getCards();
      const idx = cards.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      cards[idx] = Object.assign({}, cards[idx], patch, {
        updatedAt: Date.now(),
      });
      return this.saveCards(cards);
    },

    deleteCard(id) {
      const cards = this.getCards().filter((c) => c.id !== id);
      return this.saveCards(cards);
    },

    getCard(id) {
      return this.getCards().find((c) => c.id === id) || null;
    },

    /* ----------------- 导出 ----------------- */
    exportData() {
      const data = {
        version: DATA_VERSION,
        exportedAt: Date.now(),
        config: this.getConfig(),
        cards: this.getCards(),
      };
      const json = JSON.stringify(data, null, 2);

      // 组装文件名
      const d = new Date();
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      const fname =
        '灵感备份_' +
        d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        '_' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds()) +
        '.json';

      // 使用 Blob + 下载链接触发浏览器下载
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      Utils.toast('已导出 ' + data.cards.length + ' 条灵感 ✓', 'success');
    },

    /* ----------------- 导入 ----------------- */
    /**
     * 解析导入的 JSON 文件，返回 Promise<{summary, data}>
     * @param {File} file
     */
    parseImportFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.name.toLowerCase().endsWith('.json')) {
          reject(new Error('请选择 .json 格式的备份文件'));
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') {
              throw new Error('JSON 格式无效');
            }
            const cards = Array.isArray(data.cards) ? data.cards : [];
            // 校验每条卡片基本字段
            const validCards = cards
              .filter((c) => c && typeof c === 'object' && c.id)
              .map((c) => ({
                id: String(c.id),
                title: String(c.title || ''),
                content: String(c.content || ''),
                tags: Array.isArray(c.tags)
                  ? c.tags.map((t) => String(t)).filter(Boolean)
                  : [],
                cardColor: c.cardColor || 'theme_default',
                createdAt: Number(c.createdAt) || Date.now(),
                updatedAt: Number(c.updatedAt) || Date.now(),
              }));
            const summary = {
              fileName: file.name,
              cardCount: validCards.length,
              hasConfig: !!data.config && typeof data.config === 'object',
              version: data.version || '(未标记版本)',
            };
            if (validCards.length === 0) {
              reject(new Error('文件中未找到有效的灵感卡片数据'));
              return;
            }
            resolve({
              summary,
              data: {
                config: data.config || null,
                cards: validCards,
              },
            });
          } catch (err) {
            reject(new Error('JSON 解析失败：' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file, 'utf-8');
      });
    },

    /**
     * 执行导入
     * @param {'overwrite'|'merge'} mode 覆盖 or 合并
     * @param {{config: Object, cards: Array}} importData
     */
    executeImport(mode, importData) {
      if (mode === 'overwrite') {
        // 覆盖模式：清空现有，用导入的替换
        if (importData.config) this.saveConfig(importData.config);
        return this.saveCards(importData.cards.slice());
      } else {
        // 合并模式：按 ID 去重追加
        const existing = this.getCards();
        const idMap = new Map(existing.map((c) => [c.id, c]));
        let added = 0;
        importData.cards.forEach((c) => {
          if (!idMap.has(c.id)) {
            idMap.set(c.id, c);
            added++;
          }
          // 已存在的保留现状不覆盖
        });
        if (importData.config) {
          // 合并模式下配置也合并（导入的配置仅补充缺失项）
          const current = this.getConfig();
          this.saveConfig(Object.assign({}, importData.config, current));
        }
        const allCards = Array.from(idMap.values());
        const ok = this.saveCards(allCards);
        if (ok) {
          Utils.toast(
            '导入完成：新增 ' + added + ' 条，跳过重复 ' +
              (importData.cards.length - added) + ' 条',
            'success',
            2800
          );
        }
        return ok;
      }
    },
  };

  global.Storage = Storage;
})(window);
