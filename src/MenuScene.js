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
        const { width, height } = this.scale;

        // 🖼️ Background
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        // 🌑 Dark overlay
        this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);

        // 🏷️ Title
        this.add.text(width * 0.4, height * 0.15, 'SWORD ARENA', {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LEFT SIDE — BUTTONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const btnX = width * 0.35;

        this.createButton(btnX, height * 0.35, 'SOLO', () => {
            this.scene.start('GameScene', {
                mode: 'solo',
                character: PlayerData.character
            });
        });

        this.createButton(btnX, height * 0.47, 'MULTIPLAYER', () => {
            this.scene.start('LobbyScene', {
                character: PlayerData.character
            });
        });

        this.createButton(btnX, height * 0.59, 'CUSTOMIZE', () => {
            this.scene.start('CustomizeScene');
        });

        this.createButton(btnX, height * 0.71, 'ABOUT US', () => {
            this.showAbout();
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  RIGHT SIDE — CHARACTER PREVIEW
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const previewX = width * 0.75;
        const previewY = height * 0.5;

        // Preview background panel
        this.add.rectangle(previewX, previewY, 200, 250, 0x111111, 0.7)
            .setStrokeStyle(2, 0x333333);

        // Character name
        const charInfo = PlayerData.getCharacterInfo();

        this.add.text(previewX, previewY - 110, charInfo.name, {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Character sprite
        const previewSprite = this.add.sprite(previewX, previewY - 10, `${PlayerData.character}_idle`);
        previewSprite.setScale(0.5);
        previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        // Apply color tint
        const tint = PlayerData.getColorTint();
        if (tint) {
            previewSprite.setTint(tint);
        }

        // Color label
        const colorInfo = PlayerData.colors.find(c => c.id === PlayerData.color);
        this.add.text(previewX, previewY + 85, `COLOR: ${colorInfo?.name || 'DEFAULT'}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '7px',
            color: '#888888'
        }).setOrigin(0.5);

        // "EDIT" mini button
        const customBtn = this.add.text(previewX, previewY + 110, '⚙ EDIT', {
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#44ff44',
            backgroundColor: '#1a1a1a',
            padding: { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        customBtn.on('pointerover', () => {
            customBtn.setStyle({ backgroundColor: '#333' });
            customBtn.setScale(1.05);
        });
        customBtn.on('pointerout', () => {
            customBtn.setStyle({ backgroundColor: '#1a1a1a' });
            customBtn.setScale(1);
        });
        customBtn.on('pointerdown', () => {

            this.playClick();
            this.scene.start('CustomizeScene');
        });
    }

    // 🔘 Button Creator
    createButton(x, y, text, callback) {
        const btn = this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#222',
            padding: { x: 15, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            btn.setStyle({ backgroundColor: '#555' });
            btn.setScale(1.05);
        });
        btn.on('pointerout', () => {
            btn.setStyle({ backgroundColor: '#222' });
            btn.setScale(1);
        });
        btn.on('pointerdown', () => {
            this.playClick();  // ✅ Click on press
            callback();
        });
    }

    // 📜 About Popup
    showAbout() {
        const { width, height } = this.scale;

        const elements = [];

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0)
            .setDepth(10);
        elements.push(overlay);

        const box = this.add.rectangle(
            width / 2, height / 2,
            width * 0.5, height * 0.5,
            0x111111
        ).setDepth(11);
        elements.push(box);

        const closeText = this.add.text(
            width / 2 + (width * 0.25) - 30,
            height / 2 - (height * 0.25) + 20,
            'X',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '16px',
                color: '#ff4444'
            }
        )
            .setOrigin(0.5)
            .setDepth(12);
        elements.push(closeText);

        const closeHitbox = this.add.rectangle(
            closeText.x, closeText.y, 60, 60, 0x000000, 0
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
            closeText.setColor('#ff4444');
        });

        const aboutText = this.add.text(
            width / 2, height / 2 - 50,
            "SWORD ARENA\n\nA fast-paced sword combat game.\nFight, dash, and master abilities.\nMore updates coming soon!",
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '10px',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: width * 0.4 }
            }
        )
            .setOrigin(0.5)
            .setDepth(12);
        elements.push(aboutText);

        const discord = this.add.image(width / 2 - 60, height / 2 + 80, 'discord')
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

        const xBtn = this.add.image(width / 2 + 60, height / 2 + 80, 'x_icon')
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