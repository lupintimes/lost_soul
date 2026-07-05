export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        const { width, height } = this.scale;

        // Load logo immediately to start the fade effect as early as possible
        this.load.image('logo', 'assets/logo.png');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LOADING BAR
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const barW = 400;
        const barH = 12;
        const barX = width / 2 - barW / 2;
        const barY = height / 2 + 50;

        // Progress bar background with border
        const progressBg = this.add.graphics();
        progressBg.fillStyle(0x0d121d, 0.8);
        progressBg.fillRoundedRect(barX, barY, barW, barH, 4);
        progressBg.lineStyle(1.5, 0x1f2b3e, 1);
        progressBg.strokeRoundedRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3, 5);

        // Progress bar graphics fill
        const progressFill = this.add.graphics();

        const percentText = this.add.text(width / 2, barY + 35, '0%', {
            fontFamily: 'Rajdhani',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Force browser to load Rajdhani font before scene transition
        this.add.text(-100, -100, 'preload_font', { fontFamily: 'Rajdhani' });

        this.logoFadeComplete = false;
        this.isLoadingComplete = false;

        // Fade in logo as soon as it's loaded in the preload queue
        this.load.on('filecomplete-image-logo', () => {
            const logoImage = this.add.image(width / 2, barY - 120, 'logo').setOrigin(0.5).setScale(0.5).setAlpha(0);
            this.tweens.add({
                targets: logoImage,
                alpha: 1,
                duration: 1800,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.logoFadeComplete = true;
                    if (this.checkTransition) this.checkTransition();
                }
            });
        });

        this.load.on('progress', (value) => {
            progressFill.clear();
            progressFill.fillStyle(0xffffff, 1); // White color matching the logo
            if (value > 0) {
                progressFill.fillRoundedRect(barX, barY, barW * value, barH, 4);
            }
            percentText.setText(Math.round(value * 100) + '%');
        });

        this.load.on('complete', () => {
            percentText.setText('100%');
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  🌍 BACKGROUNDS & UI
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        this.load.image('bg', 'assets/background/background.webp');
        this.load.image('menu_bg', 'assets/background_menu.webp');

        this.load.image('border', 'assets/border.webp');
        this.load.image('bg_red', 'assets/background/red.webp');
        this.load.image('bg_yellow', 'assets/background/yellow.webp');
        this.load.image('bg_grey', 'assets/background/grey.webp');
        this.load.image('bg_purple', 'assets/background/purple.webp');
        this.load.image('bg_green', 'assets/background/green.webp');
        this.load.tilemapTiledJSON('map', 'assets/map.json');
        // Load all portal variants
        this.load.image('portal_gold', 'assets/portal/gold_portal.webp');
        this.load.image('portal_gray', 'assets/portal/gray_portal.webp');
        this.load.image('portal_pink', 'assets/portal/pink_portal.webp');
        this.load.image('portal_purple', 'assets/portal/purple_portal.webp');
        this.load.image('portal_teal', 'assets/portal/teal_portal.webp');
        this.load.image('discord', 'assets/ui/discord.png');
        this.load.image('x_icon', 'assets/ui/x.png');


        //ADUIO

        this.load.binary('sfx_click_bin', 'assets/audio/click.mp3_');

        this.load.binary('sfx_attack1_bin', 'assets/audio/attack1.mp3_');
        this.load.binary('sfx_attack2_bin', 'assets/audio/attack2.mp3_');

        this.load.binary('sfx_hurt_bin', 'assets/audio/hurt.mp3_');
        this.load.binary('sfx_death_bin', 'assets/audio/death.mp3_');
        this.load.binary('sfx_dash_bin', 'assets/audio/dash.mp3_');
        this.load.binary('sfx_spell_bin', 'assets/audio/spell.mp3_');
        this.load.binary('sfx_highjump_bin', 'assets/audio/highjump.mp3_');

        // New block sound effects (loaded as binary to prevent IDM interception)
        this.load.binary('sfx_bubble_jump_bin', 'assets/audio/bubble_jump.ogg_');
        this.load.binary('sfx_bubble_break_bin', 'assets/audio/buble_break.ogg_');
        this.load.binary('sfx_ice_break_bin', 'assets/audio/ice_break.ogg_');
        
        // Additional generic SFX placeholders
        this.load.binary('sfx_jump_bin', 'assets/audio/jump.mp3_');
        this.load.binary('sfx_walk_bin', 'assets/audio/walk.mp3_');
        this.load.binary('sfx_land_bin', 'assets/audio/land.mp3_');
        this.load.binary('sfx_teleport_bin', 'assets/audio/teleport.mp3_');
        this.load.binary('sfx_shield_block_bin', 'assets/audio/shield_block.mp3_');
        this.load.binary('sfx_shield_break_bin', 'assets/audio/shield_break.mp3_');
        this.load.binary('sfx_block_place_bin', 'assets/audio/block_place.mp3_');
        this.load.binary('sfx_ui_hover_bin', 'assets/audio/ui_hover.mp3_');
        this.load.binary('sfx_ui_select_bin', 'assets/audio/ui_select.mp3_');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  🎭 CHARACTER SPRITESHEETS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const characters = ['p1', 'p2', 'p3'];
        const spriteConfig = { frameWidth: 520, frameHeight: 420 };

        characters.forEach(char => {
            this.load.spritesheet(`${char}_idle`, `assets/${char}/idle.png`, spriteConfig);
            this.load.spritesheet(`${char}_walk`, `assets/${char}/walk.png`, spriteConfig);
            this.load.spritesheet(`${char}_attack`, `assets/${char}/attack.png`, spriteConfig);
            this.load.spritesheet(`${char}_blink`, `assets/${char}/blink.png`, spriteConfig);
            this.load.spritesheet(`${char}_taunt`, `assets/${char}/taunt.png`, spriteConfig);
            this.load.spritesheet(`${char}_hurt`, `assets/${char}/hurt.png`, spriteConfig);
            this.load.spritesheet(`${char}_death`, `assets/${char}/death.png`, spriteConfig);
        });
    }

    create() {
        this.cameras.main.setRoundPixels(false);
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
            'sfx_bubble_jump', 'sfx_bubble_break', 'sfx_ice_break',
            'sfx_jump', 'sfx_walk', 'sfx_land', 'sfx_teleport', 'sfx_shield_block', 
            'sfx_shield_break', 'sfx_block_place', 'sfx_ui_hover', 'sfx_ui_select'
        ];
        
        // Count how many keys we expect to decode
        let decodedCount = 0;
        const totalToDecode = audioKeys.length;

        const checkTransition = () => {
            if (decodedCount >= totalToDecode) {
                this.isLoadingComplete = true;
            }
            if (this.isLoadingComplete && this.logoFadeComplete) {
                console.log('✅ All assets loaded, audio decoded, logo faded, and animations created');
                this.scene.start('MenuScene');
            }
        };
        this.checkTransition = checkTransition;

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
            this.isLoadingComplete = true;
            this.checkTransition();
        } else {
            // Also add a safety timeout (e.g., 2.5 seconds) in case of decoding errors
            this.time.delayedCall(2500, () => {
                if (decodedCount < totalToDecode) {
                    console.warn('⚠️ Audio decoding timed out for some sounds, transitioning anyway...');
                    this.isLoadingComplete = true;
                    this.checkTransition();
                }
            });
        }
    }
}
