let savedCharacter = 'p1';
let savedColor = 'slate';
let savedMusic = '0.5';
let savedSfx = '0.5';
let savedGraphics = 'high';
let savedAlias = 'Guest' + Math.floor(1000 + Math.random() * 9000);
try {
    savedCharacter = localStorage.getItem('lost_soul_character') || 'p1';
    savedColor = localStorage.getItem('lost_soul_color') || 'slate';
    if (savedColor === 'default') {
        savedColor = 'slate';
    }
    savedMusic = localStorage.getItem('lost_soul_music') || '0.5';
    savedSfx = localStorage.getItem('lost_soul_sfx') || '0.5';
    savedGraphics = localStorage.getItem('lost_soul_graphics') || 'high';
    savedAlias = localStorage.getItem('lost_soul_alias') || savedAlias;
} catch (e) {
    // Safe fallback if localStorage is not accessible
}

const defaultControls = {
    left: 65, // A
    right: 68, // D
    jump: 87, // W
    down: 83, // S
    attack: 32, // SPACE
    highJump: 81, // Q
    dash: 16, // SHIFT
    spell: 82, // R
    taunt: 84 // T
};

const keyNameToCode = {
    'A': 65, 'B': 66, 'C': 67, 'D': 68, 'E': 69, 'F': 70, 'G': 71, 'H': 72, 'I': 73, 'J': 74,
    'K': 75, 'L': 76, 'M': 77, 'N': 78, 'O': 79, 'P': 80, 'Q': 81, 'R': 82, 'S': 83, 'T': 84,
    'U': 85, 'V': 86, 'W': 87, 'X': 88, 'Y': 89, 'Z': 90,
    'SPACE': 32, 'SHIFT': 16, 'ENTER': 13, 'UP': 38, 'DOWN': 40, 'LEFT': 37, 'RIGHT': 39
};

let savedControls = { ...defaultControls };
try {
    const raw = localStorage.getItem('lost_soul_controls');
    if (raw) {
        const parsed = JSON.parse(raw);
        for (const k in parsed) {
            let val = parsed[k];
            if (typeof val === 'string') {
                val = keyNameToCode[val.toUpperCase()] || defaultControls[k];
            }
            savedControls[k] = val;
        }
    }
} catch (e) {
    // Safe fallback if localStorage is not accessible
}

const PlayerData = {
    character: savedCharacter,
    color: savedColor,
    musicVolume: parseFloat(savedMusic),
    sfxVolume: parseFloat(savedSfx),
    graphicsQuality: savedGraphics,
    alias: savedAlias,
    controls: savedControls,

    setControlKey(action, keyCode) {
        this.controls[action] = keyCode;
        try {
            localStorage.setItem('lost_soul_controls', JSON.stringify(this.controls));
        } catch (e) {}
    },

    resetControls() {
        this.controls = { ...defaultControls };
        try {
            localStorage.setItem('lost_soul_controls', JSON.stringify(this.controls));
        } catch (e) {}
    },

    getKeyLabel(keyCode) {
        // Special key code labels
        const specialKeys = {
            8: 'BACKSPACE',
            9: 'TAB',
            13: 'ENTER',
            16: 'SHIFT',
            17: 'CTRL',
            18: 'ALT',
            20: 'CAPS LOCK',
            27: 'ESC',
            32: 'SPACE',
            37: 'LEFT',
            38: 'UP',
            39: 'RIGHT',
            40: 'DOWN',
            186: ';',
            187: '=',
            188: ',',
            189: '-',
            190: '.',
            191: '/',
            192: '`',
            219: '[',
            220: '\\',
            221: ']',
            222: "'"
        };
        if (specialKeys[keyCode]) return specialKeys[keyCode];
        // A-Z
        if (keyCode >= 65 && keyCode <= 90) {
            return String.fromCharCode(keyCode);
        }
        // 0-9
        if (keyCode >= 48 && keyCode <= 57) {
            return String.fromCharCode(keyCode);
        }
        // Numpad 0-9
        if (keyCode >= 96 && keyCode <= 105) {
            return 'NUMPAD ' + (keyCode - 96);
        }
        return 'KEY ' + keyCode;
    },

    setAlias(name) {
        this.alias = name;
        try {
            localStorage.setItem('lost_soul_alias', name);
        } catch (e) {}
    },

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        try {
            localStorage.setItem('lost_soul_music', this.musicVolume.toString());
        } catch (e) {}
    },

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        try {
            localStorage.setItem('lost_soul_sfx', this.sfxVolume.toString());
        } catch (e) {}
    },

    setGraphicsQuality(q) {
        this.graphicsQuality = q;
        try {
            localStorage.setItem('lost_soul_graphics', q);
        } catch (e) {}
    },

    synthBGM: null,
    musicInterval: null,

    startMusic(scene) {
        if (this.synthBGM) return;

        try {
            const ctx = scene.sound.context || new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;

            const playNote = (freq, startTime, duration) => {
                if (this.musicVolume <= 0) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.04 * this.musicVolume, startTime + 0.5);
                gain.gain.setValueAtTime(0.04 * this.musicVolume, startTime + duration - 0.5);
                gain.gain.linearRampToValueAtTime(0, startTime + duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            const notes = [220, 261.63, 329.63, 392.00]; // A3, C4, E4, G4 (Am7)
            let noteIdx = 0;

            const scheduleNext = () => {
                const now = ctx.currentTime;
                playNote(notes[noteIdx], now, 3.8);
                noteIdx = (noteIdx + 1) % notes.length;
            };

            scheduleNext();
            this.musicInterval = setInterval(scheduleNext, 4000);
            this.synthBGM = true;
        } catch (e) {
            console.error("Failed to start synth BGM:", e);
        }
    },


    characters: [
        { id: 'p1', name: 'KNIGHT', color: 0x4488ff, desc: 'Balanced fighter' },
        { id: 'p2', name: 'SHADOW', color: 0x9944ff, desc: 'Fast & deadly' },
        { id: 'p3', name: 'BERSERKER', color: 0xff4444, desc: 'Heavy hitter' }
    ],

    colors: [
        { id: 'rose', name: 'ROSE', tint: 0xe6909c },
        { id: 'sage', name: 'SAGE', tint: 0xbce9bd },
        { id: 'sand', name: 'SAND', tint: 0xf0d39a },
        { id: 'lavender', name: 'LAVENDER', tint: 0xc19ad1 },
        { id: 'slate', name: 'SLATE', tint: 0xc4c9ca },
        { id: 'sky', name: 'SKY', tint: 0x9cc5f0 },
        { id: 'peach', name: 'PEACH', tint: 0xf0b79c },
        { id: 'mint', name: 'MINT', tint: 0x9ce8df },
        { id: 'lilac', name: 'LILAC', tint: 0xe89ce3 },
        { id: 'cream', name: 'CREAM', tint: 0xe8df9c },
        { id: 'crimson', name: 'CRIMSON', tint: 0xef4444 },
        { id: 'amber', name: 'AMBER', tint: 0xf59e0b },
        { id: 'emerald', name: 'EMERALD', tint: 0x10b981 },
        { id: 'teal', name: 'TEAL', tint: 0x14b8a6 },
        { id: 'indigo', name: 'INDIGO', tint: 0x6366f1 },
        { id: 'violet', name: 'VIOLET', tint: 0x8b5cf6 },
        { id: 'fuchsia', name: 'FUCHSIA', tint: 0xd946ef },
        { id: 'mustard', name: 'MUSTARD', tint: 0xeab308 },
        { id: 'lime', name: 'LIME', tint: 0x84cc16 },
        { id: 'coral', name: 'CORAL', tint: 0xff7f50 }
    ],

    setCharacter(id) {
        this.character = id;
        try {
            localStorage.setItem('lost_soul_character', id);
        } catch (e) {}
    },

    setColor(id) {
        this.color = id;
        try {
            localStorage.setItem('lost_soul_color', id);
        } catch (e) {}
    },

    getCharacterInfo() {
        return this.characters.find(c => c.id === this.character) || this.characters[0];
    },

    getColorTint() {
        const colorObj = this.colors.find(c => c.id === this.color);
        return colorObj ? colorObj.tint : null;
    },

    getConfig() {
        return {
            character: this.character,
            color: this.color
        };
    }
};

export default PlayerData;
