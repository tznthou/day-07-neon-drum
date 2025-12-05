/**
 * Neon Motion Drum - 動態偵測引擎
 * 使用像素亮度差異偵測動作，不依賴 AI/ML 庫
 */

export class MotionDetector {
  constructor(options = {}) {
    // 偵測用的低解析度 (效能優化)
    this.width = options.width || 64;
    this.height = options.height || 48;

    // 格子配置
    this.cols = options.cols || 3;
    this.rows = options.rows || 3;
    this.cellCount = this.cols * this.rows;

    // 偵測參數
    this.threshold = options.threshold || 20;      // 亮度變化閾值 (0-255)
    this.cooldownMs = options.cooldownMs || 250;   // 冷卻時間 (ms)

    // 狀態追蹤
    this.previousBrightness = new Array(this.cellCount).fill(0);
    this.cooldowns = new Array(this.cellCount).fill(0);

    // Canvas 用於像素運算
    this.canvas = null;
    this.ctx = null;

    // Video 元素參考
    this.video = null;

    // Debug 模式
    this.debugCanvas = null;
    this.debugCtx = null;
  }

  /**
   * 初始化偵測器
   */
  init(video, debugCanvas = null) {
    this.video = video;

    // 建立偵測用 canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Debug canvas (可選)
    if (debugCanvas) {
      this.debugCanvas = debugCanvas;
      this.debugCanvas.width = this.width;
      this.debugCanvas.height = this.height;
      this.debugCtx = debugCanvas.getContext('2d');
    }

    return this;
  }

  /**
   * 執行一次偵測，回傳觸發的格子索引陣列
   */
  detect() {
    if (!this.video || !this.ctx) return [];
    // 使用常數檢查，確保 video 已有足夠資料可繪製
    if (this.video.readyState < this.video.HAVE_CURRENT_DATA) return [];

    const now = Date.now();
    const triggered = [];

    // 1. 繪製到小 canvas (水平翻轉)
    // 使用 try-catch 保護，某些瀏覽器 (Safari) 可能拋出 InvalidStateError
    let imageData;
    try {
      this.ctx.save();
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.video, -this.width, 0, this.width, this.height);
      this.ctx.restore();

      // 2. 取得像素資料
      imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    } catch (error) {
      // video 尚未準備好或被中斷，靜默跳過這一幀
      this.ctx.restore();
      return [];
    }

    // 3. 計算各區域亮度並比對
    for (let i = 0; i < this.cellCount; i++) {
      const brightness = this.getRegionBrightness(imageData, i);
      const diff = Math.abs(brightness - this.previousBrightness[i]);

      // 檢查是否超過閾值且不在冷卻中
      if (diff > this.threshold && now > this.cooldowns[i]) {
        triggered.push(i);
        this.cooldowns[i] = now + this.cooldownMs;
      }

      this.previousBrightness[i] = brightness;
    }

    // 4. Debug 繪製
    if (this.debugCtx) {
      this.drawDebug(imageData, triggered);
    }

    return triggered;
  }

  /**
   * 計算指定格子區域的平均亮度
   */
  getRegionBrightness(imageData, cellIndex) {
    const col = cellIndex % this.cols;
    const row = Math.floor(cellIndex / this.cols);

    const cellW = Math.floor(this.width / this.cols);
    const cellH = Math.floor(this.height / this.rows);

    const startX = col * cellW;
    const startY = row * cellH;

    let totalBrightness = 0;
    let pixelCount = 0;

    const data = imageData.data;
    const width = imageData.width;

    // 取樣區域內的像素
    for (let y = startY; y < startY + cellH; y++) {
      for (let x = startX; x < startX + cellW; x++) {
        const idx = (y * width + x) * 4;

        // 計算亮度: (R + G + B) / 3
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        totalBrightness += brightness;
        pixelCount++;
      }
    }

    return pixelCount > 0 ? totalBrightness / pixelCount : 0;
  }

  /**
   * 繪製 Debug 視覺化
   */
  drawDebug(imageData, triggered) {
    // 先繪製原始影像
    this.debugCtx.putImageData(imageData, 0, 0);

    const cellW = this.width / this.cols;
    const cellH = this.height / this.rows;

    // 繪製格線和觸發狀態
    for (let i = 0; i < this.cellCount; i++) {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = col * cellW;
      const y = row * cellH;

      // 格線
      this.debugCtx.strokeStyle = 'rgba(0, 255, 245, 0.5)';
      this.debugCtx.lineWidth = 1;
      this.debugCtx.strokeRect(x, y, cellW, cellH);

      // 觸發標記
      if (triggered.includes(i)) {
        this.debugCtx.fillStyle = 'rgba(255, 0, 255, 0.5)';
        this.debugCtx.fillRect(x, y, cellW, cellH);
      }

      // 亮度數值
      this.debugCtx.fillStyle = 'white';
      this.debugCtx.font = '8px monospace';
      this.debugCtx.fillText(
        Math.round(this.previousBrightness[i]).toString(),
        x + 2,
        y + 10
      );
    }
  }

  /**
   * 設定靈敏度 (閾值)
   */
  setThreshold(value) {
    this.threshold = Math.max(1, Math.min(100, value));
  }

  /**
   * 設定冷卻時間
   */
  setCooldown(ms) {
    this.cooldownMs = Math.max(50, Math.min(1000, ms));
  }

  /**
   * 取得當前參數
   */
  getParams() {
    return {
      threshold: this.threshold,
      cooldownMs: this.cooldownMs,
      width: this.width,
      height: this.height,
      cols: this.cols,
      rows: this.rows
    };
  }

  /**
   * 重置偵測器狀態
   */
  reset() {
    this.previousBrightness.fill(0);
    this.cooldowns.fill(0);
  }
}
