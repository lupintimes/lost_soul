import Controls from './Controls.js';
import CombatSystem from '../systems/CombatSystem.js';
import HealthSystem from '../systems/HealthSystem.js';


export default class Player {

    // Add this method to Player clas
    // s
    playSound(key, volume = 0.5) {
        try {
            if (this.scene.cache.audio.exists(key)) {
                this.scene.sound.play(key, { volume });
            }
        } catch (e) {
            // Silently ignore missing audio
        }
    }

    getDamage() {
        const charDamage = this.damageTable[this.character] || this.damageTable['p1'];
        const currentAnim = this.sprite.anims.currentAnim;

        if (currentAnim) {
            if (currentAnim.key === `${this.character}_attack_1`) return charDamage.attack_1;
            if (currentAnim.key === `${this.character}_attack_2`) return charDamage.attack_2;
            if (currentAnim.key === `${this.character}_attack_3`) return charDamage.attack_3;
        }

        return charDamage.attack_1;
    }

    getSpellDamage() {
        const charDamage = this.damageTable[this.character] || this.damageTable['p1'];
        return charDamage.spell;
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

        if (this.isControlled) {
            this.controls = new Controls(scene);
        } else {
            this.controls = null;
        }

        this.combat = new CombatSystem(scene, this);
        this.health = new HealthSystem(scene, this);

        this.state = 'idle';
        this.isInvincible = false;

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
        if (this.state === 'dead') return;

        if (this.sprite.y > 3900) {
            this.die();
            return;
        }

        if (this.isEnemy) {
            this.enemyAI();
            if (this.health && typeof this.health.updateBar === 'function') {
                this.health.updateBar();
            }
            return;
        }

        if (!this.isControlled) {
            if (this.health && typeof this.health.updateBar === 'function') {
                this.health.updateBar();
            }
            return;
        }

        if (this.state === 'dash') {
            if (this.health && typeof this.health.updateBar === 'function') {
                this.health.updateBar();
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
                if (this.health && typeof this.health.updateBar === 'function') {
                    this.health.updateBar();
                }
                return;
            }
        }

        const speed = this.speed || 10;
        const jumpForce = this.jumpForce || -20;
        const highJumpForce = this.highJumpForce || -36;

        if (this.health && typeof this.health.updateBar === 'function') {
            this.health.updateBar();
        }

        if (!this.controls) return;

        // 🏃 MOVE
        if (this.controls.left.isDown) {
            this.sprite.setVelocityX(-speed);
            this.sprite.setFlipX(true);
            if (this.state !== 'attack')
                this.sprite.anims.play(`${this.character}_walk_anim`, true);
        }
        else if (this.controls.right.isDown) {
            this.sprite.setVelocityX(speed);
            this.sprite.setFlipX(false);
            if (this.state !== 'attack')
                this.sprite.anims.play(`${this.character}_walk_anim`, true);
        }
        else {
            this.sprite.setVelocityX(0);
            if (this.state !== 'attack')
                this.sprite.anims.play(`${this.character}_idle_anim`, true);
        }

        // 🦘 JUMP
        if (this.isOnGround()) {
            if (Phaser.Input.Keyboard.JustDown(this.controls.highJump)) {
                this.playSound('sfx_highjump', 0.3);
                this.sprite.setVelocityY(highJumpForce);
            }
            else if (Phaser.Input.Keyboard.JustDown(this.controls.jump)) {
                this.sprite.setVelocityY(jumpForce);
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

        const dist = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            player.sprite.x, player.sprite.y
        );

        // Group flanking / chase offset X position
        const targetX = player.sprite.x + (this.chaseOffset || 0);
        const dir = targetX < this.sprite.x ? -1 : 1;

        const DETECT_RANGE = 400;
        const ATTACK_RANGE = 130;
        const LOSE_RANGE = 650;

        if (!this.aiState) this.aiState = 'patrol';
        if (!this.attackCooldown) this.attackCooldown = false;
        if (this.lastJumpTime === undefined) this.lastJumpTime = 0;
        if (this.lastSpellTime === undefined) this.lastSpellTime = 0;

        const time = this.scene.time.now;

        // 🦘 PATHFINDING / JUMPING
        // Jump if player is on a platform above and we are horizontally close, OR if we are moving but stuck horizontally against a wall/obstacle
        if (this.aiState === 'chase' || this.aiState === 'retreat') {
            const isStuck = this.isOnGround() && Math.abs(this.sprite.body.velocity.x) < 0.5;
            const playerAbove = player.sprite.y < this.sprite.y - 80 && Math.abs(player.sprite.x - this.sprite.x) < 150;
            
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
        if (this.state === 'dash') return;
        this.state = 'dash';

        this.playSound('sfx_dash', 0.3);

        const dir = this.sprite.flipX ? -1 : 1;
        this.sprite.setVelocityX(dir * 20.6);
        this.scene.time.delayedCall(200, () => {
            this.state = 'idle';
        });
    }

    // 🔮 SPELL
    castSpell() {
        this.playSound('sfx_spell', 0.4);

        const dir = this.sprite.flipX ? -1 : 1;

        const spellColors = {
            'p1': 0x00ffff,
            'p2': 0xff8c00,
            'p3': 0x9b30ff
        };

        const spellColor = spellColors[this.character] || 0x00ffff;

        // ✅ Use character-specific spell damage
        const damage = this.getSpellDamage();

        const spell = this.scene.add.circle(
            this.sprite.x + dir * 50,
            this.sprite.y,
            15
        );
        this.scene.matter.add.gameObject(spell);
        spell.setCircle(15, {
            isSensor: true,
            ignoreGravity: true
        });
        spell.setFillStyle(spellColor);
        spell.setVelocityX(dir * 8);

        spell.setOnCollide(pair => {
            const otherBody = pair.bodyA === spell.body ? pair.bodyB : pair.bodyA;
            const otherGO = otherBody.gameObject;
            if (!otherGO) return;

            if (this.isControlled && this.scene.mode === 'multiplayer') {
                Object.keys(this.scene.otherPlayerMap).forEach(id => {
                    const remote = this.scene.otherPlayerMap[id];
                    if (remote && remote.sprite === otherGO) {
                        this.scene.sendAttackToServer(id, damage);
                        spell.destroy();
                    }
                });
            } else {
                const targets = this.isEnemy
                    ? this.scene.players
                    : this.scene.enemies;

                targets.forEach(target => {
                    if (target === this) return;
                    if (target.sprite === otherGO) {
                        target.takeDamage(damage, this);
                        spell.destroy();
                    }
                });
            }
        });

        this.scene.time.delayedCall(1000, () => {
            if (spell.active) spell.destroy();
        });
    }

    taunt() {
        if (this.state === 'attack' || this.state === 'dead' || this.state === 'dash') return;
        this.state = 'taunt';
        this.sprite.anims.play(`${this.character}_taunt_anim`);
        this.sprite.once('animationcomplete', () => {
            if (this.state === 'taunt') {
                this.state = 'idle';
            }
        });
    }

    // 💥 DAMAGE
    takeDamage(amount, attacker = null) {
        if (this.state === 'dead') return;

        // ✅ Block ALL damage during invincibility
        if (this.isInvincible) return;

        this.health.current -= amount;

        // 1. Knockback force
        if (attacker && attacker.sprite) {
            const pushDir = attacker.sprite.x < this.sprite.x ? 1 : -1;
            const forceX = this.isEnemy ? 8 : 12;
            this.sprite.setVelocity(pushDir * forceX, -4);
        }

        // 2. Camera flash & Screen Shake
        const isLocalPlayer = !this.isEnemy && (this.scene.mode !== 'multiplayer' || this.scene.localPlayer === this);
        if (isLocalPlayer) {
            const isFatal = this.health.current <= 0;
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

        if (this.health.current <= 0) {
            this.health.current = 0;
            this.die();
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
        this.isInvincible = true;

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

        this.scene.time.delayedCall(1000, () => {
            this.isInvincible = false;
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

    // ☠️ DEATH
    die() {
        if (this.state === 'dead') return;

        this.state = 'dead';

        this.playSound('sfx_death', 0.5);

        this.sprite.setVelocity(0, 0);
        this.sprite.anims.play(`${this.character}_death_anim`);

        this.sprite.once('animationcomplete', () => {
            if (this.isEnemy) {
                const index = this.scene.enemies.indexOf(this);
                if (index !== -1) this.scene.enemies.splice(index, 1);
                this.sprite.destroy();
                if (this.health && this.health.bar) this.health.bar.destroy();

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

                    // ✅ Only then respawn
                    this.scene.time.delayedCall(1500, () => {
                        this.scene.respawnPlayer();
                    });
                }
            }
        });
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
        const particleCount = 24;
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
}