export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        const { width, height } = this.scale;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LOADING BAR
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const barW = 300;
        const barH = 20;
        const barX = width / 2 - barW / 2;
        const barY = height / 2;

        this.add.rectangle(barX, barY, barW, barH, 0x222222).setOrigin(0);
        const progressBar = this.add.rectangle(barX, barY, 0, barH, 0x44ff44).setOrigin(0);

        const loadingText = this.add.text(width / 2, barY - 30, 'LOADING...', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const percentText = this.add.text(width / 2, barY + 35, '0%', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#888888'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.width = barW * value;
            percentText.setText(Math.round(value * 100) + '%');
        });

        this.load.on('complete', () => {
            loadingText.setText('READY!');
            percentText.setText('100%');
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  🌍 BACKGROUNDS & UI
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        this.load.image('bg', '../assets/background.png');
        this.load.image('menu_bg', '../assets/background.png');
        this.load.image('discord', '../assets/ui/discord.png');
        this.load.image('x_icon', '../assets/ui/x.png');


        //ADUIO

        this.load.audio('sfx_click', '../assets/audio/click.mp3');

        this.load.audio('sfx_attack1', '../assets/audio/attack1.mp3');
        this.load.audio('sfx_attack2', '../assets/audio/attack2.mp3');
        
        this.load.audio('sfx_hurt', '../assets/audio/hurt.mp3');
        this.load.audio('sfx_death', '../assets/audio/death.mp3');
        this.load.audio('sfx_dash', '../assets/audio/dash.mp3');
        this.load.audio('sfx_spell', '../assets/audio/spell.mp3');
        this.load.audio('sfx_highjump', '../assets/audio/highjump.mp3');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  🎭 CHARACTER SPRITESHEETS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const characters = ['p1', 'p2', 'p3'];
        const spriteConfig = { frameWidth: 520, frameHeight: 420 };

        characters.forEach(char => {
            this.load.spritesheet(`${char}_idle`, `../assets/${char}/idle.png`, spriteConfig);
            this.load.spritesheet(`${char}_walk`, `../assets/${char}/walk.png`, spriteConfig);
            this.load.spritesheet(`${char}_attack`, `../assets/${char}/attack.png`, spriteConfig);
            this.load.spritesheet(`${char}_blink`, `../assets/${char}/blink.png`, spriteConfig);
            this.load.spritesheet(`${char}_taunt`, `../assets/${char}/taunt.png`, spriteConfig);
            this.load.spritesheet(`${char}_hurt`, `../assets/${char}/hurt.png`, spriteConfig);
            this.load.spritesheet(`${char}_death`, `../assets/${char}/death.png`, spriteConfig);
        });
    }

    create() {
        const characters = ['p1', 'p2', 'p3'];

        characters.forEach(char => {
            // Idle
            this.anims.create({
                key: `${char}_idle_anim`,
                frames: this.anims.generateFrameNumbers(`${char}_idle`, { start: 0, end: 11 }),
                frameRate: 6,
                repeat: -1
            });

            // Walk
            this.anims.create({
                key: `${char}_walk_anim`,
                frames: this.anims.generateFrameNumbers(`${char}_walk`, { start: 0, end: 11 }),
                frameRate: 12,
                repeat: -1
            });

            // Hurt
            this.anims.create({
                key: `${char}_hurt_anim`,
                frames: this.anims.generateFrameNumbers(`${char}_hurt`, { start: 0, end: 3 }),
                frameRate: 10
            });

            // Death
            this.anims.create({
                key: `${char}_death_anim`,
                frames: this.anims.generateFrameNumbers(`${char}_death`, { start: 0, end: 5 }),
                frameRate: 8
            });

            // Attack combo
            this.anims.create({
                key: `${char}_attack_1`,
                frames: this.anims.generateFrameNumbers(`${char}_attack`, { start: 0, end: 3 }),
                frameRate: 14
            });

            this.anims.create({
                key: `${char}_attack_2`,
                frames: this.anims.generateFrameNumbers(`${char}_attack`, { start: 4, end: 7 }),
                frameRate: 16
            });

            this.anims.create({
                key: `${char}_attack_3`,
                frames: this.anims.generateFrameNumbers(`${char}_attack`, { start: 8, end: 11 }),
                frameRate: 18
            });

            // Blink
            this.anims.create({
                key: `${char}_blink_anim`,
                frames: this.anims.generateFrameNumbers(`${char}_blink`, { start: 0, end: 3 }),
                frameRate: 6
            });

            // Taunt
            this.anims.create({
                key: `${char}_taunt_anim`,
                frames: this.anims.generateFrameNumbers(`${char}_taunt`, { start: 0, end: 5 }),
                frameRate: 8
            });

            // ✅ Preview — idle frames + blink frames combined
            this.anims.create({
                key: `${char}_preview`,
                frames: [
                    // Idle frames (longer, main pose)
                    ...this.anims.generateFrameNumbers(`${char}_idle`, { start: 0, end: 11 }),
                    ...this.anims.generateFrameNumbers(`${char}_idle`, { start: 0, end: 11 }),
                    // Blink
                    ...this.anims.generateFrameNumbers(`${char}_blink`, { start: 0, end: 3 }),
                    // Back to idle
                    ...this.anims.generateFrameNumbers(`${char}_idle`, { start: 0, end: 11 }),
                ],
                frameRate: 6,
                repeat: -1
            });
        });

        console.log('✅ All assets loaded and animations created');

        this.scene.start('MenuScene');
    }
}