import Player from './player/Player.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');

        // Solo mode
        this.isSpawningEnemies = false;
        this.killCount = 0;
        this.maxEnemies = 3;

        this.platforms = [];
        this.players = [];
        this.enemies = [];

        this.mode = 'solo';

        // Multiplayer specific
        this.socket = null;
        this.roomId = null;
        this.localPlayer = null;
        this.otherPlayerMap = {};
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
        // ─── Read scene data ──────────────────────────────
        const data = this.scene.settings.data || {};
        this.mode = data.mode || 'solo';
        this.roomId = data.roomId || null;
        this.socket = data.socket || null;

        // ─── Reset everything ─────────────────────────────
        this.players = [];
        this.enemies = [];
        this.platforms = [];
        this.otherPlayerMap = {};
        this.localPlayer = null;
        this.killCount = 0;
        this.maxEnemies = 3;
        this.isSpawningEnemies = false;
        this.multiplayerReady = false;

        // ─── Physics group for remote players ─────────────
        this.otherPlayers = this.physics.add.group();

        // 🌍 Background
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0);

        const worldWidth = this.bg.width;
        const worldHeight = this.bg.height;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

        // 🎬 Animations
        this.createAnimations();

        // 🧱 Platform group
        this.platformGroup = this.physics.add.staticGroup();

        // ─── Load Colliders ───────────────────────────────
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

        // ─── Spawn Points (must match server!) ────────────
        this.spawnPoints = [
            // On the ground (y: 3747 surface)
            { x: 300, y: 3700 },
            { x: 600, y: 3700 },
            { x: 900, y: 3700 },
            { x: 1200, y: 3700 },
            { x: 1500, y: 3700 },

            // On platform (y: 3341 surface)
            { x: 550, y: 3290 },
            { x: 800, y: 3290 },
            { x: 1050, y: 3290 },

            // On platform (y: 3339 surface)
            { x: 1350, y: 3290 },
            { x: 1550, y: 3290 }
        ];

        // ─── Mode-specific setup ─────────────────────────
        if (this.mode === 'solo') {
            this.spawnPlayer();
            this.spawnEnemyWave();
            this.cameras.main.startFollow(this.players[0].sprite, true, 0.1, 0.1);
        } else if (this.mode === 'multiplayer') {
            // Show "Waiting..." until server sends currentPlayers
            this.waitingText = this.add.text(
                this.scale.width / 2,
                this.scale.height / 2,
                'JOINING MATCH...',
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '14px',
                    color: '#ffff00'
                }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(999);

            this.setupMultiplayer();
        }

        // ─── Draw Tool (debug) ───────────────────────────
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

        // ─── ESC to leave ────────────────────────────────
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.mode === 'multiplayer') {
                this.leaveMultiplayer();
            } else {
                this.scene.start('MenuScene');
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🌐 MULTIPLAYER SETUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    setupMultiplayer() {
        if (!this.socket) {
            this.socket = io('http://localhost:8081');
        }

        // Remove any old listeners to prevent duplicates
        this.socket.removeAllListeners();

        // ── 1. Receive ALL current players in the room ────
        this.socket.on('currentPlayers', (players) => {
            console.log('📋 currentPlayers received:', Object.keys(players));

            Object.keys(players).forEach((id) => {
                if (id === this.socket.id) {
                    this.spawnLocalPlayer(players[id]);
                } else {
                    this.addRemotePlayer(players[id]);
                }
            });

            // Hide waiting text
            if (this.waitingText) {
                this.waitingText.destroy();
                this.waitingText = null;
            }

            this.multiplayerReady = true;

            // Request initial scoreboard
            this.socket.emit('getScoreboard');
        });

        // ── 2. A new player joined ──────────────────────
        this.socket.on('newPlayer', (playerInfo) => {
            console.log('👤 newPlayer:', playerInfo.playerId);
            this.addRemotePlayer(playerInfo);

            // Show join message
            this.showKillMessage('PLAYER JOINED!', '#4488ff');

            this.socket.emit('getScoreboard');
        });

        // ── 3. A player left ────────────────────────────
        this.socket.on('disconnectUser', (playerId) => {
            console.log('👤 disconnectUser:', playerId);
            this.removeRemotePlayer(playerId);
            this.showKillMessage('PLAYER LEFT', '#888888');
        });

        // ── 4. A player moved ───────────────────────────
        this.socket.on('playerMoved', (playerInfo) => {
            const remote = this.otherPlayerMap[playerInfo.playerId];
            if (!remote) return;

            remote.targetX = playerInfo.x;
            remote.targetY = playerInfo.y;
            remote.sprite.flipX = playerInfo.flipX;

            if (playerInfo.anim && remote.sprite.anims) {
                remote.sprite.anims.play(playerInfo.anim, true);
            }
        });

        // ── 5. A player took damage ─────────────────────
        this.socket.on('playerDamaged', (data) => {
            // If WE got hit
            if (data.targetId === this.socket.id && this.localPlayer) {
                this.localPlayer.health = data.remainingHealth;

                if (this.localPlayer.sprite && this.localPlayer.sprite.active) {
                    this.localPlayer.sprite.anims.play('hurt_anim', true);
                    this.localPlayer.sprite.setTint(0xff0000);
                    this.time.delayedCall(200, () => {
                        if (this.localPlayer && this.localPlayer.sprite && this.localPlayer.sprite.active) {
                            this.localPlayer.sprite.clearTint();
                        }
                    });
                }
            }

            // If a REMOTE player got hit
            const remote = this.otherPlayerMap[data.targetId];
            if (remote && remote.sprite && remote.sprite.active) {
                remote.health = data.remainingHealth;
                remote.sprite.anims.play('hurt_anim', true);
                remote.sprite.setTint(0xff0000);
                this.time.delayedCall(200, () => {
                    if (remote.sprite && remote.sprite.active) {
                        remote.sprite.setTint(0xff6666);
                    }
                });
            }
        });

        // ── 6. A player was killed ──────────────────────
        this.socket.on('playerKilled', (data) => {
            console.log(`💀 ${data.victimId} killed by ${data.killerId}`);

            if (data.victimId === this.socket.id && this.localPlayer) {
                this.localPlayer.sprite.anims.play('death_anim', true);
                this.localPlayer.isControlled = false;
                this.showKillMessage('YOU DIED!', '#ff4444');
            }

            const remote = this.otherPlayerMap[data.victimId];
            if (remote && remote.sprite && remote.sprite.active) {
                remote.sprite.anims.play('death_anim', true);
                remote.sprite.setTint(0x444444);
            }

            if (data.killerId === this.socket.id) {
                this.showKillMessage('KILL!', '#44ff44');
            }

            this.socket.emit('getScoreboard');
        });

        // ── 7. A player respawned ───────────────────────
        this.socket.on('playerRespawned', (data) => {
            if (data.playerId === this.socket.id && this.localPlayer) {
                this.localPlayer.sprite.setPosition(data.x, data.y);
                this.localPlayer.sprite.setVelocity(0, 0);
                this.localPlayer.health = data.health;
                this.localPlayer.isControlled = true;
                this.localPlayer.sprite.anims.play('idle_anim', true);
                this.applySpawnProtection(this.localPlayer);
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.1, 0.1);
            }

            const remote = this.otherPlayerMap[data.playerId];
            if (remote && remote.sprite) {
                remote.sprite.setPosition(data.x, data.y);
                remote.sprite.setVelocity(0, 0);
                remote.targetX = data.x;
                remote.targetY = data.y;
                remote.health = data.health;
                remote.sprite.setTint(0xff6666);
                remote.sprite.anims.play('idle_anim', true);
                remote.sprite.setActive(true).setVisible(true);
            }
        });

        // ── 8. Scoreboard ───────────────────────────────
        this.socket.on('scoreboard', (scores) => {
            this.updateScoreboard(scores);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🎮 SPAWN LOCAL PLAYER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    spawnLocalPlayer(playerInfo) {
        // Prevent double-spawn
        if (this.localPlayer) {
            console.warn('⚠️ Local player already exists, skipping spawn');
            return;
        }

        console.log(`🟢 Spawning LOCAL player at (${playerInfo.x}, ${playerInfo.y})`);

        const player = new Player(this, playerInfo.x, playerInfo.y, playerInfo.playerId, true);
        player.health = playerInfo.health || 100;

        // Disable gravity briefly to let collider register, then re-enable
        player.sprite.body.setAllowGravity(true);

        this.localPlayer = player;
        this.players.push(player);

        this.physics.add.collider(player.sprite, this.platformGroup);
        this.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);

        this.applySpawnProtection(player);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  👥 ADD / REMOVE REMOTE PLAYERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    addRemotePlayer(playerInfo) {
        // Don't add duplicates
        if (this.otherPlayerMap[playerInfo.playerId]) {
            console.warn('⚠️ Remote player already exists:', playerInfo.playerId);
            return;
        }

        // Don't add ourselves
        if (this.socket && playerInfo.playerId === this.socket.id) {
            return;
        }

        console.log(`🔴 Spawning REMOTE player: ${playerInfo.playerId} at (${playerInfo.x}, ${playerInfo.y})`);

        const remotePlayer = new Player(this, playerInfo.x, playerInfo.y, playerInfo.playerId, false);
        remotePlayer.health = playerInfo.health || 100;
        remotePlayer.sprite.setTint(0xff6666);

        // Interpolation targets
        remotePlayer.targetX = playerInfo.x;
        remotePlayer.targetY = playerInfo.y;

        // Store by ID
        this.otherPlayerMap[playerInfo.playerId] = remotePlayer;

        // Add to physics group
        this.otherPlayers.add(remotePlayer.sprite);
        remotePlayer.sprite.playerId = playerInfo.playerId;

        this.physics.add.collider(remotePlayer.sprite, this.platformGroup);
    }

    removeRemotePlayer(playerId) {
        const remote = this.otherPlayerMap[playerId];
        if (!remote) return;

        console.log(`❌ Removing remote player: ${playerId}`);

        if (remote.sprite) {
            remote.sprite.destroy();
        }

        delete this.otherPlayerMap[playerId];
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ⚔️ ATTACK SYSTEM (multiplayer)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    sendAttackToServer(targetId, damage) {
        if (!this.socket || this.mode !== 'multiplayer') return;

        this.socket.emit('playerAttack', {
            targetId: targetId,
            damage: damage
        });
    }

    checkAttackHits(attackX, attackY, attackW, attackH, damage) {
        if (this.mode !== 'multiplayer') return;

        Object.keys(this.otherPlayerMap).forEach(id => {
            const remote = this.otherPlayerMap[id];
            if (!remote || !remote.sprite || !remote.sprite.active) return;
            if (remote.health <= 0) return;

            const rx = remote.sprite.x;
            const ry = remote.sprite.y;
            const rw = remote.sprite.displayWidth * 0.3;
            const rh = remote.sprite.displayHeight * 0.5;

            const overlap =
                attackX < rx + rw / 2 &&
                attackX + attackW > rx - rw / 2 &&
                attackY < ry + rh / 2 &&
                attackY + attackH > ry - rh / 2;

            if (overlap) {
                this.sendAttackToServer(id, damage);
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  📊 SCOREBOARD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    updateScoreboard(scores) {
        if (this.scoreboardElements) {
            this.scoreboardElements.forEach(el => el.destroy());
        }
        this.scoreboardElements = [];

        const startX = 10;
        const startY = 10;

        const bg = this.add.rectangle(startX, startY, 200, 16 + scores.length * 14 + 4, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.scoreboardElements.push(bg);

        const header = this.add.text(startX + 5, startY + 2, 'SCOREBOARD', {
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#ffff00'
        })
        .setScrollFactor(0)
        .setDepth(100);
        this.scoreboardElements.push(header);

        scores.forEach((entry, index) => {
            const isMe = this.socket && entry.playerId === this.socket.id;
            const color = isMe ? '#44ff44' : '#ffffff';
            const prefix = isMe ? '► ' : '  ';
            const shortId = entry.playerId.substring(0, 6);

            const row = this.add.text(
                startX + 5,
                startY + 16 + (index * 14),
                `${prefix}${shortId}  K:${entry.kills}  D:${entry.deaths}`,
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '7px',
                    color: color
                }
            )
            .setScrollFactor(0)
            .setDepth(100);

            this.scoreboardElements.push(row);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  💬 KILL MESSAGE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    showKillMessage(text, color) {
        const { width, height } = this.scale;

        const msg = this.add.text(width / 2, height * 0.3, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            color: color,
            stroke: '#000000',
            strokeThickness: 4
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200);

        this.tweens.add({
            targets: msg,
            alpha: 0,
            y: height * 0.25,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => msg.destroy()
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🚪 LEAVE MULTIPLAYER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    leaveMultiplayer() {
        if (this.socket) {
            this.socket.emit('leaveRoom');
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        if (this.scoreboardElements) {
            this.scoreboardElements.forEach(el => el.destroy());
            this.scoreboardElements = [];
        }

        this.scene.start('LobbyScene');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🔄 UPDATE LOOP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    update() {
        if (this.mode === 'solo') {
            this.updateSolo();
        }

        if (this.mode === 'multiplayer') {
            this.updateMultiplayer();
        }
    }

    updateSolo() {
        // Count kills
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

        this.players = this.players.filter(p => p && p.sprite && p.sprite.active && p.state !== 'dead');

        this.maxEnemies = Math.min(
            this.spawnPoints.length,
            3 + Math.floor(this.killCount / 3)
        );

        if (this.enemies.length === 0 && !this.isSpawningEnemies) {
            this.isSpawningEnemies = true;
            const needed = this.maxEnemies - this.enemies.length;

            this.time.delayedCall(1000, () => {
                this.spawnEnemyWave(needed);
                this.isSpawningEnemies = false;
            });
        }

        this.players.forEach(p => p.update());
        this.enemies.forEach(e => e.update());
    }

    updateMultiplayer() {
        // Don't update until we've received currentPlayers
        if (!this.multiplayerReady) return;

        // Update local player + emit movement
        if (this.localPlayer && this.localPlayer.sprite && this.localPlayer.sprite.active) {
            this.localPlayer.update();

            // Only emit if we have a socket and player is controlled
            if (this.socket && this.localPlayer.isControlled) {
                const s = this.localPlayer.sprite;
                const x = Math.round(s.x);
                const y = Math.round(s.y);
                const flipX = s.flipX;
                const anim = s.anims.currentAnim ? s.anims.currentAnim.key : 'idle_anim';

                if (
                    this.localPlayer.lastX !== x ||
                    this.localPlayer.lastY !== y ||
                    this.localPlayer.lastFlip !== flipX ||
                    this.localPlayer.lastAnim !== anim
                ) {
                    this.socket.emit('playerMovement', { x, y, flipX, anim });
                    this.localPlayer.lastX = x;
                    this.localPlayer.lastY = y;
                    this.localPlayer.lastFlip = flipX;
                    this.localPlayer.lastAnim = anim;
                }
            }
        }

        // Interpolate remote players
        Object.keys(this.otherPlayerMap).forEach(id => {
            const remote = this.otherPlayerMap[id];
            if (!remote || !remote.sprite || !remote.sprite.active) return;

            if (remote.targetX !== undefined && remote.targetY !== undefined) {
                const lerpSpeed = 0.2;
                remote.sprite.x += (remote.targetX - remote.sprite.x) * lerpSpeed;
                remote.sprite.y += (remote.targetY - remote.sprite.y) * lerpSpeed;
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🎬 ANIMATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createAnimations() {
        if (this.anims.exists('idle_anim')) return;

        this.anims.create({ key: 'idle_anim', frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 11 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'walk_anim', frames: this.anims.generateFrameNumbers('walk', { start: 0, end: 11 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'hurt_anim', frames: this.anims.generateFrameNumbers('hurt', { start: 0, end: 3 }), frameRate: 10 });
        this.anims.create({ key: 'death_anim', frames: this.anims.generateFrameNumbers('death', { start: 0, end: 5 }), frameRate: 8 });
        this.anims.create({ key: 'attack_1', frames: this.anims.generateFrameNumbers('attack', { start: 0, end: 3 }), frameRate: 14 });
        this.anims.create({ key: 'attack_2', frames: this.anims.generateFrameNumbers('attack', { start: 4, end: 7 }), frameRate: 16 });
        this.anims.create({ key: 'attack_3', frames: this.anims.generateFrameNumbers('attack', { start: 8, end: 11 }), frameRate: 18 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🧍 SPAWN (Solo mode only)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
            enemy.countedAsKill = false;

            enemy.sprite.setTint(0xff0000);

            this.enemies.push(enemy);
            this.physics.add.collider(enemy.sprite, this.platformGroup);
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🔄 RESPAWN (Solo mode)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    respawnPlayer() {
        const spawn = Phaser.Utils.Array.GetRandom(this.spawnPoints);
        const player = new Player(this, spawn.x, spawn.y);

        this.players.push(player);
        this.physics.add.collider(player.sprite, this.platformGroup);
        this.applySpawnProtection(player);
        this.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);

        this.enemies.forEach(enemy => {
            enemy.aiState = 'chase';
            enemy.attackCooldown = false;
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ⚔️ SPAWN PROTECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    applySpawnProtection(player) {
        player.isInvincible = true;
        player.sprite.setTint(0x00ffff);

        this.time.delayedCall(1500, () => {
            if (player && player.sprite && player.sprite.active) {
                player.isInvincible = false;
                player.sprite.clearTint();
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🧱 PLATFORM SYSTEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createPlatform(rect) {
        const platform = this.add.rectangle(
            rect.x + rect.w / 2,
            rect.y + rect.h / 2,
            rect.w,
            rect.h,
            0xff0000,
            0.1
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