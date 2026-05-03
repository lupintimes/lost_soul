import Player from './player/Player.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');

        this.isSpawningEnemies = false;
        this.killCount = 0;     // total enemies killed
        this.maxEnemies = 3;    // starting value

        this.platforms = [];
        this.players = [];
        this.enemies = [];

        this.mode = 'solo';
    }

    preload() {
        this.load.image('bg', '../assets/background.png');

        this.load.spritesheet('idle', '../assets/p1/idle.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('walk', '../assets/p1/walk.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('attack', '../assets/p1/attack.png', { frameWidth: 520, frameHeight: 420 });

        this.load.spritesheet('blink', '../assets/p1/blink.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('taunt', '../assets/p1/taunt.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('hurt', '../assets/p1/hurt.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('death', '../assets/p1/death.png', { frameWidth: 520, frameHeight: 420 });
    }

    create() {
        // 🌍 Background
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0);

        const worldWidth = this.bg.width;
        const worldHeight = this.bg.height;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

        // 🎬 Animations
        this.createAnimations();

        // 🧱 Platform group
        this.platformGroup = this.physics.add.staticGroup();

        // =========================
        // ✅ LOAD COLLIDERS FIRST (FIX)
        // =========================
        const saved = [
            { x: 0, y: 3747, w: 6000, h: 251 },
            { x: 1122, y: 3340, w: 141, h: 408 },
            { x: 3, y: 0, w: 115, h: 4000 },
            { x: 414, y: 3341, w: 814, h: 68 },
            { x: 689, y: 3214, w: 96, h: 132 },
            { x: 1216, y: 3339, w: 544, h: 70 },
            { x: 916, y: 3131, w: 582, h: 22 },
            { x: 1167, y: 3048, w: 281, h: 17 }
        ];

        saved.forEach(r => this.createPlatform(r));

        // 🎥 Camera bounds
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // 📍 Spawn points
        this.spawnPoints = [
            { x: 1267, y: 3632 },
            { x: 205, y: 2817 },
            { x: 1810, y: 2755 },
            { x: 957, y: 2921 },
            { x: 1792, y: 2766 },
        ];

        // =========================
        // 🎮 SPAWN AFTER COLLIDERS (FIX)
        // =========================
        if (this.mode === 'solo') {
            this.spawnPlayer();
            this.spawnEnemyWave();
        } else {
            this.spawnMultiplayerPlayers();
        }

        // 🎥 Follow player
        this.cameras.main.startFollow(this.players[0].sprite, true, 0.1, 0.1);

        // =========================
        // 🟡 DRAW TOOL (unchanged)
        // =========================
        this.preview = this.add.graphics();
        this.isDrawing = false;
        this.startPoint = null;

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

        this.input.keyboard.on('keydown-P', () => {
            const data = this.platforms.map(p => ({
                x: Math.round(p.x),
                y: Math.round(p.y),
                w: Math.round(p.w),
                h: Math.round(p.h)
            }));

            console.log("COLLIDERS:\n", JSON.stringify(data, null, 2));
        });
    }

    update() {

        // 🔥 1. COUNT KILLS (fixed version you added)
        const aliveEnemies = [];

        this.enemies.forEach(e => {

            if (!e || !e.sprite || !e.sprite.active || e.state === 'dead') {

                if (!e.countedAsKill) {
                    this.killCount++;
                    e.countedAsKill = true;
                }

            } else {
                aliveEnemies.push(e);
            }

        });

        this.enemies = aliveEnemies;

        // 🔥 2. CLEAN PLAYERS
        this.players = this.players.filter(p => p && p.sprite && p.sprite.active && p.state !== 'dead');

        // 🔥 3. CALCULATE MAX ENEMIES (PUT IT HERE)
        this.maxEnemies = Math.min(
            this.spawnPoints.length,
            3 + Math.floor(this.killCount / 3)
        );

        // 🔥 4. SPAWN SYSTEM
        if (this.enemies.length === 0 && !this.isSpawningEnemies) {
            this.isSpawningEnemies = true;

            const needed = this.maxEnemies - this.enemies.length;

            console.log("Spawning:", needed, "| KillCount:", this.killCount, "| Max:", this.maxEnemies);

            this.time.delayedCall(1000, () => {
                this.spawnEnemyWave(needed);
                this.isSpawningEnemies = false;
            });
        }

        // 🔥 5. UPDATE OBJECTS
        this.players.forEach(p => p.update());
        this.enemies.forEach(e => e.update());
    }

    // =========================
    // 🎬 Animations
    // =========================
    createAnimations() {
        this.anims.create({ key: 'idle_anim', frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 11 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'walk_anim', frames: this.anims.generateFrameNumbers('walk', { start: 0, end: 11 }), frameRate: 12, repeat: -1 });

        this.anims.create({ key: 'hurt_anim', frames: this.anims.generateFrameNumbers('hurt', { start: 0, end: 3 }), frameRate: 10 });
        this.anims.create({ key: 'death_anim', frames: this.anims.generateFrameNumbers('death', { start: 0, end: 5 }), frameRate: 8 });

        this.anims.create({ key: 'attack_1', frames: this.anims.generateFrameNumbers('attack', { start: 0, end: 3 }), frameRate: 14 });
        this.anims.create({ key: 'attack_2', frames: this.anims.generateFrameNumbers('attack', { start: 4, end: 7 }), frameRate: 16 });
        this.anims.create({ key: 'attack_3', frames: this.anims.generateFrameNumbers('attack', { start: 8, end: 11 }), frameRate: 18 });
    }

    // =========================
    // 🧍 Spawn
    // =========================
    spawnPlayer() {
        const spawn = Phaser.Utils.Array.GetRandom(this.spawnPoints);

        const player = new Player(this, spawn.x, spawn.y);

        this.players.push(player);
        this.physics.add.collider(player.sprite, this.platformGroup);

        this.applySpawnProtection(player);
    }

    spawnEnemyWave(count = 3) {
        const shuffled = Phaser.Utils.Array.Shuffle([...this.spawnPoints]);

        const spawnCount = Math.min(count, shuffled.length);

        for (let i = 0; i < spawnCount; i++) {
            const spawn = shuffled[i];

            const enemy = new Player(this, spawn.x, spawn.y);

            enemy.isEnemy = true;
            enemy.state = 'idle';
            enemy.speed = 120;
            enemy.jumpForce = -400;

            enemy.countedAsKill = false; // ✅ MUST BE INSIDE LOOP

            enemy.sprite.setTint(0xff0000);

            this.enemies.push(enemy);
            this.physics.add.collider(enemy.sprite, this.platformGroup);
        }

        console.log("Total enemies:", this.enemies.length);
    }

    spawnMultiplayerPlayers() {
        const p1 = new Player(this, 300, 300, 1);
        const p2 = new Player(this, 600, 300, 2);

        this.players = [p1, p2];

        this.players.forEach(p => {
            this.physics.add.collider(p.sprite, this.platformGroup);
        });
    }

    // =========================
    // 🔄 Respawn
    // =========================
    respawnPlayer() {
        const spawn = Phaser.Utils.Array.GetRandom(this.spawnPoints);

        const player = new Player(this, spawn.x, spawn.y);

        this.players.push(player);

        this.physics.add.collider(player.sprite, this.platformGroup);

        this.applySpawnProtection(player);

        this.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);

        // 🔥 RESET ENEMY AI (CRITICAL)
        this.enemies.forEach(enemy => {
            enemy.aiState = 'chase';
            enemy.attackCooldown = false;
        });
    }

    // =========================
    // ⚔️ Spawn protection
    // =========================
    applySpawnProtection(player) {
        player.isInvincible = true;
        player.sprite.setTint(0x00ffff);

        this.time.delayedCall(1500, () => {
            player.isInvincible = false;
            player.sprite.clearTint();
        });
    }

    // =========================
    // 🧱 Platform system
    // =========================
    createPlatform(rect) {
        const platform = this.add.rectangle(
            rect.x + rect.w / 2,
            rect.y + rect.h / 2,
            rect.w,
            rect.h,
            0xff0000,
            0.1 // 🔥 visible for debug
        );

        this.physics.add.existing(platform, true);
        this.platformGroup.add(platform);

        this.platforms.push({ gameObject: platform, ...rect });
    }

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

    getRect(p1, p2) {
        return {
            x: Math.min(p1.x, p2.x),
            y: Math.min(p1.y, p2.y),
            w: Math.abs(p1.x - p2.x),
            h: Math.abs(p1.y - p2.y)
        };
    }
}