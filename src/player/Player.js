import Controls from './Controls.js';
import CombatSystem from '../systems/CombatSystem.js';
import HealthSystem from '../systems/HealthSystem.js';

export default class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        this.sprite = scene.physics.add.sprite(x, y, 'idle');
        this.sprite.setCollideWorldBounds(true);

        this.sprite.setScale(0.4);

        this.sprite.body.setSize(120, 200);
        this.sprite.body.setOffset(200, 180);

        this.controls = new Controls(scene);
        this.combat = new CombatSystem(scene, this);
        this.health = new HealthSystem();

        // 🧠 STATE SYSTEM
        this.state = 'idle';
        this.canControl = true;
        this.isInvincible = false;

        // ⚔️ attack timing
        this.sprite.on('animationupdate', (anim, frame) => {
            if (anim.key === 'attack_anim' && frame.index === 6) {
                this.combat.attack();
            }
        });
    }

    update() {
    const speed = 250;
    const jumpForce = -650;
    const highJumpForce = -1000;

    // =====================
    // 🏃 MOVEMENT (ALWAYS ALLOWED)
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
    // 🦘 JUMP (ALWAYS ALLOWED)
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
    // ⚔️ ATTACK (CONTROLLED)
    // =====================
    if (
        Phaser.Input.Keyboard.JustDown(this.controls.attack) &&
        this.state !== 'attack'
    ) {
        this.attack();
    }

    // =====================
    // ⚡ DASH
    // =====================
    if (
        Phaser.Input.Keyboard.JustDown(this.controls.dash) &&
        this.state !== 'dash'
    ) {
        this.dash();
    }

    // =====================
    // 🔮 SPELL
    // =====================
    if (
        Phaser.Input.Keyboard.JustDown(this.controls.spell) &&
        this.state !== 'spell'
    ) {
        this.castSpell();
    }

    // =====================
    // 😤 TAUNT
    // =====================
    if (
        Phaser.Input.Keyboard.JustDown(this.controls.taunt) &&
        this.state !== 'taunt'
    ) {
        this.taunt();
    }
}

    // ⚔️ BASIC ATTACK
    attack() {
        this.state = 'attack';
        this.canControl = false;

        this.sprite.setVelocityX(0);
        this.sprite.anims.play('attack_anim');

        this.sprite.once('animationcomplete', () => {
            this.canControl = true;
            this.state = 'idle';
        });
    }

    // ⚡ DASH
    dash() {
        this.state = 'dash';
        this.canControl = false;

        const dir = this.sprite.flipX ? -1 : 1;

        this.sprite.setVelocityX(dir * 800);
        this.sprite.setTint(0x00ffff);

        this.scene.time.delayedCall(150, () => {
            this.sprite.clearTint();
            this.canControl = true;
            this.state = 'idle';
        });
    }

    // 🔮 SPELL ATTACK
    castSpell() {
        this.state = 'spell';
        this.canControl = false;

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

        this.scene.time.delayedCall(1000, () => spell.destroy());

        this.scene.time.delayedCall(300, () => {
            this.canControl = true;
            this.state = 'idle';
        });
    }

    // 😤 TAUNT
    taunt() {
        this.state = 'taunt';
        this.canControl = false;

        this.sprite.anims.play('taunt_anim');

        this.sprite.once('animationcomplete', () => {
            this.canControl = true;
            this.state = 'idle';
        });
    }

    // 💥 DAMAGE
    takeDamage(amount) {
        if (this.isInvincible || this.state === 'dead') return;

        this.health.takeDamage(amount);

        this.state = 'hurt';
        this.canControl = false;
        this.isInvincible = true;

        this.sprite.setTint(0xff0000);
        this.sprite.anims.play('hurt_anim');

        const dir = this.sprite.flipX ? 1 : -1;
        this.sprite.setVelocityX(dir * 300);

        this.scene.time.delayedCall(300, () => {
            this.sprite.clearTint();
            this.canControl = true;
            this.state = 'idle';
        });

        this.scene.time.delayedCall(1000, () => {
            this.isInvincible = false;
        });

        if (this.health.current <= 0) {
            this.die();
        }
    }

    // ☠️ DEATH
    die() {
        this.state = 'dead';
        this.canControl = false;

        this.sprite.setVelocity(0);
        this.sprite.anims.play('death_anim');

        this.sprite.once('animationcomplete', () => {
            this.sprite.setTint(0x555555);
        });
    }
}