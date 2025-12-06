/**
 * Neon Motion Drum - 自動化診斷工具
 * 用於檢測「只有部分格子有反應」的問題
 *
 * 使用方式：
 * 1. 開啟遊戲並點擊 START
 * 2. 開啟瀏覽器開發者工具 (F12)
 * 3. 在 Console 中貼入此腳本並執行
 * 4. 在鏡頭前揮動手臂 5 秒
 * 5. 查看診斷報告
 */

(function() {
  console.log('🔍 Neon Drum 診斷工具啟動中...');

  // ============================================================
  // 1. 環境檢測
  // ============================================================
  const env = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    windowAspectRatio: (window.innerWidth / window.innerHeight).toFixed(3),
    pixelRatio: window.devicePixelRatio,
  };

  const video = document.getElementById('webcam');
  if (!video || !video.srcObject) {
    console.error('❌ 錯誤：攝影機尚未啟動，請先點擊 START');
    return;
  }

  env.videoWidth = video.videoWidth;
  env.videoHeight = video.videoHeight;
  env.videoAspectRatio = (video.videoWidth / video.videoHeight).toFixed(3);
  env.canvasAspectRatio = (64 / 48).toFixed(3) + ' (64x48 = 4:3)';

  // 關鍵檢測：object-fit: cover 的裁切問題
  env.aspectRatioMismatch = Math.abs(video.videoWidth / video.videoHeight - 64 / 48) > 0.1;

  console.log('📊 環境資訊:', env);

  // ============================================================
  // 1.5 比例不一致警告（關鍵問題檢測）
  // ============================================================
  if (env.aspectRatioMismatch) {
    console.warn('');
    console.warn('⚠️ ═══════════════════════════════════════════════════════');
    console.warn('⚠️  發現關鍵問題：VIDEO 比例與 CANVAS 比例不一致！');
    console.warn('⚠️ ═══════════════════════════════════════════════════════');
    console.warn(`   Video 實際比例: ${env.videoAspectRatio} (${video.videoWidth}x${video.videoHeight})`);
    console.warn(`   Canvas 偵測比例: ${env.canvasAspectRatio}`);
    console.warn('');
    console.warn('   這會導致：');
    console.warn('   - CSS object-fit: cover 裁切視覺畫面');
    console.warn('   - Canvas drawImage 拉伸偵測畫面');
    console.warn('   - 兩者座標系統不一致 → 格子位置錯亂！');
    console.warn('');
    console.warn('   這很可能就是「只有部分格子有反應」的原因！');
    console.warn('═══════════════════════════════════════════════════════════');
    console.warn('');
  }

  // ============================================================
  // 2. 取得 MotionDetector 實例
  // ============================================================
  const neonDrum = window.neonDrum;
  if (!neonDrum || !neonDrum.detector) {
    console.error('❌ 錯誤：MotionDetector 尚未初始化');
    return;
  }

  const detector = neonDrum.detector;
  const detectorParams = detector.getParams();
  console.log('⚙️ 偵測器參數:', detectorParams);

  // ============================================================
  // 3. 建立診斷用 Canvas
  // ============================================================
  const diagCanvas = document.createElement('canvas');
  diagCanvas.width = detector.width;
  diagCanvas.height = detector.height;
  const diagCtx = diagCanvas.getContext('2d', { willReadFrequently: true });

  // ============================================================
  // 4. 收集多幀資料
  // ============================================================
  const SAMPLE_FRAMES = 60;  // 收集 60 幀 (約 1 秒)
  const SAMPLE_INTERVAL = 100; // 每 100ms 取樣一次
  const cellStats = [];

  // 初始化每個格子的統計資料
  for (let i = 0; i < 9; i++) {
    cellStats.push({
      index: i,
      label: ['HH', 'SNR', 'CYM', 'TM1', 'KCK', 'TM2', 'CLP', 'RID', 'SYN'][i],
      brightnessHistory: [],
      diffHistory: [],
      triggerCount: 0,
    });
  }

  let frameCount = 0;
  let previousBrightness = new Array(9).fill(null);

  console.log(`⏳ 開始收集資料... (${SAMPLE_FRAMES} 幀，約 ${SAMPLE_FRAMES * SAMPLE_INTERVAL / 1000} 秒)`);
  console.log('👋 請在鏡頭前揮動手臂！');

  const sampleInterval = setInterval(() => {
    if (frameCount >= SAMPLE_FRAMES) {
      clearInterval(sampleInterval);
      analyzeAndReport();
      return;
    }

    try {
      // 繪製 video 到診斷 canvas (與 MotionDetector 相同邏輯)
      diagCtx.save();
      diagCtx.scale(-1, 1);
      diagCtx.drawImage(video, -detector.width, 0, detector.width, detector.height);
      diagCtx.restore();

      const imageData = diagCtx.getImageData(0, 0, detector.width, detector.height);

      // 分析每個格子
      for (let i = 0; i < 9; i++) {
        const stats = getRegionStats(imageData, i, detector);
        cellStats[i].brightnessHistory.push(stats.avgBrightness);

        if (previousBrightness[i] !== null) {
          const diff = Math.abs(stats.avgBrightness - previousBrightness[i]);
          cellStats[i].diffHistory.push(diff);

          if (diff > detector.threshold) {
            cellStats[i].triggerCount++;
          }
        }

        previousBrightness[i] = stats.avgBrightness;
      }

      frameCount++;

      // 進度指示
      if (frameCount % 10 === 0) {
        console.log(`📈 收集進度: ${frameCount}/${SAMPLE_FRAMES}`);
      }
    } catch (error) {
      console.error('取樣錯誤:', error);
    }
  }, SAMPLE_INTERVAL);

  // ============================================================
  // 5. 分析區域統計資料
  // ============================================================
  function getRegionStats(imageData, cellIndex, detector) {
    const col = cellIndex % 3;
    const row = Math.floor(cellIndex / 3);

    const cellW = Math.floor(detector.width / 3);
    const cellH = Math.floor(detector.height / 3);

    const startX = col * cellW;
    const startY = row * cellH;

    const data = imageData.data;
    const width = imageData.width;

    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    let blackPixelCount = 0;
    let pixelCount = 0;
    const brightnessValues = [];

    for (let y = startY; y < startY + cellH; y++) {
      for (let x = startX; x < startX + cellW; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;

        brightnessValues.push(brightness);
        totalBrightness += brightness;
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);

        if (brightness < 5) blackPixelCount++;
        pixelCount++;
      }
    }

    const avgBrightness = totalBrightness / pixelCount;

    // 計算標準差
    const variance = brightnessValues.reduce((sum, b) => sum + Math.pow(b - avgBrightness, 2), 0) / pixelCount;
    const stdDev = Math.sqrt(variance);

    return {
      avgBrightness,
      minBrightness,
      maxBrightness,
      stdDev,
      blackPixelRatio: blackPixelCount / pixelCount,
      pixelCount,
    };
  }

  // ============================================================
  // 6. 生成診斷報告
  // ============================================================
  function analyzeAndReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 NEON DRUM 診斷報告');
    console.log('='.repeat(60));

    // 計算每個格子的統計摘要
    const summaries = cellStats.map(cell => {
      const avgBrightness = cell.brightnessHistory.reduce((a, b) => a + b, 0) / cell.brightnessHistory.length;
      const avgDiff = cell.diffHistory.length > 0
        ? cell.diffHistory.reduce((a, b) => a + b, 0) / cell.diffHistory.length
        : 0;
      const maxDiff = cell.diffHistory.length > 0
        ? Math.max(...cell.diffHistory)
        : 0;

      // 計算亮度變化的標準差
      const variance = cell.brightnessHistory.reduce((sum, b) => sum + Math.pow(b - avgBrightness, 2), 0) / cell.brightnessHistory.length;
      const brightnessStdDev = Math.sqrt(variance);

      return {
        index: cell.index,
        label: cell.label,
        avgBrightness: avgBrightness.toFixed(1),
        brightnessStdDev: brightnessStdDev.toFixed(2),
        avgDiff: avgDiff.toFixed(2),
        maxDiff: maxDiff.toFixed(2),
        triggerCount: cell.triggerCount,
        status: 'unknown',
      };
    });

    // ============================================================
    // 7. 異常檢測
    // ============================================================
    const issues = [];

    summaries.forEach(s => {
      const problems = [];

      // 檢測 1: 亮度過低（可能是黑色區域）
      if (parseFloat(s.avgBrightness) < 10) {
        problems.push('亮度過低(可能是黑色區域)');
      }

      // 檢測 2: 亮度變化太小（區域沒有動態）
      if (parseFloat(s.brightnessStdDev) < 3 && s.triggerCount === 0) {
        problems.push('亮度變化極小(可能無影像資料)');
      }

      // 檢測 3: 最大差異值太小（永遠不會觸發）
      if (parseFloat(s.maxDiff) < detector.threshold * 0.5 && s.triggerCount === 0) {
        problems.push('差異值始終低於閾值');
      }

      // 檢測 4: 觸發次數為零
      if (s.triggerCount === 0 && parseFloat(s.maxDiff) > 5) {
        problems.push('有動態但未觸發(可能是冷卻問題)');
      }

      if (problems.length > 0) {
        s.status = '❌ 異常';
        issues.push({ cell: s.label, index: s.index, problems });
      } else if (s.triggerCount > 0) {
        s.status = '✅ 正常';
      } else {
        s.status = '⚠️ 待確認';
      }
    });

    // 繪製格子狀態圖
    console.log('\n📊 格子狀態圖:');
    console.log('┌────────┬────────┬────────┐');
    for (let row = 0; row < 3; row++) {
      const cells = summaries.slice(row * 3, row * 3 + 3);
      const line = cells.map(c => {
        const emoji = c.status.split(' ')[0];
        return ` ${emoji} ${c.label} `.padEnd(8);
      }).join('│');
      console.log(`│${line}│`);
      if (row < 2) {
        console.log('├────────┼────────┼────────┤');
      }
    }
    console.log('└────────┴────────┴────────┘');

    // 詳細數據表格
    console.log('\n📈 詳細數據:');
    console.table(summaries.map(s => ({
      '格子': s.label,
      '狀態': s.status,
      '平均亮度': s.avgBrightness,
      '亮度波動': s.brightnessStdDev,
      '平均差異': s.avgDiff,
      '最大差異': s.maxDiff,
      '觸發次數': s.triggerCount,
    })));

    // ============================================================
    // 8. 問題診斷
    // ============================================================
    if (issues.length > 0) {
      console.log('\n🚨 發現問題:');
      issues.forEach(issue => {
        console.log(`  [${issue.index}] ${issue.cell}: ${issue.problems.join(', ')}`);
      });

      // 分析問題模式
      const problemIndices = issues.map(i => i.index);

      // 模式 1: 右側區域問題 (2, 5, 8)
      const rightSideIssue = [2, 5, 8].every(i => problemIndices.includes(i));

      // 模式 2: 上方區域問題 (0, 1, 2)
      const topSideIssue = [0, 1, 2].every(i => problemIndices.includes(i));

      // 模式 3: 右上區域問題 (1, 2, 5)
      const topRightIssue = [1, 2, 5].every(i => problemIndices.includes(i));

      console.log('\n🔎 可能的原因:');

      if (rightSideIssue && topSideIssue) {
        console.log('  → 右側 + 上方區域異常');
        console.log('  → 可能原因: video 畫面沒有完全覆蓋偵測區域');
        console.log(`  → 實際 video 尺寸: ${env.videoWidth}x${env.videoHeight} (${env.videoAspectRatio})`);
        console.log(`  → 預期比例: ${env.expectedAspectRatio}`);
        if (env.videoAspectRatio !== '1.333') {
          console.log('  ⚠️ 攝影機比例非 4:3，可能導致影像偏移！');
        }
      } else if (rightSideIssue) {
        console.log('  → 右側區域異常: 可能是水平翻轉邏輯問題');
      } else if (topSideIssue) {
        console.log('  → 上方區域異常: 可能是 video 垂直對齊問題');
      } else if (topRightIssue) {
        console.log('  → 右上區域異常: 可能是 drawImage 座標偏移');
      } else {
        console.log('  → 問題分佈不規則，可能是：');
        console.log('    - 瀏覽器相容性問題');
        console.log('    - imageData 取得異常');
        console.log('    - 使用者沒有在這些區域揮動');
      }

      // 檢查 video 比例問題
      const actualRatio = video.videoWidth / video.videoHeight;
      if (Math.abs(actualRatio - 4/3) > 0.1) {
        console.log('\n⚠️ 警告: 攝影機比例不是 4:3');
        console.log(`  實際比例: ${actualRatio.toFixed(3)} (${video.videoWidth}x${video.videoHeight})`);
        console.log('  這可能導致 drawImage 時影像被拉伸或裁切');
        console.log('  建議: 調整 canvas 尺寸以匹配 video 比例');
      }

    } else {
      console.log('\n✅ 未發現明顯問題');
      console.log('  如果仍有問題，請確認：');
      console.log('  1. 在各個區域都有揮動手臂');
      console.log('  2. 燈光充足，攝影機能清楚看到動作');
      console.log('  3. 調整靈敏度滑桿');
    }

    // ============================================================
    // 9. 比例不一致詳細分析
    // ============================================================
    if (env.aspectRatioMismatch) {
      console.log('\n' + '═'.repeat(60));
      console.log('🔬 比例不一致問題詳細分析');
      console.log('═'.repeat(60));

      const videoRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = 64 / 48;

      console.log(`\n  Video 比例: ${videoRatio.toFixed(3)} (${video.videoWidth}x${video.videoHeight})`);
      console.log(`  Canvas 比例: ${canvasRatio.toFixed(3)} (64x48)`);

      // 計算 CSS object-fit: cover 的裁切區域
      const windowRatio = window.innerWidth / window.innerHeight;
      let visualCropX = 0, visualCropY = 0;

      if (videoRatio > windowRatio) {
        // video 比視窗寬，左右被裁切
        const scaledWidth = video.videoHeight * windowRatio;
        visualCropX = (video.videoWidth - scaledWidth) / 2;
        console.log(`\n  CSS object-fit: cover 行為:`);
        console.log(`    左右各裁切 ${visualCropX.toFixed(0)} 像素`);
      } else {
        // video 比視窗高，上下被裁切
        const scaledHeight = video.videoWidth / windowRatio;
        visualCropY = (video.videoHeight - scaledHeight) / 2;
        console.log(`\n  CSS object-fit: cover 行為:`);
        console.log(`    上下各裁切 ${visualCropY.toFixed(0)} 像素`);
      }

      console.log(`\n  Canvas drawImage 行為:`);
      console.log(`    將 ${video.videoWidth}x${video.videoHeight} 拉伸到 64x48`);
      console.log(`    ⚠️ 沒有裁切，只有拉伸！`);

      console.log(`\n  結果：`);
      console.log(`    視覺顯示的區域 ≠ 偵測分析的區域`);
      console.log(`    使用者在畫面中央揮手，偵測系統認為在偏左/偏右的位置`);

      // 計算偏移量
      if (videoRatio > canvasRatio) {
        const stretchFactor = canvasRatio / videoRatio;
        console.log(`\n  偏移計算:`);
        console.log(`    水平壓縮比: ${stretchFactor.toFixed(3)}`);
        console.log(`    視覺中心 → 偵測位置: 偏左 ${((1 - stretchFactor) / 2 * 100).toFixed(1)}%`);
      }
    }

    // ============================================================
    // 10. 建議修復方案
    // ============================================================
    console.log('\n' + '═'.repeat(60));
    console.log('💡 修復建議');
    console.log('═'.repeat(60));

    if (env.aspectRatioMismatch) {
      console.log('\n  問題根源: Video 與 Canvas 比例不一致');
      console.log('\n  修復方案 A (推薦): 修改 motion.js 的 drawImage 邏輯');
      console.log('    讓 Canvas 繪製時模擬 CSS object-fit: cover 的裁切行為');
      console.log('    確保視覺與偵測座標一致');

      console.log('\n  修復方案 B: 修改 CSS');
      console.log('    將 #webcam 的 object-fit 從 cover 改為 fill');
      console.log('    缺點: 畫面會被拉伸變形');

      console.log('\n  修復方案 C: 動態調整 Canvas 尺寸');
      console.log('    讓 Canvas 尺寸匹配 Video 比例');
      console.log('    例如: 16:9 video → 64x36 canvas');
    } else if (issues.length > 0) {
      console.log('\n  可以嘗試:');
      console.log('  1. 開啟 Debug 模式查看實際偵測畫面');
      console.log('  2. 確認燈光充足');
      console.log('  3. 調整靈敏度滑桿');
    } else {
      console.log('\n  ✅ 未發現技術問題');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('診斷完成');
    console.log('═'.repeat(60));

    // 將結果存到 window 供進一步分析
    window.__diagResult = {
      env,
      detectorParams,
      summaries,
      issues,
      rawData: cellStats,
      aspectRatioMismatch: env.aspectRatioMismatch,
    };
    console.log('\n💾 完整資料已存到 window.__diagResult');
  }

})();
