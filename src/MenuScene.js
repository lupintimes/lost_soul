import PlayerData from './PlayerData.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    playClick() {
        try {
            if (this.cache.audio.exists('sfx_click')) {
                this.sound.play('sfx_click', { volume: 0.3 });
            }
        } catch (e) {
            // ignore
        }
    }

    create() {
        this.cameras.main.setRoundPixels(false);
        const { width, height } = this.scale;

        // 🖼️ Background
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        // 🏷️ Title
        const leftX = width * 0.15;
        this.add.image(leftX + 160, height * 0.18, 'logo').setOrigin(0.5).setScale(0.4);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LEFT SIDE — BUTTONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        let btnY = height * 0.35;
        const btnSpacing = 85;

        this.createButton(leftX, btnY, '', 'SOLO', 'Begin your journey', () => {
            this.scene.start('GameScene', {
                mode: 'solo',
                character: PlayerData.character
            });
        });
        btnY += btnSpacing;

        this.createButton(leftX, btnY, '', 'MULTIPLAYER', 'Join or host a world', () => {
            this.scene.start('LobbyScene', {
                character: PlayerData.character
            });
        });
        btnY += btnSpacing;

        this.createButton(leftX, btnY, '', 'CUSTOMIZE', 'Edit your soul', () => {
            this.scene.start('CustomizeScene');
        });
        btnY += btnSpacing;

        this.createButton(leftX, btnY, '', 'ABOUT', 'Uncover the story', () => {
            this.showAbout();
        });

        // Bottom buttons
        this.createButton(width * 0.05, height - 70, '⚙', '', null, () => {
            // Settings placeholder
            this.playClick();
        }, true);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  RIGHT SIDE — CHARACTER PREVIEW
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const previewX = width * 0.75;
        const previewY = height * 0.5; // Centered vertically
        const tint = PlayerData.getColorTint();

        // Create simple particle texture
        if (!this.textures.exists('menu_particle')) {
            const particleGraphics = this.make.graphics();
            particleGraphics.fillStyle(0xffffff, 1);
            particleGraphics.fillCircle(4, 4, 4);
            particleGraphics.generateTexture('menu_particle', 8, 8);
            particleGraphics.destroy();
        }

        // Particles slightly behind character (for some ambience)
        this.add.particles(previewX, previewY - 20, 'menu_particle', {
            speed: { min: 5, max: 20 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.3, end: 0 },
            lifespan: 3000,
            blendMode: 'ADD',
            tint: tint || 0x888888,
            frequency: 200,
            emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 30) }
        });

        // Character sprite
        const previewSprite = this.add.sprite(previewX, previewY, `${PlayerData.character}_idle`);
        previewSprite.setScale(1.0); // Normal scene size
        previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        // Apply color tint
        if (tint) {
            previewSprite.setTint(tint);
        }
    }

    // 🔘 Button Creator
    createButton(x, y, icon, title, subtitle, callback, isSmall = false) {
        const btnContainer = this.add.container(x, y);
        const w = isSmall ? (!title ? 50 : 160) : 320;
        const h = isSmall ? (!title ? 50 : 40) : 70;

        // Backgrounds
        const drawBg = (graphics, color, alpha, borderColor) => {
            graphics.clear();
            graphics.fillStyle(color, alpha);
            graphics.fillRoundedRect(0, 0, w, h, 6);
            graphics.lineStyle(1.5, borderColor, 0.8);
            graphics.strokeRoundedRect(0, 0, w, h, 6);
        };

        const bgDefault = this.add.graphics();
        drawBg(bgDefault, 0x0d121d, 0.7, 0x1f2b3e);
        btnContainer.add(bgDefault);

        const bgHover = this.add.graphics();
        drawBg(bgHover, 0x1b283a, 0.85, 0x7fa3c7);
        bgHover.setAlpha(0);
        btnContainer.add(bgHover);

        // Icon Text
        if (icon) {
            const iconText = this.add.text(isSmall && !title ? w / 2 : (isSmall ? 20 : 30), h / 2, icon, {
                fontFamily: '"Cormorant Garamond"',
                fontSize: isSmall ? (!title ? '28px' : '16px') : '24px',
                color: '#ffffff'
            }).setOrigin(0.5);
            btnContainer.add(iconText);
        }

        // Title
        const titleOffset = icon ? (isSmall ? 40 : 65) : (isSmall ? 20 : 35);
        if (title) {
            const titleText = this.add.text(titleOffset, subtitle ? (h / 2 - 8) : h / 2, title, {
                fontFamily: '"Cormorant Garamond"',
                fontSize: isSmall ? '16px' : '28px',
                fontWeight: 'bold',
                color: '#ffffff'
            }).setOrigin(0, 0.5);
            btnContainer.add(titleText);
        }

        if (subtitle) {
            const subText = this.add.text(titleOffset, h / 2 + 16, subtitle, {
                fontFamily: '"Cormorant Garamond"',
                fontSize: '12px',
                color: '#6e85a0'
            }).setOrigin(0, 0.5);
            btnContainer.add(subText);
        }

        // Interaction
        const hitArea = new Phaser.Geom.Rectangle(0, 0, w, h);
        btnContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        btnContainer.on('pointerover', () => {
            if (btnContainer.fadeTween) btnContainer.fadeTween.stop();
            btnContainer.fadeTween = this.tweens.add({
                targets: bgHover,
                alpha: 1,
                duration: 120,
                ease: 'Quad.easeOut'
            });
        });
        
        btnContainer.on('pointerout', () => {
            if (btnContainer.fadeTween) btnContainer.fadeTween.stop();
            btnContainer.fadeTween = this.tweens.add({
                targets: bgHover,
                alpha: 0,
                duration: 250,
                ease: 'Quad.easeOut'
            });
        });
        
        btnContainer.on('pointerdown', () => {
            this.playClick();
            callback();
        });

        return btnContainer;
    }

    // 📜 About Popup
    showAbout() {
        const { width, height } = this.scale;

        const elements = [];

        const overlay = this.add.rectangle(0, 0, width, height, 0x090a0b, 0.75)
            .setOrigin(0)
            .setDepth(10);
        elements.push(overlay);

        const boxW = width * 0.5;
        const boxH = height * 0.55;
        
        // Rounded slate box with border
        const boxG = this.add.graphics().setDepth(11);
        boxG.fillStyle(0x0d121d, 0.95);
        boxG.fillRoundedRect(width / 2 - boxW / 2, height / 2 - boxH / 2, boxW, boxH, 12);
        boxG.lineStyle(1.5, 0x7fa3c7, 0.9);
        boxG.strokeRoundedRect(width / 2 - boxW / 2, height / 2 - boxH / 2, boxW, boxH, 12);
        elements.push(boxG);

        const closeText = this.add.text(
            width / 2 + (boxW / 2) - 25,
            height / 2 - (boxH / 2) + 25,
            '✕',
            {
                fontFamily: '"Cormorant Garamond"',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#7fa3c7'
            }
        )
            .setOrigin(0.5)
            .setDepth(12);
        elements.push(closeText);

        const closeHitbox = this.add.rectangle(
            closeText.x, closeText.y, 45, 45, 0x000000, 0
        )
            .setInteractive({ useHandCursor: true })
            .setDepth(12);
        elements.push(closeHitbox);

        closeHitbox.on('pointerover', () => {
            closeText.setScale(1.2);
            closeText.setColor('#ffffff');
        });
        closeHitbox.on('pointerout', () => {
            closeText.setScale(1);
            closeText.setColor('#7fa3c7');
        });

        const aboutText = this.add.text(
            width / 2, height / 2 - 35,
            "LOST SOUL\n\nA fast-paced sword combat game.\nFight, dash, and master abilities.\nMore updates coming soon!",
            {
                fontFamily: '"Cormorant Garamond"',
                fontSize: '20px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 4,
                wordWrap: { width: boxW * 0.8 }
            }
        )
            .setOrigin(0.5)
            .setDepth(12);
        elements.push(aboutText);

        const discord = this.add.image(width / 2 - 60, height / 2 + 95, 'discord')
            .setScale(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(12);
        elements.push(discord);

        discord.on('pointerover', () => discord.setScale(0.6));
        discord.on('pointerout', () => discord.setScale(0.5));
        discord.on('pointerdown', () => {
            this.playClick();
            window.open('https://discord.gg/ka8rz9ZkRX', '_blank');
        });

        const xBtn = this.add.image(width / 2 + 60, height / 2 + 95, 'x_icon')
            .setScale(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(12);
        elements.push(xBtn);

        xBtn.on('pointerover', () => xBtn.setScale(0.6));
        xBtn.on('pointerout', () => xBtn.setScale(0.5));
        xBtn.on('pointerdown', () => {
            this.playClick();
            console.log("Add X link later");
        });

        closeHitbox.on('pointerdown', () => {
            this.playClick();
            elements.forEach(el => el.destroy());
        });
    }
}
