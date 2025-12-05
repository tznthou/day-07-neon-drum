/**
 * Neon Motion Drum - Web Audio 合成鼓聲模組
 * 使用 Web Audio API 合成電子鼓聲，不需要外部音效檔
 */

export class SynthDrums {
  constructor() {
    this.audioContext = null;
    this.noiseBuffer = null;
    this.masterGain = null;
  }

  /**
   * 初始化 AudioContext (必須在用戶互動後呼叫)
   */
  async init() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 建立主音量控制
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.audioContext.destination);

    // 預先建立白噪音 buffer (2秒)
    this.noiseBuffer = this.createNoiseBuffer(2);

    // 確保 AudioContext 正在運行
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this;
  }

  /**
   * 建立白噪音 AudioBuffer
   */
  createNoiseBuffer(duration) {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * 設定節點在音源結束後自動清理 (防止記憶體洩漏)
   * @param {AudioScheduledSourceNode} sourceNode - 音源節點 (Oscillator 或 BufferSource)
   * @param {...AudioNode} nodesToDisconnect - 需要 disconnect 的節點
   */
  scheduleCleanup(sourceNode, ...nodesToDisconnect) {
    sourceNode.onended = () => {
      nodesToDisconnect.forEach(node => {
        try {
          node.disconnect();
        } catch (e) {
          // 節點已經 disconnect，忽略
        }
      });
    };
  }

  /**
   * 播放指定音色
   */
  play(soundName) {
    if (!this.audioContext) return;

    // 確保 AudioContext 處於運行狀態 (切分頁回來可能被 suspend)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;

    switch (soundName) {
      case 'kick':
        this.playKick(now);
        break;
      case 'snare':
        this.playSnare(now);
        break;
      case 'hihat':
        this.playHihat(now);
        break;
      case 'clap':
        this.playClap(now);
        break;
      case 'tom1':
        this.playTom(now, 200, 100); // 高音 Tom
        break;
      case 'tom2':
        this.playTom(now, 120, 60);  // 低音 Tom
        break;
      case 'crash':
        this.playCrash(now);
        break;
      case 'ride':
        this.playRide(now);
        break;
      case 'synth':
        this.playSynth(now);
        break;
      default:
        console.warn(`Unknown sound: ${soundName}`);
    }
  }

  /**
   * Kick (大鼓)
   * 低頻 sine wave + 快速 pitch bend + 衰減
   */
  playKick(time) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.4);

    this.scheduleCleanup(osc, osc, gain);
  }

  /**
   * Snare (小鼓)
   * 噪音 + 三角波 混合
   */
  playSnare(time) {
    // 噪音部分
    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 1;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // 音調部分 (三角波)
    const osc = this.audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.2);
    osc.start(time);
    osc.stop(time + 0.1);

    this.scheduleCleanup(noise, noise, noiseFilter, noiseGain);
    this.scheduleCleanup(osc, osc, oscGain);
  }

  /**
   * Hi-hat (腳踏鈸)
   * 高頻噪音 + 極短衰減
   */
  playHihat(time) {
    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.08);

    this.scheduleCleanup(noise, noise, filter, gain);
  }

  /**
   * Clap (拍手)
   * 多層噪音爆發
   */
  playClap(time) {
    // 建立多層噪音模擬拍手的「散開」感
    const burstCount = 4;
    const burstInterval = 0.01;

    for (let i = 0; i < burstCount; i++) {
      const t = time + i * burstInterval;

      const noise = this.audioContext.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.5;

      const gain = this.audioContext.createGain();
      const volume = i === burstCount - 1 ? 0.8 : 0.4; // 最後一下最大聲
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + 0.15);

      this.scheduleCleanup(noise, noise, filter, gain);
    }
  }

  /**
   * Tom (通鼓)
   * sine wave + pitch bend
   */
  playTom(time, startFreq, endFreq) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.15);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.3);

    this.scheduleCleanup(osc, osc, gain);
  }

  /**
   * Crash (碎音鈸)
   * 噪音 + 長衰減
   */
  playCrash(time) {
    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const highpass = this.audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 5000;

    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 12000;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);

    noise.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 1.5);

    this.scheduleCleanup(noise, noise, highpass, lowpass, gain);
  }

  /**
   * Ride (Ride 鈸)
   * 高頻噪音 + 金屬共鳴感
   */
  playRide(time) {
    // 噪音層
    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 8000;
    filter.Q.value = 2;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.6);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // 金屬共鳴 (高頻正弦波)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 6000;

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.1, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.6);
    osc.start(time);
    osc.stop(time + 0.4);

    this.scheduleCleanup(noise, noise, filter, noiseGain);
    this.scheduleCleanup(osc, osc, oscGain);
  }

  /**
   * Synth (合成器短音)
   * 方波 + 濾波器 sweep
   */
  playSynth(time) {
    const osc = this.audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 440; // A4

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + 0.3);
    filter.Q.value = 5;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.3);

    this.scheduleCleanup(osc, osc, filter, gain);
  }

  /**
   * 設定主音量
   */
  setVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * 清理資源
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
