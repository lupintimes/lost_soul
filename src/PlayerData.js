let savedCharacter = 'p1';
let savedColor = 'slate';
let savedMusic = '0.5';
let savedSfx = '0.5';
try {
    savedCharacter = localStorage.getItem('lost_soul_character') || 'p1';
    savedColor = localStorage.getItem('lost_soul_color') || 'slate';
    savedMusic = localStorage.getItem('lost_soul_music') || '0.5';
    savedSfx = localStorage.getItem('lost_soul_sfx') || '0.5';
} catch (e) {
    // Safe fallback if localStorage is not accessible
}

const PlayerData = {
    character: savedCharacter,
    color: savedColor,
    musicVolume: parseFloat(savedMusic),
    sfxVolume: parseFloat(savedSfx),

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
        { id: 'default', name: 'DEFAULT', tint: null },
        { id: 'rose', name: 'ROSE', tint: 0xe6909c },
        { id: 'sage', name: 'SAGE', tint: 0xbce9bd },
        { id: 'sand', name: 'SAND', tint: 0xf0d39a },
        { id: 'lavender', name: 'LAVENDER', tint: 0xc19ad1 },
        { id: 'slate', name: 'SLATE', tint: 0xc4c9ca },
        { id: 'sky', name: 'SKY', tint: 0x9cc5f0 },
        { id: 'peach', name: 'PEACH', tint: 0xf0b79c },
        { id: 'mint', name: 'MINT', tint: 0x9ce8df },
        { id: 'lilac', name: 'LILAC', tint: 0xe89ce3 },
        { id: 'cream', name: 'CREAM', tint: 0xe8df9c }
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
