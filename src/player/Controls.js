import PlayerData from '../PlayerData.js';

export default class Controls {
    constructor(scene) {
        this.keys = scene.input.keyboard.addKeys({
            left: PlayerData.controls.left,
            right: PlayerData.controls.right,
            jump: PlayerData.controls.jump,
            down: PlayerData.controls.down,
            attack: PlayerData.controls.attack,
            highJump: PlayerData.controls.highJump,
            dash: PlayerData.controls.dash,
            spell: PlayerData.controls.spell,
            taunt: PlayerData.controls.taunt
        });

        Object.assign(this, this.keys);
    }
}