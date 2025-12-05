# Day 07 - Neon Motion Drum 霓虹動態鼓機

## 核心概念
用 Webcam 偵測手部動作，揮手打空氣觸發鼓聲 + 霓虹視覺效果。
**不使用 AI 庫，純像素變化演算法**。

---

## 技術架構

### 圖層結構 (由下到上)
```
┌─────────────────────────────────────┐
│  Layer 3: 霓虹格線 UI (Grid Overlay) │  ← 觸發閃光效果
├─────────────────────────────────────┤
│  Layer 2: 隱藏 Canvas (Motion Calc)  │  ← 縮小版，做像素運算
├─────────────────────────────────────┤
│  Layer 1: Video 元素 (Webcam Feed)   │  ← 濾鏡處理後顯示
└─────────────────────────────────────┘
```

### 檔案結構
```
day-07-neon-drum/
├── index.html       # 主頁面
├── style.css        # 霓虹樣式
├── script.js        # 主邏輯
├── motion.js        # 動態偵測引擎
├── audio.js         # 音效管理
├── sounds/          # 鼓聲音效 (mp3/wav)
│   ├── kick.mp3
│   ├── snare.mp3
│   ├── hihat.mp3
│   ├── clap.mp3
│   ├── tom1.mp3
│   ├── tom2.mp3
│   ├── crash.mp3
│   ├── ride.mp3
│   └── synth.mp3
├── README.md
└── LICENSE
```

---

## 動態偵測演算法 (Motion Detection)

### 核心邏輯
```javascript
// 1. 取得低解析度畫面 (效能優化)
const DETECTION_WIDTH = 64;   // 運算用寬度
const DETECTION_HEIGHT = 48;  // 運算用高度
const GRID_COLS = 3;          // 3x3 格子
const GRID_ROWS = 3;

// 2. 計算每格的平均亮度
function getRegionBrightness(imageData, region) {
  // 取該區域所有像素的亮度平均值
  // 亮度 = (R + G + B) / 3
}

// 3. 比對前後幀差異
function detectMotion(currentFrame, previousFrame) {
  for (each grid cell) {
    const diff = Math.abs(currentBrightness - previousBrightness);
    if (diff > THRESHOLD) {
      triggerCell(cellIndex);
    }
  }
}

// 4. 冷卻機制防連擊
const COOLDOWN_MS = 250;
let lastTriggerTime = Array(9).fill(0);
```

### 關鍵參數
| 參數 | 建議值 | 說明 |
|------|--------|------|
| `THRESHOLD` | 15-25 | 亮度變化閾值 (0-255) |
| `COOLDOWN_MS` | 200-300 | 冷卻時間 (ms) |
| `DETECTION_FPS` | 30 | 偵測幀率 |
| `GRID_SIZE` | 3x3 | 格子數量 (8-9格最佳) |

---

## 視覺設計

### 配色方案 (Cyberpunk Neon)
```css
:root {
  --neon-cyan: #00fff5;
  --neon-pink: #ff00ff;
  --neon-yellow: #ffff00;
  --neon-green: #39ff14;
  --bg-dark: #0a0a0f;
  --grid-border: rgba(0, 255, 245, 0.3);
}
```

### 視覺效果
1. **Webcam 濾鏡**: `filter: grayscale(80%) contrast(1.3) brightness(0.7)`
2. **水平翻轉**: `transform: scaleX(-1)` (鏡像直覺)
3. **霓虹光暈**: `box-shadow: 0 0 20px var(--neon-cyan), inset 0 0 10px ...`
4. **觸發動畫**: 邊框亮度爆發 + 背景閃爍 + scale 微放大

### Grid 佈局 (3x3)
```
┌─────┬─────┬─────┐
│ HH  │ SNR │ CYM │   HH = Hi-hat
├─────┼─────┼─────┤   SNR = Snare
│ TM1 │ KCK │ TM2 │   CYM = Cymbal
├─────┼─────┼─────┤   TM = Tom
│ CLP │ RID │ SYN │   KCK = Kick
└─────┴─────┴─────┘   CLP = Clap
```

---

## 音效系統

### Web Audio API 架構
```javascript
class DrumMachine {
  constructor() {
    this.audioContext = new AudioContext();
    this.sounds = new Map();  // 預載音效緩衝
  }

  async loadSound(name, url) {
    const response = await fetch(url);
    const buffer = await this.audioContext.decodeAudioData(
      await response.arrayBuffer()
    );
    this.sounds.set(name, buffer);
  }

  play(name) {
    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds.get(name);
    source.connect(this.audioContext.destination);
    source.start(0);
  }
}
```

### 音效來源選項
1. **免費音效庫**:
   - https://freesound.org/ (需註冊)
   - https://samplefocus.com/
   - https://99sounds.org/

2. **Web Audio API 合成** (無需外部檔案):
   - 用 OscillatorNode 產生電子音
   - Kick: 低頻 sine wave + 衰減
   - Hi-hat: 白噪音 + 高通濾波
   - Snare: 噪音 + 短促正弦波

---

## 實作步驟

### Phase 1: 基礎架構
- [ ] 建立 HTML 結構 (video + canvas + grid)
- [ ] 寫好霓虹 CSS 樣式
- [ ] Webcam 權限請求 + 串流顯示

### Phase 2: 動態偵測核心
- [ ] 建立隱藏 canvas 做像素運算
- [ ] 實作幀差比對演算法
- [ ] 加入冷卻機制
- [ ] Debug 模式顯示偵測數據

### Phase 3: 音效整合
- [ ] Web Audio API 初始化
- [ ] 載入/合成鼓聲
- [ ] 綁定觸發事件

### Phase 4: 視覺回饋
- [ ] 觸發時格子閃光動畫
- [ ] 加入波紋擴散效果
- [ ] 調整靈敏度 UI

### Phase 5: 完善體驗
- [ ] 加入開始畫面 (需點擊啟動 AudioContext)
- [ ] 靈敏度調整滑桿
- [ ] 說明文字
- [ ] RWD 適配

---

## 已知挑戰與解法

| 挑戰 | 解法 |
|------|------|
| 光線變化誤觸發 | 調高 THRESHOLD 或加入「持續變化過濾」 |
| 背景物體移動 | 使用較小的偵測區域、忽略邊緣 |
| 延遲感 | 減少 canvas 解析度、requestAnimationFrame |
| iOS Safari 限制 | 需要 playsinline 屬性、用戶互動後才能播音 |
| AudioContext 被擋 | 強制用戶點擊 "Start" 按鈕再初始化 |

---

## 開始開發？

準備好就說一聲，我們來從 HTML/CSS 骨架開始！
