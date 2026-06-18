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

        this.load.image('bg', '../assets/background.webp');
        this.load.tilemapTiledJSON('map', '../assets/map.json');
        // Load all portal variants
        this.load.image('portal_gold', '../assets/portal/gold_portal.webp');
        this.load.image('portal_gray', '../assets/portal/gray_portal.webp');
        this.load.image('portal_pink', '../assets/portal/pink_portal.webp');
        this.load.image('portal_purple', '../assets/portal/purple_portal.webp');
        this.load.image('portal_teal', '../assets/portal/teal_portal.webp');
        this.load.image('discord', '../assets/ui/discord.png');
        this.load.image('x_icon', '../assets/ui/x.png');


        //ADUIO

        this.load.binary('sfx_click_bin', '../assets/audio/click.mp3_');

        this.load.binary('sfx_attack1_bin', '../assets/audio/attack1.mp3_');
        this.load.binary('sfx_attack2_bin', '../assets/audio/attack2.mp3_');

        this.load.binary('sfx_hurt_bin', '../assets/audio/hurt.mp3_');
        this.load.binary('sfx_death_bin', '../assets/audio/death.mp3_');
        this.load.binary('sfx_dash_bin', '../assets/audio/dash.mp3_');
        this.load.binary('sfx_spell_bin', '../assets/audio/spell.mp3_');
        this.load.binary('sfx_highjump_bin', '../assets/audio/highjump.mp3_');

        // New block sound effects (loaded as binary to prevent IDM interception)
        this.load.binary('sfx_bubble_jump_bin', '../assets/audio/bubble_jump.ogg_');
        this.load.binary('sfx_bubble_break_bin', '../assets/audio/buble_break.ogg_');
        this.load.binary('sfx_ice_break_bin', '../assets/audio/ice_break.ogg_');

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
        this.cameras.main.setRoundPixels(true);
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

        console.log('✅ All assets loaded and animations created. Decoding audio...');

        const audioKeys = [
            'sfx_click', 'sfx_attack1', 'sfx_attack2', 'sfx_hurt', 'sfx_death', 'sfx_dash', 'sfx_spell', 'sfx_highjump',
            'sfx_bubble_jump', 'sfx_bubble_break', 'sfx_ice_break'
        ];
        
        // Count how many keys we expect to decode
        let decodedCount = 0;
        const totalToDecode = audioKeys.length;

        const checkTransition = () => {
            if (decodedCount >= totalToDecode) {
                console.log('✅ All assets loaded, audio decoded, and animations created');
                this.scene.start('MenuScene');
            }
        };

        this.sound.on('decoded', (key) => {
            if (audioKeys.includes(key)) {
                decodedCount++;
                checkTransition();
            }
        });

        // Start decoding
        audioKeys.forEach(key => {
            try {
                const buffer = this.cache.binary.get(key + '_bin');
                if (buffer) {
                    this.sound.decodeAudio(key, buffer);
                } else {
                    console.warn(`⚠️ Missing binary buffer for: ${key}`);
                    decodedCount++;
                    checkTransition();
                }
            } catch (err) {
                console.error(`❌ Error decoding audio: ${key}`, err);
                decodedCount++;
                checkTransition();
            }
        });

        // Fallback: if sound manager doesn't use Web Audio or decodeAudio doesn't trigger, 
        // transition after a timeout or if decodeAudio is not supported
        if (!this.sound.decodeAudio || !this.sound.context) {
            console.log('⚠️ Web Audio not supported or decodeAudio unavailable, skipping decoding wait');
            this.scene.start('MenuScene');
        } else {
            // Also add a safety timeout (e.g., 2.5 seconds) in case of decoding errors
            this.time.delayedCall(2500, () => {
                if (decodedCount < totalToDecode) {
                    console.warn('⚠️ Audio decoding timed out for some sounds, transitioning anyway...');
                    this.scene.start('MenuScene');
                }
            });
        }
    }
}