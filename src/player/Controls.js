export default class Controls {
    constructor(scene) {
        this.keys = scene.input.keyboard.addKeys({
            left: 'A',
            right: 'D',
            jump: 'W',
            attack: 'SPACE'
        });

        Object.assign(this, this.keys);
    }
}