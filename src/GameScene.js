import Player from './player/Player.js';
import SocketManager from './SocketManager.js';

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
        this.maxEnemies = 3;

        this.platforms = [];
        this.players = [];
        this.enemies = [];

        this.mode = 'solo';

        this.socket = null;
        this.roomId = null;
        this.localPlayer = null;
        this.otherPlayerMap = {};
    }

    preload() {
        this.load.image('bg', '../assets/background.png');

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

    create() {
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
        this.maxEnemies = 3;
        this.isSpawningEnemies = false;
        this.multiplayerReady = false;

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

        // ─── Spawn Points — MUST MATCH SERVER ─────────────
        const SPAWN_OFFSET = 60;

        // ─── Spawn Points — EXACT for 152px player height ────
        this.spawnPoints = [
            // On the ground (surface y = 3747)
            { x: 300, y: 3669 },
            { x: 600, y: 3669 },
            { x: 900, y: 3669 },
            { x: 1200, y: 3669 },
            { x: 1500, y: 3669 },

            // On platform A (surface y = 3341, x: 414-1228)
            { x: 550, y: 3263 },
            { x: 800, y: 3263 },

            // On platform B (surface y = 3339, x: 1216-1760)
            { x: 1350, y: 3261 },
            { x: 1550, y: 3261 },

            // On platform C (surface y = 3131, x: 916-1498)
            { x: 1050, y: 3053 },
        ];

        // ─── Mode Setup ──────────────────────────────────
        if (this.mode === 'solo') {
            this.spawnPlayer();
            this.spawnEnemyWave();
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

        // ─── Draw Tool ───────────────────────────────────
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

            if (playerInfo.anim) {
                const currentAnim = remote.sprite.anims.currentAnim;
                if (!currentAnim || currentAnim.key !== playerInfo.anim) {
                    remote.sprite.anims.play(playerInfo.anim, true);
                }
            }
        });

        // 5. Player damaged
        this.socket.on('playerDamaged', (data) => {
            // If WE got hit
            if (data.targetId === this.socket.id && this.localPlayer) {
                if (this.localPlayer.health && typeof this.localPlayer.health === 'object') {
                    this.localPlayer.health.current = data.remainingHealth;
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

            // If a REMOTE player got hit
            const remote = this.otherPlayerMap[data.targetId];
            if (remote && remote.sprite && remote.sprite.active) {

                if (remote.health && typeof remote.health === 'object') {
                    remote.health.current = data.remainingHealth;
                }

                this.safePlaySound('sfx_hurt', 0.4);

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
                this.localPlayer.sprite.anims.play('death_anim', true);
                this.localPlayer.isControlled = false;
                this.localPlayer.sprite.setVelocity(0, 0);
                this.safePlaySound('sfx_death', 0.5);
                this.showKillMessage('YOU DIED!', '#ff4444');
            }

            // If a REMOTE player died
            const remote = this.otherPlayerMap[data.victimId];
            if (remote && remote.sprite && remote.sprite.active) {
                remote.state = 'dead';
                remote.sprite.anims.play('death_anim', true);
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

                this.localPlayer.sprite.anims.play('idle_anim', true);
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
                remote.sprite.anims.play('idle_anim', true);
                remote.sprite.setActive(true).setVisible(true);
            }
        });

        // 8. Scoreboard
        this.socket.on('scoreboard', (scores) => {
            this.updateScoreboard(scores);
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

        // ✅ Disable physics body briefly so sprite doesn't collide on spawn
        player.sprite.body.enable = false;
        player.sprite.body.setVelocity(0, 0);

        this.localPlayer = player;
        this.players.push(player);

        this.physics.add.collider(player.sprite, this.platformGroup);
        this.cameras.main.startFollow(player.sprite, true, 0.1, 0.1);

        // ✅ Re-enable physics after a short delay (lets position settle)
        this.time.delayedCall(100, () => {
            if (player.sprite && player.sprite.body) {
                player.sprite.body.enable = true;
                player.sprite.body.setVelocity(0, 0);
            }
        });

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

        // ✅ Disable gravity and physics for remote players
        // Their position comes 100% from the network
        remotePlayer.sprite.body.setAllowGravity(false);
        remotePlayer.sprite.body.setImmovable(true);
        remotePlayer.sprite.body.moves = false;

        // Interpolation targets
        remotePlayer.targetX = playerInfo.x;
        remotePlayer.targetY = playerInfo.y;

        // Store by ID
        this.otherPlayerMap[playerInfo.playerId] = remotePlayer;

        // Add to physics group
        this.otherPlayers.add(remotePlayer.sprite);
        remotePlayer.sprite.playerId = playerInfo.playerId;

        // ✅ No collider needed for remote players — server controls their position
        // this.physics.add.collider(remotePlayer.sprite, this.platformGroup);  ← REMOVE THIS
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

            // ✅ Check health on the HealthSystem object
            if (remote.health && remote.health.current <= 0) return;

            const rx = remote.sprite.x;
            const ry = remote.sprite.y;

            // ✅ Use actual sprite body size for hitbox
            const rw = remote.sprite.body.width;
            const rh = remote.sprite.body.height;

            // AABB overlap check
            const overlap =
                attackX < rx + rw / 2 &&
                attackX + attackW > rx - rw / 2 &&
                attackY < ry + rh / 2 &&
                attackY + attackH > ry - rh / 2;

            if (overlap) {
                console.log(`⚔️ HIT! ${id} for ${damage} damage`);
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

        this.scene.start('LobbyScene');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🔄 UPDATE
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

        // ✅ Only filter players with destroyed sprites, NOT dead state
        // Dead players still need to play death animation before being removed
        this.players = this.players.filter(p => p && p.sprite && p.sprite.active);

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
        if (!this.multiplayerReady) return;

        if (this.localPlayer && this.localPlayer.sprite && this.localPlayer.sprite.active) {

            try {
                this.localPlayer.update();
            } catch (err) {
                // ignore
            }

            if (this.socket && this.localPlayer.isControlled) {
                const s = this.localPlayer.sprite;
                const x = Math.round(s.x);
                const y = Math.round(s.y);
                const flipX = s.flipX;
                const anim = s.anims.currentAnim ? s.anims.currentAnim.key : 'idle_anim';

                // 🔍 LOG EVERY EMISSION
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
            } else {
                // 🔍 WHY NOT SENDING?
                if (!this.socket) console.log('❌ No socket');
                if (!this.localPlayer.isControlled) console.log('❌ Not controlled');
            }
        } else {
            // 🔍 WHY NO LOCAL PLAYER?
            if (!this.localPlayer) console.log('❌ No localPlayer');
            else if (!this.localPlayer.sprite) console.log('❌ No sprite');
            else if (!this.localPlayer.sprite.active) console.log('❌ Sprite not active');
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
        });
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

    respawnPlayer() {
        // ✅ Prevent double respawn
        if (this.isRespawning) return;
        this.isRespawning = true;

        // Clean dead players
        this.players = this.players.filter(p => p && p.sprite && p.sprite.active && p.state !== 'dead');

        const spawn = Phaser.Utils.Array.GetRandom(this.spawnPoints);
        const player = new Player(this, spawn.x, spawn.y, null, true, this.selectedCharacter);

        this.players.push(player);
        this.physics.add.collider(player.sprite, this.platformGroup);
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🧱 PLATFORM SYSTEM — FIXED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createPlatform(rect) {
        const platform = this.add.rectangle(
            rect.x + rect.w / 2,
            rect.y + rect.h / 2,
            rect.w,
            rect.h,
            0xff0000,
            0.0
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