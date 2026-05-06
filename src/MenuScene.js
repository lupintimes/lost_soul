export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
        this.load.image('menu_bg', '../assets/background.png');
        this.load.image('discord', '../assets/ui/discord.png');
        this.load.image('x_icon', '../assets/ui/x.png');
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
            this.scene.start('GameScene', { mode: 'solo' });
        });

         this.createButton(width / 2, height * 0.5, 'MULTIPLAYER', () => {
            this.scene.start('LobbyScene');
        });

        this.createButton(width / 2, height * 0.6, 'ABOUT US', () => {
            this.showAbout();
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

        btn.on('pointerdown', callback);
    }

    // 📜 About Popup
    showAbout() {
        const { width, height } = this.scale;

        const elements = []; // 🔥 track everything to destroy easily

        // 🔲 overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0)
            .setDepth(10);
        elements.push(overlay);

        // 📦 box
        const box = this.add.rectangle(
            width / 2,
            height / 2,
            width * 0.5,
            height * 0.5,
            0x111111
        ).setDepth(11);
        elements.push(box);

        // ✖ close text
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

        // 🟦 BIG clickable hitbox (🔥 fix)
        const closeHitbox = this.add.rectangle(
            closeText.x,
            closeText.y,
            60,
            60,
            0x000000,
            0
        )
            .setInteractive({ useHandCursor: true })
            .setDepth(12);
        elements.push(closeHitbox);

        // hover effect
        closeHitbox.on('pointerover', () => {
            closeText.setScale(1.2);
            closeText.setColor('#ffffff');
        });

        closeHitbox.on('pointerout', () => {
            closeText.setScale(1);
            closeText.setColor('#ff4444');
        });

        // 📜 about text
        const aboutText = this.add.text(
            width / 2,
            height / 2 - 50,
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

        // 💬 Discord
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

        // 🐦 X button
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

        // ❌ CLOSE ALL (clean destroy)
        closeHitbox.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
        });
    }
}