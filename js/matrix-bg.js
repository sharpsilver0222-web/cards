/**
 * Canvas 数字雨背景动画
 * - 颜色跟随 CSS 变量 --color-accent
 * - 透明度 ≤ 15%，并叠加遮罩层保证文字可读性
 * - 支持响应式 resize
 */
(function (global) {
  'use strict';

  const MatrixBG = {
    canvas: null,
    ctx: null,
    drops: [],
    columns: 0,
    fontSize: 16,
    running: false,
    rafId: null,
    chars: '01010100110101011100101001101001011100011010100111アイウエオカABCDEF#%@*',
    lastTime: 0,
    frameInterval: 1000 / 22, // 22 FPS，稍微放慢更有节奏感

    init() {
      if (this.canvas) return;
      this.canvas = document.getElementById('matrix-bg');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'matrix-bg';
        this.canvas.style.cssText =
          'position:fixed;inset:0;width:100%;height:100%;z-index:0;display:block;pointer-events:none;';
        document.body.insertBefore(this.canvas, document.body.firstChild);
      }
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener(
        'resize',
        Utils.debounce(() => this.resize(), 200)
      );
      this.start();
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.columns = Math.ceil(w / this.fontSize) + 2;
      this.drops = new Array(this.columns).fill(0).map(() => {
        // 30% 概率短尾（稀疏），70% 正常长度
        const isShort = Math.random() < 0.3;
        return {
          y: Math.random() * -h,
          speed: 0.5 + Math.random() * 0.9, // 0.5~1.4 倍速，网格步进
          chars: isShort ? this._genShortChars() : this._genColumnChars(),
        };
      });
    },

    _genColumnChars() {
      // 正常尾迹：20~55 个字符
      const len = 20 + Math.floor(Math.random() * 35);
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(this.chars[Math.floor(Math.random() * this.chars.length)]);
      }
      return arr;
    },

    _genShortChars() {
      // 短尾迹：6~14 个字符，营造稀疏感
      const len = 6 + Math.floor(Math.random() * 8);
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(this.chars[Math.floor(Math.random() * this.chars.length)]);
      }
      return arr;
    },

    _getAccentColor() {
      const style = getComputedStyle(document.documentElement);
      let c = style.getPropertyValue('--color-accent').trim();
      if (!c) c = '#00ff41';
      if (c.startsWith('#')) {
        const hex = c.length === 4
          ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
          : c.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b, format: 'rgb' };
      }
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        return { r: parts[0], g: parts[1], b: parts[2], format: 'rgb' };
      }
      return { r: 0, g: 255, b: 65, format: 'rgb' };
    },

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        if (now - this.lastTime >= this.frameInterval) {
          this._draw();
          this.lastTime = now;
        }
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    },

    stop() {
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
    },

    _draw() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { r, g, b } = this._getAccentColor();

      // 拖尾效果：每帧覆盖 12%，旧字符快速消失，避免同一列字符糊在一起
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      this.ctx.fillRect(0, 0, w, h);

      this.ctx.font = this.fontSize + "px 'Courier New', monospace";
      this.ctx.textBaseline = 'top';

      for (let i = 0; i < this.columns; i++) {
        const col = this.drops[i];
        const x = i * this.fontSize;

        // 绘制整列：j=0 是头部（最下方那颗，亮白），j 越大越往上方，透明度指数衰减
        const total = col.chars.length;
        for (let j = 0; j < total; j++) {
          // 网格对齐：cy 永远是 fontSize 的整数倍，字符之间不重叠
          const cy = Math.round(col.y / this.fontSize) * this.fontSize - j * this.fontSize;
          if (cy < -this.fontSize || cy > h + this.fontSize) continue;

          // 亮头 → 长尾，衰减快一些让列与列之间有疏密变化
          const alpha = 0.85 * Math.pow(0.80, j);
          if (alpha < 0.02) continue;

          // 颜色：头部（j<=2）往白色混，越往上越纯主题色
          let cr = r, cg = g, cb = b;
          if (j <= 2) {
            const mix = j === 0 ? 0.75 : (j === 1 ? 0.4 : 0.15);
            cr = Math.round(r + (255 - r) * mix);
            cg = Math.round(g + (255 - g) * mix);
            cb = Math.round(b + (255 - b) * mix);
          }

          this.ctx.fillStyle =
            'rgba(' + cr + ',' + cg + ',' + cb + ',' + alpha.toFixed(3) + ')';
          this.ctx.fillText(col.chars[j], x, cy);
        }

        // 移动：每次移动 1 个 fontSize（网格步进），字符不会在相邻帧重叠
        col.y += this.fontSize * col.speed;

        // 头部超出屏幕底部 → 整列重置到屏幕顶上方
        if (col.y - total * this.fontSize > h + 50) {
          col.y = -Math.random() * h * 0.4 - this.fontSize * 15;
          // 重置时随机决定长短尾
          col.chars = Math.random() < 0.3 ? this._genShortChars() : this._genColumnChars();
          col.speed = 0.5 + Math.random() * 0.9;
        }

        // 小概率随机替换字符（不换头部，保持亮头稳定）
        if (Math.random() < 0.012) {
          const idx = 1 + Math.floor(Math.random() * (total - 1));
          col.chars[idx] =
            this.chars[Math.floor(Math.random() * this.chars.length)];
        }
      }
    },
  };

  global.MatrixBG = MatrixBG;
})(window);
