class GameAudio {
    private ctx: AudioContext | null = null;
    private isMuted = false;
    public activeBgm: 'title' | 'map' | 'battle' | 'result' | 'quiz' | null = null;

    // Use HTMLAudioElement for true music playback
    public bgmAudio: HTMLAudioElement | null = null;

    init() {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.warn("Web Audio API is not supported.");
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Keep simple UI sound effects as Web Audio API since they are just quick blips
    playSE(type: 'success' | 'click' | 'error' | 'level_up' | 'capture' | 'impact' | 'heavy_impact' | 'player_damage' | 'heavy_player_damage' | 'deflect') {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        const playTone = (freq: number, startTime: number, duration: number, vol = 0.1, oscType: OscillatorType = 'sine') => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = oscType;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(vol, startTime + duration * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx!.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        switch (type) {
            case 'click':
                playTone(600, t, 0.1, 0.15, 'sine');
                break;
            case 'success':
                playTone(523.25, t, 0.15, 0.5, 'sine'); // C5
                playTone(659.25, t + 0.1, 0.3, 0.5, 'sine'); // E5
                break;
            case 'error':
                playTone(200, t, 0.2, 0.5, 'sawtooth');
                playTone(150, t + 0.15, 0.3, 0.5, 'sawtooth');
                break;
            case 'level_up':
                playTone(440, t, 0.15, 0.5, 'triangle');
                playTone(554.37, t + 0.15, 0.15, 0.5, 'triangle');
                playTone(659.25, t + 0.3, 0.15, 0.5, 'triangle');
                playTone(880, t + 0.45, 0.5, 0.5, 'triangle');
                break;
            case 'capture':
                playTone(300, t, 0.1, 0.5, 'square');
                playTone(400, t + 0.1, 0.1, 0.5, 'square');
                playTone(500, t + 0.2, 0.4, 0.5, 'square');
                break;
            case 'impact':
                playTone(150, t, 0.2, 0.8, 'sawtooth');
                playTone(100, t, 0.3, 0.6, 'square');
                playTone(50, t, 0.2, 0.9, 'square');
                break;
            case 'heavy_impact':
                playTone(100, t, 0.2, 1.0, 'sawtooth');
                playTone(50, t + 0.1, 0.4, 1.0, 'square');
                playTone(25, t + 0.3, 0.5, 1.0, 'sawtooth');
                playTone(200, t, 0.1, 0.7, 'square'); 
                break;
            case 'player_damage':
                playTone(300, t, 0.2, 0.7, 'sawtooth');
                playTone(250, t + 0.1, 0.3, 0.8, 'square');
                break;
            case 'heavy_player_damage':
                playTone(200, t, 0.3, 1.0, 'sawtooth');
                playTone(100, t + 0.1, 0.4, 1.0, 'square');
                playTone(400, t, 0.1, 0.6, 'triangle');
                playTone(50, t + 0.2, 0.5, 0.8, 'sawtooth');
                break;
            case 'deflect':
                playTone(800, t, 0.1, 0.8, 'triangle');
                playTone(1200, t + 0.05, 0.2, 0.3, 'sine');
                playTone(400, t + 0.1, 0.1, 0.5, 'square');
                break;
        }
    }

    // Play actual audio files for BGM instead of generating sounds
    playBGM(type: 'title' | 'map' | 'battle' | 'result' | 'quiz') {
        if (this.isMuted) return;

        // If the same BGM is already playing, do nothing
        if (this.activeBgm === type && this.bgmAudio) {
            return;
        }

        this.stopBGM();
        this.activeBgm = type;

        // Map type to the actual filename we expect in public/audio/
        const bgmFiles: Record<string, string> = {
            title: '/orgamon-quest/audio/bgm_title.mp3',
            map: '/orgamon-quest/audio/bgm_map.mp3',
            battle: `/orgamon-quest/audio/bgm_battle${Math.floor(Math.random() * 5) + 1}.mp3`,
            quiz: '/orgamon-quest/audio/bgm_quiz.mp3',
            result: '/orgamon-quest/audio/bgm_result.mp3',
        };

        const src = bgmFiles[type];
        if (!src) return;

        if (!this.bgmAudio) {
            this.bgmAudio = new Audio();
        }

        // Only set src and play strings if different
        if (!this.bgmAudio.src.endsWith(src)) {
            this.bgmAudio.src = src;
        }
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.3; // Default BGM volume

        // Try to play. If the browser blocks it due to no interaction, catch the error quietly
        this.bgmAudio.play().catch(e => {
            console.warn("BGM autoplay prevented. Waiting for user interaction...", e);
        });
    }

    stopBGM() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
            // keep this.bgmAudio intact so it stays unlocked
        }
        this.activeBgm = null;
    }
}

export const audio = new GameAudio();

// Ensure audio context and BGM unlock on first user interaction
if (typeof window !== 'undefined') {
    const initAudio = () => {
        audio.init();
        if (!audio.bgmAudio) {
            audio.bgmAudio = new Audio();
        }
        // Unlock AudioContext for SE
        if (audio['ctx']) {
            const buffer = audio['ctx'].createBuffer(1, 1, 22050);
            const source = audio['ctx'].createBufferSource();
            source.buffer = buffer;
            source.connect(audio['ctx'].destination);
            source.start(0);
        }

        // Unlock HTMLAudioElement for BGM iOS Safari
        audio.bgmAudio.play().catch(() => { });

        // If a BGM was supposed to be playing (but was blocked), start it now
        if (audio.activeBgm) {
            audio.playBGM(audio.activeBgm);
        } else {
            audio.bgmAudio.pause();
        }

        document.removeEventListener('click', initAudio);
        document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
}
