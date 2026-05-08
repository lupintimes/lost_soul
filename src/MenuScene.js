export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.selectedCharacter = 'p1';
        this.pendingMode = null;
    }

    preload() {
        this.load.image('menu_bg', '../assets/background.png');
        this.load.image('discord', '../assets/ui/discord.png');
        this.load.image('x_icon', '../assets/ui/x.png');

        // ✅ Load character preview spritesheets
        this.load.spritesheet('p1_idle', '../assets/p1/idle.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('p2_idle', '../assets/p2/idle.png', { frameWidth: 520, frameHeight: 420 });
        this.load.spritesheet('p3_idle', '../assets/p3/idle.png', { frameWidth: 520, frameHeight: 420 });
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
        this.add.text(width / 2, height * 0.2, 'SWORD ARENA', {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // 🎮 Buttons
        this.createButton(width / 2, height * 0.4, 'SOLO', () => {
            this.pendingMode = 'solo';
            this.showCharacterSelect();
        });

        this.createButton(width / 2, height * 0.5, 'MULTIPLAYER', () => {
            this.pendingMode = 'multiplayer';
            this.showCharacterSelect();
        });

        this.createButton(width / 2, height * 0.6, 'ABOUT US', () => {
            this.showAbout();
        });

        // ✅ Create idle animations for character previews
        this.createPreviewAnimations();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🎬 CHARACTER PREVIEW ANIMATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createPreviewAnimations() {
        if (!this.anims.exists('p1_preview')) {
            this.anims.create({
                key: 'p1_preview',
                frames: this.anims.generateFrameNumbers('p1_idle', { start: 0, end: 11 }),
                frameRate: 6,
                repeat: -1
            });
        }
        if (!this.anims.exists('p2_preview')) {
            this.anims.create({
                key: 'p2_preview',
                frames: this.anims.generateFrameNumbers('p2_idle', { start: 0, end: 11 }),
                frameRate: 6,
                repeat: -1
            });
        }
        if (!this.anims.exists('p3_preview')) {
            this.anims.create({
                key: 'p3_preview',
                frames: this.anims.generateFrameNumbers('p3_idle', { start: 0, end: 11 }),
                frameRate: 6,
                repeat: -1
            });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  🎭 CHARACTER SELECT SCREEN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    showCharacterSelect() {
        const { width, height } = this.scale;

        const elements = [];

        // 🔲 Overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0)
            .setDepth(10)
            .setInteractive();
        elements.push(overlay);

        // 📦 Panel
        const panelW = width * 0.8;
        const panelH = height * 0.75;
        const panelX = width / 2;
        const panelY = height / 2;

        const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x111111, 0.95)
            .setDepth(11)
            .setStrokeStyle(2, 0x444444);
        elements.push(panel);

        // 🏷️ Title
        const title = this.add.text(panelX, panelY - panelH / 2 + 25, 'SELECT CHARACTER', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            color: '#ffff00'
        })
        .setOrigin(0.5)
        .setDepth(12);
        elements.push(title);

        // ✖ Close button
        const closeText = this.add.text(
            panelX + panelW / 2 - 25,
            panelY - panelH / 2 + 20,
            'X',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '14px',
                color: '#ff4444'
            }
        )
        .setOrigin(0.5)
        .setDepth(12);
        elements.push(closeText);

        const closeHitbox = this.add.rectangle(
            closeText.x, closeText.y, 40, 40, 0x000000, 0
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
        closeHitbox.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
            this.pendingMode = null;
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  CHARACTER CARDS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const characters = [
            {
                id: 'p1',
                name: 'KNIGHT',
                color: 0x4488ff,
                anim: 'p1_preview',
                texture: 'p1_idle',
                desc: 'Balanced fighter'
            },
            {
                id: 'p2',
                name: 'SHADOW',
                color: 0x9944ff,
                anim: 'p2_preview',
                texture: 'p2_idle',
                desc: 'Fast & deadly'
            },
            {
                id: 'p3',
                name: 'BERSERKER',
                color: 0xff4444,
                anim: 'p3_preview',
                texture: 'p3_idle',
                desc: 'Heavy hitter'
            }
        ];

        const cardW = 150;
        const cardH = 200;
        const spacing = 30;
        const totalW = characters.length * cardW + (characters.length - 1) * spacing;
        const startX = panelX - totalW / 2 + cardW / 2;
        const cardY = panelY + 10;

        // Track selection highlight
        let selectedBorder = null;

        characters.forEach((char, index) => {
            const cx = startX + index * (cardW + spacing);

            // Card background
            const cardBg = this.add.rectangle(cx, cardY, cardW, cardH, 0x1a1a1a)
                .setDepth(12)
                .setStrokeStyle(2, 0x333333)
                .setInteractive({ useHandCursor: true });
            elements.push(cardBg);

            // Character sprite preview
            const charSprite = this.add.sprite(cx, cardY - 20, char.texture)
                .setScale(0.25)
                .setDepth(13);
            charSprite.anims.play(char.anim, true);
            elements.push(charSprite);

            // Character name
            const nameText = this.add.text(cx, cardY + 60, char.name, {
                fontFamily: '"Press Start 2P"',
                fontSize: '8px',
                color: '#ffffff',
                align: 'center'
            })
            .setOrigin(0.5)
            .setDepth(13);
            elements.push(nameText);

            // Description
            const descText = this.add.text(cx, cardY + 80, char.desc, {
                fontFamily: '"Press Start 2P"',
                fontSize: '6px',
                color: '#888888',
                align: 'center'
            })
            .setOrigin(0.5)
            .setDepth(13);
            elements.push(descText);

            // ✅ Default selection highlight
            if (char.id === this.selectedCharacter) {
                selectedBorder = this.add.rectangle(cx, cardY, cardW + 6, cardH + 6, 0x000000, 0)
                    .setDepth(11)
                    .setStrokeStyle(3, char.color);
                elements.push(selectedBorder);
            }

            // Hover effects
            cardBg.on('pointerover', () => {
                cardBg.setFillStyle(0x333333);
                charSprite.setScale(0.28);
                nameText.setColor('#ffff00');
            });

            cardBg.on('pointerout', () => {
                if (this.selectedCharacter === char.id) {
                    cardBg.setFillStyle(0x222222);
                } else {
                    cardBg.setFillStyle(0x1a1a1a);
                }
                charSprite.setScale(0.25);
                nameText.setColor('#ffffff');
            });

            // Click to select
            cardBg.on('pointerdown', () => {
                this.selectedCharacter = char.id;

                // Update selection border
                if (selectedBorder) selectedBorder.destroy();
                selectedBorder = this.add.rectangle(cx, cardY, cardW + 6, cardH + 6, 0x000000, 0)
                    .setDepth(11)
                    .setStrokeStyle(3, char.color);
                elements.push(selectedBorder);

                // Update all card backgrounds
                characters.forEach((c, i) => {
                    // Reset all cards
                });

                console.log(`🎭 Selected: ${char.name} (${char.id})`);
            });
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  PLAY BUTTON
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const playBtn = this.add.text(
            panelX,
            panelY + panelH / 2 - 35,
            '▶ PLAY',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#228B22',
                padding: { x: 30, y: 12 }
            }
        )
        .setOrigin(0.5)
        .setDepth(12)
        .setInteractive({ useHandCursor: true });
        elements.push(playBtn);

        playBtn.on('pointerover', () => {
            playBtn.setStyle({ backgroundColor: '#32CD32' });
            playBtn.setScale(1.05);
        });

        playBtn.on('pointerout', () => {
            playBtn.setStyle({ backgroundColor: '#228B22' });
            playBtn.setScale(1);
        });

        playBtn.on('pointerdown', () => {
            console.log(`🎮 Starting ${this.pendingMode} with character: ${this.selectedCharacter}`);

            // Destroy popup
            elements.forEach(el => el.destroy());

            // Start the game with character data
            if (this.pendingMode === 'solo') {
                this.scene.start('GameScene', {
                    mode: 'solo',
                    character: this.selectedCharacter
                });
            } else if (this.pendingMode === 'multiplayer') {
                this.scene.start('LobbyScene', {
                    character: this.selectedCharacter
                });
            }
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  SELECTED CHARACTER LABEL
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const selectedLabel = this.add.text(
            panelX,
            panelY + panelH / 2 - 70,
            `SELECTED: ${this.selectedCharacter.toUpperCase()}`,
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '8px',
                color: '#44ff44'
            }
        )
        .setOrigin(0.5)
        .setDepth(12);
        elements.push(selectedLabel);

        // ✅ Store elements ref so we can update the label
        this.charSelectElements = elements;
        this.selectedLabel = selectedLabel;
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

        btn.on('pointerdown', callback);
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
            console.log("Add X link later");
        });

        closeHitbox.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
        });
    }
}