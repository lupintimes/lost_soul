import Player from './player/Player.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
    this.load.image('bg', '../assets/background.png');

    this.load.spritesheet('idle', '../assets/p1/idle.png', {
        frameWidth: 520,
        frameHeight: 420
    });

    this.load.spritesheet('walk', '../assets/p1/walk.png', {
        frameWidth: 520,
        frameHeight: 420
    });

    this.load.spritesheet('attack', '../assets/p1/attack.png', {
        frameWidth: 520,
        frameHeight: 420
    });
}
    create() {
        // 🌍 world
        this.physics.world.setBounds(0, 0, 6000, 4000);

        this.add.image(3000, 2000, 'bg');

        // 🎬 animations
        this.createAnimations();

        // 👤 player
        this.player = new Player(this, 200, 300);

        // 🎥 camera
        this.cameras.main.setBounds(0, 0, 6000, 4000);
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    }

    update() {
        this.player.update();
    }

    // 🎬 ANIMATIONS
    createAnimations() {
    this.anims.create({
        key: 'idle_anim',
        frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 11 }),
        frameRate: 6,
        repeat: -1
    });

    this.anims.create({
        key: 'walk_anim',
        frames: this.anims.generateFrameNumbers('walk', { start: 0, end: 11 }),
        frameRate: 12,
        repeat: -1
    });

    this.anims.create({
        key: 'attack_anim',
        frames: this.anims.generateFrameNumbers('attack', { start: 0, end: 11 }),
        frameRate: 16,
        repeat: 0
    });
}
}