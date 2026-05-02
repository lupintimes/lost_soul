import Player from './player/Player.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.platforms = [];
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

        this.load.spritesheet('blink', '../assets/p1/blink.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('taunt', '../assets/p1/taunt.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('hurt', '../assets/p1/hurt.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('death', '../assets/p1/death.png', { frameWidth: 520, frameHeight: 420 });
    }

    create() {
        // 🖼️ BACKGROUND (NO SCALING)
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0);

        // 🌍 WORLD = IMAGE SIZE (🔥 IMPORTANT FIX)
        const worldWidth = this.bg.width;
        const worldHeight = this.bg.height;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

        // 🎬 ANIMATIONS
        this.createAnimations();

        // 👤 PLAYER
        this.player = new Player(this, 200, 300);

        // 🧱 PLATFORM GROUP
        this.platformGroup = this.physics.add.staticGroup();

        // 🔗 COLLISION
        this.physics.add.collider(this.player.sprite, this.platformGroup);

        // 🎥 CAMERA
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

        // 🟡 DRAW PREVIEW
        this.preview = this.add.graphics();

        this.isDrawing = false;
        this.startPoint = null;

        // 🖱️ INPUT
        this.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                this.removePlatform(pointer);
                return;
            }

            const world = pointer.positionToCamera(this.cameras.main);
            this.startPoint = world;
            this.isDrawing = true;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.isDrawing) return;

            const world = pointer.positionToCamera(this.cameras.main);
            const rect = this.getRect(this.startPoint, world);

            this.preview.clear();
            this.preview.lineStyle(2, 0xffff00, 1);
            this.preview.strokeRect(rect.x, rect.y, rect.w, rect.h);
        });

        this.input.on('pointerup', (pointer) => {
            if (!this.isDrawing) return;

            const world = pointer.positionToCamera(this.cameras.main);
            const rect = this.getRect(this.startPoint, world);

            this.createPlatform(rect);

            this.preview.clear();
            this.isDrawing = false;
        });

        // 💾 EXPORT
        this.input.keyboard.on('keydown-E', () => {
            const data = this.platforms.map(p => ({
                x: p.x,
                y: p.y,
                w: p.w,
                h: p.h
            }));

            console.log("COPY THIS:", JSON.stringify(data, null, 2));
        });

        // 🧪 AUTO LOAD (your test rect)
        const saved = [
            { x: 0, y: 3747, w: 6000, h: 251 },

            { x: 1122, y: 3340, w: 141, h: 408 },

            { x: 3, y: 0, w: 115, h: 4000 },
            {
                x: 414,
                y: 3341,
                w: 814,
                h: 68
            },
            {
                x: 689,
                y: 3214,
                w: 96,
                h: 132
            },

            {
                x: 1216,
                y: 3339,
                w: 544,
                h: 70
            },

            {
                x: 916,
                y: 3131,
                w: 582,
                h: 22
            },

            {
                x: 1167,
                y: 3048,
                w: 281,
                h: 17
            }
        ];

        saved.forEach(r => this.createPlatform(r));

        // 🧪 DEBUG MARKER (optional)
        this.add.rectangle(159, 3747, 20, 20, 0x00ff00);
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

        this.anims.create({
            key: 'blink_anim',
            frames: this.anims.generateFrameNumbers('blink', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: 0
        });

        this.anims.create({
            key: 'taunt_anim',
            frames: this.anims.generateFrameNumbers('taunt', { start: 0, end: 5 }),
            frameRate: 10
        });

        this.anims.create({
            key: 'hurt_anim',
            frames: this.anims.generateFrameNumbers('hurt', { start: 0, end: 3 }),
            frameRate: 10
        });

        this.anims.create({
            key: 'death_anim',
            frames: this.anims.generateFrameNumbers('death', { start: 0, end: 5 }),
            frameRate: 8
        });
    }

    // 🧱 CREATE PLATFORM (FIXED CENTER LOGIC)
    createPlatform(rect) {
        const centerX = rect.x + rect.w / 2;
        const centerY = rect.y + rect.h / 2;

        const platform = this.add.rectangle(
            centerX,
            centerY,
            rect.w,
            rect.h,
            0xff0000,
            0.03
        );

        this.physics.add.existing(platform, true);

        this.platformGroup.add(platform);

        this.platforms.push({
            gameObject: platform,
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h
        });
    }

    // ❌ REMOVE PLATFORM
    removePlatform(pointer) {
        const world = pointer.positionToCamera(this.cameras.main);

        for (let i = 0; i < this.platforms.length; i++) {
            const p = this.platforms[i];

            if (
                world.x > p.x &&
                world.x < p.x + p.w &&
                world.y > p.y &&
                world.y < p.y + p.h
            ) {
                p.gameObject.destroy();
                this.platforms.splice(i, 1);
                return;
            }
        }
    }

    // 📐 RECT HELPER
    getRect(p1, p2) {
        return {
            x: Math.min(p1.x, p2.x),
            y: Math.min(p1.y, p2.y),
            w: Math.abs(p1.x - p2.x),
            h: Math.abs(p1.y - p2.y)
        };
    }
}