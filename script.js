/**
 * Neon Motion Drum - 主控制器
 * 整合 Webcam、動態偵測、音效播放、視覺回饋
 */

import { SynthDrums } from './audio.js';
import { MotionDetector } from './motion.js';

class NeonDrum {
  constructor() {
    // 模組實例
    this.drums = null;
    this.detector = null;

    // DOM 元素
    this.startScreen = document.getElementById('start-screen');
    this.startBtn = document.getElementById('start-btn');
    this.gameContainer = document.getElementById('game-container');
    this.video = document.getElementById('webcam');
    this.debugCanvas = document.getElementById('debug-canvas');
    this.cells = document.querySelectorAll('.cell');
    this.statusEl = document.getElementById('status');

    // 控制元素
    this.sensitivitySlider = document.getElementById('sensitivity');
    this.sensitivityValue = document.getElementById('sensitivity-value');
    this.cooldownSlider = document.getElementById('cooldown');
    this.cooldownValue = document.getElementById('cooldown-value');
    this.debugToggle = document.getElementById('debug-toggle');

    // 狀態
    this.isRunning = false;
    this.animationId = null;

    // 格子對應音效
    this.soundMap = [
      'hihat', 'snare', 'crash',
      'tom1', 'kick', 'tom2',
      'clap', 'ride', 'synth'
    ];

    this.bindEvents();
  }

  /**
   * 綁定事件
   */
  bindEvents() {
    // 開始按鈕
    this.startBtn.addEventListener('click', () => this.start());

    // 靈敏度滑桿
    this.sensitivitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.sensitivityValue.textContent = value;
      if (this.detector) {
        this.detector.setThreshold(value);
      }
    });

    // 冷卻時間滑桿
    this.cooldownSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.cooldownValue.textContent = value;
      if (this.detector) {
        this.detector.setCooldown(value);
      }
    });

    // Debug 切換
    this.debugToggle.addEventListener('click', () => {
      this.debugCanvas.classList.toggle('hidden');
      this.debugToggle.classList.toggle('active');
    });

    // 手動點擊格子也能觸發音效
    this.cells.forEach((cell, index) => {
      cell.addEventListener('click', () => {
        this.triggerCell(index);
      });
    });

    // 鍵盤快捷鍵 (數字鍵 1-9)
    document.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;

      const keyMap = {
        '1': 0, '2': 1, '3': 2,
        '4': 3, '5': 4, '6': 5,
        '7': 6, '8': 7, '9': 8
      };

      if (keyMap.hasOwnProperty(e.key)) {
        this.triggerCell(keyMap[e.key]);
      }
    });
  }

  /**
   * 開始遊戲
   */
  async start() {
    // 瀏覽器相容性檢查
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showStatus('你的瀏覽器不支援攝影機功能，請使用 Chrome/Firefox/Safari', true);
      return;
    }
    if (!window.AudioContext && !window.webkitAudioContext) {
      this.showStatus('你的瀏覽器不支援 Web Audio API', true);
      return;
    }

    try {
      this.showStatus('正在啟動...', false);

      // 1. 初始化音效系統
      this.drums = new SynthDrums();
      await this.drums.init();

      // 2. 請求攝影機權限
      this.showStatus('請求攝影機權限...', false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      // 3. 設定影片串流
      this.video.srcObject = stream;
      await this.video.play();

      // 4. 初始化動態偵測器
      this.detector = new MotionDetector({
        threshold: parseInt(this.sensitivitySlider.value),
        cooldownMs: parseInt(this.cooldownSlider.value)
      });
      this.detector.init(this.video, this.debugCanvas);

      // 5. 切換畫面
      this.startScreen.classList.add('hidden');
      this.gameContainer.classList.remove('hidden');

      // 6. 開始偵測迴圈
      this.isRunning = true;
      this.loop();

      this.showStatus('準備就緒！揮動你的手！', false);
      setTimeout(() => this.hideStatus(), 2000);

    } catch (error) {
      console.error('啟動失敗:', error);
      this.showStatus(this.getErrorMessage(error), true);

      // 清理已啟動的資源 (攝影機綠燈不會一直亮)
      if (this.video.srcObject) {
        this.video.srcObject.getTracks().forEach(track => track.stop());
        this.video.srcObject = null;
      }
      if (this.drums) {
        this.drums.dispose();
        this.drums = null;
      }
    }
  }

  /**
   * 主偵測迴圈
   */
  loop() {
    if (!this.isRunning) return;

    try {
      // 執行動態偵測
      const triggered = this.detector.detect();

      // 觸發對應格子
      triggered.forEach(index => {
        this.triggerCell(index);
      });
    } catch (error) {
      console.error('偵測迴圈錯誤:', error);
      // 錯誤不中斷迴圈，繼續執行下一幀
    }

    // 繼續下一幀
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  /**
   * 觸發指定格子
   */
  triggerCell(index) {
    const cell = this.cells[index];
    const soundName = this.soundMap[index];

    // 播放音效
    if (this.drums) {
      this.drums.play(soundName);
    }

    // 視覺回饋 - 使用 animationend 事件確保與 CSS 動畫同步
    cell.classList.add('triggered');
    cell.addEventListener('animationend', () => {
      cell.classList.remove('triggered');
    }, { once: true });
  }

  /**
   * 顯示狀態訊息
   */
  showStatus(message, isError = false) {
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle('error', isError);
    this.statusEl.classList.add('visible');
  }

  /**
   * 隱藏狀態訊息
   */
  hideStatus() {
    this.statusEl.classList.remove('visible');
  }

  /**
   * 取得友善的錯誤訊息
   */
  getErrorMessage(error) {
    if (error.name === 'NotAllowedError') {
      return '攝影機權限被拒絕，請允許使用攝影機';
    }
    if (error.name === 'NotFoundError') {
      return '找不到攝影機裝置';
    }
    if (error.name === 'NotReadableError') {
      return '攝影機被其他程式使用中';
    }
    return `發生錯誤: ${error.message}`;
  }

  /**
   * 停止遊戲
   */
  stop() {
    this.isRunning = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // 停止影片串流
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }

    // 清理音效系統
    if (this.drums) {
      this.drums.dispose();
      this.drums = null;
    }
  }
}

// 啟動應用程式
document.addEventListener('DOMContentLoaded', () => {
  window.neonDrum = new NeonDrum();
});
