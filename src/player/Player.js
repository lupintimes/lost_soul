import Controls from './Controls.js';
import CombatSystem from '../systems/CombatSystem.js';
import HealthSystem from '../systems/HealthSystem.js';

export default class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        this.comboStep = 0;
        this.comboTimer = null;

        this.sprite = scene.physics.add.sprite(x, y, 'idle');
        this.sprite.setCollideWorldBounds(true);

        this.sprite.setScale(0.4);

        this.sprite.body.setSize(160, 380);
        this.sprite.body.setOffset(180, 30);

        this.controls = new Controls(scene);
        this.combat = new CombatSystem(scene, this);
        this.health = new HealthSystem(scene, this);

        this.state = 'idle';
        this.canControl = true;
        this.isInvincible = false;

        // attack trigger (combo)
        this.sprite.on('animationupdate', (anim, frame) => {
            if (
                (anim.key === 'attack_1' ||
                    anim.key === 'attack_2' ||
                    anim.key === 'attack_3') &&
                frame.index === 2
            ) {
                this.combat.attack();
            }
        });
    }

    update() {
        // =====================
        // 🤖 ENEMY MODE
        // =====================
        if (this.isEnemy) {
            this.enemyAI();
            this.health.updateBar();
            return;
        }

        // 🔥 DASH LOCK (IMPORTANT FIX)
        if (this.state === 'dash') {
            this.health.updateBar();
            return;
        }

        const speed = this.speed || 250;
        const jumpForce = this.jumpForce || -650;
        const highJumpForce = this.highJumpForce || -1000;

        this.health.updateBar();

        // =====================
        // 🏃 MOVEMENT
        // =====================
        if (this.controls.left.isDown) {
            this.sprite.setVelocityX(-speed);
            this.sprite.setFlipX(true);
            if (this.state !== 'attack')
                this.sprite.anims.play('walk_anim', true);
        }
        else if (this.controls.right.isDown) {
            this.sprite.setVelocityX(speed);
            this.sprite.setFlipX(false);
            if (this.state !== 'attack')
                this.sprite.anims.play('walk_anim', true);
        }
        else {
            this.sprite.setVelocityX(0);
            if (this.state !== 'attack')
                this.sprite.anims.play('idle_anim', true);
        }

        // =====================
        // 🦘 JUMP
        // =====================
        if (this.sprite.body.blocked.down) {
            if (Phaser.Input.Keyboard.JustDown(this.controls.highJump)) {
                this.sprite.setVelocityY(highJumpForce);
            }
            else if (Phaser.Input.Keyboard.JustDown(this.controls.jump)) {
                this.sprite.setVelocityY(jumpForce);
            }
        }

        // =====================
        // ⚔️ ATTACK
        // =====================
        if (
            Phaser.Input.Keyboard.JustDown(this.controls.attack) &&
            this.state !== 'attack'
        ) {
            this.attack();
        }

        // =====================
        // ⚡ DASH (FIXED)
        // =====================
        if (
            Phaser.Input.Keyboard.JustDown(this.controls.dash)
        ) {
            this.dash();
        }

        // =====================
        // 🔮 SPELL
        // =====================
        if (
            Phaser.Input.Keyboard.JustDown(this.controls.spell)
        ) {
            this.castSpell();
        }

        // =====================
        // 😤 TAUNT
        // =====================
        if (
            Phaser.Input.Keyboard.JustDown(this.controls.taunt)
        ) {
            this.taunt();
        }
    }

    // =====================
    // 🤖 ENEMY AI (FIXED)
    // =====================
    enemyAI() {
        const player = this.scene.players[0];
        if (!player) return;

        const dist = Phaser.Math.Distance.Between(
            this.sprite.x,
            this.sprite.y,
            player.sprite.x,
            player.sprite.y
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
                this.sprite.anims.play('walk_anim', true);

                if (Math.random() < 0.005) {
                    this.patrolDir *= -1;
                }
                break;

            case 'chase':
                if (dist > LOSE_RANGE) {
                    this.aiState = 'patrol';
                    break;
                }

                if (dist > ATTACK_RANGE) {
                    this.sprite.setVelocityX(dir * this.speed);
                    this.sprite.setFlipX(dir < 0);
                    this.sprite.anims.play('walk_anim', true);
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

                if (dist < 90) {
                    this.sprite.setVelocityX(-dir * this.speed);
                }

                if (dist > ATTACK_RANGE) {
                    this.aiState = 'chase';
                }
                break;
        }

        if (this.sprite.body.blocked.down && Math.random() < 0.002) {
            this.sprite.setVelocityY(this.jumpForce);
        }
    }

    // ⚔️ COMBO ATTACK
    attack() {
        if (this.state === 'attack') return;

        this.state = 'attack';

        this.comboStep++;
        if (this.comboStep > 3) this.comboStep = 1;

        this.sprite.anims.play(`attack_${this.comboStep}`);

        if (this.comboTimer) this.comboTimer.remove();

        this.comboTimer = this.scene.time.delayedCall(600, () => {
            this.comboStep = 0;
        });

        this.sprite.once('animationcomplete', () => {
            this.state = 'idle';
        });
    }

    // ⚡ DASH (FIXED)
    dash() {
        if (this.state === 'dash') return;

        this.state = 'dash';

        const dir = this.sprite.flipX ? -1 : 1;

        this.sprite.setVelocityX(dir * 900);
        this.sprite.setTint(0x00ffff);

        this.scene.time.delayedCall(200, () => {
            this.sprite.clearTint();
            this.state = 'idle';
        });
    }

    // 🔮 SPELL
    castSpell() {
        const dir = this.sprite.flipX ? -1 : 1;

        const spell = this.scene.add.circle(
            this.sprite.x + dir * 50,
            this.sprite.y,
            15,
            0x00ffff
        );

        this.scene.physics.add.existing(spell);
        spell.body.allowGravity = false;
        spell.body.setVelocityX(dir * 400);

        // 🔥 ADD DAMAGE DETECTION
        const targets = this.isEnemy
            ? this.scene.players
            : this.scene.enemies;

        targets.forEach(target => {
            if (target === this) return;

            this.scene.physics.add.overlap(spell, target.sprite, () => {
                target.takeDamage(15);
                spell.destroy(); // destroy on hit
            });
        });

        // auto destroy
        this.scene.time.delayedCall(1000, () => {
            if (spell.active) spell.destroy();
        });
    }

    // 😤 TAUNT
    taunt() {
        this.sprite.anims.play('taunt_anim');
    }

    // 💥 DAMAGE
    takeDamage(amount) {
        if (this.isInvincible || this.state === 'dead') return;

        this.health.takeDamage(amount);

        this.state = 'hurt';
        this.isInvincible = true;

        this.sprite.setTint(0xff0000);
        this.sprite.anims.play('hurt_anim');

        const dir = this.sprite.flipX ? 1 : -1;
        this.sprite.setVelocityX(dir * 300);

        this.scene.time.delayedCall(300, () => {
            this.sprite.clearTint();
            this.state = 'idle';
        });

        this.scene.time.delayedCall(1000, () => {
            this.isInvincible = false;
        });

        if (this.health.current <= 0) {
            this.die();
        }
    }

    die() {
        if (this.state === 'dead') return;

        this.state = 'dead';

        this.sprite.setVelocity(0);
        this.sprite.anims.play('death_anim');

        this.sprite.once('animationcomplete', () => {

            // 🧍 PLAYER
            if (!this.isEnemy) {

                this.sprite.destroy();
                this.health.bar.destroy();

                this.scene.time.delayedCall(1500, () => {
                    this.scene.respawnPlayer(this);
                });
            }

            // 🤖 ENEMY
            else {
                const index = this.scene.enemies.indexOf(this);
                if (index !== -1) {
                    this.scene.enemies.splice(index, 1);
                }

                this.sprite.destroy();
                this.health.bar.destroy();
            }
        });
    }
}