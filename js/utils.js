/**
 * 工具函数库
 * 提供 UUID、时间格式化、防抖节流、Toast、DOM 辅助等通用方法
 */
(function (global) {
  'use strict';

  const Utils = {};

  /**
   * 生成 UUID v4 风格的唯一 ID
   * @returns {string}
   */
  Utils.uuid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  /**
   * 格式化时间戳为 YYYY-MM-DD HH:mm
   * @param {number} ts 毫秒级时间戳
   * @returns {string}
   */
  Utils.formatTime = function (ts) {
    const d = new Date(ts);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  };

  /**
   * 从时间戳生成相对时间（如 "3分钟前"）
   * @param {number} ts
   * @returns {string}
   */
  Utils.relativeTime = function (ts) {
    const diff = Date.now() - ts;
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    if (diff < min) return '刚刚';
    if (diff < hour) return Math.floor(diff / min) + '分钟前';
    if (diff < day) return Math.floor(diff / hour) + '小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + '天前';
    return Utils.formatTime(ts).slice(0, 10);
  };

  /**
   * 防抖函数
   * @param {Function} fn
   * @param {number} delay ms
   */
  Utils.debounce = function (fn, delay) {
    let timer = null;
    return function () {
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), delay);
    };
  };

  /**
   * 节流函数
   * @param {Function} fn
   * @param {number} interval ms
   */
  Utils.throttle = function (fn, interval) {
    let last = 0;
    return function () {
      const now = Date.now();
      if (now - last >= interval) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  };

  /**
   * HTML 转义，防止 XSS
   * @param {string} str
   * @returns {string}
   */
  Utils.escapeHtml = function (str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /**
   * 截取字符串，超出加省略号
   * @param {string} str
   * @param {number} maxLen
   */
  Utils.truncate = function (str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '…';
  };

  /**
   * 数组去重
   * @param {Array} arr
   */
  Utils.unique = function (arr) {
    return Array.from(new Set(arr));
  };

  /**
   * 显示 Toast 提示（右上角浮层）
   * @param {string} msg 提示内容
   * @param {'success'|'error'|'info'} [type] 类型
   * @param {number} [duration] 毫秒
   */
  Utils.toast = function (msg, type, duration) {
    type = type || 'info';
    duration = duration || 2000;

    let wrap = document.getElementById('toast-container');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-container';
      wrap.style.cssText =
        'position:fixed;top:80px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(wrap);
    }

    const el = document.createElement('div');
    const colors = {
      success: 'var(--color-accent)',
      error: '#ff5555',
      info: 'var(--color-text)',
    };
    const borderColor = colors[type] || colors.info;
    el.className = 'toast-item';
    el.style.cssText =
      'padding:10px 18px;background:rgba(0,0,0,0.85);color:var(--color-text);' +
      'border-left:3px solid ' +
      borderColor +
      ';border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.5);' +
      'font-size:14px;font-family:var(--font-family);opacity:0;transform:translateX(20px);' +
      'transition:all 0.3s ease;min-width:160px;';
    el.textContent = msg;
    wrap.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, duration);
  };

  /**
   * 显示全局 Loading 遮罩
   * @param {string} [text]
   */
  Utils.showLoading = function (text) {
    let mask = document.getElementById('global-loading');
    if (mask) {
      mask.querySelector('.loading-text').textContent = text || '加载中...';
      mask.style.display = 'flex';
      return;
    }
    mask = document.createElement('div');
    mask.id = 'global-loading';
    mask.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;' +
      'flex-direction:column;z-index:99998;color:var(--color-accent);font-family:var(--font-family);gap:16px;';
    mask.innerHTML =
      '<div class="loading-spinner" style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);' +
      'border-top-color:var(--color-accent);border-radius:50%;animation:utils-spin 0.8s linear infinite;"></div>' +
      '<div class="loading-text" style="font-size:14px;">' +
      (text || '加载中...') +
      '</div>';
    document.body.appendChild(mask);

    if (!document.getElementById('utils-spin-style')) {
      const s = document.createElement('style');
      s.id = 'utils-spin-style';
      s.textContent =
        '@keyframes utils-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(s);
    }
  };

  Utils.hideLoading = function () {
    const mask = document.getElementById('global-loading');
    if (mask) mask.style.display = 'none';
  };

  /**
   * 简易 DOM 创建：$el('div', { class: 'a', onclick: fn }, 'text')
   * @param {string} tag
   * @param {Object} [props]
   * @param {string|Node|Array} [children]
   */
  Utils.$el = function (tag, props, children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object')
          Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function')
          el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v !== false && v != null) el.setAttribute(k, v);
      }
    }
    const appendChild = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(appendChild);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    };
    if (children != null) appendChild(children);
    return el;
  };

  global.Utils = Utils;
})(window);
