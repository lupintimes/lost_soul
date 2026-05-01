import Controls from './Controls.js';
import CombatSystem from '../systems/CombatSystem.js';
import HealthSystem from '../systems/HealthSystem.js';

export default class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        this.sprite = scene.physics.add.sprite(x, y, 'idle');
        // 🔥 adjust this visually
        this.sprite.setScale(0.25);
        this.sprite.setCollideWorldBounds(true);

        // 🔽 scale if too big
        this.sprite.setScale(0.4);

        // 🔽 fix hitbox (adjust later)
        this.sprite.body.setSize(60, 90);
        this.sprite.body.setOffset(30, 30);

        this.controls = new Controls(scene);
        this.combat = new CombatSystem(scene, this);
        this.health = new HealthSystem();

        this.isAttacking = false;

        // ⚔️ frame-based attack timing
        this.sprite.on('animationupdate', (anim, frame) => {
            if (anim.key === 'attack_anim' && frame.index === 3) {
                this.combat.attack();
            }
        });
    }

    update() {
        const speed = 250;
        const jumpForce = -500;

        if (this.isAttacking) return;

        // movement
        if (this.controls.left.isDown) {
            this.sprite.setVelocityX(-speed);
            this.sprite.setFlipX(true);
            this.sprite.anims.play('walk_anim', true);
        }
        else if (this.controls.right.isDown) {
            this.sprite.setVelocityX(speed);
            this.sprite.setFlipX(false);
            this.sprite.anims.play('walk_anim', true);
        }
        else {
            this.sprite.setVelocityX(0);
            this.sprite.anims.play('idle_anim', true);
        }

        // jump
        if (this.controls.jump.isDown && this.sprite.body.blocked.down) {
            this.sprite.setVelocityY(jumpForce);
        }

        // attack
        if (Phaser.Input.Keyboard.JustDown(this.controls.attack)) {
            this.attack();
        }
    }

    attack() {
        this.isAttacking = true;

        this.sprite.setVelocityX(0);
        this.sprite.anims.play('attack_anim');

        this.sprite.once('animationcomplete', () => {
            this.isAttacking = false;
        });
    }
}