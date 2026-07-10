import Controls from './Controls.js';
import CombatSystem from '../systems/CombatSystem.js';
import HealthSystem from '../systems/HealthSystem.js';
import PlayerData from '../PlayerData.js';


export default class Player {

    // Add this method to Player clas
    // s
    playSound(key, volume = 0.5) {
        try {
            if (this.scene.cache.audio.exists(key)) {
                this.scene.sound.play(key, { volume: volume * PlayerData.sfxVolume });
            }
        } catch (e) {
            // Silently ignore missing audio
        }
    }

    getDamage() {
        const charDamage = this.damageTable[this.character] || this.damageTable['p1'];
        let baseDamage = charDamage.attack_1;
        const currentAnim = this.sprite.anims.currentAnim;

        if (currentAnim) {
            if (currentAnim.key === `${this.character}_attack_1`) baseDamage = charDamage.attack_1;
            if (currentAnim.key === `${this.character}_attack_2`) baseDamage = charDamage.attack_2;
            if (currentAnim.key === `${this.character}_attack_3`) baseDamage = charDamage.attack_3;
        }

        // 50% damage boost during Rage Mode
        if (this.isRageActive) {
            baseDamage = Math.round(baseDamage * 1.5);
        }

        // 40% damage reduction when chilled
        if (this.chillEndTime && this.scene.time.now < this.chillEndTime) {
            baseDamage = Math.round(baseDamage * (1 - this.chillPowerReduction));
        }

        return baseDamage;
    }

    getSpellDamage() {
        const charDamage = this.damageTable[this.character] || this.damageTable['p1'];
        let damage = charDamage.spell;
        if (this.isRageActive) {
            damage = Math.round(damage * 1.5);
        }
        if (this.chillEndTime && this.scene.time.now < this.chillEndTime) {
            damage = Math.round(damage * (1 - this.chillPowerReduction));
        }
        return damage;
    }



    constructor(scene, x, y, playerId, isControlled, character) {
        this.scene = scene;

        this.playerId = playerId || null;
        this.isControlled = isControlled !== undefined ? isControlled : true;
        this.character = character || 'p1';



        this.sprite = scene.matter.add.sprite(x, y, `${this.character}_idle`);
        this.sprite.setScale(0.4);
        this.sprite.setDepth(2);
        this.sprite.setRectangle(64, 152);
        this.sprite.setFixedRotation();
        this.sprite.setFriction(0.1, 0.05, 0.01);
        this.sprite.setBounce(0);
        
        // Setup collision categories (category 2 for players/enemies, category 1 for map)
        if (this.sprite && this.sprite.body) {
            this.sprite.body.collisionFilter.category = 0x0002;
            this.sprite.body.collisionFilter.mask = 0x0001 | 0x0002;
        }

        if (this.isControlled) {
            this.controls = new Controls(scene);
        } else {
            this.controls = null;
        }

        this.combat = new CombatSystem(scene, this);
        const maxHp = this.character === 'p1' ? 130 : 100;
        this.health = new HealthSystem(scene, this, maxHp);

        this.state = 'idle';
        this.isInvincible = false;
        // Knight (p1) has a 4-second cooldown for their Shield Block spell. Others have 200ms.
        this.spellCooldown = this.character === 'p1' ? 4000 : 200;
        this.lastSpellTime = 0;
        this.lastDamageTime = 0;
        this.lastRegenTime = 0;

        // Ability States & variables
        this.isShieldActive = false;
        this.shieldVisual = null;
        
        this.isRageActive = false;
        this.isRageForced = false;
        this.hasHighJumpedInAir = false;
        this.hasDoubleJumped = false;
        this.hasTriggeredUndyingRage = false;
        this.lastRageDrainTime = null;
        this.speed = 10;
        this.originalSpeed = 10;
        this.chillEndTime = null;
        this.chillSlowFactor = 0.5; // 50% slow
        this.chillPowerReduction = 0.4; // 40% power reduction
        this.freezeVisual = null;

        // Knight Taunt Fortress Buff
        this.isTauntedDefenseBuffActive = false;
        this.lastTauntBuffTime = -Infinity; // Allow immediate first use
        this.fortressVisual = null;

        // Dash charges & cooldown (0.7s recharge delay)
        this.dashCooldown = 700;
        this.maxDashCharges = this.character === 'p2' ? 2 : 1;
        this.dashCharges = this.maxDashCharges;
        this.lastDashChargeRegenTime = null;

        this.lastX = 0;
        this.lastY = 0;
        this.lastFlip = false;
        this.lastAnim = `${this.character}_idle_anim`;

        this.targetX = x;
        this.targetY = y;

        this.damageTable = {
            'p1': { attack_1: 35, attack_2: 50, attack_3: 70, spell: 30 },
            'p2': { attack_1: 30, attack_2: 40, attack_3: 60, spell: 35 },
            'p3': { attack_1: 50, attack_2: 65, attack_3: 90, spell: 45 }
        };



        // ⚔️ attack trigger
        // ⚔️ attack trigger
        this.sprite.on('animationupdate', (anim, frame) => {
            if (
                (anim.key === `${this.character}_attack_1` ||
                    anim.key === `${this.character}_attack_2` ||
                    anim.key === `${this.character}_attack_3`) &&
                frame.index === 2
            ) {
                console.log(`⚔️ HIT TRIGGERED! anim: ${anim.key}`);

                this.combat.attack();

                if (this.isControlled && this.scene.mode === 'multiplayer') {
                    this.checkMultiplayerHit();
                }
            }
        });

        // Setup overhead name tag for multiplayer / custom alias visibility
        if (!this.isEnemy) {
            const shortId = this.playerId ? this.playerId.substring(0, 6) : '';
            let startName = '';
            if (this.isControlled) {
                const myAlias = PlayerData.alias || 'YOU';
                startName = shortId ? `${myAlias} (${shortId})` : myAlias;
            } else {
                const peerAlias = this.alias;
                startName = peerAlias 
                    ? `${peerAlias} (${shortId})` 
                    : (shortId || 'PLAYER');
            }
            
            this.nameLabel = scene.add.text(x, y - 80, startName.toUpperCase(), {
                fontFamily: 'Rajdhani',
                fontSize: '13px',
                fontWeight: 'bold',
                color: this.isControlled ? '#ffffff' : '#ffd700',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(11);
        }
    }

    // ⚔️ MULTIPLAYER HIT DETECTION
    checkMultiplayerHit() {
        if (!this.scene || this.scene.mode !== 'multiplayer') return;

        const dir = this.sprite.flipX ? -1 : 1;
        const attackX = this.sprite.x + (dir * 30);
        const attackY = this.sprite.y - 20;
        const attackW = 100;
        const attackH = 80;

        // ✅ Use same damage table
        const damage = this.getDamage();

        this.scene.checkAttackHits(
            attackX - attackW / 2,
            attackY - attackH / 2,
            attackW,
            attackH,
            damage
        );
    }

    update() {
        if (!this.sprite || !this.sprite.body) return;

        if (this.nameLabel && this.sprite && this.sprite.active) {
            this.nameLabel.setPosition(this.sprite.x, this.sprite.y - 80);
            this.nameLabel.setVisible(this.state !== 'dead');
        }

        // Run abilities visuals/status effects update for all clients/players
        this.updateAbilitiesVisuals();

        if (this.state === 'dead') return;

        // Passive health regeneration (recovery over time)
        const isLocalPlayer = !this.isEnemy && (this.scene.mode !== 'multiplayer' || this.scene.localPlayer === this);
        const maxRegenHp = this.isRageForced ? Math.floor(this.health.max * 0.3) : this.health.max;
        if (isLocalPlayer && this.health.current < maxRegenHp && !this.hasTriggeredUndyingRage) {
            const now = this.scene.time.now;
            if (now - this.lastDamageTime >= 3000) {
                if (!this.lastRegenTime) {
                    this.lastRegenTime = now;
                }
                if (now - this.lastRegenTime >= 500) {
                    const regenAmount = 3;
                    this.health.current = Math.min(maxRegenHp, this.health.current + regenAmount);
                    if (this.health && typeof this.health.updateBar === 'function') {
                        this.health.updateBar();
                    }
                    this.lastRegenTime = now;
                }
            } else {
                this.lastRegenTime = null;
            }
        } else {
            this.lastRegenTime = null;
        }

        if (this.health && typeof this.health.updateBar === 'function') {
            this.health.updateBar();
        }

        if (this.sprite.y > 3900) {
            this.die();
            return;
        }

        // Check if player is standing on bounce/slide blocks
        const wasOnSlide = this.isStandingOnSlideBlock;
        this.isStandingOnSlideBlock = false;
        const feetOffset = 76 * (this.sprite.scaleY / 0.4);
        if (this.scene && this.scene.platforms) {
            const platforms = this.scene.platforms;
            const len = platforms.length;
            for (let i = 0; i < len; i++) {
                const platform = platforms[i];
                if (!platform.gameObject || !platform.gameObject.active) continue;
                if (platform.blockType !== 'bounce' && platform.blockType !== 'slide') continue;

                const rx = platform.x;
                const ry = platform.y;
                const rw = platform.w;
                const rh = platform.h;

                const px = this.sprite.x;
                const py = this.sprite.y;

                const isOverlappingX = (px + 20 >= rx) && (px - 20 <= rx + rw);
                // Widen threshold to 22px and check falling down (velocity.y >= 0) to avoid lag/resting delay on high-speed falls
                const isStandingOnTop = Math.abs((py + feetOffset) - ry) < 22 && this.sprite.body.velocity.y >= -1;

                if (isOverlappingX && isStandingOnTop) {
                    if (platform.blockType === 'bounce') {
                        const area = (platform.w || 30) * (platform.h || 30);
                        const minArea = 900;
                        const maxAreaThreshold = 15000;
                        const factor = Phaser.Math.Clamp((area - minArea) / (maxAreaThreshold - minArea), 0, 1);
                        
                        const jumpVelocity = -9 - (22 * factor);
                        
                        this.sprite.setVelocityY(jumpVelocity);
                        this.playSound('sfx_bubble_jump', 0.3 + 0.4 * factor);
                        this.lastBounceTime = this.scene.time.now;
                        
                        const particleColor = (platform.tint !== null && platform.tint !== undefined) ? platform.tint : 0xffd700;
                        this.createHitParticles(this.sprite.x, py + feetOffset, particleColor);
                        
                        if (this.scene && typeof this.scene.wobbleBlock === 'function') {
                            this.scene.wobbleBlock(platform);
                        }
                        
                        if (this.isControlled) {
                            platform.bounceCount = (platform.bounceCount || 0) + 1;
                            const maxBounces = Math.round(2 + 6 * factor);
                            if (platform.bounceCount >= maxBounces) {
                                const obstacleId = platform.id;
                                this.scene.time.delayedCall(10, () => {
                                    if (this.scene.mode === 'multiplayer' && this.scene.socket && obstacleId) {
                                        this.scene.socket.emit('removeObstacle', { id: obstacleId });
                                    }
                                    this.scene.destroyObstacleLocally(obstacleId, true);
                                });
                            }
                        }
                    } else if (platform.blockType === 'slide') {
                        this.isStandingOnSlideBlock = true;
                    }
                }
            }
        }

        // Track slide-off coasting: preserve momentum for a moment after leaving slide
        if (!this.isStandingOnSlideBlock && wasOnSlide) {
            this.slideCoastFrames = 18; // ~18 frames (~300ms at 60fps) of coast momentum
        }
        if (this.slideCoastFrames > 0) {
            this.slideCoastFrames--;
        }

        if (this.state === 'hurt') {
            return;
        }

        if (this.state === 'dash') {
            // Allow chaining a double dash if player is Shadow (p2) and has a charge
            if (this.controls && Phaser.Input.Keyboard.JustDown(this.controls.dash)) {
                this.dash();
            }
            return;
        }

        if (this.isEnemy) {
            this.enemyAI();
            return;
        }

        if (!this.isControlled) {
            return;
        }

        if (this.scene && this.scene.scene && this.scene.scene.isActive('SettingsScene')) {
            if (this.sprite && this.sprite.body) {
                this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.8);
                if (this.state !== 'dead' && this.state !== 'hurt' && this.state !== 'idle') {
                    this.state = 'idle';
                    this.sprite.anims.play(`${this.character}_idle`, true);
                }
            }
            return;
        }

        if (this.state === 'taunt') {
            // Allow interrupting taunt with movement, jump, attack, dash, or spell
            if (this.controls.left.isDown || this.controls.right.isDown || 
                this.controls.jump.isDown || this.controls.highJump.isDown ||
                Phaser.Input.Keyboard.JustDown(this.controls.attack) || 
                Phaser.Input.Keyboard.JustDown(this.controls.dash) || 
                Phaser.Input.Keyboard.JustDown(this.controls.spell)) {
                this.state = 'idle';
            } else {
                return;
            }
        }

        let speed = this.speed || 10;
        let jumpForce = this.jumpForce || -20;
        let highJumpForce = this.highJumpForce || -36;

        if (this.isShieldActive) {
            speed = speed * 1.5;
            jumpForce = jumpForce * 1.4;
            highJumpForce = highJumpForce * 1.3;
        }

        if (!this.controls) return;

        // Slide block wall climbing logic
        let isTouchingLeftSide = false;
        let isTouchingRightSide = false;
        
        if (this.scene && this.scene.platforms) {
            const platforms = this.scene.platforms;
            const len = platforms.length;
            for (let i = 0; i < len; i++) {
                const platform = platforms[i];
                if (platform.blockType !== 'slide' || !platform.gameObject || !platform.gameObject.active) continue;

                const rx = platform.x;
                const ry = platform.y;
                const rw = platform.w;
                const rh = platform.h;

                const px = this.sprite.x;
                const py = this.sprite.y;

                // Vertical bounds overlap: player must be vertically aligned with the slide block
                const isOverlappingY = (py + 74 >= ry) && (py - 74 <= ry + rh);

                if (isOverlappingY) {
                    // Left side of block (player is on the left, pushing right)
                    const distToLeft = Math.abs((px + 32) - rx);
                    if (distToLeft < 15 && px < rx) {
                        isTouchingLeftSide = true;
                    }

                    // Right side of block (player is on the right, pushing left)
                    const distToRight = Math.abs((px - 32) - (rx + rw));
                    if (distToRight < 15 && px > rx + rw) {
                        isTouchingRightSide = true;
                    }
                }
            }
        }

        // Check if player is holding directional keys away from the block
        let isMovingAway = false;
        if (isTouchingLeftSide && this.controls.left.isDown) {
            isMovingAway = true;
        }
        if (isTouchingRightSide && this.controls.right.isDown) {
            isMovingAway = true;
        }

        const isClimbingKeysDown = (this.controls.jump.isDown || (this.controls.highJump && this.controls.highJump.isDown) || (this.controls.down && this.controls.down.isDown));
        const isClimbing = (isTouchingLeftSide || isTouchingRightSide) && isClimbingKeysDown && !isMovingAway;

        if (isClimbing) {
            const climbSpeed = speed * 2.5;
            
            // Gently push horizontal velocity to keep player locked against the block
            // If forcing down, push away to drop off the wall. Otherwise lock against it.
            if (this.controls.jump.isDown || (this.controls.highJump && this.controls.highJump.isDown)) {
                if (isTouchingLeftSide) {
                    this.sprite.setVelocityX(1.5);
                } else {
                    this.sprite.setVelocityX(-1.5);
                }
                this.sprite.setVelocityY(-climbSpeed); // Move UP
                if (this.state !== 'attack') {
                    this.sprite.anims.play(`${this.character}_walk_anim`, true);
                }
            } else if (this.controls.down && this.controls.down.isDown) {
                // Push away horizontally to release from sticky wall
                if (isTouchingLeftSide) {
                    this.sprite.setVelocityX(-4);
                } else {
                    this.sprite.setVelocityX(4);
                }
                this.sprite.setVelocityY(12); // Move DOWN / Drop
                if (this.state !== 'attack') {
                    this.sprite.anims.play(`${this.character}_walk_anim`, true);
                }
            } else {
                if (isTouchingLeftSide) {
                    this.sprite.setVelocityX(1.5);
                } else {
                    this.sprite.setVelocityX(-1.5);
                }
                this.sprite.setVelocityY(0); // Cling still
                if (this.state !== 'attack') {
                    this.sprite.anims.play(`${this.character}_idle_anim`, true);
                }
            }
        }

        if (!isClimbing) {
            // 🏃 MOVE
            let moveSpeed = speed;
            if (this.isStandingOnSlideBlock) {
                moveSpeed = speed * 2.5; // Boosted slide speed
            }

            if (this.controls.left.isDown) {
                this.sprite.setVelocityX(-moveSpeed);
                this.sprite.setFlipX(true);
                if (this.state !== 'attack')
                    this.sprite.anims.play(`${this.character}_walk_anim`, true);
            }
            else if (this.controls.right.isDown) {
                this.sprite.setVelocityX(moveSpeed);
                this.sprite.setFlipX(false);
                if (this.state !== 'attack')
                    this.sprite.anims.play(`${this.character}_walk_anim`, true);
            }
            else {
                if (this.isStandingOnSlideBlock) {
                    // Decay velocity slowly while still on ice
                    this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.97);
                } else if (this.slideCoastFrames > 0) {
                    // Continue coasting with friction after leaving slide block
                    this.sprite.setVelocityX(this.sprite.body.velocity.x * 0.92);
                } else {
                    this.sprite.setVelocityX(0);
                }
                if (this.state !== 'attack')
                    this.sprite.anims.play(`${this.character}_idle_anim`, true);
            }

            // 🦘 JUMP
            if (this.isOnGround()) {
                this.hasHighJumpedInAir = false;
                this.hasDoubleJumped = false;
                if (Phaser.Input.Keyboard.JustDown(this.controls.highJump)) {
                    this.playSound('sfx_highjump', 0.3);
                    this.sprite.setVelocityY(highJumpForce);
                    this.hasHighJumpedInAir = true;
                    this.createHighJumpBurst(true); // Ground burst
                }
                else if (Phaser.Input.Keyboard.JustDown(this.controls.jump)) {
                    this.playSound('sfx_jump', 0.3);
                    this.sprite.setVelocityY(jumpForce);
                }
            } else {
                // Fast fall when pressing S in mid-air (disabled briefly after hitting a bounce block)
                const timeSinceBounce = this.scene.time.now - (this.lastBounceTime || 0);
                if (this.controls.down.isDown && timeSinceBounce > 400) {
                    this.sprite.setVelocityY(Math.max(this.sprite.body.velocity.y, 16));
                }

                // Allow high jump mid-air after normal jump
                if (Phaser.Input.Keyboard.JustDown(this.controls.highJump) && !this.hasHighJumpedInAir) {
                    this.playSound('sfx_highjump', 0.3);
                    this.sprite.setVelocityY(highJumpForce);
                    this.hasHighJumpedInAir = true;
                    this.createHighJumpBurst(false); // Mid-air burst
                }
                // Allow double jump for p2 (Shadow) in mid-air
                else if (this.character === 'p2' && Phaser.Input.Keyboard.JustDown(this.controls.jump) && !this.hasDoubleJumped) {
                    this.playSound('sfx_jump', 0.3);
                    this.sprite.setVelocityY(jumpForce);
                    this.hasDoubleJumped = true;
                }
            }
        }

        if (Phaser.Input.Keyboard.JustDown(this.controls.attack)) {
            this.attack();
        }

        if (Phaser.Input.Keyboard.JustDown(this.controls.dash)) {
            this.dash();
        }

        if (Phaser.Input.Keyboard.JustDown(this.controls.spell)) {
            this.castSpell();
        }

        if (Phaser.Input.Keyboard.JustDown(this.controls.taunt)) {
            this.taunt();
        }
    }

    // 🤖 ENEMY AI
    enemyAI() {
        const player = this.scene.players.find(p => p && p.state !== 'dead');
        if (!player || !player.sprite) return;

        const time = this.scene.time.now;

        // Enemy Teleport execution if touching a teleporter
        if (this.isEnemy && this.scene.teleports) {
            if (this.lastTeleportTime === undefined) this.lastTeleportTime = 0;
            if (time - this.lastTeleportTime > 2000) {
                const len = this.scene.teleports.length;
                for (let i = 0; i < len; i++) {
                    const tp = this.scene.teleports[i];
                    const tpDist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, tp.x, tp.y);
                    if (tpDist < 70) {
                        this.sprite.setPosition(tp.tx, tp.ty);
                        this.sprite.setVelocity(0, 0);
                        this.lastTeleportTime = time;
                        this.scene.safePlaySound('sfx_teleport', 0.25);
                        break;
                    }
                }
            }
        }

        const dist = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            player.sprite.x, player.sprite.y
        );

        // Group flanking / chase offset X position
        let targetX = player.sprite.x + (this.chaseOffset || 0);
        const verticalDist = Math.abs(player.sprite.y - this.sprite.y);

        // Heuristic: If enemy is right below the player (within 400px vertically), push them to the side so they don't get stuck under platform ceilings
        // We use hysteresis to prevent rapid left/right oscillation
        if (this.isAvoidingBelow === undefined) this.isAvoidingBelow = false;
        if (this.avoidBelowSide === undefined) this.avoidBelowSide = -1;

        const isRightBelow = (this.sprite.y > player.sprite.y) && (verticalDist <= 400);
        const horizontalDist = Math.abs(player.sprite.x - this.sprite.x);

        if (isRightBelow) {
            if (!this.isAvoidingBelow && horizontalDist < 80) {
                this.isAvoidingBelow = true;
                this.avoidBelowSide = this.sprite.x < player.sprite.x ? -1 : 1;
            } else if (this.isAvoidingBelow && horizontalDist > 180) {
                this.isAvoidingBelow = false;
            }
        } else {
            this.isAvoidingBelow = false;
        }

        if (this.isAvoidingBelow) {
            targetX = player.sprite.x + this.avoidBelowSide * 200;
        }

        // Heuristic: If player is on a different vertical level, target the nearest teleporter on our level
        if (verticalDist > 400 && this.scene.teleports) {
            let closestTp = null;
            let minTpDist = Infinity;
            
            const len = this.scene.teleports.length;
            for (let i = 0; i < len; i++) {
                const tp = this.scene.teleports[i];
                if (Math.abs(tp.y - this.sprite.y) < 300) {
                    const distToTp = Math.abs(tp.x - this.sprite.x);
                    if (distToTp < minTpDist) {
                        minTpDist = distToTp;
                        closestTp = tp;
                    }
                }
            }

            if (closestTp) {
                targetX = closestTp.x;
            }
        }

        const dir = targetX < this.sprite.x ? -1 : 1;

        // In solo wave mode, enemies (except static guards) always chase the player
        const alwaysChase = this.scene.mode === 'solo' && !this.isGuard;
        const DETECT_RANGE = alwaysChase ? 999999 : 400;
        const ATTACK_RANGE = 130;
        const LOSE_RANGE = alwaysChase ? 999999 : 650;

        if (!this.aiState) this.aiState = 'patrol';
        if (!this.attackCooldown) this.attackCooldown = false;
        if (this.lastJumpTime === undefined) this.lastJumpTime = 0;
        if (this.lastSpellTime === undefined) this.lastSpellTime = 0;

        // 🦘 PATHFINDING / JUMPING
        // Jump if player is on a platform above and we are horizontally close, OR if we are moving but stuck horizontally against a wall/obstacle
        if (this.aiState === 'chase' || this.aiState === 'retreat') {
            const isStuck = this.isOnGround() && Math.abs(this.sprite.body.velocity.x) < 0.5;
            const playerAbove = player.sprite.y < this.sprite.y - 80 && Math.abs(player.sprite.x - this.sprite.x) < 220;
            
            if ((isStuck || playerAbove) && this.isOnGround() && (time - this.lastJumpTime > 1500)) {
                this.sprite.setVelocityY(this.jumpForce || -16);
                this.lastJumpTime = time;
            }
        }

        // 🔮 SHADOW (p2) SPELLCASTING
        if (this.character === 'p2' && this.aiState === 'chase' && dist > 150 && dist < 400) {
            if (time - this.lastSpellTime > 3000 && Math.random() < 0.02) {
                // Orient towards player
                this.sprite.setFlipX(player.sprite.x < this.sprite.x);
                this.castSpell();
                this.lastSpellTime = time;
            }
        }

        switch (this.aiState) {
            case 'patrol':
                if (dist < DETECT_RANGE) {
                    this.aiState = 'chase';
                    return;
                }
                if (!this.patrolDir) {
                    this.patrolDir = Math.random() < 0.5 ? -1 : 1;
                }
                this.sprite.setVelocityX(this.patrolDir * this.speed * 0.5);
                this.sprite.setFlipX(this.patrolDir < 0);
                this.sprite.anims.play(`${this.character}_walk_anim`, true);
                break;

            case 'chase':
                if (dist > LOSE_RANGE) {
                    this.aiState = 'patrol';
                    break;
                }
                if (dist > ATTACK_RANGE) {
                    this.sprite.setVelocityX(dir * this.speed);
                    this.sprite.setFlipX(dir < 0);
                    this.sprite.anims.play(`${this.character}_walk_anim`, true);
                } else {
                    this.aiState = 'attack';
                }
                break;

            case 'attack':
                this.sprite.setVelocityX(0);
                if (!this.attackCooldown) {
                    this.attack();
                    this.attackCooldown = true;
                    // Berserker has a shorter attack cooldown
                    const cooldownDuration = this.character === 'p3' ? 600 : 900;
                    this.scene.time.delayedCall(cooldownDuration, () => {
                        this.attackCooldown = false;
                    });
                }
                if (dist > ATTACK_RANGE) {
                    this.aiState = 'chase';
                }
                break;

            case 'retreat':
                // Move away from the player
                this.sprite.setVelocityX(-dir * this.speed * 1.2);
                this.sprite.setFlipX(-dir < 0);
                this.sprite.anims.play(`${this.character}_walk_anim`, true);
                
                if (dist > LOSE_RANGE) {
                    this.aiState = 'patrol';
                    if (this.retreatTimer) this.retreatTimer.destroy();
                }
                break;
        }
    }

    // ⚔️ ATTACK
    attack() {
        if (this.state === 'attack' || this.state === 'dead') return;

        this.state = 'attack';

        this.sprite.anims.play(`${this.character}_attack_1`);

        this.playSound('sfx_attack1', 0.3);

        this.sprite.once('animationcomplete', () => {
            if (this.state !== 'dead') {
                this.state = 'idle';
            }
        });
    }

    // ⚡ DASH
    dash() {
        if (this.dashCharges <= 0) return;
        this.dashCharges--;
        this.state = 'dash';

        this.playSound('sfx_dash', 0.3);

        const dir = this.sprite.flipX ? -1 : 1;
        const dashSpeed = this.character === 'p2' ? 44 : 30;
        this.sprite.setVelocityX(dir * dashSpeed);

        if (this.dashTimer) {
            this.dashTimer.destroy();
        }

        this.dashTimer = this.scene.time.delayedCall(280, () => {
            if (this.state === 'dash') {
                this.state = 'idle';
            }
        });
    }

    // 🔮 SPELL
    castSpell() {
        if (this.scene.time.now < this.lastSpellTime + this.spellCooldown) {
            return;
        }
        this.lastSpellTime = this.scene.time.now;

        // Knight Shield Block spell
        if (this.character === 'p1') {
            this.playSound('sfx_highjump', 0.5);
            this.isShieldActive = true;
            this.shieldBlocksAbsorbed = 0;
            
            const spellId = this.scene.mode === 'multiplayer' && this.isControlled
                ? `${this.playerId}_shield_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`
                : `solo_shield_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

            if (this.isControlled && this.scene.mode === 'multiplayer' && this.scene.socket) {
                this.scene.socket.emit('castSpell', {
                    x: this.sprite.x,
                    y: this.sprite.y,
                    dir: this.sprite.flipX ? -1 : 1,
                    character: this.character,
                    spellId: spellId,
                    type: 'shield_block'
                });
            }

            if (this.shieldTimer) this.shieldTimer.destroy();
            this.shieldTimer = this.scene.time.delayedCall(2000, () => {
                this.isShieldActive = false;
                const blastId = `${spellId}_blast`;
                this.releaseShieldBlast(blastId);
            });
            return;
        }

        this.playSound('sfx_spell', 0.4);

        const dir = this.sprite.flipX ? -1 : 1;

        const spellColors = {
            'p1': 0x00ffff,
            'p2': 0xff8c00,
            'p3': 0x9b30ff
        };

        const spellColor = spellColors[this.character] || 0x00ffff;
        const damage = this.getSpellDamage();

        // Shadow (p2) or raging Berserker (p3) gets a larger projectile
        const isP2 = this.character === 'p2';
        const isRagingP3 = this.character === 'p3' && this.isRageActive;
        const radius = (isP2 || isRagingP3) ? 22 : 15;
        const velocityX = isP2 ? dir * 14.4 : dir * 8;

        const spell = this.scene.add.graphics({
            x: this.sprite.x + dir * 50,
            y: this.sprite.y
        });
        const steps = 8;
        const R_inner = radius * 0.3;
        for (let i = 0; i <= steps; i++) {
            const factor = i / steps;
            const currentRadius = radius - (radius - R_inner) * factor;

            const r1 = (spellColor >> 16) & 0xff;
            const g1 = (spellColor >> 8) & 0xff;
            const b1 = spellColor & 0xff;

            const r = Math.round(r1 + (255 - r1) * factor);
            const g = Math.round(g1 + (255 - g1) * factor);
            const b = Math.round(b1 + (255 - b1) * factor);

            const color = (r << 16) | (g << 8) | b;

            const alpha = 1.0 - 0.6 * factor;
            spell.fillStyle(color, alpha);
            spell.fillCircle(0, 0, currentRadius);
        }
        spell.setDepth(10);
        this.scene.matter.add.gameObject(spell);
        spell.setCircle(radius, {
            isSensor: true,
            ignoreGravity: true
        });
        spell.setVelocityX(velocityX);

        // 🔶 Spell projectile trail: spawn fading dots of signature color along trajectory
        const trailTimer = this.scene.time.addEvent({
            delay: PlayerData.graphicsQuality === 'low' ? 90 : 30,
            loop: true,
            callback: () => {
                if (!spell || !spell.active) {
                    if (trailTimer) trailTimer.destroy();
                    return;
                }
                const dotRadius = radius * 0.8;
                const dot = this.scene.add.circle(spell.x, spell.y, dotRadius, spellColor, 0.45);
                dot.setDepth(9);
                this.scene.tweens.add({
                    targets: dot,
                    alpha: 0,
                    scale: 0.15,
                    duration: 450,
                    ease: 'Quad.easeOut',
                    onComplete: () => { if (dot && dot.active) dot.destroy(); }
                });
            }
        });

        const spellId = this.scene.mode === 'multiplayer' && this.isControlled
            ? `${this.playerId}_spell_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`
            : `solo_spell_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

        if (!this.scene.spells) {
            this.scene.spells = [];
        }
        this.scene.spells.push({
            gameObject: spell,
            damage: damage,
            owner: this,
            trailTimer: trailTimer,
            radius: radius,
            spellId: spellId
        });

        // --- MULTIPLAYER PROJECTILE SYNCHRONIZATION ---
        if (this.isControlled && this.scene.mode === 'multiplayer' && this.scene.socket) {
            this.scene.socket.emit('castSpell', {
                x: this.sprite.x,
                y: this.sprite.y,
                dir: dir,
                character: this.character,
                spellId: spellId
            });
        }

        this.scene.time.delayedCall(1000, () => {
            if (spell.active) spell.destroy();
            if (trailTimer) trailTimer.destroy();
        });
    }

    castSpellRemote(x, y, dir, spellId) {
        this.playSound('sfx_spell', 0.4);

        const spellColors = {
            'p1': 0x00ffff,
            'p2': 0xff8c00,
            'p3': 0x9b30ff
        };

        const spellColor = spellColors[this.character] || 0x00ffff;
        const damage = this.getSpellDamage();

        const isP2 = this.character === 'p2';
        const isRagingP3 = this.character === 'p3' && this.isRageActive;
        const radius = (isP2 || isRagingP3) ? 22 : 15;
        const velocityX = isP2 ? dir * 14.4 : dir * 8;

        const spell = this.scene.add.graphics({
            x: x + dir * 50,
            y: y
        });
        const steps = 8;
        const R_inner = radius * 0.3;
        for (let i = 0; i <= steps; i++) {
            const factor = i / steps;
            const currentRadius = radius - (radius - R_inner) * factor;

            const r1 = (spellColor >> 16) & 0xff;
            const g1 = (spellColor >> 8) & 0xff;
            const b1 = spellColor & 0xff;

            const r = Math.round(r1 + (255 - r1) * factor);
            const g = Math.round(g1 + (255 - g1) * factor);
            const b = Math.round(b1 + (255 - b1) * factor);

            const color = (r << 16) | (g << 8) | b;

            const alpha = 1.0 - 0.6 * factor;
            spell.fillStyle(color, alpha);
            spell.fillCircle(0, 0, currentRadius);
        }
        spell.setDepth(10);
        this.scene.matter.add.gameObject(spell);
        spell.setCircle(radius, {
            isSensor: true,
            ignoreGravity: true
        });
        spell.setVelocityX(velocityX);

        // 🔶 Spell projectile trail
        const trailTimer = this.scene.time.addEvent({
            delay: 30,
            loop: true,
            callback: () => {
                if (!spell || !spell.active) {
                    if (trailTimer) trailTimer.destroy();
                    return;
                }
                const dotRadius = radius * 0.8;
                const dot = this.scene.add.circle(spell.x, spell.y, dotRadius, spellColor, 0.45);
                dot.setDepth(9);
                this.scene.tweens.add({
                    targets: dot,
                    alpha: 0,
                    scale: 0.15,
                    duration: 450,
                    ease: 'Quad.easeOut',
                    onComplete: () => { if (dot && dot.active) dot.destroy(); }
                });
            }
        });

        if (!this.scene.spells) {
            this.scene.spells = [];
        }
        this.scene.spells.push({
            gameObject: spell,
            damage: damage,
            owner: this,
            trailTimer: trailTimer,
            radius: radius,
            spellId: spellId
        });

        this.scene.time.delayedCall(1000, () => {
            if (spell.active) spell.destroy();
            if (trailTimer) trailTimer.destroy();
        });
    }

    releaseShieldBlast(blastId = null, remoteBlocksAbsorbed = null) {
        if (this.state === 'dead' || !this.sprite || !this.sprite.active) return;

        const activeBlastId = blastId || `${this.playerId || 'solo'}_shield_${Date.now()}_${Math.random().toString(36).substring(2, 5)}_blast`;

        // Double execution guard
        if (activeBlastId && this.lastReleasedBlastId === activeBlastId) {
            return;
        }
        this.lastReleasedBlastId = activeBlastId;

        const blocksAbsorbed = remoteBlocksAbsorbed !== null ? remoteBlocksAbsorbed : (this.shieldBlocksAbsorbed || 0);
        const baseDamage = 15;
        const bonusDamage = blocksAbsorbed * 7.5;
        const totalDamage = Math.round(baseDamage + bonusDamage);
        const blastRadius = 200;

        // Play blast sound
        this.playSound('sfx_spell', 0.6);

        // Visual shockwave effect: an expanding circle that fades out
        const wave = this.scene.add.circle(this.sprite.x, this.sprite.y, 10, 0x00ffff, 0.6);
        wave.setDepth(4);
        this.scene.tweens.add({
            targets: wave,
            radius: blastRadius,
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => {
                wave.destroy();
            }
        });

        // Spawn a ring of particle circles flying outward
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
            const px = this.sprite.x + Math.cos(a) * 30;
            const py = this.sprite.y + Math.sin(a) * 30;
            const spark = this.scene.add.circle(px, py, 6, 0x00ffff, 0.9);
            spark.setDepth(5);
            this.scene.tweens.add({
                targets: spark,
                x: this.sprite.x + Math.cos(a) * (blastRadius * 0.9),
                y: this.sprite.y + Math.sin(a) * (blastRadius * 0.9),
                scale: 0.1,
                alpha: 0,
                duration: 350,
                ease: 'Quad.easeOut',
                onComplete: () => { spark.destroy(); }
            });
        }

        // Spawn central blast particles
        this.createHitParticles(this.sprite.x, this.sprite.y, 0x00ffff);
        this.createHitParticles(this.sprite.x, this.sprite.y - 30, 0x00ffff);

        // --- MULTIPLAYER SHIELD BLAST SYNCHRONIZATION ---
        if (this.isControlled && this.scene.mode === 'multiplayer' && this.scene.socket) {
            this.scene.socket.emit('releaseShieldBlast', {
                blocksAbsorbed: blocksAbsorbed,
                blastId: activeBlastId
            });
        }

        // Find targets in radius
        if (this.scene.mode === 'multiplayer') {
            if (this.isControlled) {
                // Caster client: check collision against remote players
                for (const id in this.scene.otherPlayerMap) {
                    if (Object.prototype.hasOwnProperty.call(this.scene.otherPlayerMap, id)) {
                        const remote = this.scene.otherPlayerMap[id];
                        if (!remote || !remote.sprite || !remote.sprite.active || remote.state === 'dead' || remote.isInvincible) continue;

                        const dx = remote.sprite.x - this.sprite.x;
                        const dy = remote.sprite.y - this.sprite.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist <= blastRadius) {
                            if (this.scene.socket) {
                                this.scene.socket.emit('shieldBlastHit', {
                                    targetId: id,
                                    damage: totalDamage,
                                    blastId: activeBlastId
                                });
                            }

                            // Apply local knockback push to target sprite
                            const angle = Math.atan2(dy, dx);
                            const pushForce = 15 + blocksAbsorbed * 5;
                            remote.sprite.setVelocity(Math.cos(angle) * pushForce, Math.sin(angle) * pushForce - 3);
                        }
                    }
                }
            } else {
                // Remote client casting on our screen: check if it hits our local player
                if (this.scene.localPlayer && this.scene.localPlayer.sprite && this.scene.localPlayer.sprite.active && this.scene.localPlayer.state !== 'dead' && !this.scene.localPlayer.isInvincible) {
                    const localP = this.scene.localPlayer;
                    const dx = localP.sprite.x - this.sprite.x;
                    const dy = localP.sprite.y - this.sprite.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= blastRadius) {
                        if (this.scene.socket) {
                            this.scene.socket.emit('shieldBlastHit', {
                                targetId: this.scene.socket.id,
                                damage: totalDamage,
                                blastId: activeBlastId
                            });
                        }

                        // Apply local knockback push to our local player sprite
                        const angle = Math.atan2(dy, dx);
                        const pushForce = 15 + blocksAbsorbed * 5;
                        localP.sprite.setVelocity(Math.cos(angle) * pushForce, Math.sin(angle) * pushForce - 3);
                    }
                }
            }
        } else {
            // Solo or enemy casting: check against enemies (or players if caster is enemy)
            const targetList = this.isEnemy ? this.scene.players : this.scene.enemies;
            if (targetList) {
                const tarLen = targetList.length;
                for (let i = 0; i < tarLen; i++) {
                    const target = targetList[i];
                    if (!target || !target.sprite || !target.sprite.active || target.state === 'dead' || target.isInvincible || target === this) continue;

                    const dx = target.sprite.x - this.sprite.x;
                    const dy = target.sprite.y - this.sprite.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= blastRadius) {
                        target.takeDamage(totalDamage, this);

                        // Apply massive knockback push
                        const angle = Math.atan2(dy, dx);
                        const pushForce = 15 + blocksAbsorbed * 5;
                        target.sprite.setVelocity(Math.cos(angle) * pushForce, Math.sin(angle) * pushForce - 3);
                    }
                }
            }
        }

        // Show a temporary screen text if blocks were absorbed (Guard Counter!)
        if (blocksAbsorbed > 0 && !this.isEnemy && (this.scene.mode !== 'multiplayer' || this.scene.localPlayer === this)) {
            this.scene.showKillMessage(`GUARD COUNTER! +${Math.round(bonusDamage)} DMG`, '#00ffff');
        }
    }

    taunt() {
        if (this.state === 'attack' || this.state === 'dead' || this.state === 'dash') return;
        this.state = 'taunt';
        this.sprite.anims.play(`${this.character}_taunt_anim`);

        // 🩸 Berserker Forced Rage: press T to toggle forced Rage Mode (no cooldown)
        if (this.character === 'p3' && this.isControlled) {
            this.isRageForced = !this.isRageForced;
            if (this.isRageForced) {
                // Reduce health to the minimum rage threshold (30% of max health)
                const rageThresholdHp = Math.floor(this.health.max * 0.3);
                if (this.health.current > rageThresholdHp) {
                    this.health.current = rageThresholdHp;
                    if (this.health && typeof this.health.updateBar === 'function') {
                        this.health.updateBar();
                    }
                }
            }
            this.playSound('sfx_highjump', 0.6);
            if (this.scene && typeof this.scene.showKillMessage === 'function') {
                this.scene.showKillMessage(this.isRageForced ? 'RAGE FORCED ON!' : 'RAGE FORCED OFF', this.isRageForced ? '#ff0000' : '#888888');
            }
        }

        // 🛡️ Knight Fortress Buff: press T to gain 50% damage reduction for 5 seconds (15s cooldown)
        if (this.character === 'p1' && this.isControlled) {
            const now = this.scene.time.now;
            const BUFF_COOLDOWN = 15000;
            const BUFF_DURATION = 5000;

            if (now - this.lastTauntBuffTime >= BUFF_COOLDOWN) {
                this.lastTauntBuffTime = now;
                this.isTauntedDefenseBuffActive = true;

                // Visual + sound feedback
                this.createHitParticles(this.sprite.x, this.sprite.y, 0xffd700);
                this.createHitParticles(this.sprite.x, this.sprite.y - 50, 0xffaa00);
                this.playSound('sfx_highjump', 0.6);

                // Show FORTRESS ACTIVE banner
                if (this.scene && typeof this.scene.showKillMessage === 'function') {
                    this.scene.showKillMessage('FORTRESS ACTIVE!', '#ffd700');
                }

                // Expire after 5 seconds
                if (this.tauntBuffTimer) this.tauntBuffTimer.destroy();
                this.tauntBuffTimer = this.scene.time.delayedCall(BUFF_DURATION, () => {
                    this.isTauntedDefenseBuffActive = false;
                    if (this.scene && typeof this.scene.showKillMessage === 'function') {
                        this.scene.showKillMessage('FORTRESS ENDED', '#888888');
                    }
                });
            }
        }

        this.sprite.once('animationcomplete', () => {
            if (this.state === 'taunt') {
                this.state = 'idle';
            }
        });
    }

    applyChill(duration) {
        this.chillEndTime = this.scene.time.now + duration;
    }

    // 💥 DAMAGE
    takeDamage(amount, attacker = null, isMelee = false) {
        if (this.state === 'dead') return;

        // ✅ Block ALL damage during invincibility
        if (this.isInvincible) return;

        // Knight Shield Block damage reduction (100% reduction - no damage)
        if (this.isShieldActive) {
            if (amount > 0) {
                this.shieldBlocksAbsorbed = (this.shieldBlocksAbsorbed || 0) + 1;
            }
            amount = 0;
            this.createHitParticles(this.sprite.x, this.sprite.y, 0x00ffff);
            this.playSound('sfx_click', 0.5);
            if (this.shieldVisual) {
                this.shieldVisual.fillAlpha = 0.6;
                this.shieldVisual.setScale(1.15);
                this.scene.time.delayedCall(150, () => {
                    if (this.shieldVisual) {
                        this.shieldVisual.fillAlpha = 0.15;
                        this.shieldVisual.setScale(1.0);
                    }
                });
            }
        }

        // 🛡️ Knight Fortress Taunt Buff: 50% damage reduction
        if (this.isTauntedDefenseBuffActive && amount > 0) {
            amount = Math.ceil(amount * 0.5);
            this.createHitParticles(this.sprite.x, this.sprite.y, 0xffd700);
        }

        if (amount > 0) {
            this.lastDamageTime = this.scene.time.now;
            if (this.health) {
                this.health.healthBarVisibleEndTime = this.scene.time.now + 2000;
            }
        }

        this.health.current -= amount;
        const isFatal = this.health.current <= 0;
        if (isFatal) {
            this.health.current = 0;
        }

        // Show damage numbers locally (offline/solo mode)
        if (this.scene.mode !== 'multiplayer') {
            const isEnemyHit = this.isEnemy;
            this.scene.showDamageNumber(this.sprite.x, this.sprite.y - 40, amount, isEnemyHit);

            if (attacker && attacker.character === 'p1' && isMelee && amount > 0) {
                this.applyChill(3000);
                this.scene.showDamageNumber(this.sprite.x, this.sprite.y - 65, 0, false, true); // CHILLED!
            }
        }

        // Immediately update health bar so the visual feedback is instant
        if (this.health && typeof this.health.updateBar === 'function') {
            this.health.updateBar();
        }

        // 1. Knockback force (ignored if shield is active - Iron Will)
        if (attacker && attacker.sprite && !this.isShieldActive) {
            const pushDir = attacker.sprite.x < this.sprite.x ? 1 : -1;
            const forceX = this.isEnemy ? 8 : 12;
            this.sprite.setVelocity(pushDir * forceX, -4);
        }

        // 2. Camera flash & Screen Shake
        const isLocalPlayer = !this.isEnemy && (this.scene.mode !== 'multiplayer' || this.scene.localPlayer === this);
        if (isLocalPlayer) {
            const shakeIntensity = isFatal ? 0.015 : 0.0005;
            this.scene.cameras.main.shake(150, shakeIntensity);
            this.scene.cameras.main.flash(2, 255, 0, 0, false);
        } else if (this.isEnemy && attacker && !attacker.isEnemy) {
            // Player hit an enemy
            this.scene.cameras.main.shake(80, 0.005);
        }

        // 3. Pixel Particles Burst
        let sparkColor = 0x00ffff; // Default player cyan
        if (this.isEnemy) {
            if (this.character === 'p1') sparkColor = 0xcccccc; // Knight grey
            else if (this.character === 'p2') sparkColor = 0x8844ff; // Shadow purple
            else sparkColor = 0xff4444; // Berserker red
        }
        this.createHitParticles(this.sprite.x, this.sprite.y, sparkColor);

        // Fatal hit handling: play hurt hitstun first, then trigger die()
        if (isFatal) {
            // For p3 (Berserker), trigger Undying Rage instead of dying on the first fatal hit (solo mode player only, not enemies)
            if (this.character === 'p3' && !this.hasTriggeredUndyingRage && this.scene.mode === 'solo' && !this.isEnemy) {
                this.hasTriggeredUndyingRage = true;
                this.isRageActive = true;
                this.health.current = this.health.max;
                
                // Trigger visual effects immediately (can't rely on updateAbilitiesVisuals transition check)
                this.sprite.setScale(0.48);
                if (this.scene && this.scene.cameras && this.scene.cameras.main) {
                    this.scene.cameras.main.shake(250, 0.008);
                }
                this.sprite.clearTint();
                this.state = 'idle';
                
                this.playSound('sfx_highjump', 0.8);
                this.createHitParticles(this.sprite.x, this.sprite.y, 0xff0000);
                this.createHitParticles(this.sprite.x, this.sprite.y - 40, 0xff4400);
                
                if (this.health && typeof this.health.updateBar === 'function') {
                    this.health.updateBar();
                }
                return;
            }

            this.state = 'hurt';
            this.isInvincible = true;

            this.playSound('sfx_hurt', 0.4);

            this.sprite.setTint(0xff0000);
            this.sprite.anims.play(`${this.character}_hurt_anim`);

            this.scene.time.delayedCall(300, () => {
                this.die();
            });
            return;
        }

        // Low health retreat trigger for enemies
        if (this.isEnemy && this.health.current / this.health.max < 0.35) {
            const roll = Math.random();
            let retreatChance = 0;
            if (this.character === 'p1') retreatChance = 0.3; // Knight
            if (this.character === 'p2') retreatChance = 0.6; // Shadow

            if (roll < retreatChance && this.aiState !== 'retreat') {
                this.aiState = 'retreat';
                if (this.retreatTimer) this.retreatTimer.destroy();
                this.retreatTimer = this.scene.time.delayedCall(1500, () => {
                    if (this.aiState === 'retreat') {
                        this.aiState = 'chase';
                    }
                });
            }
        }

        this.state = 'hurt';

        this.playSound('sfx_hurt', 0.4);

        this.sprite.setTint(0xff0000);
        this.sprite.anims.play(`${this.character}_hurt_anim`);

        this.scene.time.delayedCall(300, () => {
            if (this.state !== 'dead') {
                if (this.originalTint !== undefined) {
                    this.sprite.setTint(this.originalTint);
                } else {
                    this.sprite.clearTint();
                }
                this.state = 'idle';
            }
        });
    }

    hitNearbyTargets(damage) {
        const dir = this.sprite.flipX ? -1 : 1;
        const attackX = this.sprite.x + (dir * 30);
        const attackY = this.sprite.y - 20;
        const attackW = 100;
        const attackH = 80;

        // ✅ Show red debug hitbox
        const debugBox = this.scene.add.rectangle(
            attackX,
            attackY,
            attackW,
            attackH,
            0xff0000,
            0.3
        );
        this.scene.time.delayedCall(200, () => {
            debugBox.destroy();
        });

        const targets = this.isEnemy
            ? this.scene.players
            : this.scene.enemies;

        targets.forEach(target => {
            if (!target || !target.sprite || !target.sprite.active) return;
            if (target === this) return;
            if (target.state === 'dead') return;
            if (target.isInvincible) return;

            const tx = target.sprite.x;
            const ty = target.sprite.y;
            const tw = 64;
            const th = 152;

            const overlap =
                (attackX - attackW / 2) < (tx + tw / 2) &&
                (attackX + attackW / 2) > (tx - tw / 2) &&
                (attackY - attackH / 2) < (ty + th / 2) &&
                (attackY + attackH / 2) > (ty - th / 2);

            if (overlap) {
                target.takeDamage(damage);
            }
        });
    }

    recoverFromUndyingRage() {
        if (!this.hasTriggeredUndyingRage) return;

        this.hasTriggeredUndyingRage = false;
        this.lastRageDrainTime = null;

        // Restore health to at least 50% of max
        this.health.current = Math.max(this.health.current, this.health.max * 0.5);
        if (this.health && typeof this.health.updateBar === 'function') {
            this.health.updateBar();
        }

        // Reset visual rage states
        this.isRageActive = false;
        this.isRageForced = false;
        this.speed = this.originalSpeed;
        if (this.sprite && this.sprite.active) {
            this.sprite.setScale(0.4);
            this.sprite.clearTint();
        }

        // Visual and sound feedback
        this.playSound('sfx_spell', 0.6);
        this.createHitParticles(this.sprite.x, this.sprite.y, 0x44ff44); // Green burst for recovery
        this.createHitParticles(this.sprite.x, this.sprite.y - 30, 0x00ff00);

        if (this.scene && typeof this.scene.showKillMessage === 'function') {
            this.scene.showKillMessage('UNDYING SURVIVAL!', '#00ff00');
        }
    }

    createHighJumpBurst(onGround) {
        if (!this.sprite || !this.sprite.active) return;

        const feetX = this.sprite.x;
        const feetOffset = 76 * (this.sprite.scaleY / 0.4);
        const feetY = this.sprite.y + feetOffset;

        // Expanding wind ring shockwave
        const ring = this.scene.add.circle(feetX, feetY, 10, 0xffffff, 0.5);
        ring.setDepth(1);
        this.scene.tweens.add({
            targets: ring,
            radius: 70,
            scaleY: onGround ? 0.25 : 0.8, // Squashed if on ground, circular if mid-air
            alpha: 0,
            duration: 350,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });

        // Spawn some wind/dust particles shooting downwards/outwards
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const size = Phaser.Math.Between(4, 9);
            const p = this.scene.add.circle(feetX, feetY, size, 0xeeeeee, 0.7)
                .setDepth(1);

            const angle = Math.PI * 0.5 + (Math.random() - 0.5) * 1.5; // Mostly downwards
            const speed = Phaser.Math.Between(25, 60);
            const targetX = feetX + Math.cos(angle) * speed;
            const targetY = feetY + Math.sin(angle) * speed * (onGround ? 0.4 : 0.8);

            this.scene.tweens.add({
                targets: p,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: 0.1,
                duration: Phaser.Math.Between(250, 450),
                ease: 'Quad.easeOut',
                onComplete: () => p.destroy()
            });
        }
    }

    createDashGhost() {
        if (!this.sprite || !this.sprite.active) return;

        const color = 0x00ffff; // Cyan shade

        const ghost = this.scene.add.sprite(this.sprite.x, this.sprite.y, this.sprite.texture.key);
        ghost.setFrame(this.sprite.frame.name);
        // Stretch horizontally for a motion blur effect (scaleX * 1.35)
        ghost.setScale(this.sprite.scaleX * 1.35, this.sprite.scaleY);
        ghost.setFlipX(this.sprite.flipX);
        ghost.setDepth(this.sprite.depth - 1);
        ghost.setTint(color);
        ghost.setAlpha(0.35); // Lower alpha for dense overlapping trail

        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            scaleX: this.sprite.scaleX * 0.9,
            scaleY: this.sprite.scaleY * 0.9,
            duration: 250, // Faster fade for motion blur
            ease: 'Expo.easeOut',
            onComplete: () => {
                ghost.destroy();
            }
        });
    }

    // ☠️ DEATH
    die() {
        if (this.state === 'dead') return;

        this.state = 'dead';
        this.isShieldActive = false;
        this.isRageActive = false;
        this.isRageForced = false;
        this.hasTriggeredUndyingRage = false;
        this.isTauntedDefenseBuffActive = false;
        if (this.shieldVisual) {
            this.shieldVisual.destroy();
            this.shieldVisual = null;
        }
        if (this.fortressVisual) {
            this.fortressVisual.destroy();
            this.fortressVisual = null;
        }
        if (this.freezeVisual) {
            this.freezeVisual.destroy();
            this.freezeVisual = null;
        }
        if (this.shieldTimer) this.shieldTimer.destroy();
        if (this.tauntBuffTimer) this.tauntBuffTimer.destroy();

        this.playSound('sfx_death', 0.5);

        this.sprite.setVelocity(0, 0);
        this.sprite.anims.play(`${this.character}_death_anim`);

        this.sprite.once('animationcomplete', () => {
            if (this.isEnemy) {
                const index = this.scene.enemies.indexOf(this);
                if (index !== -1) this.scene.enemies.splice(index, 1);
                this.sprite.destroy();
                if (this.health && this.health.bar) this.health.bar.destroy();
                if (this.nameLabel) this.nameLabel.destroy();
            }
            else {
                if (this.scene.mode === 'solo') {
                    // Stop camera follow to prevent errors on destroyed sprite
                    this.scene.cameras.main.stopFollow();

                    // ✅ Remove from players array FIRST
                    const index = this.scene.players.indexOf(this);
                    if (index !== -1) this.scene.players.splice(index, 1);

                    this.sprite.destroy();
                    if (this.health && this.health.bar) this.health.bar.destroy();
                    if (this.nameLabel) this.nameLabel.destroy();

                    // ✅ Only then respawn
                    this.scene.time.delayedCall(1500, () => {
                        this.scene.respawnPlayer();
                    });
                }
            }
        });
    }

    setAlias(aliasName) {
        this.alias = aliasName;
        if (this.nameLabel) {
            const shortId = this.playerId ? this.playerId.substring(0, 6) : '';
            const newText = shortId ? `${aliasName} (${shortId})` : aliasName;
            this.nameLabel.setText(newText.toUpperCase());
        }
    }

    isOnGround() {
        if (!this.sprite || !this.sprite.body) return false;

        const body = this.sprite.body;

        // If we are moving downwards fast, we are definitely falling, not on ground
        if (body.velocity.y > 2) {
            return false;
        }

        // If we are moving upwards fast (e.g. already jumping), we are not on ground
        if (body.velocity.y < -2) {
            return false;
        }

        // Otherwise, if we are colliding with anything, we must be on the ground/slope
        const pairs = this.scene.matter.world.engine.pairs.list;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            if (pair.isActive && (pair.bodyA === body || pair.bodyB === body)) {
                return true;
            }
        }

        return false;
    }

    createHitParticles(x, y, color = 0xffffff) {
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const size = Phaser.Math.Between(12, 24);
            const p = this.scene.add.rectangle(x, y, size, size, color)
                .setDepth(5);

            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(40, 100);
            const targetX = x + Math.cos(angle) * speed;
            const targetY = y + Math.sin(angle) * speed - Phaser.Math.Between(10, 30);

            this.scene.tweens.add({
                targets: p,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: 0.1,
                duration: Phaser.Math.Between(400, 600),
                ease: 'Power2',
                onComplete: () => {
                    if (p && p.active) p.destroy();
                }
            });
        }
    }

    updateAbilitiesVisuals() {
        if (!this.sprite || !this.sprite.active) {
            if (this.shieldVisual) {
                this.shieldVisual.destroy();
                this.shieldVisual = null;
            }
            return;
        }

        const time = this.scene.time.now;

        // 1. Dash Charge Regeneration
        if (this.dashCharges < this.maxDashCharges) {
            if (!this.lastDashChargeRegenTime) {
                this.lastDashChargeRegenTime = time;
            }
            if (time - this.lastDashChargeRegenTime >= this.dashCooldown) {
                this.dashCharges++;
                this.lastDashChargeRegenTime = (this.dashCharges < this.maxDashCharges) ? time : null;
            }
        } else {
            this.lastDashChargeRegenTime = null;
        }

        // 2. Knight Shield Visual & Collider
        if (this.isShieldActive && this.state !== 'dead') {
            const shieldRadius = 90;
            if (!this.shieldVisual) {
                this.shieldVisual = this.scene.add.circle(this.sprite.x, this.sprite.y, shieldRadius, 0x00ffff, 0.15);
                this.shieldVisual.setStrokeStyle(3, 0x00ffff, 0.7);
                this.shieldVisual.setDepth(3);
            } else {
                this.shieldVisual.x = this.sprite.x;
                this.shieldVisual.y = this.sprite.y;
            }

            // Act as a collider for enemies/opponents
            let opponents = [];
            if (this.isEnemy) {
                opponents = this.scene.players || [];
            } else {
                if (this.scene.mode === 'multiplayer') {
                    const allPlayers = [];
                    if (this.scene.localPlayer && this.scene.localPlayer !== this) {
                        allPlayers.push(this.scene.localPlayer);
                    }
                    if (this.scene.otherPlayerMap) {
                        for (const id in this.scene.otherPlayerMap) {
                            if (Object.prototype.hasOwnProperty.call(this.scene.otherPlayerMap, id)) {
                                const p = this.scene.otherPlayerMap[id];
                                if (p && p !== this) {
                                    allPlayers.push(p);
                                }
                            }
                        }
                    }
                    opponents = allPlayers;
                } else {
                    opponents = this.scene.enemies || [];
                }
            }

            const opLen = opponents.length;
            for (let i = 0; i < opLen; i++) {
                const opponent = opponents[i];
                if (!opponent || !opponent.sprite || !opponent.sprite.active) continue;
                if (opponent.state === 'dead') continue;

                const dx = opponent.sprite.x - this.sprite.x;
                const dy = opponent.sprite.y - this.sprite.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < shieldRadius) {
                    const angle = dist > 0 ? Math.atan2(dy, dx) : (this.sprite.flipX ? Math.PI : 0);
                    
                    // Push opponent to the boundary of the shield
                    const targetX = this.sprite.x + Math.cos(angle) * shieldRadius;
                    const targetY = this.sprite.y + Math.sin(angle) * shieldRadius;
                    
                    opponent.sprite.setPosition(targetX, targetY);

                    // Apply outward velocity
                    const pushForce = 3;
                    opponent.sprite.setVelocity(Math.cos(angle) * pushForce, Math.sin(angle) * pushForce - 1);
                }
            }

            // Act as a collider for user-built blocks (platforms)
            if (this.scene && this.scene.platforms) {
                const platforms = this.scene.platforms;
                const platLen = platforms.length;
                for (let i = 0; i < platLen; i++) {
                    const platform = platforms[i];
                    if (platform.source !== 'user') continue;

                    const rx = platform.x;
                    const ry = platform.y;
                    const rw = platform.w;
                    const rh = platform.h;

                    const px = this.sprite.x;
                    const py = this.sprite.y;

                    // Closest point on the platform to the player's center
                    const closestX = Math.max(rx, Math.min(px, rx + rw));
                    const closestY = Math.max(ry, Math.min(py, ry + rh));

                    const dx = px - closestX;
                    const dy = py - closestY;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < shieldRadius) {
                        let pushAngle = dist > 0 ? Math.atan2(dy, dx) : 0;
                        if (dist === 0) {
                            const rcx = rx + rw / 2;
                            const rcy = ry + rh / 2;
                            pushAngle = Math.atan2(py - rcy, px - rcx);
                        }

                        const resolveDist = shieldRadius - dist;
                        const targetX = px + Math.cos(pushAngle) * resolveDist;
                        const targetY = py + Math.sin(pushAngle) * resolveDist;

                        this.sprite.setPosition(targetX, targetY);

                        // Push player's velocity slightly away from the block to simulate a bounce/slide
                        const bounceForce = 1.5;
                        if (this.sprite.body) {
                            this.sprite.setVelocity(
                                this.sprite.body.velocity.x + Math.cos(pushAngle) * bounceForce,
                                this.sprite.body.velocity.y + Math.sin(pushAngle) * bounceForce
                            );
                        }
                    }
                }
            }
        } else {
            if (this.shieldVisual) {
                this.shieldVisual.destroy();
                this.shieldVisual = null;
            }
        }

        // 3. Berserker Rage Check & Visual
        if (this.character === 'p3') {
            // (uses outer `time` from line 879 — no re-declaration)
            
            // Rage hp decay over time when undying rage is active
            if (this.isRageActive && this.hasTriggeredUndyingRage && this.state !== 'dead') {
                if (!this.lastRageDrainTime) {
                    this.lastRageDrainTime = time;
                }
                const elapsed = time - this.lastRageDrainTime;
                if (elapsed >= 100) {
                    const drainAmount = (10 * elapsed) / 1000; // 10 HP per second
                    this.health.current = Math.max(0, this.health.current - drainAmount);
                    this.lastRageDrainTime = time;

                    if (this.health.current <= 0 && this.state !== 'dead') {
                        this.die();
                    }
                }
            } else {
                this.lastRageDrainTime = null;
            }

            const isLocalOrEnemy = this.isEnemy || (this.scene.mode !== 'multiplayer' || this.scene.localPlayer === this);
            const healthRatio = (this.health && this.health.max > 0) ? (this.health.current / this.health.max) : 1;
            const shouldBeRaging = isLocalOrEnemy
                ? ((healthRatio <= 0.3 || this.hasTriggeredUndyingRage || this.isRageForced) && this.health.current > 0 && this.state !== 'dead')
                : (this.isRageActive && this.health.current > 0 && this.state !== 'dead');
            
            if (shouldBeRaging) {
                // Trigger rage initiation visuals (only for the normal low-HP path;
                // the undying rage path triggers these directly in takeDamage)
                if (!this.isRageActive) {
                    this.isRageActive = true;
                    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
                        this.scene.cameras.main.shake(200, 0.005);
                    }
                }
                // Enforce enlarged scale every frame so other code can't reset it
                this.sprite.setScale(0.48);
                // Under normal rage, speed is 13. Under undying rage, speed is 15.
                this.speed = this.hasTriggeredUndyingRage ? 15 : 13;
                
                // Pulsing red tint using sin wave
                const sinVal = Math.sin(time / 120) * 0.5 + 0.5; // 0..1
                // Interpolate between 0xff6666 (mild) and 0xff0000 (full red)
                const red = 0xff;
                const gb = Math.round((1 - sinVal) * 0x66);
                const pulseColor = (red << 16) | (gb << 8) | gb;
                this.sprite.setTint(pulseColor);

                // Emitting rage particles (larger + denser than normal)
                const particleChance = this.hasTriggeredUndyingRage ? 0.45 : 0.3;
                if (Math.random() < particleChance) {
                    const offsetRange = 35;
                    const rx = this.sprite.x + Phaser.Math.Between(-offsetRange, offsetRange);
                    const ry = this.sprite.y + Phaser.Math.Between(-offsetRange, offsetRange);
                    const particleSize = this.hasTriggeredUndyingRage ? Phaser.Math.Between(8, 16) : Phaser.Math.Between(5, 10);
                    
                    const p = this.scene.add.rectangle(rx, ry, particleSize, particleSize, 0xff0000, 0.9);
                    p.setDepth(1);
                    this.scene.tweens.add({
                        targets: p,
                        y: p.y - 50,
                        alpha: 0,
                        scale: 0.1,
                        duration: this.hasTriggeredUndyingRage ? 450 : 600,
                        onComplete: () => {
                            if (p && p.active) p.destroy();
                        }
                    });
                }
            } else {
                if (this.isRageActive) {
                    this.isRageActive = false;
                    this.speed = this.originalSpeed;
                    // Reset scale and tint when rage ends
                    this.sprite.setScale(0.4);
                    this.sprite.clearTint();
                }
            }
        }

        // 4. Knight Fortress Taunt Buff Visual
        if (this.character === 'p1' && this.isTauntedDefenseBuffActive && this.state !== 'dead') {
            // Pulsing gold tint using sin wave
            const goldSin = Math.sin(time / 150) * 0.5 + 0.5; // 0..1
            const r = 0xff;
            const g = Math.round(0xaa + goldSin * (0xee - 0xaa));
            const b = Math.round(goldSin * 0x44);
            const goldColor = (r << 16) | (g << 8) | b;
            this.sprite.setTint(goldColor);

            // Silhouette-shaped golden pulsing aura
            if (!this.fortressVisual) {
                this.fortressVisual = this.scene.add.sprite(this.sprite.x, this.sprite.y, this.sprite.texture.key);
                this.fortressVisual.setDepth(this.sprite.depth - 1);
                this.fortressVisual.setTint(0xffd700);
            } else {
                // Sync animation state, texture, flip, and coordinates
                if (this.fortressVisual.texture.key !== this.sprite.texture.key) {
                    this.fortressVisual.setTexture(this.sprite.texture.key);
                }
                this.fortressVisual.setFrame(this.sprite.frame.name);
                this.fortressVisual.x = this.sprite.x;
                this.fortressVisual.y = this.sprite.y;
                this.fortressVisual.flipX = this.sprite.flipX;

                // Pulsing outer scale and alpha glow
                const pulse = Math.sin(time / 100) * 0.03;
                this.fortressVisual.setScale(this.sprite.scaleX * (1.08 + pulse), this.sprite.scaleY * (1.08 + pulse));
                this.fortressVisual.setAlpha(0.35 + Math.sin(time / 80) * 0.1);
            }

            // Occasional gold shield dust rising upward and drifting
            if (Math.random() < 0.25) {
                const startX = this.sprite.x + Phaser.Math.Between(-30, 30);
                const gp = this.scene.add.circle(startX, this.sprite.y + 20, Phaser.Math.Between(3, 6), 0xffd700, 0.85);
                gp.setDepth(4);
                this.scene.tweens.add({
                    targets: gp,
                    x: startX + Phaser.Math.Between(-20, 20),
                    y: gp.y - 65,
                    alpha: 0,
                    scale: 0.1,
                    duration: Phaser.Math.Between(600, 950),
                    ease: 'Sine.easeOut',
                    onComplete: () => { if (gp && gp.active) gp.destroy(); }
                });
            }
        } else {
            if (this.fortressVisual) {
                this.fortressVisual.destroy();
                this.fortressVisual = null;
            }
            if (this.character === 'p1' && !this.isTauntedDefenseBuffActive && !this.isShieldActive) {
                // Only clear tint if neither buff is active (avoid overriding hurt tint handled elsewhere)
                if (this.sprite.tintTopLeft !== 0xffffff && !this.isRageActive) {
                    // Let hurt/spawn-protection tints manage themselves; only clear gold tint on buff end
                }
            }
        }

        // 5. Chill Debuff Visual & Slowdown
        const isChilled = this.chillEndTime && time < this.chillEndTime;
        if (isChilled) {
            // Apply speed reduction dynamically relative to current speed (rage or normal)
            let currentBaseSpeed = this.originalSpeed;
            if (this.isRageActive) {
                currentBaseSpeed = this.hasTriggeredUndyingRage ? 15 : 13;
            }
            this.speed = currentBaseSpeed * this.chillSlowFactor;
            
            // Tint cold cyan (directly on the sprite)
            this.sprite.setTint(0x00ffff);
            
            // Set 0.75 opacity/alpha if not currently dashing (which alternates its own alpha)
            if (this.state !== 'dash') {
                this.sprite.setAlpha(0.75);
            }
            
            // Frost dust falling down
            if (Math.random() < 0.15) {
                const startX = this.sprite.x + Phaser.Math.Between(-30, 30);
                const fp = this.scene.add.circle(startX, this.sprite.y - 20, Phaser.Math.Between(3, 6), 0x00ffff, 0.85);
                fp.setDepth(4);
                this.scene.tweens.add({
                    targets: fp,
                    x: startX + Phaser.Math.Between(-10, 10),
                    y: fp.y + 50,
                    alpha: 0,
                    scale: 0.1,
                    duration: Phaser.Math.Between(500, 800),
                    ease: 'Sine.easeIn',
                    onComplete: () => { if (fp && fp.active) fp.destroy(); }
                });
            }
        } else {
            // Restore speed, alpha, and clear tint if the chill just ended
            if (this.chillEndTime && time >= this.chillEndTime) {
                this.chillEndTime = null;
                this.speed = this.isRageActive ? (this.hasTriggeredUndyingRage ? 15 : 13) : this.originalSpeed;
                this.sprite.clearTint();
                if (this.state !== 'dash' && !this.isInvincible) {
                    this.sprite.setAlpha(1.0);
                }
            }
        }

        // Apply anim speed adjustments based on state
        if (this.isRageActive) {
            this.sprite.anims.timeScale = 1.6;
        } else {
            this.sprite.anims.timeScale = 1.0;
        }

        // Set/Restore collision filter based on dashing state
        if (this.sprite && this.sprite.body) {
            if (this.state === 'dash') {
                this.sprite.body.collisionFilter.mask = 0x0001; // only collide with map/ground
                
                // Ghostly blinking effect: alternate alpha between 0.2 and 0.6
                const flash = Math.floor(time / 50) % 2 === 0;
                this.sprite.setAlpha(flash ? 0.2 : 0.6);

                // Spawn silhouette ghost tail every 20ms (dense trail for motion blur)
                if (!this.lastDashGhostTime) this.lastDashGhostTime = 0;
                if (time - this.lastDashGhostTime >= 20) {
                    this.lastDashGhostTime = time;
                    this.createDashGhost();
                }
            } else {
                this.sprite.body.collisionFilter.mask = 0x0001 | 0x0002; // collide with map/ground and other players/enemies
                
                // Restore alpha if we were dashing/invincible/chilled
                const targetAlpha = isChilled ? 0.75 : 1.0;
                if (this.sprite.alpha !== targetAlpha && !this.isInvincible) {
                    this.sprite.setAlpha(targetAlpha);
                }
            }
        }

        // High jump rising visual trail
        if (this.sprite && this.sprite.body && this.sprite.body.velocity.y < -2 && this.hasHighJumpedInAir) {
            if (!this.lastHighJumpTrailTime) this.lastHighJumpTrailTime = 0;
            if (time - this.lastHighJumpTrailTime >= 35) {
                this.lastHighJumpTrailTime = time;
                
                // Spawn a fading rising wind line/spark
                const wx = this.sprite.x + Phaser.Math.Between(-15, 15);
                const wy = this.sprite.y + Phaser.Math.Between(0, 50);
                const wLine = this.scene.add.rectangle(wx, wy, 2, Phaser.Math.Between(15, 30), 0xffffff, 0.4)
                    .setDepth(1);
                this.scene.tweens.add({
                    targets: wLine,
                    alpha: 0,
                    scaleY: 0.1,
                    duration: 300,
                    ease: 'Sine.easeOut',
                    onComplete: () => wLine.destroy()
                });
            }
        }
    }
}