const PlayerData = {
    character: 'p1',
    color: 'default',

    characters: [
        { id: 'p1', name: 'KNIGHT', color: 0x4488ff, desc: 'Balanced fighter' },
        { id: 'p2', name: 'SHADOW', color: 0x9944ff, desc: 'Fast & deadly' },
        { id: 'p3', name: 'BERSERKER', color: 0xff4444, desc: 'Heavy hitter' }
    ],

    colors: [
        { id: 'default', name: 'DEFAULT', tint: null },
        { id: 'gold', name: 'GOLD', tint: 0xffd700 },
        { id: 'ice', name: 'ICE', tint: 0x88ccff },
        { id: 'dark', name: 'DARK', tint: 0x555555 },
        { id: 'neon', name: 'NEON', tint: 0x00ff88 }
    ],

    setCharacter(id) {
        this.character = id;
    },

    setColor(id) {
        this.color = id;
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