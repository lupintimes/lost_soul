import Player from './player/Player.js';
import SocketManager from './SocketManager.js';
import PlayerData from './PlayerData.js';

export default class GameScene extends Phaser.Scene {

    // Add this method to GameScene class
    safePlaySound(key, volume = 0.5) {
        try {
            if (this.cache.audio.exists(key)) {
                this.sound.play(key, { volume });
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

    preload() {
        this.load.image('bg', '../assets/background.webp');

        const characters = ['p1', 'p2', 'p3'];

        characters.forEach(char => {
            this.load.spritesheet(`${char}_idle`, `../assets/${char}/idle.png`, { frameWidth: 520, frameHeight: 420 });
            this.load.spritesheet(`${char}_walk`, `../assets/${char}/walk.png`, { frameWidth: 520, frameHeight: 420 });
            this.load.spritesheet(`${char}_attack`, `../assets/${char}/attack.png`, { frameWidth: 520, frameHeight: 420 });
            this.load.spritesheet(`${char}_blink`, `../assets/${char}/blink.png`, { frameWidth: 520, frameHeight: 420 });
            this.load.spritesheet(`${char}_taunt`, `../assets/${char}/taunt.png`, { frameWidth: 520, frameHeight: 420 });
            this.load.spritesheet(`${char}_hurt`, `../assets/${char}/hurt.png`, { frameWidth: 520, frameHeight: 420 });
            this.load.spritesheet(`${char}_death`, `../assets/${char}/death.png`, { frameWidth: 520, frameHeight: 420 });
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

        // ✅ Teleport configuration
        const teleports = [
            { x: 375, y: 2900, tx: 2350, ty: 2244 },
            { x: 2293, y: 2244, tx: 3000, ty: 226 },
            { x: 2937, y: 226, tx: 3450, ty: 219 },
            { x: 3356, y: 219, tx: 5600, ty: 3542 },
            { x: 5510, y: 3542, tx: 450, ty: 2900 }
        ];

        // ✅ Create teleporter sprites once
        if (!this.teleporterSprites || this.teleporterSprites.length === 0) {
            this.teleporterSprites = [];

            const portalKeys = ['portal_gold', 'portal_pink', 'portal_teal', 'portal_purple', 'portal_gray'];

            // Source portals (full portal sprite, one per teleport)
            teleports.forEach((tp, i) => {
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

        // ✅ Check each teleporter
        for (let i = 0; i < teleports.length; i++) {
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

    create() {
        this.cameras.main.setRoundPixels(true);
        // Clean up DOM chat elements on scene shutdown or destroy
        this.events.on('shutdown', () => this.cleanupChat());
        this.events.on('destroy', () => this.cleanupChat());

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
        this.killCount = 0;
        this.deathCount = 0;
        this.maxEnemies = 12;
        this.isSpawningEnemies = false;
        this.multiplayerReady = false;
        // Reset teleporter state
        this.canTeleport = true;
        this.teleporterSprites = [];

        // 🌍 Background
        this.bg = this.add.image(0, 0, 'bg').setOrigin(0);

        const worldWidth = this.bg.width;
        const worldHeight = this.bg.height;

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
                    fontFamily: '"Silkscreen"',
                    fontSize: '18px',
                    color: '#ffff00'
                }
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(999);

            this.setupMultiplayer();
            this.initChat();
        }

        // ─── Obstacle Limit Configuration ────────────────
        this.OBSTACLE_MIN_WIDTH = 30;
        this.OBSTACLE_MIN_HEIGHT = 30;
        this.OBSTACLE_MIN_AREA = 900;
        this.OBSTACLE_MAX_AREA = 250000;
        this.MAX_BUILD_POINTS = 300000;

        // ─── Draw Tool ───────────────────────────────────
        this.preview = this.add.graphics();
        this.isDrawing = false;
        this.startPoint = null;
        this.keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.selectedBlockType = 'normal'; // 'normal', 'bounce', 'slide'
        this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

        this.input.on('pointerdown', (pointer) => {
            if (this.keyX.isDown) {
                this.removeobstacle(pointer);
                return;
            }
            const world = pointer.positionToCamera(this.cameras.main);
            this.startPoint = world;
            this.isDrawing = true;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.isDrawing) return;
            const world = pointer.positionToCamera(this.cameras.main);

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
        });

        this.input.on('pointerup', (pointer) => {
            if (!this.isDrawing) return;
            const world = pointer.positionToCamera(this.cameras.main);

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

            if (success && this.mode === 'multiplayer' && this.socket) {
                this.socket.emit('createObstacle', { id, rect, opacity, creatorId, tint, blockType });
            }

            this.preview.clear();
            this.isDrawing = false;
        });




        this.input.keyboard.on('keydown-ESC', () => {
            if (this.isChatActive) return;
            if (this.mode === 'multiplayer') {
                this.leaveMultiplayer();
            } else {
                this.scene.start('MenuScene');
            }
        });

        this.createBuildPointsUI();
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
            this.showKillMessage('PLAYER LEFT', '#888888');
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

            if (playerInfo.anim) {
                const currentAnim = remote.sprite.anims.currentAnim;
                if (!currentAnim || currentAnim.key !== playerInfo.anim) {
                    remote.sprite.anims.play(playerInfo.anim, true);
                }
            }
        });

        // 5. Player damaged
        this.socket.on('playerDamaged', (data) => {
            if (data.targetId === this.socket.id && this.localPlayer) {
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
            this.createObstacle(data.rect, data.opacity, data.id, data.creatorId, false, data.tint, data.blockType || 'normal');
        });

        this.socket.on('obstacleRemoved', (data) => {
            console.log('🗑️ Remote obstacle removed:', data.id);
            const index = this.platforms.findIndex(p => p.id === data.id);
            if (index !== -1) {
                const p = this.platforms[index];
                if (p.gameObject) p.gameObject.destroy();
                if (p.outer) p.outer.destroy();
                if (p.middle) p.middle.destroy();
                this.platforms.splice(index, 1);
            }
        });

        this.socket.on('currentObstacles', (obstacles) => {
            console.log('📋 Received current obstacles:', obstacles);
            Object.keys(obstacles).forEach(id => {
                const obs = obstacles[id];
                if (!this.platforms.some(p => p.id === id)) {
                    this.createObstacle(obs.rect, obs.opacity, id, obs.creatorId, false, obs.tint, obs.blockType || 'normal');
                }
            });
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

        // ✅ Disable gravity and physics for remote players in Matter
        remotePlayer.sprite.setSensor(true);
        remotePlayer.sprite.setIgnoreGravity(true);
        remotePlayer.sprite.setDepth(10);

        // Interpolation targets
        remotePlayer.targetX = playerInfo.x;
        remotePlayer.targetY = playerInfo.y;

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

        const bg = this.add.rectangle(startX, startY, 240, 22 + scores.length * 18 + 6, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.scoreboardElements.push(bg);

        const header = this.add.text(startX + 10, startY + 4, 'SCOREBOARD', {
            fontFamily: '"Silkscreen"',
            fontSize: '11px',
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
                startX + 10,
                startY + 24 + (index * 18),
                `${prefix}${shortId}  K:${entry.kills}  D:${entry.deaths}`,
                {
                    fontFamily: '"Silkscreen"',
                    fontSize: '11px',
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
            fontFamily: '"Silkscreen"',
            fontSize: '26px',
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
        this.updateBuildPointsUI();
        this.updateHUD();

        // ─── Block Type Selection Keys ────────────────────
        if (Phaser.Input.Keyboard.JustDown(this.key1)) {
            this.selectedBlockType = 'normal';
            this.showKillMessage('BLOCK: NORMAL', '#c4c9ca');
        } else if (Phaser.Input.Keyboard.JustDown(this.key2)) {
            this.selectedBlockType = 'bounce';
            this.showKillMessage('BLOCK: BOUNCE', '#ffd700');
        } else if (Phaser.Input.Keyboard.JustDown(this.key3)) {
            this.selectedBlockType = 'slide';
            this.showKillMessage('BLOCK: SLIDE', '#00ffff');
        }

        if (this.mode === 'solo') {
            this.updateSolo();
        }

        if (this.mode === 'multiplayer') {
            this.updateMultiplayer();
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
        this.checkTeleports();
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
                    this.localPlayer.lastRageActive !== this.localPlayer.isRageActive;

                if (hasChanged && (now - this.lastEmitTime) > 50) {
                    this.socket.emit('playerMovement', { 
                        x, 
                        y, 
                        flipX, 
                        anim,
                        isShieldActive: this.localPlayer.isShieldActive,
                        isRageActive: this.localPlayer.isRageActive
                    });
                    this.localPlayer.lastX = x;
                    this.localPlayer.lastY = y;
                    this.localPlayer.lastFlip = flipX;
                    this.localPlayer.lastAnim = anim;
                    this.localPlayer.lastShieldActive = this.localPlayer.isShieldActive;
                    this.localPlayer.lastRageActive = this.localPlayer.isRageActive;
                    this.lastEmitTime = now;
                }
            }
        }

        // Interpolate remote players
        Object.keys(this.otherPlayerMap).forEach(id => {
            const remote = this.otherPlayerMap[id];
            if (!remote || !remote.sprite || !remote.sprite.active) return;

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

            try {
                remote.update();
            } catch (err) {
                // ignore
            }
        });
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

    createObstacle(rect, opacity, id = null, creatorId = null, isLocalInit = false, tint = null, blockType = 'normal') {
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
                    console.log(`✂️ Overlap detected with enemy obstacle ${p.id || 'no-id'}. Performing subtraction.`);

                    // Remove old enemy obstacle locally
                    if (p.gameObject) p.gameObject.destroy();
                    if (p.outer) p.outer.destroy();
                    if (p.middle) p.middle.destroy();
                    this.platforms.splice(i, 1);

                    // Notify server to remove it
                    if (this.mode === 'multiplayer' && this.socket && p.id) {
                        this.socket.emit('removeObstacle', { id: p.id });
                    }

                    // Compute remaining regions of the enemy obstacle
                    const pieces = this.subtractRect(p, rect);
                    console.log(`✂️ Obstacle split into ${pieces.length} smaller pieces.`);

                    // Create and emit split pieces under original creator's ownership
                    pieces.forEach((piece, index) => {
                        const subId = p.id ? `${p.id}_sub_${index}_${Date.now()}` : `${p.creatorId}_sub_${Date.now()}_${index}`;

                        this.createObstacle(piece, opacity, subId, p.creatorId, false, p.tint);

                        if (this.mode === 'multiplayer' && this.socket) {
                            this.socket.emit('createObstacle', { id: subId, rect: piece, opacity, creatorId: p.creatorId, tint: p.tint });
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
            opacity
        );
        // Outer border color: blockType takes priority, then tint, then default slate
        let outerColor;
        if (blockType === 'bounce') {
            outerColor = 0xffd700; // Gold for bounce
        } else if (blockType === 'slide') {
            outerColor = 0x00e5ff; // Cyan for slide/ice
        } else {
            outerColor = (tint !== null && tint !== undefined) ? tint : 0xc4c9ca;
        }
        const outer = this.add.rectangle(
            cx,
            cy,
            rect.w - 12.5,
            rect.h - 12.5,
            outerColor,
            opacity
        );

        // Inner black border (top layer - black by default)
        const middle = this.add.rectangle(
            cx,
            cy,
            rect.w - 25,
            rect.h - 25,
            0x000000,
            1
        );


        this.matter.add.gameObject(platform, {
            isStatic: true,
            friction: blockType === 'slide' ? 0.0 : 0.1
        });


        if (rotation !== 0) {
            platform.setAngle(rotation);
            outer.setAngle(rotation);
            middle.setAngle(rotation);
        }
        this.platforms.push({
            gameObject: platform,
            outer,
            middle,
            tint,
            blockType: blockType || 'normal',
            ...rect,
            deletable: true,
            source: 'user',
            id: id,
            creatorId: creatorId
        });

        // Decay timer: start blinking after 12 seconds, disappear and refund after 15 seconds
        const decayTime = 15000;
        const blinkStartTime = 12000;

        // Schedule blinking
        this.time.delayedCall(blinkStartTime, () => {
            const idx = this.platforms.findIndex(p => p.id === id);
            if (idx !== -1) {
                const p = this.platforms[idx];
                const components = [p.gameObject, p.outer, p.middle].filter(Boolean);
                
                this.tweens.add({
                    targets: components,
                    alpha: 0.2,
                    duration: 250,
                    yoyo: true,
                    repeat: 11 // 12 cycles of 250ms = 3 seconds of blinking
                });
            }
        });

        // Schedule deletion & build points refund
        this.time.delayedCall(decayTime, () => {
            const idx = this.platforms.findIndex(p => p.id === id);
            if (idx !== -1) {
                const p = this.platforms[idx];
                const components = [p.gameObject, p.outer, p.middle].filter(Boolean);
                
                // Fade out smoothly over 500ms
                this.tweens.add({
                    targets: components,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        const currentIdx = this.platforms.findIndex(pl => pl.id === id);
                        if (currentIdx !== -1) {
                            const pl = this.platforms[currentIdx];
                            const isOwner = this.mode !== 'multiplayer' || !pl.creatorId || pl.creatorId === this.socket.id;
                            
                            if (isOwner) {
                                // Authoritatively remove locally and sync to other clients
                                if (this.mode === 'multiplayer' && this.socket && pl.id) {
                                    this.socket.emit('removeObstacle', { id: pl.id });
                                }
                                
                                if (pl.gameObject) pl.gameObject.destroy();
                                if (pl.outer) pl.outer.destroy();
                                if (pl.middle) pl.middle.destroy();
                                
                                this.platforms.splice(currentIdx, 1);
                                this.updateBuildPointsUI();
                            } else {
                                // For non-owners, they can also clean up locally after fade-out completes
                                if (pl.gameObject) pl.gameObject.destroy();
                                if (pl.outer) pl.outer.destroy();
                                if (pl.middle) pl.middle.destroy();
                                
                                this.platforms.splice(currentIdx, 1);
                            }
                        }
                    }
                });
            }
        });

        return true;
    }

    getUsedBuildPoints() {
        let used = 0;
        this.platforms.forEach(p => {
            if (p.deletable && (!p.creatorId || (this.socket && p.creatorId === this.socket.id))) {
                used += p.w * p.h;
            }
        });
        return used;
    }

    createBuildPointsUI() {
        const { width } = this.scale;
        const startX = width - 230;
        const startY = 10;
        const panelW = 220;
        const panelH = 68; // Expanded to fit block type row and larger text

        this.buildUIBg = this.add.rectangle(startX, startY, panelW, panelH, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.buildUIBg.setStrokeStyle(1.5, 0x333333);

        this.buildUITitle = this.add.text(startX + 10, startY + 6, 'BUILD POINTS', {
            fontFamily: '"Silkscreen"',
            fontSize: '11px',
            color: '#ffff00'
        })
            .setScrollFactor(0)
            .setDepth(100);

        this.buildUIBarBg = this.add.rectangle(startX + 10, startY + 20, panelW - 20, 10, 0x222222)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.buildUIBarFill = this.add.rectangle(startX + 10, startY + 20, panelW - 20, 10, 0x00ffcc)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.buildUIText = this.add.text(startX + 10, startY + 34, '300,000 / 300,000', {
            fontFamily: '"Silkscreen"',
            fontSize: '10px',
            color: '#ffffff'
        })
            .setScrollFactor(0)
            .setDepth(100);

        // Block type indicator (1=Normal, 2=Bounce, 3=Slide)
        this.buildBlockTypeText = this.add.text(startX + 10, startY + 46, '[ 1 ] NORMAL', {
            fontFamily: '"Silkscreen"',
            fontSize: '10px',
            color: '#c4c9ca'
        })
            .setScrollFactor(0)
            .setDepth(100);
    }

    updateBuildPointsUI() {
        if (!this.buildUIBarFill || !this.buildUIText) return;

        const used = this.getUsedBuildPoints();
        const available = Math.max(0, this.MAX_BUILD_POINTS - used);
        const pct = Math.max(0, Math.min(1, available / this.MAX_BUILD_POINTS));

        // Update bar width (max width is panelW - 20 = 200)
        this.buildUIBarFill.width = 200 * pct;

        // Change bar fill color depending on remaining build points percentage
        if (pct < 0.2) {
            this.buildUIBarFill.setFillStyle(0xff4444); // Red
        } else if (pct < 0.5) {
            this.buildUIBarFill.setFillStyle(0xffaa00); // Orange
        } else {
            this.buildUIBarFill.setFillStyle(0x00ffcc); // Cyan
        }

        // Format numbers with commas (e.g. 150,000)
        const formatNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        this.buildUIText.setText(`${formatNum(available)} / ${formatNum(this.MAX_BUILD_POINTS)}`);

        // Update block type indicator
        if (this.buildBlockTypeText) {
            const bt = this.selectedBlockType || 'normal';
            if (bt === 'bounce') {
                this.buildBlockTypeText.setText('[ 2 ] BOUNCE ↑');
                this.buildBlockTypeText.setColor('#ffd700');
            } else if (bt === 'slide') {
                this.buildBlockTypeText.setText('[ 3 ] SLIDE ⟶');
                this.buildBlockTypeText.setColor('#00e5ff');
            } else {
                this.buildBlockTypeText.setText('[ 1 ] NORMAL');
                this.buildBlockTypeText.setColor('#c4c9ca');
            }
        }
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

                if (p.gameObject) p.gameObject.destroy();
                if (p.outer) p.outer.destroy();
                if (p.middle) p.middle.destroy();

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
        const { width, height } = this.scale;

        // 1. Health Panel (top-left)
        this.hudHealthBg = this.add.rectangle(10, 10, 240, 58, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.hudHealthBg.setStrokeStyle(1.5, 0x333333);

        this.hudHealthTitle = this.add.text(20, 15, 'PLAYER HP', {
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
            color: '#ff4444'
        })
            .setScrollFactor(0)
            .setDepth(100);

        this.hudHealthBarBg = this.add.rectangle(20, 31, 220, 12, 0x222222)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.hudHealthBarFill = this.add.rectangle(20, 31, 220, 12, 0x2ecc71)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.hudHealthText = this.add.text(20, 46, 'HP: 100 / 100', {
            fontFamily: '"Silkscreen"',
            fontSize: '11px',
            color: '#ffffff'
        })
            .setScrollFactor(0)
            .setDepth(100);

        // 2. Stats Panel (below Health panel)
        this.hudKillsBg = this.add.rectangle(10, 78, 240, 32, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.hudKillsBg.setStrokeStyle(1.5, 0x333333);

        this.hudKillsText = this.add.text(20, 85, 'KILLS: 0   DEATHS: 0', {
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
            color: '#ffffff'
        })
            .setScrollFactor(0)
            .setDepth(100);

        // 3. Spell Cooldown Panel (below Build Points panel on the right side)
        const spellX = width - 250;
        const spellY = 100; // 10px below Build Points panel (10 + 80 = 90)

        this.hudSpellBg = this.add.rectangle(spellX, spellY, 240, 44, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.hudSpellBg.setStrokeStyle(1.5, 0x333333);

        this.hudSpellTitle = this.add.text(spellX + 10, spellY + 8, 'SPELL (R): READY', {
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
            color: '#44ff44'
        })
            .setScrollFactor(0)
            .setDepth(100);

        this.hudSpellBarBg = this.add.rectangle(spellX + 10, spellY + 24, 220, 10, 0x222222)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.hudSpellBarFill = this.add.rectangle(spellX + 10, spellY + 24, 220, 10, 0x9b30ff)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        // 4. Dash Cooldown / Charges Panel (below Spell panel on the right side)
        const dashX = width - 250;
        const dashY = 154; // 10px below Spell panel (100 + 44 + 10)

        this.hudDashBg = this.add.rectangle(dashX, dashY, 240, 44, 0x000000, 0.6)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.hudDashBg.setStrokeStyle(1.5, 0x333333);

        this.hudDashTitle = this.add.text(dashX + 10, dashY + 8, 'DASH (SHIFT): READY', {
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
            color: '#44ff44'
        })
            .setScrollFactor(0)
            .setDepth(100);

        this.hudDashBarBg = this.add.rectangle(dashX + 10, dashY + 24, 220, 10, 0x222222)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.hudDashBarFill = this.add.rectangle(dashX + 10, dashY + 24, 220, 10, 0x00bfff)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(100);

        this.hudControlsBg = this.add.rectangle((width - 540) / 2, height - 105, 540, 95, 0x000000, 0.7)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(99);
        this.hudControlsBg.setStrokeStyle(1.5, 0x555555);

        const controlsTextStr =
            "CONTROLS HINT:\n" +
            "• Move: A/D | Jump: W | High Jump: Q | Dash: SHIFT | Taunt: T\n" +
            "• Spell: R | Attack: SPACE\n" +
            "• Build Block: Left Click & Drag | Delete: Right Click (or X+Click)";

        this.hudControlsText = this.add.text((width - 540) / 2 + 15, height - 98, controlsTextStr, {
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
            color: '#cccccc',
            lineSpacing: 5
        })
            .setScrollFactor(0)
            .setDepth(100);

        // Fade out controls panel after 10 seconds
        this.time.delayedCall(10000, () => {
            this.tweens.add({
                targets: [this.hudControlsBg, this.hudControlsText],
                alpha: 0,
                duration: 1500,
                onComplete: () => {
                    if (this.hudControlsBg && this.hudControlsBg.active) this.hudControlsBg.destroy();
                    if (this.hudControlsText && this.hudControlsText.active) this.hudControlsText.destroy();
                }
            });
        });
    }

    updateHUD() {
        const playerObj = this.mode === 'multiplayer' ? this.localPlayer : this.players[0];
        if (!playerObj) return;

        const currentHp = playerObj.health ? playerObj.health.current : 0;
        const maxHp = playerObj.health ? playerObj.health.max : 100;

        if (this.hudHealthBarFill && this.hudHealthText) {
            const pct = Math.max(0, Math.min(1, currentHp / maxHp));
            this.hudHealthBarFill.width = 200 * pct;

            let color = 0x2ecc71; // Green
            if (pct < 0.3) {
                color = 0xe74c3c; // Red
            } else if (pct < 0.6) {
                color = 0xf1c40f; // Yellow
            }
            this.hudHealthBarFill.setFillStyle(color);

            let tag = '';
            if (playerObj.isRageActive) {
                tag = '  [RAGE]';
                this.hudHealthText.setColor('#ff3333');
            } else if (playerObj.isShieldActive) {
                tag = '  [SHIELD]';
                this.hudHealthText.setColor('#00ffff');
            } else {
                this.hudHealthText.setColor('#ffffff');
            }

            this.hudHealthText.setText(`HP: ${currentHp} / ${maxHp}${tag}`);
        }

        if (this.hudKillsText) {
            this.hudKillsText.setText(`KILLS: ${this.killCount}   DEATHS: ${this.deathCount}`);
        }

        const now = this.time.now;

        if (this.hudSpellTitle && this.hudSpellBarFill && playerObj) {
            const lastCast = playerObj.lastSpellTime || 0;
            const cooldown = playerObj.spellCooldown || 200;
            const elapsed = now - lastCast;

            const isKnight = playerObj.character === 'p1';
            const spellName = isKnight ? 'SHIELD' : 'SPELL';

            const spellColors = {
                'p1': 0x00ffff,
                'p2': 0xff8c00,
                'p3': 0x9b30ff
            };
            const spellColor = spellColors[playerObj.character] || 0x00ffff;

            if (playerObj.isShieldActive) {
                const activeElapsed = now - lastCast;
                const shieldDuration = 2000;
                const activeRatio = Math.max(0, Math.min(1, 1 - (activeElapsed / shieldDuration)));
                const activeRem = ((shieldDuration - activeElapsed) / 1000).toFixed(1);

                this.hudSpellTitle.setText(`SHIELD: ACTIVE (${activeRem}s)`);
                this.hudSpellTitle.setColor('#00ffff');
                
                this.hudSpellBarFill.width = 200 * activeRatio;
                this.hudSpellBarFill.setFillStyle(0x00ffff);
            } else if (elapsed < cooldown) {
                const ratio = Math.max(0, Math.min(1, elapsed / cooldown));
                const rem = ((cooldown - elapsed) / 1000).toFixed(1);
                
                this.hudSpellTitle.setText(`${spellName} (R): COOLDOWN (${rem}s)`);
                this.hudSpellTitle.setColor('#ffaa00');
                
                this.hudSpellBarFill.width = 200 * ratio;
                this.hudSpellBarFill.setFillStyle(0xffaa00);
            } else {
                this.hudSpellTitle.setText(`${spellName} (R): READY`);
                this.hudSpellTitle.setColor('#44ff44');
                
                this.hudSpellBarFill.width = 200;
                this.hudSpellBarFill.setFillStyle(spellColor);
            }
        }

        if (this.hudDashTitle && this.hudDashBarFill && playerObj) {
            const maxCharges = playerObj.maxDashCharges || 1;
            const currentCharges = playerObj.dashCharges !== undefined ? playerObj.dashCharges : maxCharges;
            const bolts = '⚡'.repeat(currentCharges);
            
            if (currentCharges < maxCharges) {
                const lastRegen = playerObj.lastDashChargeRegenTime || now;
                const cooldown = playerObj.dashCooldown || 1500;
                const elapsed = now - lastRegen;
                const ratio = Math.max(0, Math.min(1, elapsed / cooldown));
                
                this.hudDashTitle.setText(`DASH (SHIFT): RECHARGING [${bolts}]`);
                this.hudDashTitle.setColor('#ffaa00');
                
                this.hudDashBarFill.width = 200 * ratio;
                this.hudDashBarFill.setFillStyle(0xffaa00);
            } else {
                this.hudDashTitle.setText(`DASH (SHIFT): READY [${bolts}]`);
                this.hudDashTitle.setColor('#44ff44');
                
                this.hudDashBarFill.width = 200;
                this.hudDashBarFill.setFillStyle(0x00bfff);
            }
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
                bottom: 80px;
                left: 20px;
                width: 360px;
                height: 200px;
                display: flex;
                flex-direction: column;
                pointer-events: none;
                z-index: 1000;
                font-family: 'Silkscreen', monospace;
                font-size: 8px;
            }
            #game-chat-log {
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                margin-bottom: 8px;
                padding: 8px;
                background: rgba(0, 0, 0, 0.4);
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.1);
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
                color: #ffffff;
            }
            .chat-message-system {
                color: #ffff00;
            }
            .chat-message-me {
                color: #44ff44;
            }
            .chat-message-other {
                color: #88ccff;
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
                background: rgba(10, 10, 10, 0.9);
                border: 1.5px solid #555;
                border-radius: 4px;
                color: #fff;
                font-family: 'Silkscreen', monospace;
                font-size: 8px;
                outline: none;
                box-sizing: border-box;
            }
            #game-chat-input:focus {
                border-color: #ffff00;
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
        document.body.appendChild(container);

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

    cleanupChat() {
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