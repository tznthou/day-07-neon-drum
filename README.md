# Day 07 - Neon Motion Drum 霓虹動態鼓機

> [← 回到 Muripo HQ](https://tznthou.github.io/muripo-hq/)

用 Webcam 偵測手部動作，揮手觸發霓虹鼓聲！

## Demo

[Live Demo](https://tznthou.github.io/day-07-neon-drum/)

## 功能

- **動態偵測** - 純像素差異演算法，不需要 AI/ML 庫
- **9 種音效** - Web Audio API 合成電子鼓聲
- **視覺回饋** - 觸發時霓虹閃光動畫
- **零延遲** - 即時偵測，揮手馬上有聲音

## 流程

```mermaid
flowchart LR
    A[Webcam 畫面] --> B[縮小成 64×48]
    B --> C[計算 9 格亮度]
    C --> D{與上一幀比較}
    D -->|差異 > 閾值| E[觸發音效 + 閃光]
    D -->|差異 < 閾值| F[等待下一幀]
    E --> F
    F --> A
```

## 快速開始

```bash
# 本地開發 (需要 localhost 才能使用攝影機)
npx serve .
```

## 使用方式

1. 開啟網頁，點擊「START」授權攝影機
2. 站在鏡頭前，揮手或擊打空氣
3. 手部經過的格子會觸發對應音效

## 鼓墊配置

```
┌─────┬─────┬─────┐
│ HH  │ SNR │ CYM │   HH = Hi-hat (腳踏鈸)
├─────┼─────┼─────┤   SNR = Snare (小鼓)
│ TM1 │ KCK │ TM2 │   CYM = Crash (碎音鈸)
├─────┼─────┼─────┤   TM = Tom (通鼓)
│ CLP │ RID │ SYN │   KCK = Kick (大鼓)
└─────┴─────┴─────┘   CLP = Clap (拍手)
                      RID = Ride (Ride鈸)
                      SYN = Synth (合成器)
```

## 控制選項

| 選項 | 說明 |
|------|------|
| 靈敏度 | 調整觸發門檻 (5-50)，數值越低越靈敏 |
| 冷卻 | 同一格子的觸發間隔 (100-500ms) |
| Debug | 顯示偵測視覺化，查看亮度變化 |

## 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `1-9` | 手動觸發對應格子 |

## 技術棧

```mermaid
graph TD
    A[HTML] --> E[Neon Motion Drum]
    B[CSS] --> E
    C[motion.js<br>動態偵測] --> E
    D[audio.js<br>Web Audio 合成] --> E
    E --> F[純前端<br>零依賴<br>無 AI/ML]
```

- **motion.js** - 像素亮度差異偵測，64×48 低解析度運算
- **audio.js** - Web Audio API 合成 9 種電子鼓聲
- **script.js** - 主控制器，整合攝影機、偵測、音效

## 瀏覽器支援

| 瀏覽器 | 支援 |
|--------|------|
| Chrome / Edge | ✅ 推薦 |
| Firefox | ✅ |
| Safari | ✅ iOS 14.3+ |

## License

[MIT](LICENSE)
