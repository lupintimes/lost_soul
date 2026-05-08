import Controls from './Controls.js';
import CombatSystem from '../systems/CombatSystem.js';
import HealthSystem from '../systems/HealthSystem.js';

export default class Player {
    constructor(scene, x, y, playerId, isControlled, character) {
        this.scene = scene;

        this.playerId = playerId || null;
        this.isControlled = isControlled !== undefined ? isControlled : true;
        this.character = character || 'p1';

        this.comboStep = 0;
        this.comboTimer = null;
        this.currentAttackStep = 0;

        this.sprite = scene.physics.add.sprite(x, y, `${this.character}_idle`);
        this.sprite.setCollideWorldBounds(true);

        this.sprite.setScale(0.4);
        this.sprite.body.setSize(160, 380);
        this.sprite.body.setOffset(180, 30);

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

        // ⚔️ attack trigger
        this.sprite.on('animationupdate', (anim, frame) => {
            if (
                (anim.key === `${this.character}_attack_1` ||
                    anim.key === `${this.character}_attack_2` ||
                    anim.key === `${this.character}_attack_3`) &&
                frame.index === 2
            ) {
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

        const currentAnim = this.sprite.anims.currentAnim;
        let damage = 15;

        if (currentAnim) {
            if (currentAnim.key === `${this.character}_attack_1`) damage = 15;
            if (currentAnim.key === `${this.character}_attack_2`) damage = 20;
            if (currentAnim.key === `${this.character}_attack_3`) damage = 30;
        }

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

        if (!this.isControlled) {
            if (this.health && typeof this.health.updateBar === 'function') {
                this.health.updateBar();
            }
            return;
        }

        if (this.isEnemy) {
            this.enemyAI();
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

        const speed = this.speed || 250;
        const jumpForce = this.jumpForce || -650;
        const highJumpForce = this.highJumpForce || -850;

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
        if (this.sprite.body.blocked.down) {
            if (Phaser.Input.Keyboard.JustDown(this.controls.highJump)) {
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

        const dir = player.sprite.x < this.sprite.x ? -1 : 1;

        const DETECT_RANGE = 400;
        const ATTACK_RANGE = 130;
        const LOSE_RANGE = 650;

        if (!this.aiState) this.aiState = 'patrol';
        if (!this.attackCooldown) this.attackCooldown = false;

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
                    this.scene.time.delayedCall(900, () => {
                        this.attackCooldown = false;
                    });
                }
                if (dist > ATTACK_RANGE) {
                    this.aiState = 'chase';
                }
                break;
        }
    }

    // ⚔️ ATTACK
    attack() {
        if (this.state === 'attack' || this.state === 'dead') return;

        this.state = 'attack';

        this.comboStep++;
        if (this.comboStep > 3) this.comboStep = 1;
        this.currentAttackStep = this.comboStep;

        this.sprite.anims.play(`${this.character}_attack_${this.comboStep}`);

        this.sprite.once('animationcomplete', () => {
            if (this.state !== 'dead') {
                this.state = 'idle';
            }
            this.scene.time.delayedCall(500, () => {
                this.comboStep = 0;
                this.currentAttackStep = 0;
            });
        });
    }

    // ⚡ DASH
    dash() {
        if (this.state === 'dash') return;
        this.state = 'dash';
        const dir = this.sprite.flipX ? -1 : 1;
        this.sprite.setVelocityX(dir * 900);
        this.scene.time.delayedCall(200, () => {
            this.state = 'idle';
        });
    }

    // 🔮 SPELL
    castSpell() {
        const dir = this.sprite.flipX ? -1 : 1;

        const spellColors = {
            'p1': 0x00ffff,   // Cyan
            'p2': 0xff8c00,   // Orange
            'p3': 0x9b30ff    // Violet
        };

        const spellColor = spellColors[this.character] || 0x00ffff;

        const spell = this.scene.add.circle(
            this.sprite.x + dir * 50,
            this.sprite.y,
            15,
            spellColor
        );

        this.scene.physics.add.existing(spell);
        spell.body.allowGravity = false;
        spell.body.setVelocityX(dir * 400);

        if (this.isControlled && this.scene.mode === 'multiplayer') {
            Object.keys(this.scene.otherPlayerMap).forEach(id => {
                const remote = this.scene.otherPlayerMap[id];
                if (!remote || !remote.sprite) return;

                this.scene.physics.add.overlap(spell, remote.sprite, () => {
                    this.scene.sendAttackToServer(id, 15);
                    spell.destroy();
                });
            });
        } else {
            const targets = this.isEnemy
                ? this.scene.players
                : this.scene.enemies;

            targets.forEach(target => {
                if (target === this) return;
                this.scene.physics.add.overlap(spell, target.sprite, () => {
                    target.takeDamage(15);
                    spell.destroy();
                });
            });
        }

        this.scene.time.delayedCall(1000, () => {
            if (spell.active) spell.destroy();
        });
    }

    taunt() {
        this.sprite.anims.play(`${this.character}_taunt_anim`);
    }

    // 💥 DAMAGE
    takeDamage(amount) {
        if (this.state === 'dead') return;

        this.health.current -= amount;

        if (this.health.current <= 0) {
            this.health.current = 0;
            this.die();
            return;
        }

        if (this.isInvincible) return;

        this.state = 'hurt';
        this.isInvincible = true;

        this.sprite.setTint(0xff0000);
        this.sprite.anims.play(`${this.character}_hurt_anim`);

        this.scene.time.delayedCall(300, () => {
            if (this.state !== 'dead') {
                this.sprite.clearTint();
                this.state = 'idle';
            }
        });

        this.scene.time.delayedCall(1000, () => {
            this.isInvincible = false;
        });
    }

    // ☠️ DEATH
    die() {
        if (this.state === 'dead') return;

        this.state = 'dead';

        this.sprite.setVelocity(0);
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
}