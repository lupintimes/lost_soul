let savedCharacter = 'p1';
let savedColor = 'slate';
try {
    savedCharacter = localStorage.getItem('lost_soul_character') || 'p1';
    savedColor = localStorage.getItem('lost_soul_color') || 'slate';
} catch (e) {
    // Safe fallback if localStorage is not accessible
}

const PlayerData = {
    character: savedCharacter,
    color: savedColor,

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