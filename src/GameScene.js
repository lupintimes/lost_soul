import Player from './player/Player.js';
import SocketManager from './SocketManager.js';
import PlayerData from './PlayerData.js';

const SPELL_COLORS = {
    'p1': 0x00ffff,
    'p2': 0xff8c00,
    'p3': 0x9b30ff
};

export default class GameScene extends Phaser.Scene {

    // Add this method to GameScene class
    safePlaySound(key, volume = 0.5) {
        try {
            if (this.cache.audio.exists(key)) {
                this.sound.play(key, { volume: volume * PlayerData.sfxVolume });
            }
        } catch (e) {
            // ignore
        }
    }

    constructor() {
        super('GameScene');

        this.isSpawningEnemies = false;
        this.killCount = 0;
        this.deathCount = 0;
        this.maxEnemies = 12;

        this.platforms = [];
        this.players = [];
        this.enemies = [];

        this.mode = 'solo';

        this.socket = null;
        this.roomId = null;
        this.localPlayer = null;
        this.otherPlayerMap = {};
        this.isChatActive = false;


    }

    preload() { }

    createTeleporters() {
        const portalKeys = ['portal_gold', 'portal_pink', 'portal_teal', 'portal_purple', 'portal_gray'];
        this.teleports.forEach((tp, i) => {
            const portalKey = portalKeys[i % portalKeys.length];
            const teleporter = this.add.sprite(tp.x, tp.y, portalKey)
                .setDepth(1)
                .setAlpha(1)
                .setScale(0.4);

            // Pulsing animation
            this.tweens.add({
                targets: teleporter,
                alpha: 0.8,
                scale: 0.45,
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.teleporterSprites.push(teleporter);
        });
    }

    checkTeleports() {
        // ✅ Get the correct player based on mode
        let player;
        if (this.mode === 'multiplayer') {
            if (!this.localPlayer) return;
            player = this.localPlayer.sprite;
        } else {
            if (!this.players[0]) return;
            player = this.players[0].sprite;
        }

        if (!this.canTeleport || !player) return;

        const teleports = this.teleports;
        const len = teleports.length;

        // ✅ Check each teleporter
        for (let i = 0; i < len; i++) {
            const tp = teleports[i];

            const dist = Phaser.Math.Distance.Between(
                player.x,
                player.y,
                tp.x,
                tp.y
            );

            if (dist < 100) {
                console.log(`🌀 Teleporting from (${tp.x}, ${tp.y}) to (${tp.tx}, ${tp.ty})`);

                this.canTeleport = false;

                player.setPosition(tp.tx, tp.ty);
                player.setVelocity(0, 0);

                this.cameras.main.flash(200, 255, 255, 255);
                this.safePlaySound('sfx_teleport', 0.5); // if you have this sound

                this.time.delayedCall(1000, () => {
                    this.canTeleport = true;
                });

                break; // Only teleport once per check
            }
        }
    }

    handlePointerDown(pointer) {
        const world = pointer.positionToCamera(this.cameras.main);
        this.startPoint = world;
        this.isDrawing = true;
        this.isDeletingByRegion = this.keyX.isDown;
    }

    handlePointerMove(pointer) {
        if (!this.isDrawing) return;
        const world = pointer.positionToCamera(this.cameras.main);

        if (this.isDeletingByRegion) {
            const rect = this.getRect(this.startPoint, world);
            this.preview.clear();
            this.preview.lineStyle(2, 0xff0000, 1);
            this.preview.fillStyle(0xff0000, 0.25);
            this.preview.fillRect(rect.x, rect.y, rect.w, rect.h);
            this.preview.strokeRect(rect.x, rect.y, rect.w, rect.h);
        } else {
            // Limit dimensions to max area while dragging
            let dx = world.x - this.startPoint.x;
            let dy = world.y - this.startPoint.y;
            let w = Math.abs(dx);
            let h = Math.abs(dy);
            let area = w * h;

            const availablePoints = Math.max(0, this.MAX_BUILD_POINTS - this.getUsedBuildPoints());
            const maxAllowedArea = Math.min(this.OBSTACLE_MAX_AREA, availablePoints);
            if (area > maxAllowedArea) {
                const scale = Math.sqrt(maxAllowedArea / Math.max(1, area));
                dx *= scale;
                dy *= scale;
            }

            const clampedWorld = {
                x: this.startPoint.x + dx,
                y: this.startPoint.y + dy
            };
            const rect = this.getRect(this.startPoint, clampedWorld);

            this.preview.clear();
            this.preview.lineStyle(2, 0xffff00, 1);
            this.preview.strokeRect(rect.x, rect.y, rect.w, rect.h);
        }
    }

    performRegionDeletion(rect, pointer) {
        let deletedCount = 0;
        let hasAttemptedForeignDelete = false;

        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (!p.deletable) continue;

            // Bounding box overlap check between selection rect and platform p
            const overlap =
                rect.x < p.x + p.w &&
                rect.x + rect.w > p.x &&
                rect.y < p.y + p.h &&
                rect.y + rect.h > p.y;

            if (overlap) {
                const isOwner = this.mode !== 'multiplayer' || !p.creatorId || p.creatorId === this.socket.id;
                if (isOwner) {
                    // Remove old obstacle locally
                    if (p.gameObject) p.gameObject.destroy();
                    if (p.outer) p.outer.destroy();
                    if (p.middle) p.middle.destroy();
                    if (p.jelly) p.jelly.destroy();

                    this.platforms.splice(i, 1);

                    // Notify server of deletion
                    if (this.mode === 'multiplayer' && this.socket && p.id) {
                        this.socket.emit('removeObstacle', { id: p.id });
                    }

                    // Compute remaining pieces of the obstacle outside the selection rectangle
                    const pieces = this.subtractRect(p, rect);

                    // Create and sync remaining split pieces
                    pieces.forEach((piece, index) => {
                        const subId = p.id ? `${p.id}_sub_${index}_${Date.now()}` : `${p.creatorId}_sub_${Date.now()}_${index}`;
                        this.createObstacle(piece, p.opacity || 0.9, subId, p.creatorId, false, p.tint, p.blockType);

                        if (this.mode === 'multiplayer' && this.socket) {
                            this.socket.emit('createObstacle', {
                                id: subId,
                                rect: piece,
                                opacity: p.opacity || 0.9,
                                creatorId: p.creatorId,
                                tint: p.tint,
                                blockType: p.blockType,
                                createdAt: Date.now()
                            });
                        }
                    });

                    deletedCount++;
                } else {
                    hasAttemptedForeignDelete = true;
                }
            }
        }

        if (deletedCount > 0) {
            this.showKillMessage(`REMOVED ${deletedCount} OBSTACLES!`, '#44ff44');
            this.updateBuildPointsUI();
        } else if (hasAttemptedForeignDelete) {
            this.showKillMessage("CANNOT REMOVE OTHER PLAYERS' OBSTACLES!", '#ff4444');
        }
    }

    handlePointerUp(pointer) {
        if (!this.isDrawing) return;
        const world = pointer.positionToCamera(this.cameras.main);

        if (this.isDeletingByRegion) {
            const rect = this.getRect(this.startPoint, world);

            // If the selection rectangle is extremely small, treat it as a single point deletion
            if (rect.w < 5 && rect.h < 5) {
                this.removeobstacle(pointer);
            } else {
                this.performRegionDeletion(rect, pointer);
            }

            this.preview.clear();
            this.isDrawing = false;
            this.isDeletingByRegion = false;
        } else {
            // Apply same limit clamping on pointer up
            let dx = world.x - this.startPoint.x;
            let dy = world.y - this.startPoint.y;
            let w = Math.abs(dx);
            let h = Math.abs(dy);
            let area = w * h;

            const availablePoints = Math.max(0, this.MAX_BUILD_POINTS - this.getUsedBuildPoints());
            const maxAllowedArea = Math.min(this.OBSTACLE_MAX_AREA, availablePoints);
            if (area > maxAllowedArea) {
                const scale = Math.sqrt(maxAllowedArea / Math.max(1, area));
                dx *= scale;
                dy *= scale;
            }

            const clampedWorld = {
                x: this.startPoint.x + dx,
                y: this.startPoint.y + dy
            };
            const rect = this.getRect(this.startPoint, clampedWorld);
            const opacity = 0.9;

            // Always generate a unique ID (even in solo) so decay timers target the correct block
            const id = this.mode === 'multiplayer' && this.socket
                ? `${this.socket.id}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`
                : `solo_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
            const creatorId = this.mode === 'multiplayer' && this.socket ? this.socket.id : null;
            const tint = PlayerData.getColorTint();
            const blockType = this.selectedBlockType || 'normal';
            const success = this.createObstacle(rect, opacity, id, creatorId, true, tint, blockType);
            if (success) {
                this.safePlaySound('sfx_block_place', 0.5);
            }

            if (success && this.mode === 'multiplayer' && this.socket) {
                this.socket.emit('createObstacle', { id, rect, opacity, creatorId, tint, blockType, createdAt: Date.now() });
            }

            this.preview.clear();
            this.isDrawing = false;
        }
    }

    create() {
        this.cameras.main.setRoundPixels(false);
        this.game.events.on('visible', () => {
            this.anims.resumeAll();
        });
        // Clean up DOM chat elements on scene shutdown or destroy
        this.events.on('shutdown', () => { this.cleanupChat(); this.cleanupDOMUI(); });
        this.events.on('destroy', () => { this.cleanupChat(); this.cleanupDOMUI(); });

        const data = this.scene.settings.data || {};
        this.mode = data.mode || 'solo';
        this.roomId = data.roomId || null;
        this.selectedCharacter = data.character || 'p1';

        this.socket = SocketManager.get();

        // Reset everything
        this.isRespawning = false;
        this.players = [];
        this.enemies = [];
        this.platforms = [];
        this.otherPlayerMap = {};
        this.localPlayer = null;
        this.spells = [];
        this.killCount = 0;
        this.deathCount = 0;
        this.maxEnemies = 12;
        this.isSpawningEnemies = false;
        this.multiplayerReady = false;
        // Reset teleporter state
        this.canTeleport = true;
        this.teleporterSprites = [];
        this.teleports = [
            { x: 375, y: 2900, tx: 2350, ty: 2244 },
            { x: 2293, y: 2244, tx: 3000, ty: 226 },
            { x: 2937, y: 226, tx: 3450, ty: 219 },
            { x: 3356, y: 219, tx: 5600, ty: 3542 },
            { x: 5510, y: 3542, tx: 450, ty: 2900 }
        ];
        this.createTeleporters();

        // 🌍 Background
        this.bg = this.add.image(0, 0, 'bg')
            .setOrigin(0)
            .setDepth(-10)
            .setVisible(false);

        // 🧱 Red Region Parallax Layer
        this.redBg = this.add.image(1575, 400, 'bg_red')
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0.8, 0.8)
            .setScale(1.1)
            .setDepth(-8);

        // 🛡️ Create 5-sided polygon geometry mask
        const maskGraphics = this.add.graphics().setVisible(false);
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.beginPath();
        maskGraphics.moveTo(0, 0);
        maskGraphics.lineTo(3150, 0);
        maskGraphics.lineTo(3150, 650);
        maskGraphics.lineTo(2500, 1250);
        maskGraphics.lineTo(0, 1250);
        maskGraphics.closePath();
        maskGraphics.fillPath();

        const mask = maskGraphics.createGeometryMask();
        this.redBg.setMask(mask);



        // 🧱 Yellow Region Parallax Layer
        this.yellowBg = this.add.image(1250, 1700, 'bg_yellow')
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0.8, 0.8)
            .setScale(1.1)
            .setDepth(-8);

        // 🛡️ Create 4-sided polygon geometry mask for Yellow Region
        const yellowMaskGraphics = this.add.graphics().setVisible(false);
        yellowMaskGraphics.fillStyle(0xffffff);
        yellowMaskGraphics.beginPath();
        yellowMaskGraphics.moveTo(0, 1250);
        yellowMaskGraphics.lineTo(2500, 1250);
        yellowMaskGraphics.lineTo(2500, 2600);
        yellowMaskGraphics.lineTo(0, 2600);
        yellowMaskGraphics.closePath();
        yellowMaskGraphics.fillPath();

        const yellowMask = yellowMaskGraphics.createGeometryMask();
        this.yellowBg.setMask(yellowMask);



        // 🧱 Grey Region Parallax Layer
        this.greyBg = this.add.image(1850, 2800, 'bg_grey')
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0.8, 0.8)
            .setScale(1.1)
            .setDepth(-8);

        // 🛡️ Create 6-sided polygon geometry mask for Grey Region
        const greyMaskGraphics = this.add.graphics().setVisible(false);
        greyMaskGraphics.fillStyle(0xffffff);
        greyMaskGraphics.beginPath();
        greyMaskGraphics.moveTo(0, 2600);
        greyMaskGraphics.lineTo(2050, 2600);
        greyMaskGraphics.lineTo(2050, 3000);
        greyMaskGraphics.lineTo(3700, 3000);
        greyMaskGraphics.lineTo(3700, 4000);
        greyMaskGraphics.lineTo(0, 4000);
        greyMaskGraphics.closePath();
        greyMaskGraphics.fillPath();

        const greyMask = greyMaskGraphics.createGeometryMask();
        this.greyBg.setMask(greyMask);



        // 🧱 Purple Region Parallax Layer
        this.purpleBg = this.add.image(4300, 2300, 'bg_purple')
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0.8, 0.8)
            .setScale(1.1)
            .setDepth(-8);

        // 🛡️ Create 4-sided polygon geometry mask for Purple Region
        const purpleMaskGraphics = this.add.graphics().setVisible(false);
        purpleMaskGraphics.fillStyle(0xffffff);
        purpleMaskGraphics.beginPath();
        purpleMaskGraphics.moveTo(3750, 1400);
        purpleMaskGraphics.lineTo(6000, 1400);
        purpleMaskGraphics.lineTo(6000, 4000);
        purpleMaskGraphics.lineTo(3750, 4000);
        purpleMaskGraphics.closePath();
        purpleMaskGraphics.fillPath();

        const purpleMask = purpleMaskGraphics.createGeometryMask();
        this.purpleBg.setMask(purpleMask);



        // 🧱 Green Region Parallax Layer
        this.greenBg = this.add.image(3500, 1450, 'bg_green')
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0.8, 0.8)
            .setScale(1.1)
            .setDepth(-8);

        // 🛡️ Create 8-sided polygon geometry mask for Green Region
        const greenMaskGraphics = this.add.graphics().setVisible(false);
        greenMaskGraphics.fillStyle(0xffffff);
        greenMaskGraphics.beginPath();
        greenMaskGraphics.moveTo(3150, 0);
        greenMaskGraphics.lineTo(6000, 0);
        greenMaskGraphics.lineTo(6000, 1400);
        greenMaskGraphics.lineTo(3750, 1400);
        greenMaskGraphics.lineTo(3750, 2900);
        greenMaskGraphics.lineTo(2500, 2900);
        greenMaskGraphics.lineTo(2500, 1150);
        greenMaskGraphics.lineTo(3150, 650);
        greenMaskGraphics.closePath();
        greenMaskGraphics.fillPath();

        const greenMask = greenMaskGraphics.createGeometryMask();
        this.greenBg.setMask(greenMask);



        this.border = this.add.image(0, 0, 'border')
            .setOrigin(0)
            .setDepth(-5);

        const worldWidth = this.border.width;
        const worldHeight = this.border.height;

        // Ensure background image fits the full world dimensions
        this.bg.setDisplaySize(worldWidth, worldHeight);

        this.matter.world.setBounds(0, 0, worldWidth, worldHeight);

        // 🎬 Animations
        this.createAnimations();

        const map = this.make.tilemap({ key: 'map' });

        const collisionLayer = map.getObjectLayer('collision');

        collisionLayer.objects.forEach(obj => {

            this.createPlatform({
                x: obj.x,
                y: obj.y,
                w: obj.width,
                h: obj.height,
                rotation: obj.rotation
            });
        });

        this.canTeleport = true;


        // 🎥 Camera bounds
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // ─── Spawn Points — MUST MATCH SERVER ─────────────
        const SPAWN_OFFSET = 60;

        // ─── Spawn Points — EXACT for 152px player height ────
        this.spawnPoints = [
            // Original starting spawn points
            { x: 300, y: 3669 },
            { x: 600, y: 3669 },
            { x: 900, y: 3669 },
            { x: 1200, y: 3669 },
            { x: 1500, y: 3669 },
            { x: 550, y: 3263 },
            { x: 800, y: 3263 },
            { x: 1350, y: 3261 },
            { x: 1550, y: 3261 },
            { x: 1050, y: 3053 },

            // Middle ground & platforms
            { x: 1800, y: 3757 },
            { x: 2100, y: 3757 },
            { x: 2400, y: 3757 },
            { x: 300, y: 2448 },
            { x: 800, y: 2448 },
            { x: 1300, y: 2448 },
            { x: 1800, y: 2448 },
            { x: 2700, y: 2744 },
            { x: 3100, y: 2744 },
            { x: 3500, y: 2744 },

            // Right side ground & platforms
            { x: 4000, y: 3781 },
            { x: 4300, y: 3781 },
            { x: 4600, y: 3781 },
            { x: 5000, y: 3781 },
            { x: 5300, y: 3781 },
            { x: 4900, y: 3596 },
            { x: 5300, y: 3596 },
            { x: 5700, y: 3596 },

            // High altitude platforms
            { x: 4000, y: 2224 },
            { x: 4400, y: 2224 },
            { x: 4700, y: 2224 },
            { x: 4700, y: 1910 },
            { x: 5000, y: 1910 },
            { x: 4800, y: 792 },
            { x: 5100, y: 792 },
            { x: 5600, y: 792 },
            { x: 5800, y: 792 },

            // User-defined additional spawn positions
            { x: 150, y: 200 },
            { x: 230, y: 1000 },
            { x: 2050, y: 975 },
            { x: 3350, y: 270 },
            { x: 5060, y: 1200 },
            { x: 2700, y: 2650 },
            { x: 2880, y: 1240 },
            { x: 300, y: 2275 },
            { x: 1200, y: 2350 },
            { x: 2300, y: 2060 },
            { x: 4050, y: 2050 },
            { x: 4125, y: 3085 },
            { x: 5445, y: 3575 },
            { x: 5300, y: 2850 }
        ];

        // ─── Mode Setup ──────────────────────────────────
        if (this.mode === 'solo') {
            this.maxEnemies = 6;
            const playerSpawn = this.spawnPlayer();
            this.spawnInitialEnemies(playerSpawn);
            this.cameras.main.startFollow(this.players[0].sprite, true, 0.1, 0.1);

        } else if (this.mode === 'multiplayer') {
            if (!this.socket || !this.socket.connected) {
                console.error('❌ No socket! Going back to lobby.');
                this.scene.start('LobbyScene');
                return;
            }

            this.waitingText = this.add.text(
                this.scale.width / 2,
                this.scale.height / 2,
                'JOINING MATCH...',
                {
                    fontFamily: '"Cormorant Garamond"',
                    fontSize: '22px',
                    fontWeight: 'bold',
                    color: '#7fa3c7'
                }
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(999);

            this.setupMultiplayer();
        }

        // ─── Obstacle Limit Configuration ────────────────
        this.OBSTACLE_MIN_WIDTH = 30;
        this.OBSTACLE_MIN_HEIGHT = 30;
        this.OBSTACLE_MIN_AREA = 900;
        this.OBSTACLE_MAX_AREA = 250000;
        this.MAX_BUILD_POINTS = 300000;

        // ─── Draw & Deletion Tool ────────────────────────
        this.preview = this.add.graphics();
        this.isDrawing = false;
        this.isDeletingByRegion = false;
        this.startPoint = null;
        this.keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.selectedBlockType = 'normal'; // 'normal', 'bounce', 'slide'
        this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

        this.input.on('pointerdown', this.handlePointerDown, this);
        this.input.on('pointermove', this.handlePointerMove, this);
        this.input.on('pointerup', this.handlePointerUp, this);





        this.input.keyboard.on('keydown-ESC', () => {
            if (this.isChatActive) return;
            if (this.mode === 'multiplayer') {
                this.leaveMultiplayer();
            } else {
                this.scene.start('MenuScene');
            }
        });

        this.initDOMUI();
        if (this.mode === 'multiplayer') {
            this.initChat();
        }
        this.createHUD();

    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🌐 MULTIPLAYER SETUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    setupMultiplayer() {
        this.socket = SocketManager.get();

        if (!this.socket) {
            console.error('❌ Socket is null!');
            return;
        }

        // ✅ Remove ONLY game-specific listeners (not all)
        this.socket.off('currentPlayers');
        this.socket.off('newPlayer');
        this.socket.off('disconnectUser');
        this.socket.off('playerMoved');
        this.socket.off('playerDamaged');
        this.socket.off('playerKilled');
        this.socket.off('playerRespawned');
        this.socket.off('scoreboard');
        this.socket.off('serverList');
        this.socket.off('serverCreated');
        this.socket.off('joinedServer');
        this.socket.off('lobbyError');
        this.socket.off('obstacleCreated');
        this.socket.off('obstacleRemoved');
        this.socket.off('currentObstacles');
        this.socket.off('spellCast');
        this.socket.off('shieldBlastReleased');

        // 1. Current players
        this.socket.on('currentPlayers', (players) => {
            if (this.multiplayerReady) return;

            console.log('📋 currentPlayers received:', players);

            if (!players || typeof players !== 'object' || Array.isArray(players)) {
                console.error('❌ Invalid players data!', players);
                return;
            }

            Object.keys(players).forEach((id) => {
                const playerData = players[id];
                if (!playerData || !playerData.playerId) return;

                if (id === this.socket.id) {
                    this.spawnLocalPlayer(playerData);
                } else {
                    this.addRemotePlayer(playerData);
                }
            });

            if (this.waitingText) {
                this.waitingText.destroy();
                this.waitingText = null;
            }

            this.multiplayerReady = true;
            this.socket.emit('getScoreboard');
        });

        // 2. New player
        this.socket.on('newPlayer', (playerInfo) => {
            console.log('👤 newPlayer:', playerInfo.playerId);
            this.addRemotePlayer(playerInfo);
            this.showKillMessage('PLAYER JOINED!', '#4488ff');
            this.socket.emit('getScoreboard');
        });

        // 3. Player left
        this.socket.on('disconnectUser', (playerId) => {
            console.log('👤 disconnectUser:', playerId);
            this.removeRemotePlayer(playerId);
            this.showKillMessage('PLAYER LEFT', '#6e85a0');
        });

        // 4. Player moved — ✅ THIS IS THE CRITICAL ONE
        this.socket.on('playerMoved', (playerInfo) => {


            const remote = this.otherPlayerMap[playerInfo.playerId];
            if (!remote) {
                console.log('❌ Remote player not found in map!'); // 🔍 DEBUG
                return;
            }
            if (!remote || !remote.sprite || !remote.sprite.active) return;

            remote.targetX = playerInfo.x;
            remote.targetY = playerInfo.y;
            remote.sprite.flipX = playerInfo.flipX;
            remote.isShieldActive = playerInfo.isShieldActive || false;
            remote.isRageActive = playerInfo.isRageActive || false;
            remote.state = playerInfo.state || 'idle';
            if (playerInfo.health !== undefined && remote.health && typeof remote.health === 'object') {
                remote.health.current = playerInfo.health;
            }
            remote.lastMovementUpdateTime = this.time.now;

            if (playerInfo.anim) {
                const currentAnim = remote.sprite.anims.currentAnim;
                if (!currentAnim || currentAnim.key !== playerInfo.anim) {
                    remote.sprite.anims.play(playerInfo.anim, true);
                }
            }
        });

        // 5. Player damaged
        this.socket.on('playerDamaged', (data) => {
            const attackerObj = (data.attackerId === this.socket.id) ? this.localPlayer : this.otherPlayerMap[data.attackerId];
            let targetObj = null;

            if (data.targetId === this.socket.id && this.localPlayer) {
                targetObj = this.localPlayer;
                // ✅ Block damage if invincible
                if (this.localPlayer.isInvincible) return;

                if (this.localPlayer.health && typeof this.localPlayer.health === 'object') {
                    this.localPlayer.health.current = data.remainingHealth;
                }

                if (data.hasTriggeredUndyingRage) {
                    this.localPlayer.hasTriggeredUndyingRage = true;
                    this.localPlayer.isRageActive = true;
                }

                this.safePlaySound('sfx_hurt', 0.4);

                if (this.localPlayer.sprite && this.localPlayer.sprite.active) {
                    this.localPlayer.sprite.anims.play(`${this.localPlayer.character}_hurt_anim`, true);
                    this.localPlayer.sprite.setTint(0xff0000);
                    this.time.delayedCall(200, () => {
                        if (this.localPlayer && this.localPlayer.sprite && this.localPlayer.sprite.active) {
                            this.localPlayer.sprite.clearTint();
                        }
                    });
                }
            }

            const remote = this.otherPlayerMap[data.targetId];
            if (remote && remote.sprite && remote.sprite.active) {
                targetObj = remote;
                if (remote.health && typeof remote.health === 'object') {
                    remote.health.current = data.remainingHealth;
                }

                if (data.hasTriggeredUndyingRage) {
                    remote.hasTriggeredUndyingRage = true;
                    remote.isRageActive = true;
                }

                this.safePlaySound('sfx_hurt', 0.2);

                remote.sprite.anims.play(`${remote.character}_hurt_anim`, true);
                remote.sprite.setTint(0xff0000);
                this.time.delayedCall(200, () => {
                    if (remote.sprite && remote.sprite.active) {
                        remote.sprite.setTint(0xff6666);
                    }
                });
            }

            // Show floating damage numbers and chill effect in multiplayer
            if (targetObj && targetObj.sprite && targetObj.sprite.active) {
                const isEnemyHit = (data.attackerId === this.socket.id);
                this.showDamageNumber(targetObj.sprite.x, targetObj.sprite.y - 40, data.damage, isEnemyHit);

                if (targetObj.health && data.damage > 0) {
                    targetObj.health.healthBarVisibleEndTime = this.time.now + 2000;
                }

                if (attackerObj && attackerObj.character === 'p1' && data.damage > 0) {
                    targetObj.applyChill(3000);
                    this.showDamageNumber(targetObj.sprite.x, targetObj.sprite.y - 65, 0, false, true); // CHILLED!
                }
            }
        });

        // 6. Player killed
        this.socket.on('playerKilled', (data) => {
            console.log(`💀 ${data.victimId} killed by ${data.killerId}`);

            // If WE died
            if (data.victimId === this.socket.id && this.localPlayer) {
                this.localPlayer.state = 'dead';
                this.localPlayer.sprite.anims.play(`${this.localPlayer.character}_death_anim`, true);
                this.localPlayer.isControlled = false;
                this.localPlayer.sprite.setVelocity(0, 0);
                this.safePlaySound('sfx_death', 0.5);
                this.showKillMessage('YOU DIED!', '#ff4444');
            }

            // If a REMOTE player died
            const remote = this.otherPlayerMap[data.victimId];
            if (remote && remote.sprite && remote.sprite.active) {
                remote.state = 'dead';
                remote.sprite.anims.play(`${remote.character}_death_anim`, true);
                remote.sprite.setTint(0x444444);

                this.safePlaySound('sfx_death', 0.2);
            }

            // If WE got the kill
            if (data.killerId === this.socket.id) {
                this.showKillMessage('KILL!', '#44ff44');
            }

            this.socket.emit('getScoreboard');
        });

        // 7. Player respawned
        this.socket.on('playerRespawned', (data) => {
            // If WE respawned
            if (data.playerId === this.socket.id && this.localPlayer) {
                this.localPlayer.sprite.setPosition(data.x, data.y);
                this.localPlayer.sprite.setVelocity(0, 0);
                this.localPlayer.state = 'idle';
                this.localPlayer.isControlled = true;

                // ✅ Reset health on HealthSystem
                if (this.localPlayer.health && typeof this.localPlayer.health === 'object') {
                    this.localPlayer.health.current = data.health;
                }

                this.localPlayer.sprite.anims.play(`${this.localPlayer.character}_idle_anim`, true);
                this.applySpawnProtection(this.localPlayer);
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.1, 0.1);
            }

            // If a REMOTE player respawned
            const remote = this.otherPlayerMap[data.playerId];
            if (remote && remote.sprite) {
                remote.sprite.setPosition(data.x, data.y);
                remote.targetX = data.x;
                remote.targetY = data.y;
                remote.state = 'idle';

                // ✅ Reset health on HealthSystem
                if (remote.health && typeof remote.health === 'object') {
                    remote.health.current = data.health;
                }

                remote.sprite.setTint(0xff6666);
                remote.sprite.anims.play(`${remote.character}_idle_anim`, true);
                remote.sprite.setActive(true).setVisible(true);
            }
        });

        // 8. Scoreboard
        this.socket.on('scoreboard', (scores) => {
            this.updateScoreboard(scores);
            if (this.socket) {
                const myScore = scores.find(s => s.playerId === this.socket.id);
                if (myScore) {
                    this.killCount = myScore.kills;
                    this.deathCount = myScore.deaths;
                }
            }
        });

        // 9. Obstacle sync events
        this.socket.on('obstacleCreated', (data) => {
            console.log('🧱 Remote obstacle created:', data.id);
            this.createObstacle(data.rect, data.opacity, data.id, data.creatorId, false, data.tint, data.blockType || 'normal', data.createdAt);
        });

        this.socket.on('obstacleRemoved', (data) => {
            console.log('🗑️ Remote obstacle removed:', data.id);
            this.destroyObstacleLocally(data.id, true);
        });

        this.socket.on('currentObstacles', (obstacles) => {
            console.log('📋 Received current obstacles:', obstacles);
            Object.keys(obstacles).forEach(id => {
                const obs = obstacles[id];
                if (!this.platforms.some(p => p.id === id)) {
                    this.createObstacle(obs.rect, obs.opacity, id, obs.creatorId, false, obs.tint, obs.blockType || 'normal', obs.createdAt);
                }
            });
        });

        // 10. Spell synchronization
        this.socket.on('spellCast', (data) => {
            console.log('🔮 Remote spell cast by:', data.casterId);
            const remotePlayer = this.otherPlayerMap[data.casterId];
            if (remotePlayer) {
                if (data.type === 'shield_block') {
                    remotePlayer.playSound('sfx_highjump', 0.5);
                    remotePlayer.isShieldActive = true;
                    remotePlayer.shieldBlocksAbsorbed = 0;
                } else {
                    remotePlayer.castSpellRemote(data.x, data.y, data.dir, data.spellId);
                }
            }
        });

        this.socket.on('shieldBlastReleased', (data) => {
            console.log('💥 Remote shield blast released by:', data.casterId);
            const remotePlayer = this.otherPlayerMap[data.casterId];
            if (remotePlayer) {
                remotePlayer.isShieldActive = false;
                remotePlayer.releaseShieldBlast(data.blastId, data.blocksAbsorbed);
            } else if (this.localPlayer && this.localPlayer.playerId === data.casterId) {
                this.localPlayer.isShieldActive = false;
                this.localPlayer.releaseShieldBlast(data.blastId, data.blocksAbsorbed);
            }
        });

        // ✅ Request players after all listeners are ready
        console.log('🔄 Requesting players from server...');
        this.socket.emit('requestPlayers');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🎮 SPAWN LOCAL PLAYER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    spawnLocalPlayer(playerInfo) {
        if (this.localPlayer) {

            return;
        }

        // ✅ Pass character
        const player = new Player(this, playerInfo.x, playerInfo.y, playerInfo.playerId, true, this.selectedCharacter);





        if (player.health && typeof player.health.setHealth === 'function') {
            player.health.setHealth(playerInfo.health || 100);
        } else {
            player.hp = playerInfo.health || 100;
        }

        this.localPlayer = player;
        this.players.push(player);

        player.sprite.setDepth(10);

        this.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);
        this.applySpawnProtection(player);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  👥 REMOTE PLAYERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    addRemotePlayer(playerInfo) {
        if (this.otherPlayerMap[playerInfo.playerId]) {
            console.warn('⚠️ Remote player already exists:', playerInfo.playerId);
            return;
        }

        if (this.socket && playerInfo.playerId === this.socket.id) {
            return;
        }



        console.log(`🔴 Spawning REMOTE player: ${playerInfo.playerId} at (${playerInfo.x}, ${playerInfo.y})`);

        const remoteChar = playerInfo.character || 'p1';
        const remotePlayer = new Player(this, playerInfo.x, playerInfo.y, playerInfo.playerId, false, remoteChar);
        remotePlayer.sprite.setTint(0xff6666);

        // Play idle animation immediately upon spawning
        remotePlayer.sprite.anims.play(`${remoteChar}_idle_anim`, true);

        // ✅ Disable gravity and physics for remote players in Matter
        remotePlayer.sprite.setSensor(true);
        remotePlayer.sprite.setIgnoreGravity(true);
        remotePlayer.sprite.setDepth(10);

        // Interpolation targets
        remotePlayer.targetX = playerInfo.x;
        remotePlayer.targetY = playerInfo.y;
        remotePlayer.lastMovementUpdateTime = this.time.now;

        remotePlayer.isShieldActive = playerInfo.isShieldActive || false;
        remotePlayer.isRageActive = playerInfo.isRageActive || false;

        // Store by ID
        this.otherPlayerMap[playerInfo.playerId] = remotePlayer;

        remotePlayer.sprite.playerId = playerInfo.playerId;
    }

    removeRemotePlayer(playerId) {
        const remote = this.otherPlayerMap[playerId];
        if (!remote) return;

        console.log(`❌ Removing remote: ${playerId}`);

        if (remote.sprite) {
            remote.sprite.destroy();
        }

        delete this.otherPlayerMap[playerId];
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ⚔️ ATTACK SYSTEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    sendAttackToServer(targetId, damage) {
        if (!this.socket || this.mode !== 'multiplayer') return;
        this.socket.emit('playerAttack', { targetId, damage });
    }

    checkAttackHits(attackX, attackY, attackW, attackH, damage) {
        if (this.mode !== 'multiplayer') return;
        if (!this.socket) return;

        Object.keys(this.otherPlayerMap).forEach(id => {
            const remote = this.otherPlayerMap[id];
            if (!remote || !remote.sprite || !remote.sprite.active) return;

            // ✅ Skip invincible players
            if (remote.isInvincible) return;

            if (remote.health && remote.health.current <= 0) return;

            const rx = remote.sprite.x;
            const ry = remote.sprite.y;
            const rw = 64;
            const rh = 152;

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
        const startY = 120;
        const rowH = 18;
        const panelH = 24 + scores.length * rowH + 8;

        const bg = this.add.graphics().setScrollFactor(0).setDepth(99);
        bg.fillStyle(0x0d121d, 0.75);
        bg.fillRoundedRect(startX, startY, 240, panelH, 6);
        bg.lineStyle(1.5, 0x1f2b3e, 0.8);
        bg.strokeRoundedRect(startX, startY, 240, panelH, 6);
        this.scoreboardElements.push(bg);

        const header = this.add.text(startX + 12, startY + 5, 'SCOREBOARD', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        })
            .setScrollFactor(0)
            .setDepth(100);
        this.scoreboardElements.push(header);

        scores.forEach((entry, index) => {
            const isMe = this.socket && entry.playerId === this.socket.id;
            const color = isMe ? '#ffffff' : '#7fa3c7';
            const prefix = isMe ? '► ' : '  ';
            const shortId = entry.playerId.substring(0, 6);

            const row = this.add.text(
                startX + 12,
                startY + 24 + (index * rowH),
                `${prefix}${shortId}  K:${entry.kills}  D:${entry.deaths}`,
                {
                    fontFamily: 'Rajdhani',
                    fontSize: '13px',
                    fontWeight: isMe ? 'bold' : 'normal',
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
            fontFamily: 'Rajdhani',
            fontSize: '32px',
            fontWeight: 'bold',
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
    //  🚪 LEAVE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    leaveMultiplayer() {
        if (this.socket) {
            this.socket.emit('leaveRoom');
        }

        SocketManager.disconnect();
        this.socket = null;

        if (this.scoreboardElements) {
            this.scoreboardElements.forEach(el => el.destroy());
            this.scoreboardElements = [];
        }
        // Clean up teleporter sprites
        if (this.teleporterSprites) {
            this.teleporterSprites.forEach(tp => tp.destroy());
            this.teleporterSprites = [];
        }
        this.cleanupChat();
        this.scene.start('LobbyScene');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🔄 UPDATE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    update() {
        this.updateHUD();
        this.updateDecayingPlatforms();

        // ─── Block Type Selection Keys ────────────────────
        if (Phaser.Input.Keyboard.JustDown(this.key1)) {
            this.selectedBlockType = 'normal';
            this.showKillMessage('BLOCK: NORMAL', '#c4c9ca');
            this.updateBuildPointsUI();
        } else if (Phaser.Input.Keyboard.JustDown(this.key2)) {
            this.selectedBlockType = 'bounce';
            this.showKillMessage('BLOCK: BOUNCE', '#ffd700');
            this.updateBuildPointsUI();
        } else if (Phaser.Input.Keyboard.JustDown(this.key3)) {
            this.selectedBlockType = 'slide';
            this.showKillMessage('BLOCK: SLIDE', '#00ffff');
            this.updateBuildPointsUI();
        }

        if (this.mode === 'solo') {
            this.updateSolo();
        }

        if (this.mode === 'multiplayer') {
            this.updateMultiplayer();
        }

        this.updateSpells();
    }

    updateSpells() {
        if (!this.spells || this.spells.length === 0) return;

        for (let i = this.spells.length - 1; i >= 0; i--) {
            const s = this.spells[i];
            if (!s.gameObject || !s.gameObject.active) {
                this.spells.splice(i, 1);
                continue;
            }

            const sx = s.gameObject.x;
            const sy = s.gameObject.y;
            const sr = s.radius;

            if (this.mode === 'multiplayer') {
                if (s.owner.isControlled) {
                    // Caster's client: check against remote players
                    let hitDetected = false;
                    for (const id in this.otherPlayerMap) {
                        if (Object.prototype.hasOwnProperty.call(this.otherPlayerMap, id)) {
                            const remote = this.otherPlayerMap[id];
                            if (!remote || !remote.sprite || !remote.sprite.active || remote.state === 'dead' || remote.isInvincible) continue;

                            const rx = remote.sprite.x;
                            const ry = remote.sprite.y;
                            const rw = 64;
                            const rh = 152;

                            const closestX = Math.max(rx - rw / 2, Math.min(sx, rx + rw / 2));
                            const closestY = Math.max(ry - rh / 2, Math.min(sy, ry + rh / 2));
                            const dx = sx - closestX;
                            const dy = sy - closestY;
                            const distSq = dx * dx + dy * dy;

                            if (distSq < sr * sr) {
                                if (this.socket && s.spellId) {
                                    this.socket.emit('spellHit', { targetId: id, damage: s.damage, spellId: s.spellId });
                                }
                                s.gameObject.destroy();
                                if (s.trailTimer) s.trailTimer.destroy();
                                this.spells.splice(i, 1);
                                hitDetected = true;
                                break;
                            }
                        }
                    }
                    if (hitDetected) continue;
                } else {
                    // Target's client: check if this remote spell hits our local player
                    if (this.localPlayer && this.localPlayer.sprite && this.localPlayer.sprite.active && this.localPlayer.state !== 'dead' && !this.localPlayer.isInvincible) {
                        const px = this.localPlayer.sprite.x;
                        const py = this.localPlayer.sprite.y;
                        const pw = 64;
                        const ph = 152;

                        const closestX = Math.max(px - pw / 2, Math.min(sx, px + pw / 2));
                        const closestY = Math.max(py - ph / 2, Math.min(sy, py + ph / 2));
                        const dx = sx - closestX;
                        const dy = sy - closestY;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < sr * sr) {
                            if (this.socket && s.spellId) {
                                this.socket.emit('spellHit', { targetId: this.socket.id, damage: s.damage, spellId: s.spellId });
                            }
                            s.gameObject.destroy();
                            if (s.trailTimer) s.trailTimer.destroy();
                            this.spells.splice(i, 1);
                            continue;
                        }
                    }
                }
            } else {
                // Solo or enemy casting: check against enemies or players
                const targets = s.owner.isEnemy ? this.players : this.enemies;
                const tarLen = targets.length;
                for (let j = 0; j < tarLen; j++) {
                    const target = targets[j];
                    if (!target || !target.sprite || !target.sprite.active || target.state === 'dead' || target.isInvincible || target === s.owner) continue;

                    const tx = target.sprite.x;
                    const ty = target.sprite.y;
                    const tw = 64;
                    const th = 152;

                    const closestX = Math.max(tx - tw / 2, Math.min(sx, tx + tw / 2));
                    const closestY = Math.max(ty - th / 2, Math.min(sy, ty + th / 2));
                    const dx = sx - closestX;
                    const dy = sy - closestY;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < sr * sr) {
                        target.takeDamage(s.damage, s.owner);
                        s.gameObject.destroy();
                        if (s.trailTimer) s.trailTimer.destroy();
                        this.spells.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    updateSolo() {
        const aliveEnemies = [];
        this.checkTeleports();
        this.enemies.forEach(e => {
            if (!e || !e.sprite || !e.sprite.active || e.state === 'dead') {
                if (!e.countedAsKill) {
                    this.killCount++;
                    e.countedAsKill = true;

                    const localP = this.localPlayer || this.players[0];
                    if (localP && localP.character === 'p3' && localP.hasTriggeredUndyingRage) {
                        localP.recoverFromUndyingRage();
                    }
                }
            } else {
                aliveEnemies.push(e);
            }
        });

        this.enemies = aliveEnemies;

        // ✅ Only filter players with destroyed sprites, NOT dead state
        // Dead players still need to play death animation before being removed
        this.players = this.players.filter(p => p && p.sprite && p.sprite.active);

        this.maxEnemies = 6;

        if (this.enemies.length < this.maxEnemies && !this.isSpawningEnemies) {
            this.isSpawningEnemies = true;
            const needed = this.maxEnemies - this.enemies.length;

            this.time.delayedCall(2000, () => {
                this.spawnEnemyWave(needed);
                this.isSpawningEnemies = false;
            });
        }

        this.players.forEach(p => p.update());
        this.enemies.forEach(e => e.update());
    }

    updateMultiplayer() {
        if (!this.multiplayerReady) return;

        if (this.localPlayer && this.localPlayer.sprite && this.localPlayer.sprite.active) {

            try {
                this.localPlayer.update();
            } catch (err) {
                // ignore
            }

            if (this.socket && this.localPlayer.isControlled && this.localPlayer.state !== 'dead') {
                const s = this.localPlayer.sprite;
                const x = Math.round(s.x);
                const y = Math.round(s.y);
                const flipX = s.flipX;
                const anim = s.anims.currentAnim ? s.anims.currentAnim.key : `${this.localPlayer.character}_idle_anim`;

                // ✅ THIS LINE WAS MISSING
                const now = Date.now();

                if (!this.lastEmitTime) this.lastEmitTime = 0;

                const hasChanged =
                    this.localPlayer.lastX !== x ||
                    this.localPlayer.lastY !== y ||
                    this.localPlayer.lastFlip !== flipX ||
                    this.localPlayer.lastAnim !== anim ||
                    this.localPlayer.lastShieldActive !== this.localPlayer.isShieldActive ||
                    this.localPlayer.lastRageActive !== this.localPlayer.isRageActive ||
                    this.localPlayer.lastHealth !== this.localPlayer.health.current ||
                    this.localPlayer.lastState !== this.localPlayer.state;

                if (hasChanged && (now - this.lastEmitTime) > 50) {
                    this.socket.emit('playerMovement', {
                        x,
                        y,
                        flipX,
                        anim,
                        isShieldActive: this.localPlayer.isShieldActive,
                        isRageActive: this.localPlayer.isRageActive,
                        health: this.localPlayer.health.current,
                        state: this.localPlayer.state
                    });
                    this.localPlayer.lastX = x;
                    this.localPlayer.lastY = y;
                    this.localPlayer.lastFlip = flipX;
                    this.localPlayer.lastAnim = anim;
                    this.localPlayer.lastShieldActive = this.localPlayer.isShieldActive;
                    this.localPlayer.lastRageActive = this.localPlayer.isRageActive;
                    this.localPlayer.lastHealth = this.localPlayer.health.current;
                    this.localPlayer.lastState = this.localPlayer.state;
                    this.lastEmitTime = now;
                }
            }
        }

        // Interpolate remote players
        for (const id in this.otherPlayerMap) {
            if (!Object.prototype.hasOwnProperty.call(this.otherPlayerMap, id)) continue;
            const remote = this.otherPlayerMap[id];
            if (!remote || !remote.sprite || !remote.sprite.active) continue;

            if (remote.targetX !== undefined && remote.targetY !== undefined) {
                const dx = remote.targetX - remote.sprite.x;
                const dy = remote.targetY - remote.sprite.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 300) {
                    remote.sprite.x = remote.targetX;
                    remote.sprite.y = remote.targetY;
                } else {
                    const lerpSpeed = 0.3;
                    remote.sprite.x += dx * lerpSpeed;
                    remote.sprite.y += dy * lerpSpeed;
                }
            }

            // If we haven't received a movement update for 1000ms, force idle animation
            const gameTimeNow = this.time.now;
            if (remote.lastMovementUpdateTime && (gameTimeNow - remote.lastMovementUpdateTime > 1000)) {
                if (remote.state !== 'dead' && remote.state !== 'attack' && remote.state !== 'taunt') {
                    const idleAnim = `${remote.character}_idle_anim`;
                    if (remote.sprite.anims.currentAnim && remote.sprite.anims.currentAnim.key !== idleAnim) {
                        remote.sprite.anims.play(idleAnim, true);
                    }
                }
            }

            try {
                remote.update();
            } catch (err) {
                // ignore
            }
        }
        this.checkTeleports();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🎬 ANIMATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createAnimations() {
        const chars = ['p1', 'p2', 'p3'];

        chars.forEach(char => {
            if (this.anims.exists(`${char}_idle_anim`)) return;

            this.anims.create({ key: `${char}_idle_anim`, frames: this.anims.generateFrameNumbers(`${char}_idle`, { start: 0, end: 11 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: `${char}_walk_anim`, frames: this.anims.generateFrameNumbers(`${char}_walk`, { start: 0, end: 11 }), frameRate: 12, repeat: -1 });
            this.anims.create({ key: `${char}_hurt_anim`, frames: this.anims.generateFrameNumbers(`${char}_hurt`, { start: 0, end: 3 }), frameRate: 10 });
            this.anims.create({ key: `${char}_death_anim`, frames: this.anims.generateFrameNumbers(`${char}_death`, { start: 0, end: 5 }), frameRate: 8 });
            this.anims.create({ key: `${char}_attack_1`, frames: this.anims.generateFrameNumbers(`${char}_attack`, { start: 0, end: 3 }), frameRate: 14 });
            this.anims.create({ key: `${char}_attack_2`, frames: this.anims.generateFrameNumbers(`${char}_attack`, { start: 4, end: 7 }), frameRate: 16 });
            this.anims.create({ key: `${char}_attack_3`, frames: this.anims.generateFrameNumbers(`${char}_attack`, { start: 8, end: 11 }), frameRate: 18 });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🧍 SOLO SPAWN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    spawnPlayer() {
        const spawn = Phaser.Utils.Array.GetRandom(this.spawnPoints);
        const player = new Player(this, spawn.x, spawn.y, null, true, this.selectedCharacter);

        this.players.push(player);
        this.applySpawnProtection(player);
        return spawn;
    }

    spawnInitialEnemies(playerSpawn) {
        const candidates = this.spawnPoints.filter(spawn =>
            !(playerSpawn && spawn.x === playerSpawn.x && spawn.y === playerSpawn.y)
        );
        const shuffled = Phaser.Utils.Array.Shuffle(candidates);
        const spawnCount = Math.min(this.maxEnemies, shuffled.length);

        for (let i = 0; i < spawnCount; i++) {
            const spawn = shuffled[i];
            const randomChar = Phaser.Utils.Array.GetRandom(['p1', 'p2', 'p3']);
            const enemy = new Player(this, spawn.x, spawn.y, null, false, randomChar);

            enemy.isEnemy = true;
            enemy.state = 'idle';
            enemy.countedAsKill = false;
            enemy.chaseOffset = Phaser.Math.Between(-40, 40);

            if (randomChar === 'p1') {
                enemy.speed = 3;
                enemy.jumpForce = -16;
                enemy.sprite.setTint(0xaaaaaa);
            } else if (randomChar === 'p2') {
                enemy.speed = 3.8;
                enemy.jumpForce = -18;
                enemy.sprite.setTint(0x8844ff);
            } else {
                enemy.speed = 2.6;
                enemy.jumpForce = -14;
                enemy.sprite.setTint(0xff4444);
            }

            this.enemies.push(enemy);
        }
    }

    spawnEnemyWave(count = 3) {
        let playerX = 0;
        let playerY = 0;
        let hasPlayer = false;
        if (this.players && this.players[0] && this.players[0].sprite) {
            playerX = this.players[0].sprite.x;
            playerY = this.players[0].sprite.y;
            hasPlayer = true;
        }

        let candidates = this.spawnPoints.filter(sp => {
            // Avoid visible viewport to prevent visible spawning (teleporting)
            if (this.cameras && this.cameras.main && this.cameras.main.worldView) {
                const view = this.cameras.main.worldView;
                if (sp.x >= view.x && sp.x <= view.x + view.width &&
                    sp.y >= view.y && sp.y <= view.y + view.height) {
                    return false;
                }
            }

            if (hasPlayer) {
                const distToPlayer = Phaser.Math.Distance.Between(sp.x, sp.y, playerX, playerY);
                if (distToPlayer < 500) return false;
            }
            for (let enemy of this.enemies) {
                if (enemy && enemy.sprite && enemy.sprite.active) {
                    const distToEnemy = Phaser.Math.Distance.Between(sp.x, sp.y, enemy.sprite.x, enemy.sprite.y);
                    if (distToEnemy < 100) return false;
                }
            }
            return true;
        });

        if (candidates.length < count) {
            candidates = this.spawnPoints.filter(sp => {
                if (hasPlayer) {
                    const distToPlayer = Phaser.Math.Distance.Between(sp.x, sp.y, playerX, playerY);
                    return distToPlayer > 300;
                }
                return true;
            });
        }

        if (candidates.length === 0) {
            candidates = [...this.spawnPoints];
        }

        const shuffled = Phaser.Utils.Array.Shuffle(candidates);
        const spawnCount = Math.min(count, shuffled.length);

        for (let i = 0; i < spawnCount; i++) {
            const spawn = shuffled[i];
            const randomChar = Phaser.Utils.Array.GetRandom(['p1', 'p2', 'p3']);

            // Pass false for isControlled to avoid redundant controls classes
            const enemy = new Player(this, spawn.x, spawn.y, null, false, randomChar);

            enemy.isEnemy = true;
            enemy.state = 'idle';
            enemy.countedAsKill = false;
            enemy.chaseOffset = Phaser.Math.Between(-40, 40);

            // Configure speed, jumpForce, and visual indicator based on archetype
            if (randomChar === 'p1') {
                // Knight (balanced/cautious)
                enemy.speed = 3;
                enemy.jumpForce = -16;
                enemy.sprite.setTint(0xaaaaaa);
            } else if (randomChar === 'p2') {
                // Shadow (fast/spellcaster)
                enemy.speed = 3.8;
                enemy.jumpForce = -18;
                enemy.sprite.setTint(0x8844ff);
            } else {
                // Berserker (slow/heavy/aggressive)
                enemy.speed = 2.6;
                enemy.jumpForce = -14;
                enemy.sprite.setTint(0xff4444);
            }

            this.enemies.push(enemy);
        }
    }

    respawnPlayer() {
        // ✅ Prevent double respawn
        if (this.isRespawning) return;
        this.isRespawning = true;

        if (this.mode === 'solo') {
            this.deathCount++;
        }

        // Clean dead players
        this.players = this.players.filter(p => p && p.sprite && p.sprite.active && p.state !== 'dead');

        const spawn = Phaser.Utils.Array.GetRandom(this.spawnPoints);
        const player = new Player(this, spawn.x, spawn.y, null, true, this.selectedCharacter);

        if (this.mode === 'solo') {
            this.localPlayer = player;
        }

        this.players.push(player);
        this.applySpawnProtection(player);
        this.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);

        this.enemies.forEach(enemy => {
            enemy.aiState = 'chase';
            enemy.attackCooldown = false;
        });

        // ✅ Reset flag after spawn
        this.time.delayedCall(100, () => {
            this.isRespawning = false;
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ⚔️ SPAWN PROTECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    applySpawnProtection(player) {
        player.isInvincible = true;
        player.sprite.setTint(0x00ffff);

        // ✅ Track spawn position
        const spawnX = player.sprite.x;
        const spawnY = player.sprite.y;

        // ✅ Start with 5 seconds
        let protectionTime = 5000;

        // ✅ Check for movement every 100ms
        const moveCheck = this.time.addEvent({
            delay: 100,
            repeat: -1,
            callback: () => {
                if (!player || !player.sprite || !player.sprite.active) {
                    moveCheck.destroy();
                    return;
                }

                const dx = Math.abs(player.sprite.x - spawnX);
                const dy = Math.abs(player.sprite.y - spawnY);

                // ✅ If player moved more than 5px, reduce to 2 seconds
                if (dx > 5 || dy > 5) {
                    moveCheck.destroy();

                    // ✅ Remove protection after 2 seconds from first movement
                    this.time.delayedCall(2000, () => {
                        if (player && player.sprite && player.sprite.active) {
                            player.isInvincible = false;
                            player.sprite.clearTint();
                        }
                    });
                }
            }
        });

        // ✅ Max protection = 5 seconds (if no movement at all)
        this.time.delayedCall(protectionTime, () => {
            moveCheck.destroy();

            if (player && player.sprite && player.sprite.active) {
                player.isInvincible = false;
                player.sprite.clearTint();
            }
        });

        // ✅ Blinking effect to show invincibility
        const blinkEvent = this.time.addEvent({
            delay: 200,
            repeat: -1,
            callback: () => {
                if (!player || !player.sprite || !player.sprite.active || !player.isInvincible) {
                    blinkEvent.destroy();
                    return;
                }

                // Toggle visibility for blink effect
                if (player.sprite.alpha === 1) {
                    player.sprite.setAlpha(0.75);
                } else {
                    player.sprite.setAlpha(1);
                }
            }
        });

        // ✅ When invincibility ends, reset alpha
        const checkEnd = this.time.addEvent({
            delay: 100,
            repeat: -1,
            callback: () => {
                if (!player || !player.sprite || !player.sprite.active) {
                    checkEnd.destroy();
                    blinkEvent.destroy();
                    return;
                }

                if (!player.isInvincible) {
                    checkEnd.destroy();
                    blinkEvent.destroy();
                    player.sprite.setAlpha(1);
                }
            }
        });
    }

    drawJelly(graphics, w, h, opacity, tint, warnRedProgress = 0) {
        graphics.clear();
        const r = Math.min(w, h, 14);

        const baseColor = (tint !== null && tint !== undefined) ? tint : 0xffd700;

        // 1. Outer glow border
        graphics.lineStyle(4, baseColor, opacity);
        // 2. Jelly main body fill (semi-translucent custom tint color)
        graphics.fillStyle(baseColor, 0.75 * opacity);

        // Drawing coordinates are relative to the graphics center (0,0)
        graphics.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r);
        graphics.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r);

        // 3. Inner glossy core shimmer
        graphics.fillStyle(baseColor, 0.35 * opacity);
        graphics.fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, Math.max(2, r - 4));

        // 4. Glare/reflection highlight (always white)
        const glareH = Math.min(8, h * 0.2);
        graphics.fillStyle(0xffffff, 0.45 * opacity);
        graphics.fillRoundedRect(-w / 2 + 8, -h / 2 + 6, w - 16, glareH, Math.max(1, r - 6));

        // 5. Subtle Jelly bubbles (fewer, smaller, and lower opacity)
        if (w > 45 && h > 45) {
            // Bubble 1 (bottom left-ish)
            graphics.lineStyle(1.0, 0xffffff, 0.3 * opacity);
            graphics.strokeCircle(-w / 4, h / 4, 3);
            graphics.fillStyle(0xffffff, 0.4 * opacity);
            graphics.fillCircle(-w / 4 - 0.8, h / 4 - 0.8, 0.7);

            // Bubble 2 (top right-ish)
            graphics.lineStyle(0.8, 0xffffff, 0.2 * opacity);
            graphics.strokeCircle(w / 3, -h / 6, 2);
            graphics.fillStyle(0xffffff, 0.3 * opacity);
            graphics.fillCircle(w / 3 - 0.5, -h / 6 - 0.5, 0.5);
        }

        // 6. Red warning overlay (applied at 0.05 max opacity)
        // Removed: Now handled efficiently by a separate warnOverlay graphics object to prevent per-frame redraws.
    }

    drawFrozen(graphics, w, h, opacity, tint, crackRatio = 0.35) {
        graphics.clear();
        const r = Math.min(w, h, 6);
        const baseColor = (tint !== null && tint !== undefined) ? tint : 0x00e5ff;

        // 1. Semi-translucent frozen body fill (the ice itself)
        graphics.fillStyle(baseColor, 0.6 * opacity);

        // 2. Frozen block outer border
        graphics.lineStyle(3, 0xffffff, 0.85 * opacity);
        graphics.strokeRoundedRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, r);
        graphics.fillRoundedRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, r);

        // 3. Inner cold core border
        graphics.lineStyle(1.5, baseColor, 0.75 * opacity);
        graphics.strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(1, r - 2));

        // 4. Glossy reflection glare (top highlight)
        const glareH = Math.min(6, h * 0.15);
        graphics.fillStyle(0xffffff, 0.4 * opacity);
        graphics.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, glareH, Math.max(1, r - 3));

        // 5. Crystalline Frost Cracks (Internal ice fractures based on crackRatio)
        if (w > 30 && h > 30 && crackRatio > 0) {
            graphics.lineStyle(1.0, 0xffffff, 0.65 * opacity); // Higher opacity/brightness for cracks

            // Crack 1: Top-Left to Center-Right
            graphics.beginPath();
            graphics.moveTo(-w / 3, -h / 6);
            graphics.lineTo(-w / 8, h / 8);
            graphics.lineTo(w / 4, -h / 12);
            graphics.strokePath();

            // Branch from Crack 1 (drawn if crackRatio > 0.4)
            if (crackRatio > 0.4) {
                graphics.beginPath();
                graphics.moveTo(-w / 8, h / 8);
                graphics.lineTo(-w / 6, h / 3);
                graphics.strokePath();
            }

            // Crack 2: Bottom-Right small crack (drawn if crackRatio > 0.7)
            if (crackRatio > 0.7) {
                graphics.beginPath();
                graphics.moveTo(w / 3, h / 3);
                graphics.lineTo(w / 6, h / 4);
                graphics.strokePath();
            }

            // Crack 3: Cross-cutting fracture (drawn if crackRatio >= 1.0)
            if (crackRatio >= 1.0) {
                graphics.beginPath();
                graphics.moveTo(w / 3, -h / 3);
                graphics.lineTo(0, -h / 8);
                graphics.lineTo(-w / 4, -h / 4);
                graphics.strokePath();
            }
        }

        // 6. Diagonal Ice shine (subtle glass reflection)
        graphics.fillStyle(0xffffff, 0.12 * opacity);
        graphics.beginPath();
        graphics.moveTo(-w / 2 + 4, -h / 2 + 4);
        graphics.lineTo(-w / 2 + 20, -h / 2 + 4);
        graphics.lineTo(w / 2 - 4, h / 2 - 4);
        graphics.lineTo(w / 2 - 20, h / 2 - 4);
        graphics.closePath();
        graphics.fillPath();
    }

    drawNormal(graphics, w, h, opacity, tint) {
        graphics.clear();
        const r = Math.min(w, h, 4);
        const baseColor = (tint !== null && tint !== undefined) ? tint : 0x475569;

        // 1. Solid industrial background block
        graphics.fillStyle(baseColor, 0.9 * opacity);

        // 2. Heavy outer plate outline
        graphics.lineStyle(2.5, 0x0f172a, 1.0 * opacity);
        graphics.strokeRoundedRect(-w / 2 + 1.25, -h / 2 + 1.25, w - 2.5, h - 2.5, r);
        graphics.fillRoundedRect(-w / 2 + 1.25, -h / 2 + 1.25, w - 2.5, h - 2.5, r);

        // 3. Bevel Highlights (Top and Left inner edges for metallic 3D feel)
        graphics.lineStyle(1.5, 0xffffff, 0.25 * opacity);
        graphics.beginPath();
        graphics.moveTo(-w / 2 + 4, h / 2 - 4);
        graphics.lineTo(-w / 2 + 4, -h / 2 + 4);
        graphics.lineTo(w / 2 - 4, -h / 2 + 4);
        graphics.strokePath();

        // 4. Bevel Shadows (Bottom and Right inner edges)
        graphics.lineStyle(1.5, 0x0f172a, 0.4 * opacity);
        graphics.beginPath();
        graphics.moveTo(-w / 2 + 4, h / 2 - 4);
        graphics.lineTo(w / 2 - 4, h / 2 - 4);
        graphics.lineTo(w / 2 - 4, -h / 2 + 4);
        graphics.strokePath();

        // 5. Inset armor plate panel border
        graphics.lineStyle(1.5, 0x0f172a, 0.3 * opacity);
        graphics.strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, Math.max(1, r - 2));

        // 6. Corner Rivets / Screws (if the block is large enough)
        if (w >= 28 && h >= 28) {
            const rivetOffset = 6;
            const rivetRadius = 2.0;
            const rivetPositions = [
                { x: -w / 2 + rivetOffset, y: -h / 2 + rivetOffset },
                { x: w / 2 - rivetOffset, y: -h / 2 + rivetOffset },
                { x: -w / 2 + rivetOffset, y: h / 2 - rivetOffset },
                { x: w / 2 - rivetOffset, y: h / 2 - rivetOffset }
            ];
            rivetPositions.forEach(pos => {
                // Shadow base circle
                graphics.fillStyle(0x0f172a, 0.5 * opacity);
                graphics.fillCircle(pos.x, pos.y, rivetRadius);
                // Highlight dot
                graphics.fillStyle(0xffffff, 0.75 * opacity);
                graphics.fillCircle(pos.x - 0.5, pos.y - 0.5, 0.5);
            });
        }

        // 7. Armor plate horizontal / vertical divider grooves (for long/tall blocks)
        if (w > 80) {
            graphics.lineStyle(1.0, 0x0f172a, 0.25 * opacity);
            for (let offset = -w / 2 + 50; offset < w / 2 - 25; offset += 50) {
                graphics.beginPath();
                graphics.moveTo(offset, -h / 2 + 8);
                graphics.lineTo(offset, h / 2 - 8);
                graphics.strokePath();
                // Add highlight line next to the groove for depth
                graphics.lineStyle(1.0, 0xffffff, 0.12 * opacity);
                graphics.beginPath();
                graphics.moveTo(offset + 1, -h / 2 + 8);
                graphics.lineTo(offset + 1, h / 2 - 8);
                graphics.strokePath();
                // Reset lineStyle
                graphics.lineStyle(1.0, 0x0f172a, 0.25 * opacity);
            }
        }
        if (h > 80) {
            graphics.lineStyle(1.0, 0x0f172a, 0.25 * opacity);
            for (let offset = -h / 2 + 50; offset < h / 2 - 25; offset += 50) {
                graphics.beginPath();
                graphics.moveTo(-w / 2 + 8, offset);
                graphics.lineTo(w / 2 - 8, offset);
                graphics.strokePath();
                // Add highlight line next to the groove for depth
                graphics.lineStyle(1.0, 0xffffff, 0.12 * opacity);
                graphics.beginPath();
                graphics.moveTo(-w / 2 + 8, offset + 1);
                graphics.lineTo(w / 2 - 8, offset + 1);
                graphics.strokePath();
                // Reset lineStyle
                graphics.lineStyle(1.0, 0x0f172a, 0.25 * opacity);
            }
        }
    }


    startJellyIdle(jellyVisual) {
        if (!jellyVisual || !jellyVisual.active) return;

        this.tweens.add({
            targets: jellyVisual,
            scaleY: 1.03,
            scaleX: 0.97,
            duration: 1000 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    wobbleBlock(platform) {
        if (!platform || !platform.jelly || platform.isWobbling) return;

        platform.isWobbling = true;

        // Kill the idle tween
        this.tweens.killTweensOf(platform.jelly);

        // Immediate light squish (no delay, milder scale)
        platform.jelly.scaleY = 0.85;
        platform.jelly.scaleX = 1.15;

        // Spring back to normal with wobble/elastic bounce
        this.tweens.add({
            targets: platform.jelly,
            scaleY: 1.0,
            scaleX: 1.0,
            duration: 600,
            ease: 'Elastic.easeOut',
            easeParams: [1.1, 0.45],
            onComplete: () => {
                platform.isWobbling = false;
                // Restart idle breathing
                this.startJellyIdle(platform.jelly);
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ✨ BLOCK DISAPPEAR & PARTICLES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    destroyObstacleLocally(id, triggerEffects = true) {
        const idx = this.platforms.findIndex(p => p.id === id);
        if (idx !== -1) {
            const p = this.platforms[idx];
            if (triggerEffects) {
                this.triggerObstacleDisappearEffects(p);
            }
            if (p.gameObject) p.gameObject.destroy();
            if (p.outer) p.outer.destroy();
            if (p.middle) p.middle.destroy();
            if (p.jelly) p.jelly.destroy();
            if (p.warnOverlay) p.warnOverlay.destroy();
            this.platforms.splice(idx, 1);
            this.updateBuildPointsUI();
            return true;
        }
        return false;
    }

    triggerObstacleDisappearEffects(p) {
        if (!p) return;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;

        // Find the player object we should measure distance from (local player in multiplayer, or players[0] in solo)
        const playerObj = this.mode === 'multiplayer' ? this.localPlayer : (this.players && this.players[0]);
        let factor = 1.0; // Default factor in case player does not exist yet (e.g. at startup/respawn)

        if (playerObj && playerObj.sprite && playerObj.sprite.active) {
            const px = playerObj.sprite.x;
            const py = playerObj.sprite.y;
            const dx = cx - px;
            const dy = cy - py;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Full volume/shake within 200px, linear attenuation up to 800px, 0 beyond 800px
            factor = Math.max(0, Math.min(1, 1 - (distance - 200) / 600));
        }

        if (p.blockType === 'bounce') {
            const volume = 0.5 * factor;
            if (volume > 0.02) {
                this.safePlaySound('sfx_bubble_break', volume);
            }
            this.createBubbleBlastParticles(cx, cy, p.w, p.h, p.tint || 0xffd700);

            const shakeIntensity = 0.005 * factor;
            if (shakeIntensity > 0.0001) {
                this.cameras.main.shake(150, shakeIntensity);
            }
        } else if (p.blockType === 'slide') {
            const volume = 0.55 * factor;
            if (volume > 0.02 && !p.hasPlayedBreakWarningAudio) {
                this.safePlaySound('sfx_ice_break', volume);
            }
            this.createIceShatterParticles(cx, cy, p.w, p.h, p.tint || 0x00e5ff);
        } else {
            const volume = 0.4 * factor;
            if (volume > 0.02) {
                this.safePlaySound('sfx_bubble_break', volume);
            }
            this.createNormalDissolveParticles(cx, cy, p.w, p.h, p.tint || 0x475569);
        }
    }

    showDamageNumber(x, y, amount, isEnemyHit, isChill = false) {
        let text = amount.toString();
        let color = '#ff3333'; // Default red for player taking damage
        let fontSize = '20px';
        let strokeColor = '#000000';
        let strokeThickness = 4;

        if (isEnemyHit) {
            color = '#ffcc00'; // Gold/yellow for enemy hits
            if (amount > 50) {
                color = '#ff3300'; // Critical/big damage orange-red
                fontSize = '28px';
                strokeThickness = 6;
            } else if (amount > 35) {
                fontSize = '24px';
            }
        } else {
            // Player taking damage
            if (amount === 0) {
                text = "BLOCKED";
                color = '#00ffff'; // Cyan for shield blocks
                fontSize = '18px';
            } else if (amount > 40) {
                fontSize = '26px';
                strokeThickness = 5;
            }
        }

        if (isChill) {
            text = "CHILLED!";
            color = '#33aacc'; // Frost blue
            fontSize = '20px';
            strokeThickness = 4;
        }

        // Add slight random offset to prevent numbers overlapping perfectly
        const rx = x + Phaser.Math.Between(-25, 25);
        const ry = y - Phaser.Math.Between(10, 30);

        const dmgText = this.add.text(rx, ry, text, {
            fontFamily: '"Cormorant Garamond"',
            fontSize: fontSize,
            color: color,
            stroke: strokeColor,
            strokeThickness: strokeThickness
        }).setOrigin(0.5).setDepth(100);

        // Tween up, bounce scale, and fade out
        dmgText.setScale(0.5);
        this.tweens.add({
            targets: dmgText,
            scaleX: 1.1,
            scaleY: 1.1,
            y: ry - 50,
            duration: 150,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: dmgText,
                    alpha: 0,
                    y: ry - 90,
                    duration: 600,
                    delay: 200,
                    ease: 'Sine.easeIn',
                    onComplete: () => {
                        if (dmgText && dmgText.active) {
                            dmgText.destroy();
                        }
                    }
                });
            }
        });
    }

    createBubbleBlastParticles(cx, cy, w, h, tint) {
        const area = w * h;
        const count = Math.min(18, Math.max(6, Math.floor(area / 2500)));

        for (let i = 0; i < count; i++) {
            const px = cx + Phaser.Math.Between(-w / 2, w / 2);
            const py = cy + Phaser.Math.Between(-h / 2, h / 2);
            const radius = Phaser.Math.Between(4, 12);

            const bubble = this.add.graphics().setDepth(90);
            bubble.fillStyle(tint, 0.55);
            bubble.fillCircle(0, 0, radius);
            bubble.lineStyle(1.5, 0xffffff, 0.8);
            bubble.strokeCircle(0, 0, radius);
            bubble.setPosition(px, py);

            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(100, 260);
            const targetX = px + Math.cos(angle) * speed;
            const targetY = py + Math.sin(angle) * speed;

            this.tweens.add({
                targets: bubble,
                x: targetX,
                y: targetY,
                scale: 0.1,
                alpha: 0,
                duration: Phaser.Math.Between(600, 1100),
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    if (bubble && bubble.active) bubble.destroy();
                }
            });
        }
    }

    createIceShatterParticles(cx, cy, w, h, tint) {
        const area = w * h;
        const count = Math.min(15, Math.max(5, Math.floor(area / 3000)));

        for (let i = 0; i < count; i++) {
            const px = cx + Phaser.Math.Between(-w / 2, w / 2);
            const py = cy + Phaser.Math.Between(-h / 2, h / 2);

            const sw = Phaser.Math.Between(10, 22);
            const sh = Phaser.Math.Between(8, 16);
            const color = Phaser.Math.RND.pick([tint, 0xffffff, 0xa5f3fc, 0xbae6fd, 0xe0f2fe]);

            let shard;
            const shapeType = Phaser.Math.Between(0, 2);
            if (shapeType === 0) {
                shard = this.add.rectangle(px, py, sw, sh, color, 0.85).setDepth(90);
            } else if (shapeType === 1) {
                shard = this.add.circle(px, py, sw / 2, color, 0.85).setDepth(90);
            } else {
                shard = this.add.triangle(px, py, 0, sh, sw / 2, 0, sw, sh, color, 0.85).setDepth(90);
            }
            shard.setAngle(Phaser.Math.Between(0, 360));

            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(50, 180);
            const targetX = px + Math.cos(angle) * speed;
            const targetY = py + Math.sin(angle) * speed + 150; // gravity drop

            this.tweens.add({
                targets: shard,
                x: targetX,
                y: targetY,
                angle: shard.angle + Phaser.Math.Between(-180, 180),
                alpha: 0,
                scale: 0.15,
                duration: Phaser.Math.Between(1000, 2500),
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (shard && shard.active) shard.destroy();
                }
            });
        }
    }

    createNormalDissolveParticles(cx, cy, w, h, tint) {
        const area = w * h;
        const count = Math.min(12, Math.max(4, Math.floor(area / 3000)));

        for (let i = 0; i < count; i++) {
            const px = cx + Phaser.Math.Between(-w / 2, w / 2);
            const py = cy + Phaser.Math.Between(-h / 2, h / 2);
            const size = Phaser.Math.Between(8, 14);
            const color = Phaser.Math.RND.pick([tint, 0x1e293b, 0x64748b, 0x334155]);

            const dust = this.add.rectangle(px, py, size, size, color, 0.9).setDepth(90);
            const targetX = px + Phaser.Math.Between(-30, 30);
            const targetY = py + Phaser.Math.Between(25, 65);

            this.tweens.add({
                targets: dust,
                x: targetX,
                y: targetY,
                scale: 0.15,
                alpha: 0,
                angle: Phaser.Math.Between(-120, 120),
                duration: Phaser.Math.Between(500, 800),
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (dust && dust.active) dust.destroy();
                }
            });
        }
    }

    updateDecayingPlatforms() {
        const now = this.time.now;
        const totalLife = 15000;

        this.platforms.forEach(p => {
            if (!p.deletable || p.source !== 'user' || !p.createdAt) return;

            const age = now - p.createdAt;

            if (p.blockType === 'slide') {
                // Ice cracks advance step-by-step
                let stage = 0;
                if (age > 11250) {
                    stage = 3;
                } else if (age > 7500) {
                    stage = 2;
                } else if (age > 3750) {
                    stage = 1;
                }

                if (p.crackStage !== stage) {
                    p.crackStage = stage;
                    if (p.jelly) {
                        this.drawFrozen(p.jelly, p.w, p.h, p.opacity || 0.9, p.tint, stage / 3);
                    }
                }

                // Play ice break sound slightly before actual decay (800ms before 15000)
                if (age > 14200 && !p.hasPlayedBreakWarningAudio) {
                    p.hasPlayedBreakWarningAudio = true;
                    const cx = p.x + p.w / 2;
                    const cy = p.y + p.h / 2;
                    const playerObj = this.mode === 'multiplayer' ? this.localPlayer : (this.players && this.players[0]);
                    let f = 1.0;
                    if (playerObj && playerObj.sprite && playerObj.sprite.active) {
                        const px = playerObj.sprite.x;
                        const py = playerObj.sprite.y;
                        const dx = cx - px;
                        const dy = cy - py;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        f = Math.max(0, Math.min(1, 1 - (distance - 200) / 600));
                    }
                    const volume = 0.55 * f;
                    if (volume > 0.02) {
                        this.safePlaySound('sfx_ice_break', volume);
                    }
                }

                // Shake slightly in final 1 second of decay
                if (age > 14000 && p.jelly) {
                    const shakeOffsetX = Phaser.Math.Between(-1, 1);
                    const shakeOffsetY = Phaser.Math.Between(-1, 1);
                    const cx = p.x + p.w / 2;
                    const cy = p.y + p.h / 2;
                    p.jelly.setPosition(cx + shakeOffsetX, cy + shakeOffsetY);
                }
            } else if (p.blockType === 'bounce') {
                // Bubble blocks shake, pulse, and turn increasingly red in the final 3 seconds
                if (age > 12000) {
                    const remaining = totalLife - age;
                    const pulseSpeed = remaining > 1000 ? 15 : 30;
                    const scale = 1 + 0.03 * Math.sin((now / 1000) * pulseSpeed);

                    const shake = remaining > 1000 ? 1 : 2.5;
                    const offsetX = Phaser.Math.Between(-shake, shake);
                    const offsetY = Phaser.Math.Between(-shake, shake);

                    const cx = p.x + p.w / 2;
                    const cy = p.y + p.h / 2;

                    if (p.jelly) {
                        p.jelly.setPosition(cx + offsetX, cy + offsetY);
                        p.jelly.setScale(scale);

                        if (p.warnOverlay) {
                            p.warnOverlay.setPosition(cx + offsetX, cy + offsetY);
                            p.warnOverlay.setScale(scale);
                            const progress = (age - 12000) / 3000; // 0.0 to 1.0
                            p.warnOverlay.setAlpha(progress * 0.05 * (p.opacity || 0.9));
                        }
                    }
                }
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🧱 PLATFORM SYSTEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


    createPlatform(rect) {
        const rotation = rect.rotation || 0;
        const angle = Phaser.Math.DegToRad(rotation);

        // Calculate center for Matter body taking rotation around top-left into account
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = rect.x + (rect.w / 2) * cos - (rect.h / 2) * sin;
        const cy = rect.y + (rect.w / 2) * sin + (rect.h / 2) * cos;

        const platform = this.add.rectangle(
            cx,
            cy,
            rect.w,
            rect.h
        );
        this.matter.add.gameObject(platform, {
            isStatic: true,
            friction: 0.1
        });

        platform.setFillStyle(0xff0000, 0);

        if (rotation !== 0) {
            platform.setAngle(rotation);
        }

        this.platforms.push({
            gameObject: platform,
            ...rect,
            deletable: false,
            source: 'map'
        });
    }

    createObstacle(rect, opacity, id = null, creatorId = null, isLocalInit = false, tint = null, blockType = 'normal', createdAtServer = null) {
        const minW = this.OBSTACLE_MIN_WIDTH || 30;
        const minH = this.OBSTACLE_MIN_HEIGHT || 30;
        const minArea = this.OBSTACLE_MIN_AREA || 900;
        const maxArea = this.OBSTACLE_MAX_AREA || 250000;

        const w = rect.w;
        const h = rect.h;
        const area = w * h;

        // Validate width and height (warnings only shown to local drawing player)
        if (w < minW || h < minH) {
            if (isLocalInit) this.showKillMessage('OBSTACLE TOO NARROW!', '#ff4444');
            return false;
        }

        // Validate area limits
        if (area < minArea) {
            if (isLocalInit) this.showKillMessage('OBSTACLE AREA TOO SMALL!', '#ff4444');
            return false;
        }
        if (area > maxArea + 1) {
            if (isLocalInit) this.showKillMessage('OBSTACLE AREA TOO LARGE!', '#ff4444');
            return false;
        }

        // Validate build points limit
        if (isLocalInit) {
            const usedPoints = this.getUsedBuildPoints();
            if (usedPoints + area > this.MAX_BUILD_POINTS) {
                this.showKillMessage('NOT ENOUGH BUILD POINTS!', '#ff4444');
                return false;
            }
        }

        // 2. Subtraction logic: replace enemy obstacles in covered regions
        if (isLocalInit) {
            for (let i = this.platforms.length - 1; i >= 0; i--) {
                const p = this.platforms[i];
                if (!p.deletable) continue;

                // Check overlap
                const overlap =
                    rect.x < p.x + p.w &&
                    rect.x + rect.w > p.x &&
                    rect.y < p.y + p.h &&
                    rect.y + rect.h > p.y;

                if (overlap) {

                    // Remove old enemy obstacle locally
                    if (p.gameObject) p.gameObject.destroy();
                    if (p.outer) p.outer.destroy();
                    if (p.middle) p.middle.destroy();
                    if (p.jelly) p.jelly.destroy();
                    if (p.warnOverlay) p.warnOverlay.destroy();
                    this.platforms.splice(i, 1);
                    this.updateBuildPointsUI();

                    // Notify server to remove it
                    if (this.mode === 'multiplayer' && this.socket && p.id) {
                        this.socket.emit('removeObstacle', { id: p.id });
                    }

                    // Compute remaining regions of the enemy obstacle
                    const pieces = this.subtractRect(p, rect);

                    // Create and emit split pieces under original creator's ownership
                    pieces.forEach((piece, index) => {
                        const subId = p.id ? `${p.id}_sub_${index}_${Date.now()}` : `${p.creatorId}_sub_${Date.now()}_${index}`;

                        this.createObstacle(piece, opacity, subId, p.creatorId, false, p.tint, p.blockType);

                        if (this.mode === 'multiplayer' && this.socket) {
                            this.socket.emit('createObstacle', { id: subId, rect: piece, opacity, creatorId: p.creatorId, tint: p.tint, blockType: p.blockType, createdAt: Date.now() });
                        }
                    });
                }
            }
        }

        const rotation = rect.rotation || 0;
        const angle = Phaser.Math.DegToRad(rotation);

        // Calculate center for Matter body taking rotation around top-left into account
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = rect.x + (rect.w / 2) * cos - (rect.h / 2) * sin;
        const cy = rect.y + (rect.w / 2) * sin + (rect.h / 2) * cos;

        // Fill
        const platform = this.add.rectangle(
            cx,
            cy,
            rect.w,
            rect.h,
            0x000000,
            (blockType === 'bounce' || blockType === 'slide' || blockType === 'normal') ? 0 : opacity
        );

        let outer = null;
        let middle = null;
        let jelly = null;
        let warnOverlay = null;

        if (blockType === 'bounce') {
            jelly = this.add.graphics({ x: cx, y: cy });
            this.drawJelly(jelly, rect.w, rect.h, opacity, tint);
            this.startJellyIdle(jelly);

            warnOverlay = this.add.graphics({ x: cx, y: cy });
            const r = Math.min(rect.w, rect.h, 14);
            warnOverlay.fillStyle(0xff0000, 1);
            warnOverlay.fillRoundedRect(-rect.w / 2 + 2, -rect.h / 2 + 2, rect.w - 4, rect.h - 4, r);
            warnOverlay.lineStyle(4, 0xff0000, 1);
            warnOverlay.strokeRoundedRect(-rect.w / 2 + 2, -rect.h / 2 + 2, rect.w - 4, rect.h - 4, r);
            warnOverlay.setAlpha(0);
        } else if (blockType === 'slide') {
            jelly = this.add.graphics({ x: cx, y: cy });
            this.drawFrozen(jelly, rect.w, rect.h, opacity, tint, 0); // Start with 0 crackRatio (clean ice)
        } else {
            jelly = this.add.graphics({ x: cx, y: cy });
            this.drawNormal(jelly, rect.w, rect.h, opacity, tint);
        }

        this.matter.add.gameObject(platform, {
            isStatic: true,
            friction: blockType === 'slide' ? 0.0 : 0.1
        });

        if (rotation !== 0) {
            platform.setAngle(rotation);
            if (outer) outer.setAngle(rotation);
            if (middle) middle.setAngle(rotation);
            if (jelly) jelly.setAngle(rotation);
            if (warnOverlay) warnOverlay.setAngle(rotation);
        }

        let obstacleAge = 0;
        if (createdAtServer) {
            obstacleAge = Date.now() - createdAtServer;
        }

        this.platforms.push({
            gameObject: platform,
            outer,
            middle,
            jelly,
            warnOverlay,
            tint,
            blockType: blockType || 'normal',
            ...rect,
            deletable: true,
            source: 'user',
            id: id,
            creatorId: creatorId,
            createdAt: this.time.now - obstacleAge,
            crackStage: 0
        });
        this.updateBuildPointsUI();

        // Decay timer: start warning/blinking after 12 seconds, disappear and refund after 15 seconds
        const decayTime = 15000;
        const blinkStartTime = 12000;

        const remainingBlinkTime = Math.max(0, blinkStartTime - obstacleAge);
        const remainingDecayTime = Math.max(0, decayTime - obstacleAge);
        // Schedule warning blink ONLY for normal blocks (bounce and slide have custom warning updates)
        this.time.delayedCall(remainingBlinkTime, () => {
            const idx = this.platforms.findIndex(p => p.id === id);
            if (idx !== -1) {
                const p = this.platforms[idx];
                if (p.blockType === 'normal') {
                    const components = [p.gameObject, p.outer, p.middle, p.jelly, p.warnOverlay].filter(Boolean);
                    this.tweens.add({
                        targets: components,
                        alpha: 0.2,
                        duration: 250,
                        yoyo: true,
                        repeat: 11 // 12 cycles of 250ms = 3 seconds
                    });
                }
            }
        });

        // Schedule deletion & build points refund ONLY in solo mode (in multiplayer, the server authoritatively handles decay and broadcasts 'obstacleRemoved')
        if (this.mode !== 'multiplayer') {
            this.time.delayedCall(remainingDecayTime, () => {
                this.destroyObstacleLocally(id, true);
            });
        }

        return true;
    }

    getUsedBuildPoints() {
        let used = 0;
        this.platforms.forEach(p => {
            if (p.deletable && (!p.creatorId || (this.socket && p.creatorId === this.socket.id))) {
                used += p.w * p.h;
            }
        });
        return Math.round(used);
    }

    initDOMUI() {
        if (document.getElementById('game-ui-container')) {
            document.getElementById('game-ui-container').remove();
        }
        if (document.getElementById('game-ui-styles')) {
            document.getElementById('game-ui-styles').remove();
        }

        const style = document.createElement('style');
        style.id = 'game-ui-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@700&family=Inter:wght@400;500;700&display=swap');
            
            #game-ui-container {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none;
                font-family: 'Rajdhani', sans-serif;
                font-weight: 700;
                color: white;
                z-index: 100;
                user-select: none;
            }

            .pixel-panel {
                background: rgba(13, 18, 29, 0.75);
                border: 1.5px solid #1f2b3e;
                border-radius: 6px;
            }

            #ui-player-panel {
                position: absolute;
                top: 15px; left: 15px;
                display: flex;
                align-items: center;
                gap: 12px;
                pointer-events: auto;
                padding: 10px 15px;
            }
            .avatar-container {
                width: 60px; height: 60px;
                display: flex; justify-content: center; align-items: center;
                overflow: hidden;
                background: #a8a8a838;
                border: 1.5px solid #1f2b3e;
                border-radius: 6px;
            }

            .player-stats { display: flex; flex-direction: column; gap: 4px; justify-content: center; }
            .player-name { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px; margin: 0; color: #fff; line-height: 1; }
            
            .hp-bar-bg { width: 180px; height: 16px; background: #090a0b; overflow: hidden; position: relative; margin: 2px 0; border-radius: 4px; }
            .hp-bar-fill { width: 100%; height: 100%; background: #2e7d32; transition: width 0.2s ease, background-color 0.2s ease; }
            .hp-text { position: absolute; width: 100%; text-align: center; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 11px; line-height: 16px; text-shadow: 1px 1px 2px #000; top: 0; left: 0; }
            
            .kill-death { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 12px; color: #7fa3c7; display: flex; gap: 15px; margin-top: 2px; }
            .kill-death span { display: flex; align-items: center; gap: 4px; }

            /* --- Top Right: Build Points --- */
            #ui-build-panel {
                position: absolute;
                top: 15px; right: 15px;
                padding: 12px 15px;
                display: flex; flex-direction: column; gap: 10px;
                pointer-events: auto;
            }
            .build-header { display: flex; align-items: center; gap: 10px; font-size: 16px; color: #fff; }
            .build-icon { width: 8px; height: 8px; background: #0ea5e9; transform: rotate(45deg); }
            .build-bar-bg { width: 180px; height: 10px; background: #090a0b; border-radius: 4px; overflow: hidden; }
            .build-bar-fill { width: 60%; height: 100%; background: #0ea5e9; transition: width 0.2s ease; }
            .build-text { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 11px; text-align: left; color: #ddd; margin-top: 2px; }

            /* --- Bottom: Hotbar --- */
            #ui-hotbar {
                position: absolute;
                bottom: 30px; left: 50%; transform: translateX(-50%);
                display: flex; gap: 12px;
                pointer-events: auto;
            }
            .hotbar-slot {
                width: 64px; height: 64px;
                display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
                background: rgba(13, 18, 29, 0.75);
                border: 1.5px solid #1f2b3e;
                border-radius: 6px;
                position: relative;
                cursor: pointer;
            }
            .hotbar-slot[data-type="normal"].active { border-color: #fff; }
            .hotbar-slot[data-type="bounce"].active { border-color: #7fa3c7; }
            .hotbar-slot[data-type="slide"].active { border-color: #7fa3c7; }

            .slot-key { position: absolute; top: 4px; left: 4px; font-size: 9px; color: #aaa; border: 1.5px solid #1f2b3e; border-radius: 3px; padding: 2px 4px; }
            .slot-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-top: 6px; }
            .slot-label { font-size: 9px; color: #aaa; text-align: center; }

            .hotbar-slot[data-type="normal"] { color: #fff; }
            .hotbar-slot[data-type="bounce"] { color: #7fa3c7; }
            .hotbar-slot[data-type="slide"] { color: #7fa3c7; }
            .hotbar-slot.active .slot-label { color: currentColor; }
            .hotbar-slot.active .slot-key { color: currentColor; border-color: currentColor; }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'game-ui-container';

        container.innerHTML = `
            <div id="ui-player-panel" class="pixel-panel">
                <div class="avatar-container">
                    <canvas id="ui-avatar-canvas" width="60" height="60"></canvas>
                </div>
                <div class="player-stats">
                    <h3 class="player-name">PLAYER</h3>
                    <div class="hp-bar-bg">
                        <div class="hp-bar-fill" id="ui-hp-fill"></div>
                        <div class="hp-text" id="ui-hp-text">100 / 100</div>
                    </div>
                    <div class="kill-death">
                        <span>💀 KILLS: <span id="ui-kills">0</span></span>
                        <span>🎯 D: <span id="ui-deaths">0</span></span>
                    </div>
                </div>
            </div>

            <div id="ui-build-panel" class="pixel-panel">
                <div class="build-header">
                    <div class="build-icon"></div>
                    BUILD POINTS
                </div>
                <div class="build-bar-bg">
                    <div class="build-bar-fill" id="ui-build-fill"></div>
                </div>
                <div class="build-text" id="ui-build-text">300,000 / 500,000</div>
            </div>

            <div id="ui-hotbar">
                <div class="hotbar-slot active" data-type="normal" onclick="window.game.scene.getScene('GameScene').selectedBlockType = 'normal';">
                    <div class="slot-key">1</div>
                    <div class="slot-icon">🧊</div>
                    <div class="slot-label">NORMAL</div>
                </div>
                <div class="hotbar-slot" data-type="bounce" onclick="window.game.scene.getScene('GameScene').selectedBlockType = 'bounce';">
                    <div class="slot-key">2</div>
                    <div class="slot-icon">🍄</div>
                    <div class="slot-label">BOUNCE ↑</div>
                </div>
                <div class="hotbar-slot" data-type="slide" onclick="window.game.scene.getScene('GameScene').selectedBlockType = 'slide';">
                    <div class="slot-key">3</div>
                    <div class="slot-icon">❄️</div>
                    <div class="slot-label">SLIDE ⟶</div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Draw static tinted avatar to DOM canvas
        const canvas = document.getElementById('ui-avatar-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const char = PlayerData.character || 'p1';
            const tint = PlayerData.getColorTint();

            const tex = this.textures.exists(`${char}_idle`) ? this.textures.get(`${char}_idle`).getSourceImage() : null;
            if (tex) {
                ctx.clearRect(0, 0, 60, 60);
                // Draw first frame (520x420) scaled into 60x60
                ctx.drawImage(tex, 0, 0, 520, 420, -7, 0, 74, 60);

                if (tint && tint !== 0xffffff) {
                    const tintStr = '#' + tint.toString(16).padStart(6, '0');
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.fillStyle = tintStr;
                    ctx.fillRect(0, 0, 60, 60);

                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(tex, 0, 0, 520, 420, -7, 0, 74, 60);
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
        }

        // Sync DOM UI position and scale with the Phaser canvas
        const syncUI = () => {
            const canvas = this.game.canvas;
            if (!document.getElementById('game-ui-container') || !canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / 1280;
            const scaleY = rect.height / 720;
            container.style.transformOrigin = 'top left';
            container.style.transform = `scale(${scaleX}, ${scaleY})`;
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.top}px`;
            container.style.width = '1280px';
            container.style.height = '720px';
        };

        syncUI();
        window.addEventListener('resize', syncUI);
        this.events.once('shutdown', () => window.removeEventListener('resize', syncUI));
        this.events.once('destroy', () => window.removeEventListener('resize', syncUI));


        this.updateBuildPointsUI();
    }

    updateBuildPointsUI() {
        const buildFill = document.getElementById('ui-build-fill');
        const buildText = document.getElementById('ui-build-text');

        if (!buildFill || !buildText) return;

        const used = this.getUsedBuildPoints();
        const available = Math.max(0, this.MAX_BUILD_POINTS - used);
        const pct = Math.max(0, Math.min(1, available / this.MAX_BUILD_POINTS));

        buildFill.style.width = `${pct * 100}%`;

        if (pct < 0.2) {
            buildFill.style.backgroundColor = '#ef4444';
            buildFill.style.boxShadow = '0 0 10px #ef4444';
        } else if (pct < 0.5) {
            buildFill.style.backgroundColor = '#f59e0b';
            buildFill.style.boxShadow = '0 0 10px #f59e0b';
        } else {
            buildFill.style.backgroundColor = '#0ea5e9';
            buildFill.style.boxShadow = '0 0 10px #0ea5e9';
        }

        const formatNum = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        buildText.textContent = `${formatNum(available)} / ${formatNum(this.MAX_BUILD_POINTS)}`;

        const bt = this.selectedBlockType || 'normal';
        document.querySelectorAll('.hotbar-slot').forEach(slot => {
            if (slot.dataset.type === bt) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }

    removeobstacle(pointer) {
        const world = pointer.positionToCamera(this.cameras.main);

        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];

            if (!p.deletable) continue;

            const isInside =
                world.x > p.x &&
                world.x < p.x + p.w &&
                world.y > p.y &&
                world.y < p.y + p.h;

            if (isInside) {
                // Check ownership: other players can't remove another player's obstacles
                const isOwner = this.mode !== 'multiplayer' || !p.creatorId || p.creatorId === this.socket.id;
                if (!isOwner) {
                    this.showKillMessage("CANNOT REMOVE ANOTHER PLAYER'S OBSTACLE!", '#ff4444');
                    return;
                }

                if (this.mode === 'multiplayer' && this.socket && p.id) {
                    this.socket.emit('removeObstacle', { id: p.id });
                }

                this.destroyObstacleLocally(p.id, true);
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

    subtractRect(A, B) {
        // Check overlap
        const noOverlap =
            A.x >= B.x + B.w ||
            A.x + A.w <= B.x ||
            A.y >= B.y + B.h ||
            A.y + A.h <= B.y;

        if (noOverlap) {
            return [A];
        }

        const pieces = [];

        // 1. Top piece
        if (A.y < B.y) {
            pieces.push({
                x: A.x,
                y: A.y,
                w: A.w,
                h: B.y - A.y
            });
        }

        // 2. Bottom piece
        if (A.y + A.h > B.y + B.h) {
            pieces.push({
                x: A.x,
                y: B.y + B.h,
                w: A.w,
                h: (A.y + A.h) - (B.y + B.h)
            });
        }

        // Y overlap range
        const overlapYStart = Math.max(A.y, B.y);
        const overlapYEnd = Math.min(A.y + A.h, B.y + B.h);
        const overlapH = overlapYEnd - overlapYStart;

        if (overlapH > 0) {
            // 3. Left piece
            if (A.x < B.x) {
                pieces.push({
                    x: A.x,
                    y: overlapYStart,
                    w: B.x - A.x,
                    h: overlapH
                });
            }

            // 4. Right piece
            if (A.x + A.w > B.x + B.w) {
                pieces.push({
                    x: B.x + B.w,
                    y: overlapYStart,
                    w: (A.x + A.w) - (B.x + B.w),
                    h: overlapH
                });
            }
        }

        // Filter out tiny pieces
        return pieces.filter(p => p.w > 0.1 && p.h > 0.1);
    }

    createHUD() {
        // Obsolete: HUD and instructions are now handled entirely by DOM UI (initDOMUI)
        // We only use this to render the animated avatar sprite behind the DOM UI

        const char = PlayerData.character || 'p1';

        // Avatar will be dynamically positioned in updateHUD to counteract camera zoom
        this.uiAvatarSprite = this.add.sprite(0, 0, `${char}_idle`)
            .setScrollFactor(1)
            .setDepth(1000);

        this.uiAvatarSprite = this.add.sprite(0, 0, `${char}_idle`)
            .setScrollFactor(1)
            .setDepth(1000);

        this.uiAvatarSprite.anims.play(`${char}_preview`, true);
        const tint = PlayerData.getColorTint();
        if (tint) {
            this.uiAvatarSprite.setTint(tint);
        }
    }

    updateHUD() {

        const playerObj = this.mode === 'multiplayer' ? this.localPlayer : this.players[0];
        if (!playerObj) return;

        const currentHp = playerObj.health ? playerObj.health.current : 0;
        const maxHp = playerObj.health ? playerObj.health.max : 100;

        // Initialize DOM cache if needed
        if (!this._domCache) {
            this._domCache = {
                hpFill: document.getElementById('ui-hp-fill'),
                hpText: document.getElementById('ui-hp-text'),
                uiKills: document.getElementById('ui-kills'),
                uiDeaths: document.getElementById('ui-deaths'),
                lastHp: -1,
                lastMaxHp: -1,
                lastKills: -1,
                lastDeaths: -1,
                lastHpColor: ''
            };
        }

        const cache = this._domCache;

        // Only update HP DOM if values actually changed
        if (cache.hpFill && cache.hpText && (cache.lastHp !== currentHp || cache.lastMaxHp !== maxHp)) {
            const pct = Math.max(0, Math.min(1, currentHp / maxHp));
            cache.hpFill.style.width = `${pct * 100}%`;
            cache.hpText.textContent = `${Math.round(currentHp)} / ${maxHp}`;

            let colorHex = '#10b981';
            if (pct < 0.3) {
                colorHex = '#ef4444';
            } else if (pct < 0.6) {
                colorHex = '#f59e0b';
            }

            // Only update CSS string if color changed to avoid style reflows
            if (cache.lastHpColor !== colorHex) {
                cache.hpFill.style.backgroundColor = colorHex;
                cache.hpFill.style.boxShadow = `0 0 10px ${colorHex}`;
                cache.lastHpColor = colorHex;
            }

            cache.lastHp = currentHp;
            cache.lastMaxHp = maxHp;
        }

        if (cache.uiKills && cache.lastKills !== this.killCount) {
            cache.uiKills.textContent = this.killCount;
            cache.lastKills = this.killCount;
        }

        if (cache.uiDeaths && cache.lastDeaths !== this.deathCount) {
            cache.uiDeaths.textContent = this.deathCount;
            cache.lastDeaths = this.deathCount;
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  💬 CHAT SYSTEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    initChat() {
        // 1. Create CSS style block dynamically
        const style = document.createElement('style');
        style.id = 'game-chat-styles';
        style.textContent = `
            #game-chat-container {
                position: absolute;
                bottom: 20px;
                left: 20px;
                width: 360px;
                height: 200px;
                display: flex;
                flex-direction: column;
                pointer-events: none;
                z-index: 1000;
                font-family: 'Rajdhani', sans-serif;
                font-size: 14px;
                font-weight: bold;
            }
            #game-chat-log {
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                margin-bottom: 8px;
                padding: 8px;
                background: rgba(13, 18, 29, 0.75);
                border-radius: 6px;
                border: 1px solid rgba(138, 153, 173, 0.15);
                backdrop-filter: blur(4px);
                scrollbar-width: none;
            }
            #game-chat-log::-webkit-scrollbar {
                display: none;
            }
            .chat-message {
                margin: 4px 0;
                line-height: 1.4;
                word-break: break-all;
                animation: fadeInChat 0.2s ease-out forwards;
                color: #7fa3c7;
            }
            .chat-message-system {
                color: #7fa3c7;
                font-style: italic;
            }
            .chat-message-me {
                color: #ffffff;
            }
            .chat-message-other {
                color: #7fa3c7;
            }
            @keyframes fadeInChat {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #game-chat-input-container {
                display: none;
                pointer-events: auto;
            }
            #game-chat-input {
                width: 100%;
                padding: 8px;
                background: rgba(13, 18, 29, 0.9);
                border: 1.5px solid #1f2b3e;
                border-radius: 6px;
                color: #fff;
                font-family: 'Rajdhani', sans-serif;
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
            }
            #game-chat-input:focus {
                border-color: #7fa3c7;
            }
        `;
        document.head.appendChild(style);

        // 2. Create DOM container
        const container = document.createElement('div');
        container.id = 'game-chat-container';

        const log = document.createElement('div');
        log.id = 'game-chat-log';
        container.appendChild(log);

        const inputContainer = document.createElement('div');
        inputContainer.id = 'game-chat-input-container';

        const input = document.createElement('input');
        input.id = 'game-chat-input';
        input.type = 'text';
        input.placeholder = 'PRESS ENTER TO CHAT...';
        input.maxLength = 50;
        inputContainer.appendChild(input);

        container.appendChild(inputContainer);
        const uiContainer = document.getElementById('game-ui-container');
        if (uiContainer) {
            uiContainer.appendChild(container);
        } else {
            document.body.appendChild(container);
        }

        this.chatContainer = container;
        this.chatLog = log;
        this.chatInputContainer = inputContainer;
        this.chatInput = input;
        this.isChatActive = false;

        // 3. Register input events and keyboard listeners
        const closeChat = () => {
            this.isChatActive = false;
            this.chatInputContainer.style.display = 'none';
            this.chatInput.value = '';
            this.chatInput.blur();
            if (this.localPlayer) {
                this.localPlayer.isControlled = true;
            }
            // Re-enable Phaser's keyboard plugin
            if (this.input && this.input.keyboard) {
                this.input.keyboard.enabled = true;
            }
        };

        input.addEventListener('blur', () => {
            // Wait slightly to check if blur was caused by Enter/Esc closing it already,
            // or if the user clicked away (which we want to trigger closeChat).
            setTimeout(() => {
                if (this.isChatActive) {
                    closeChat();
                }
            }, 100);
        });

        input.addEventListener('keydown', (e) => {
            // Stop propagation so Phaser keyboard manager doesn't intercept keys
            e.stopPropagation();

            if (e.key === 'Enter') {
                const message = this.chatInput.value.trim();
                if (message.length > 0) {
                    // Send to server
                    this.socket.emit('chatMessage', { message });
                    // Add local message immediately
                    this.addChatMessage(this.socket.id, message);
                }
                closeChat();
            } else if (e.key === 'Escape') {
                closeChat();
            }
        });

        input.addEventListener('keypress', (e) => {
            e.stopPropagation();
        });

        input.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });

        // Register global ENTER key on Phaser input to focus the chat input when inactive
        this.input.keyboard.on('keydown-ENTER', () => {
            if (this.mode !== 'multiplayer') return;
            if (!this.isChatActive) {
                this.isChatActive = true;
                this.chatInputContainer.style.display = 'block';

                // Disable Phaser keyboard inputs from updating player
                if (this.localPlayer) {
                    this.localPlayer.isControlled = false;
                    // Reset velocities so player doesn't slide endlessly while typing
                    if (this.localPlayer.sprite && this.localPlayer.sprite.body) {
                        this.localPlayer.sprite.setVelocityX(0);
                        this.localPlayer.sprite.anims.play(`${this.localPlayer.character}_idle_anim`, true);
                    }
                }

                // Disable Phaser's keyboard plugin completely so it doesn't intercept keys!
                if (this.input && this.input.keyboard) {
                    this.input.keyboard.enabled = false;
                }

                // Focus the HTML input after a short tick to ensure it is visible first
                setTimeout(() => {
                    this.chatInput.focus();
                }, 10);
            }
        });

        // 4. Socket Listener
        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data.senderId, data.message);
        });

        this.addSystemMessage('SYSTEM: PRESS ENTER TO CHAT.');

        // Scale and position chat relative to the game canvas bounds
        this.resizeChat();
        this.scale.on('resize', this.resizeChat, this);
    }

    addChatMessage(senderId, message) {
        if (!this.chatLog) return;

        const isMe = this.socket && senderId === this.socket.id;
        const shortId = senderId.substring(0, 6);
        const nameColorClass = isMe ? 'chat-message-me' : 'chat-message-other';
        const displayName = isMe ? 'YOU' : shortId;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';

        const nameSpan = document.createElement('span');
        nameSpan.className = nameColorClass;
        nameSpan.textContent = `[${displayName}]: `;

        const textSpan = document.createElement('span');
        textSpan.textContent = message;

        msgDiv.appendChild(nameSpan);
        msgDiv.appendChild(textSpan);

        this.chatLog.appendChild(msgDiv);
        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    addSystemMessage(message) {
        if (!this.chatLog) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message chat-message-system';
        msgDiv.textContent = message;

        this.chatLog.appendChild(msgDiv);
        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    cleanupDOMUI() {
        if (document.getElementById('game-ui-container')) {
            document.getElementById('game-ui-container').remove();
        }
        if (document.getElementById('game-ui-styles')) {
            document.getElementById('game-ui-styles').remove();
        }
    }

    resizeChat() {
        if (!this.chatContainer) return;
        const canvas = this.sys.game.canvas;
        const rect = canvas.getBoundingClientRect();

        const scaleX = (rect.width / 1280) || 1;
        const scaleY = (rect.height / 720) || 1;

        this.chatContainer.style.left = `${rect.left + 20 * scaleX}px`;
        this.chatContainer.style.bottom = `${window.innerHeight - rect.bottom + 80 * scaleY}px`;
        this.chatContainer.style.width = `${360 * scaleX}px`;
        this.chatContainer.style.height = `${200 * scaleY}px`;
        this.chatContainer.style.fontSize = `${14 * scaleX}px`;

        const input = document.getElementById('game-chat-input');
        if (input) {
            input.style.fontSize = `${14 * scaleX}px`;
        }
    }

    cleanupChat() {
        // Remove scale resize listener
        this.scale.off('resize', this.resizeChat, this);

        const style = document.getElementById('game-chat-styles');
        if (style) style.remove();

        const container = document.getElementById('game-chat-container');
        if (container) container.remove();

        this.chatContainer = null;
        this.chatLog = null;
        this.chatInputContainer = null;
        this.chatInput = null;
        this.isChatActive = false;

        // Ensure Phaser's keyboard plugin is re-enabled on cleanup
        if (this.input && this.input.keyboard) {
            this.input.keyboard.enabled = true;
        }
    }
}
