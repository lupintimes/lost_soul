import PlayerData from './PlayerData.js';

export default class SettingsScene extends Phaser.Scene {
    constructor() {
        super('SettingsScene');
    }

    playClick() {
        try {
            if (this.sound.context && this.sound.context.state === 'suspended') {
                this.sound.context.resume();
            }
            if (this.cache.audio.exists('sfx_click')) {
                this.sound.play('sfx_click', { volume: 0.3 * PlayerData.sfxVolume });
            }
        } catch (e) {
            // ignore
        }
    }

    create() {
        this.cameras.main.setRoundPixels(false);
        const { width, height } = this.scale;

        // ─── Background ───────────────────────────────────
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        this.add.rectangle(0, 0, width, height, 0x090a0b, 0.75).setOrigin(0);

        // ─── Title ────────────────────────────────────────
        this.add.text(width / 2, 50, 'SETTINGS', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ─── Back Button ──────────────────────────────────
        const backBtnContainer = this.add.container(20, 20);
        const backW = 100;
        const backH = 40;
        const backBg = this.add.graphics();
        const drawBackBg = (color, alpha, borderColor) => {
            backBg.clear();
            backBg.fillStyle(color, alpha);
            backBg.fillRoundedRect(0, 0, backW, backH, 6);
            backBg.lineStyle(1.5, borderColor, 0.8);
            backBg.strokeRoundedRect(0, 0, backW, backH, 6);
        };
        drawBackBg(0x0d121d, 0.7, 0x2e3d52);
        backBtnContainer.add(backBg);

        const backText = this.add.text(backW / 2, backH / 2, '← BACK', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);
        backBtnContainer.add(backText);

        backBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, backW, backH), Phaser.Geom.Rectangle.Contains);
        backBtnContainer.on('pointerover', () => {
            drawBackBg(0x17212e, 0.85, 0xff4444);
            backText.setColor('#ffffff');
        });
        backBtnContainer.on('pointerout', () => {
            drawBackBg(0x0d121d, 0.7, 0x2e3d52);
            backText.setColor('#7fa3c7');
        });
        backBtnContainer.on('pointerdown', () => {
            this.playClick();
            this.scene.start('MenuScene');
        });

        // ─── Settings Panel ──────────────────────────────
        const panelW = 500;
        const panelH = 350;
        const panelX = width / 2 - panelW / 2;
        const panelY = height / 2 - panelH / 2 + 20;

        const panelG = this.add.graphics();
        panelG.fillStyle(0x0d121d, 0.85);
        panelG.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
        panelG.lineStyle(1.5, 0x2e3d52, 1);
        panelG.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

        // ─── Music Control Row ────────────────────────────
        const musicY = panelY + 80;
        this.add.text(width / 2, musicY - 30, 'MUSIC VOLUME', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);

        // Controls container
        const mMinus = this.createSelectorButton(width / 2 - 80, musicY, '−', () => {
            PlayerData.setMusicVolume(PlayerData.musicVolume - 0.1);
            this.musicText.setText(`${Math.round(PlayerData.musicVolume * 100)}%`);
            this.playClick();
        });
        
        this.musicText = this.add.text(width / 2, musicY, `${Math.round(PlayerData.musicVolume * 100)}%`, {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        const mPlus = this.createSelectorButton(width / 2 + 80, musicY, '+', () => {
            PlayerData.setMusicVolume(PlayerData.musicVolume + 0.1);
            this.musicText.setText(`${Math.round(PlayerData.musicVolume * 100)}%`);
            this.playClick();
        });

        // ─── SFX Control Row ──────────────────────────────
        const sfxY = panelY + 220;
        this.add.text(width / 2, sfxY - 30, 'SFX VOLUME', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);

        // Controls container
        const sMinus = this.createSelectorButton(width / 2 - 80, sfxY, '−', () => {
            PlayerData.setSfxVolume(PlayerData.sfxVolume - 0.1);
            this.sfxText.setText(`${Math.round(PlayerData.sfxVolume * 100)}%`);
            this.playClick();
        });
        
        this.sfxText = this.add.text(width / 2, sfxY, `${Math.round(PlayerData.sfxVolume * 100)}%`, {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        const sPlus = this.createSelectorButton(width / 2 + 80, sfxY, '+', () => {
            PlayerData.setSfxVolume(PlayerData.sfxVolume + 0.1);
            this.sfxText.setText(`${Math.round(PlayerData.sfxVolume * 100)}%`);
            this.playClick();
        });
    }

    createSelectorButton(x, y, label, callback) {
        const btnW = 35;
        const btnH = 35;
        const container = this.add.container(x - btnW / 2, y - btnH / 2);
        
        const bg = this.add.graphics();
        const drawBg = (color, alpha, borderColor) => {
            bg.clear();
            bg.fillStyle(color, alpha);
            bg.fillRoundedRect(0, 0, btnW, btnH, 6);
            bg.lineStyle(1.5, borderColor, 0.8);
            bg.strokeRoundedRect(0, 0, btnW, btnH, 6);
        };
        drawBg(0x0d121d, 0.7, 0x2e3d52);
        container.add(bg);

        const text = this.add.text(btnW / 2, btnH / 2, label, {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add(text);

        container.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        container.on('pointerover', () => drawBg(0x17212e, 0.85, 0x7dd3fc));
        container.on('pointerout', () => drawBg(0x0d121d, 0.7, 0x2e3d52));
        container.on('pointerdown', callback);

        return container;
    }
}
