// Sound effect cache and audio manager
type SoundType = 'click' | 'win' | 'lose' | 'correct' | 'wrong' | 'tick' | 'notification' | 'start' | 'reaction' | 'flip' | 'match' | 'combo' | 'levelup' | 'countdown' | 'whoosh' | 'pop' | 'ding';
type EmojiSound = 'laugh' | 'cry' | 'love' | 'fire' | 'angry' | 'kiss' | 'clap' | 'sparkle' | 'shy';

// Map emojis to sound types and ElevenLabs prompts
const emojiSoundMap: Record<string, EmojiSound> = {
  '😂': 'laugh',
  '🤣': 'laugh',
  '😍': 'love',
  '💕': 'love',
  '❤️': 'love',
  '🔥': 'fire',
  '😤': 'angry',
  '🥵': 'fire',
  '💋': 'kiss',
  '😘': 'kiss',
  '🙈': 'shy',
  '👏': 'clap',
  '💯': 'fire',
  '✨': 'sparkle',
  '😭': 'cry',
  '🎉': 'clap',
  '🤔': 'sparkle',
  '😱': 'sparkle',
  '💀': 'angry',
  '✔️': 'sparkle',
  '👍': 'clap',
};

// Map emojis to ElevenLabs sound prompts
const emojiElevenLabsMap: Record<string, string> = {
  '😂': 'joyful laughter, happy giggling sound, cheerful laugh',
  '❤️': 'romantic heart beat, love sound effect, soft heartbeat',
  '🤣': 'hysterical laughter, rolling on floor laughing, uncontrollable giggling',
  '👍': 'approval sound, positive affirmation, thumbs up beep',
  '😭': 'crying sound, sad weeping, emotional tears',
  '🎉': 'party celebration, confetti pop sound, festive celebration',
  '🔥': 'fire crackling, flames burning, fire whoosh',
  '🤔': 'thinking sound, contemplation, pondering effect',
  '😱': 'gasping sound, surprised gasp, shocked reaction',
  '💀': 'spooky sound, eerie effect, skeleton rattle',
  '💯': 'perfect score sound, achievement unlocked, success chime',
  '✔️': 'check mark sound, confirmation beep, success ding',
};

class SoundManager {
  private static instance: SoundManager;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private isEnabled: boolean = true;
  private audioContext: AudioContext | null = null;

  // If ElevenLabs SFX is misconfigured (e.g. missing permissions), disable calls to avoid repeated 500s.
  private elevenLabsSfxAvailable: boolean = true;
  private elevenLabsSfxDisabledReason: string | null = null;

  private constructor() {}

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  // Play iPhone notification sound (tri-tone)
  playNotificationSound() {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    
    const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 - iPhone tri-tone
    const times = [0, 0.1, 0.2];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      const startTime = ctx.currentTime + times[i];
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  // Play start game fanfare
  playStartSound() {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const times = [0, 0.1, 0.2, 0.35];
    const durations = [0.15, 0.15, 0.15, 0.4];
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = freq;
      osc.type = 'triangle';
      
      const startTime = ctx.currentTime + times[i];
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i]);
      
      osc.start(startTime);
      osc.stop(startTime + durations[i]);
    });
  }

  // Play emoji-specific sound with ElevenLabs integration
  playEmojiSound(emoji: string, useElevenLabs: boolean = false) {
    if (!this.isEnabled) return;
    
    // Try ElevenLabs first if enabled and available
    if (useElevenLabs && emojiElevenLabsMap[emoji]) {
      this.generateAndPlaySFX(emojiElevenLabsMap[emoji], 0.8).catch(() => {
        // Fallback to local sound if ElevenLabs fails
        this.playEmojiSoundLocal(emoji);
      });
      return;
    }
    
    // Play local sound
    this.playEmojiSoundLocal(emoji);
  }

  // Play emoji-specific local sound (synchronous)
  private playEmojiSoundLocal(emoji: string) {
    if (!this.isEnabled) return;
    
    const soundType = emojiSoundMap[emoji] || 'sparkle';
    const ctx = this.getAudioContext();
    
    switch (soundType) {
      case 'laugh': {
        // Playful ascending notes
        [400, 500, 600, 700, 800].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq + Math.random() * 50;
          osc.type = 'sine';
          const t = ctx.currentTime + i * 0.08;
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
        });
        break;
      }
      
      case 'cry': {
        // Descending sad notes
        [600, 500, 400, 350].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          const t = ctx.currentTime + i * 0.15;
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
        });
        break;
      }
      
      case 'love': {
        // Soft romantic chime
        [880, 1100, 1320].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          const t = ctx.currentTime + i * 0.1;
          gain.gain.setValueAtTime(0.25, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
          osc.start(t);
          osc.stop(t + 0.3);
        });
        break;
      }
      
      case 'fire': {
        // Intense whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        break;
      }
      
      case 'angry': {
        // Low growl
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        break;
      }
      
      case 'kiss': {
        // Cute pop sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        break;
      }
      
      case 'clap': {
        // Sharp clap sound using noise
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        const noise = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        noise.buffer = buffer;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        noise.start();
        break;
      }
      
      case 'shy': {
        // Soft descending notes
        [600, 550, 500].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          const t = ctx.currentTime + i * 0.1;
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
          osc.start(t);
          osc.stop(t + 0.15);
        });
        break;
      }
      
      case 'sparkle':
      default: {
        // Magical sparkle
        [1200, 1500, 1800, 2000].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          const t = ctx.currentTime + i * 0.05;
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
        });
        break;
      }
    }
  }

  // Play win celebration sound
  playWinSound() {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    
    // Triumphant fanfare
    const melody = [
      { note: 523.25, time: 0, dur: 0.15 },    // C5
      { note: 659.25, time: 0.15, dur: 0.15 }, // E5
      { note: 783.99, time: 0.3, dur: 0.15 },  // G5
      { note: 1046.50, time: 0.45, dur: 0.4 }, // C6
      { note: 987.77, time: 0.5, dur: 0.35 },  // B5
      { note: 1046.50, time: 0.6, dur: 0.5 },  // C6
    ];
    
    melody.forEach(({ note, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = note;
      osc.type = 'triangle';
      const t = ctx.currentTime + time;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    });
  }

  async playLocalSound(soundType: SoundType) {
    if (!this.isEnabled) return;

    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    switch (soundType) {
      case 'notification':
        this.playNotificationSound();
        return;
        
      case 'start':
        this.playStartSound();
        return;

      case 'click':
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
        break;

      case 'win':
        this.playWinSound();
        return;

      case 'lose':
        oscillator.frequency.setValueAtTime(400, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
        break;

      case 'correct':
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
        break;

      case 'wrong':
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.2);
        break;

      case 'tick':
        oscillator.frequency.value = 1000;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.05);
        break;

      case 'flip':
        // Card flip whoosh sound
        oscillator.frequency.setValueAtTime(300, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
        break;

      case 'match':
        // Satisfying match chime
        this.playMatchSound();
        return;

      case 'combo':
        // Combo/streak sound
        this.playComboSound();
        return;

      case 'levelup':
        // Level up fanfare
        this.playLevelUpSound();
        return;

      case 'countdown':
        // Countdown beep
        oscillator.frequency.value = 440;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
        break;

      case 'whoosh':
        // Quick whoosh for transitions
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
        break;

      case 'pop':
        // Bubble pop sound
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
        break;

      case 'ding':
        // Simple ding notification
        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.2);
        break;
    }
  }

  // Play satisfying match sound
  private playMatchSound() {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // Play combo/streak sound (ascending)
  private playComboSound() {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.06;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  // Play level up fanfare
  private playLevelUpSound() {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    
    const melody = [
      { note: 392, time: 0, dur: 0.1 },      // G4
      { note: 523.25, time: 0.1, dur: 0.1 }, // C5
      { note: 659.25, time: 0.2, dur: 0.1 }, // E5
      { note: 783.99, time: 0.3, dur: 0.15 }, // G5
      { note: 1046.50, time: 0.45, dur: 0.3 }, // C6
    ];
    
    melody.forEach(({ note, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = note;
      osc.type = 'triangle';
      const t = ctx.currentTime + time;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    });
  }

  async generateAndPlaySFX(prompt: string, duration: number = 1): Promise<void> {
    if (!this.isEnabled) return;

    // If we already detected ElevenLabs is not usable, don't spam the backend.
    if (!this.elevenLabsSfxAvailable) {
      // Fall back to local sound
      this.playLocalSound('click');
      return;
    }

    // Check cache first
    const cacheKey = `${prompt}-${duration}`;
    if (this.audioCache.has(cacheKey)) {
      const cachedAudio = this.audioCache.get(cacheKey)!;
      cachedAudio.currentTime = 0;
      await cachedAudio.play();
      return;
    }

    // Check if backend is configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey ||
      supabaseUrl === 'https://placeholder.supabase.co' ||
      supabaseKey === 'placeholder-key'
    ) {
      // Fall back to local sound if backend is not configured
      this.playLocalSound('click');
      return;
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-sfx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ prompt, duration }),
      });

      if (!response.ok) {
        // Try to pull a useful message (edge function returns JSON with { error })
        let details: string | undefined;
        try {
          const maybeJson = await response.clone().json();
          if (maybeJson?.error) details = String(maybeJson.error);
        } catch {
          // ignore
        }

        // Common case: ElevenLabs key exists but lacks sound_generation permission.
        if (response.status === 401) {
          this.elevenLabsSfxAvailable = false;
          this.elevenLabsSfxDisabledReason = details || 'Unauthorized (401)';
          console.warn('Disabling ElevenLabs SFX due to authorization error:', this.elevenLabsSfxDisabledReason);
        }

        throw new Error(details ? `SFX request failed: ${details}` : `SFX request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Cache the audio
      this.audioCache.set(cacheKey, audio);

      await audio.play();
    } catch (error) {
      console.error('Failed to play SFX:', error);
      // Fall back to local sound
      this.playLocalSound('click');
    }
  }
}

export const soundManager = SoundManager.getInstance();
