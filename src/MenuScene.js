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
        this.cameras.main.setRoundPixels(true);
        const { width, height } = this.scale;

        // Initialize menu graphics for panels
        this.menuGraphics = this.add.graphics().setDepth(1);

        const drawGlassPanel = (graphics, x, y, w, h, strokeColor, radius = 6) => {
            // Drop shadow
            graphics.fillStyle(0x000000, 0.35);
            graphics.fillRoundedRect(x + 3, y + 3, w, h, radius);
            // Glass background
            graphics.fillStyle(0x0a0f19, 0.85);
            graphics.fillRoundedRect(x, y, w, h, radius);
            // Neon stroke
            graphics.lineStyle(1.5, strokeColor, 0.85);
            graphics.strokeRoundedRect(x, y, w, h, radius);
        };

        // 🌑 Dark overlay
        this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);

        // 🏷️ Title (Styled with glowing neon cyan text and strong shadow)
        this.add.text(width * 0.35, height * 0.15, 'SWORD ARENA', {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            color: '#00e5ff'
        })
            .setOrigin(0.5)
            .setShadow(3, 3, '#000000', 5);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LEFT SIDE — BUTTONS CONTAINER
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const btnX = width * 0.35;
        // Draw Left Card Panel enclosing all buttons (width=280, height=360)
        drawGlassPanel(this.menuGraphics, btnX - 140, 195, 280, 360, 0x00e5ff, 8);

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
        //  RIGHT SIDE — CHARACTER PREVIEW CARD
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const previewX = width * 0.75;
        const previewY = height * 0.5;

        // Preview border color matches character's color theme
        const charColorMap = { p1: 0x4488ff, p2: 0x9944ff, p3: 0xff4444 };
        const previewStroke = charColorMap[PlayerData.character] || 0x00e5ff;
        const hexPreviewColor = '#' + previewStroke.toString(16).padStart(6, '0');

        // Draw Right Card Panel
        drawGlassPanel(this.menuGraphics, previewX - 100, previewY - 140, 200, 265, previewStroke, 8);

        // Character name (colored to match theme)
        const charInfo = PlayerData.getCharacterInfo();
        this.add.text(previewX, previewY - 105, charInfo.name, {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            color: hexPreviewColor
        })
            .setOrigin(0.5)
            .setDepth(2)
            .setShadow(1.5, 1.5, '#000000', 3);

        // Character sprite
        const previewSprite = this.add.sprite(previewX, previewY - 10, `${PlayerData.character}_idle`)
            .setDepth(2);
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
        })
            .setOrigin(0.5)
            .setDepth(2)
            .setShadow(1, 1, '#000000', 2);

        // "EDIT" mini button (Sleek green neon glass design)
        const customBtnText = this.add.text(previewX, previewY + 115, '⚙ EDIT', {
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#44ff44',
            padding: { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setDepth(3)
            .setShadow(1, 1, '#000000', 2);

        const editGraphics = this.add.graphics().setDepth(2);
        const drawEditBtn = (isHover) => {
            editGraphics.clear();
            editGraphics.fillStyle(isHover ? 0x142814 : 0x0a190a, 0.85);
            editGraphics.fillRoundedRect(previewX - 45, previewY + 100, 90, 30, 4);
            editGraphics.lineStyle(1.5, isHover ? 0x44ff44 : 0x228822, 0.85);
            editGraphics.strokeRoundedRect(previewX - 45, previewY + 100, 90, 30, 4);
        };
        drawEditBtn(false);

        const editHitbox = this.add.rectangle(previewX, previewY + 115, 90, 30, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);

        editHitbox.on('pointerover', () => {
            drawEditBtn(true);
            customBtnText.setScale(1.05);
        });
        editHitbox.on('pointerout', () => {
            drawEditBtn(false);
            customBtnText.setScale(1);
        });
        editHitbox.on('pointerdown', () => {
            this.playClick();
            this.scene.start('CustomizeScene');
        });
    }

    // 🔘 Button Creator (Custom Glass Pill Button)
    createButton(x, y, text, callback) {
        const btnW = 240;
        const btnH = 46;

        const btnGraphics = this.add.graphics().setDepth(2);

        const drawButtonG = (isHover) => {
            btnGraphics.clear();
            // Drop shadow
            btnGraphics.fillStyle(0x000000, 0.25);
            btnGraphics.fillRoundedRect(x - btnW / 2 + 2, y - btnH / 2 + 2, btnW, btnH, 6);
            // Glass background
            btnGraphics.fillStyle(isHover ? 0x152033 : 0x0a0f19, 0.9);
            btnGraphics.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
            // Border
            btnGraphics.lineStyle(1.5, isHover ? 0x00ffff : 0x475569, 0.85);
            btnGraphics.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
        };

        drawButtonG(false);

        const btnText = this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            color: '#ffffff'
        })
            .setOrigin(0.5)
            .setDepth(3)
            .setShadow(1.5, 1.5, '#000000', 3);

        const hitArea = this.add.rectangle(x, y, btnW, btnH, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);

        hitArea.on('pointerover', () => {
            drawButtonG(true);
            btnText.setColor('#00ffff');
            btnText.setScale(1.05);
        });

        hitArea.on('pointerout', () => {
            drawButtonG(false);
            btnText.setColor('#ffffff');
            btnText.setScale(1);
        });

        hitArea.on('pointerdown', () => {
            this.playClick();
            callback();
        });
    }

    // 📜 About Popup (Crimson Glowing Glass Popup)
    showAbout() {
        const { width, height } = this.scale;

        const elements = [];

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0)
            .setDepth(10);
        elements.push(overlay);

        const boxX = width / 2;
        const boxY = height / 2;
        const boxW = width * 0.55;
        const boxH = height * 0.55;

        const popupGraphics = this.add.graphics().setDepth(11);
        elements.push(popupGraphics);

        // Draw popup container
        popupGraphics.fillStyle(0x000000, 0.35);
        popupGraphics.fillRoundedRect(boxX - boxW / 2 + 3, boxY - boxH / 2 + 3, boxW, boxH, 12);
        popupGraphics.fillStyle(0x0a0f19, 0.95);
        popupGraphics.fillRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 12);
        popupGraphics.lineStyle(2, 0xff0055, 0.9); // Crimson outline
        popupGraphics.strokeRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 12);

        const closeText = this.add.text(
            boxX + boxW / 2 - 25,
            boxY - boxH / 2 + 25,
            'X',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '16px',
                color: '#ff4444'
            }
        )
            .setOrigin(0.5)
            .setDepth(12)
            .setShadow(1.5, 1.5, '#000000', 3);
        elements.push(closeText);

        const closeHitbox = this.add.rectangle(
            closeText.x, closeText.y, 50, 50, 0x000000, 0
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
            boxX, boxY - 40,
            "SWORD ARENA\n\nA fast-paced sword combat game.\nFight, dash, and master abilities.\nMore updates coming soon!",
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '10px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 10,
                wordWrap: { width: boxW - 60 }
            }
        )
            .setOrigin(0.5)
            .setDepth(12)
            .setShadow(1.5, 1.5, '#000000', 3);
        elements.push(aboutText);

        const discord = this.add.image(boxX - 60, boxY + 70, 'discord')
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

        const xBtn = this.add.image(boxX + 60, boxY + 70, 'x_icon')
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