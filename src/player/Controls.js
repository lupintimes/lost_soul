export default class Controls {
    constructor(scene) {
        this.keys = scene.input.keyboard.addKeys({
            left: 'A',
            right: 'D',
            jump: 'W',
            attack: 'SPACE',
            highJump: 'Q',
            dash: 'SHIFT',
            spell: 'R',
            taunt: 'X'
        });

        Object.assign(this, this.keys);
    }
}