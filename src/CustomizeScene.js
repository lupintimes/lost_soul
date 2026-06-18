import PlayerData from './PlayerData.js';

export default class CustomizeScene extends Phaser.Scene {
    constructor() {
        super('CustomizeScene');
        this.activeTab = 'character';
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

        // Initialize graphics for glass panels
        this.customGraphics = this.add.graphics().setDepth(1);

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

        // 🖼️ Background
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

        // 🏷️ Title
        this.add.text(width / 2, 20, 'CUSTOMIZE', {
            fontFamily: '"Silkscreen"',
            fontSize: '26px',
            color: '#00ffcc'
        })
            .setOrigin(0.5)
            .setShadow(2, 2, '#000000', 4);

        // ← BACK button (Sleek red neon pill button)
        const backBtnText = this.add.text(60, 25, '← BACK', {
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
            color: '#ff4444'
        })
            .setOrigin(0.5)
            .setDepth(3)
            .setShadow(1, 1, '#000000', 2);

        const backGraphics = this.add.graphics().setDepth(2);
        const drawBackBtn = (isHover) => {
            backGraphics.clear();
            backGraphics.fillStyle(isHover ? 0x2e1414 : 0x190a0a, 0.85);
            backGraphics.fillRoundedRect(20, 10, 80, 30, 4);
            backGraphics.lineStyle(1.5, isHover ? 0xff4444 : 0x882222, 0.85);
            backGraphics.strokeRoundedRect(20, 10, 80, 30, 4);
        };
        drawBackBtn(false);

        const backHitbox = this.add.rectangle(60, 25, 80, 30, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);

        backHitbox.on('pointerover', () => {
            drawBackBtn(true);
            backBtnText.setScale(1.05);
        });
        backHitbox.on('pointerout', () => {
            drawBackBtn(false);
            backBtnText.setScale(1);
        });
        backHitbox.on('pointerdown', () => {
            this.playClick(); 
            this.scene.start('MenuScene');
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LEFT SIDE — CHARACTER PREVIEW CARD
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const previewX = width * 0.2;
        const previewY = height * 0.5;

        // Preview border color matches character's color theme
        const charColorMap = { p1: 0x4488ff, p2: 0x9944ff, p3: 0xff4444 };
        const previewStroke = charColorMap[PlayerData.character] || 0x00e5ff;

        drawGlassPanel(this.customGraphics, previewX - 90, previewY - 150, 180, 310, previewStroke, 8);

        this.add.text(previewX, previewY - 130, 'PREVIEW', {
            fontFamily: '"Silkscreen"',
            fontSize: '11px',
            color: '#888888'
        })
            .setOrigin(0.5)
            .setDepth(2)
            .setShadow(1, 1, '#000000', 2);

        // Character preview sprite
        this.previewSprite = this.add.sprite(previewX, previewY - 20, `${PlayerData.character}_idle`)
            .setDepth(2);
        this.previewSprite.setScale(0.45);
        this.previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        const tint = PlayerData.getColorTint();
        if (tint) this.previewSprite.setTint(tint);

        // Info labels
        this.charLabel = this.add.text(previewX, previewY + 80, PlayerData.getCharacterInfo().name, {
            fontFamily: '"Silkscreen"',
            fontSize: '14px',
            color: '#ffffff'
        })
            .setOrigin(0.5)
            .setDepth(2)
            .setShadow(1.5, 1.5, '#000000', 3);

        this.colorLabel = this.add.text(previewX, previewY + 105, `COLOR: ${PlayerData.color.toUpperCase()}`, {
            fontFamily: '"Silkscreen"',
            fontSize: '10px',
            color: '#888888'
        })
            .setOrigin(0.5)
            .setDepth(2)
            .setShadow(1, 1, '#000000', 2);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  RIGHT SIDE — TABS + OPTIONS CONTAINER
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const panelX = width * 0.42;
        const panelY = 50;
        const panelW = width * 0.53;
        const panelH = height - 70;

        // Draw Right glass card panel (Silver/Cyan border)
        drawGlassPanel(this.customGraphics, panelX, panelY, panelW, panelH, 0x00ffcc, 8);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  TABS — CHARACTER, COLOR, INSTRUCTIONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const tabs = ['CHARACTER', 'COLOR', 'INSTRUCTIONS'];
        const tabKeys = ['character', 'color', 'instructions'];
        const tabW = panelW / tabs.length;

        this.tabButtons = [];
        this.tabGraphics = this.add.graphics().setDepth(2);

        const drawTabButton = (index, isActive, isHover) => {
            const tx = panelX + index * tabW;
            const ty = panelY + 5;
            const tw = tabW - 4;
            const th = 34;

            // Draw a rounded glass tab bar button
            this.tabGraphics.fillStyle(isActive ? 0x223344 : (isHover ? 0x1c2333 : 0x0a101d), 0.9);
            this.tabGraphics.fillRoundedRect(tx + 2, ty, tw, th, 4);
            this.tabGraphics.lineStyle(1.5, isActive ? 0x00ffcc : (isHover ? 0x475569 : 0x2a3649), 0.85);
            this.tabGraphics.strokeRoundedRect(tx + 2, ty, tw, th, 4);
        };

        const redrawTabs = () => {
            this.tabGraphics.clear();
            tabKeys.forEach((key, idx) => {
                drawTabButton(idx, key === this.activeTab, false);
            });
        };
        redrawTabs();

        tabs.forEach((tabName, i) => {
            const tx = panelX + i * tabW + tabW / 2;
            const ty = panelY + 22;
            const isActive = tabKeys[i] === this.activeTab;

            const tabBtnText = this.add.text(tx, ty, tabName, {
                fontFamily: '"Silkscreen"',
                fontSize: '11px',
                color: isActive ? '#00ffcc' : '#666666'
            })
                .setOrigin(0.5)
                .setDepth(3)
                .setShadow(1, 1, '#000000', 2);

            const tabHitbox = this.add.rectangle(tx, ty, tabW - 4, 34, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(4);

            tabHitbox.tabKey = tabKeys[i];
            tabHitbox.tabIndex = i;

            tabHitbox.on('pointerover', () => {
                if (this.activeTab !== tabHitbox.tabKey) {
                    drawTabButton(tabHitbox.tabIndex, false, true);
                    tabBtnText.setColor('#ffffff');
                }
            });

            tabHitbox.on('pointerout', () => {
                if (this.activeTab !== tabHitbox.tabKey) {
                    drawTabButton(tabHitbox.tabIndex, false, false);
                    tabBtnText.setColor('#666666');
                }
            });

            tabHitbox.on('pointerdown', () => {
                this.playClick(); 
                this.activeTab = tabHitbox.tabKey;
                this.renderOptions();
                redrawTabs();

                this.tabButtons.forEach(tb => {
                    if (tb.textObj.tabKey === this.activeTab) {
                        tb.textObj.setColor('#00ffcc');
                    } else {
                        tb.textObj.setColor('#666666');
                    }
                });
            });

            tabBtnText.tabKey = tabKeys[i];
            this.tabButtons.push({ hitBox: tabHitbox, textObj: tabBtnText });
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  OPTIONS CONTAINER
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        this.optionsConfig = {
            x: panelX + 15,
            y: panelY + 50,
            w: panelW - 30,
            itemH: 50
        };

        this.optionElements = [];

        this.renderOptions();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER OPTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderOptions() {
        if (this.instrWheelListener) {
            this.input.off('wheel', this.instrWheelListener);
            this.instrWheelListener = null;
        }

        this.optionElements.forEach(el => el.destroy());
        this.optionElements = [];

        const { x, y, w, itemH } = this.optionsConfig;

        let items = [];
        let currentSelection = '';

        switch (this.activeTab) {
            case 'character':
                items = PlayerData.characters;
                currentSelection = PlayerData.character;
                break;
            case 'color':
                items = PlayerData.colors;
                currentSelection = PlayerData.color;
                break;
            case 'instructions':
                this.renderInstructions();
                return;
        }

        items.forEach((item, index) => {
            const iy = y + index * itemH;
            const isSelected = item.id === currentSelection;

            // Draw a rounded glass selection item card
            const itemBgGraphics = this.add.graphics().setDepth(2);
            this.optionElements.push(itemBgGraphics);

            const drawItemBg = (isHover) => {
                itemBgGraphics.clear();
                // Drop shadow
                itemBgGraphics.fillStyle(0x000000, 0.2);
                itemBgGraphics.fillRoundedRect(x + 2, iy + 2, w, itemH - 5, 6);
                // Glass background
                itemBgGraphics.fillStyle(isSelected ? 0x142017 : (isHover ? 0x222230 : 0x0c1322), 0.9);
                itemBgGraphics.fillRoundedRect(x, iy, w, itemH - 5, 6);
                // Outline
                const strokeCol = isSelected ? 0x44ff44 : (isHover ? 0x00ffff : 0x2e3c54);
                const strokeW = isSelected ? 2 : 1;
                itemBgGraphics.lineStyle(strokeW, strokeCol, 0.85);
                itemBgGraphics.strokeRoundedRect(x, iy, w, itemH - 5, 6);
            };
            drawItemBg(false);

            const itemHitbox = this.add.rectangle(x + w / 2, iy + (itemH - 5) / 2, w, itemH - 5, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(4);
            this.optionElements.push(itemHitbox);

            // Color indicator dot
            const dotColor = item.color || item.tint || 0x888888;
            const dot = this.add.circle(x + 20, iy + (itemH - 5) / 2, 8, dotColor).setDepth(3);
            this.optionElements.push(dot);

            // Item name
            const nameText = this.add.text(x + 40, iy + 6, item.name, {
                fontFamily: '"Silkscreen"',
                fontSize: '13px',
                color: isSelected ? '#44ff44' : '#ffffff'
            })
                .setDepth(3)
                .setShadow(1, 1, '#000000', 2);
            this.optionElements.push(nameText);

            // Description (for characters)
            if (item.desc) {
                const descText = this.add.text(x + 40, iy + 26, item.desc, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '10px',
                    color: '#888888'
                })
                    .setDepth(3)
                    .setShadow(1, 1, '#000000', 1);
                this.optionElements.push(descText);
            }

            // Selected checkmark
            if (isSelected) {
                const check = this.add.text(x + w - 30, iy + (itemH - 5) / 2 - 8, '✓', {
                    fontFamily: '"Silkscreen"',
                    fontSize: '18px',
                    color: '#44ff44'
                })
                    .setDepth(3)
                    .setShadow(1, 1, '#000000', 2);
                this.optionElements.push(check);
            }

            // Character preview sprite (only for character tab)
            if (this.activeTab === 'character') {
                const miniSprite = this.add.sprite(x + w - 70, iy + (itemH - 5) / 2, `${item.id}_idle`)
                    .setDepth(3);
                miniSprite.setScale(0.15);
                miniSprite.anims.play(`${item.id}_preview`, true);
                this.optionElements.push(miniSprite);
            }

            // Color preview box (only for color tab)
            if (this.activeTab === 'color') {
                const previewBox = this.add.rectangle(
                    x + w - 70,
                    iy + (itemH - 5) / 2,
                    28, 28,
                    item.tint || 0xffffff
                )
                    .setStrokeStyle(1.5, 0x556677)
                    .setDepth(3);
                this.optionElements.push(previewBox);
            }

            // Hover interactions
            itemHitbox.on('pointerover', () => {
                drawItemBg(true);
                if (!isSelected) {
                    nameText.setColor('#ffff00');
                }
            });

            itemHitbox.on('pointerout', () => {
                drawItemBg(false);
                if (!isSelected) {
                    nameText.setColor('#ffffff');
                }
            });

            // Click to select
            itemHitbox.on('pointerdown', () => {
                this.playClick(); 
                switch (this.activeTab) {
                    case 'character':
                        PlayerData.setCharacter(item.id);
                        break;
                    case 'color':
                        PlayerData.setColor(item.id);
                        break;
                }

                console.log(`✅ ${this.activeTab} set to: ${item.id}`);

                this.updatePreview();
                this.renderOptions();
            });
        });

        // ── Character Ability Card (only in character tab) ───────
        if (this.activeTab === 'character') {
            const abilityData = {
                p1: {
                    label: 'KNIGHT',
                    color: 0x4488ff,
                    hp: 130,
                    lines: [
                        'R  — SHIELD BLOCK',
                        '       2s full immunity, repels nearby foes.',
                        '       4s cooldown.',
                        'T  — FORTRESS TAUNT',
                        '       5s / 50% damage reduction.',
                        '       Silhouette aura glow. 15s cooldown.',
                    ]
                },
                p2: {
                    label: 'SHADOW',
                    color: 0x9944ff,
                    hp: 100,
                    lines: [
                        'SHIFT  — DOUBLE DASH  (2 charges, 0.7s regen)',
                        'W x2   — DOUBLE JUMP  (mid-air)',
                        'R      — PHANTOM ORB',
                        '         Large (r=22), 1.8× speed orange orb.',
                        '         Orange trail particles follow it.',
                    ]
                },
                p3: {
                    label: 'BERSERKER',
                    color: 0xff4444,
                    hp: 100,
                    lines: [
                        'AUTO  — RAGE MODE  (≤ 30% HP)',
                        '        Speed +30%  •  Damage +50%',
                        '        Red pulsing tint, larger sprite.',
                        'AUTO  — UNDYING RAGE  (1st fatal hit)',
                        '        Restores FULL HP, activates permanent',
                        '        rage. HP drains slowly over time.',
                    ]
                }
            };

            const sel = PlayerData.character;
            const data = abilityData[sel];

            if (data) {
                const cardY = y + items.length * itemH + 10;
                const lineH = 18;
                const cardH = 22 + data.lines.length * lineH + 10;
                const hexCol = '#' + data.color.toString(16).padStart(6, '0');

                // Card background graphics (glassmorphic style)
                const cardGraphics = this.add.graphics().setDepth(2);
                this.optionElements.push(cardGraphics);

                // Shadow
                cardGraphics.fillStyle(0x000000, 0.2);
                cardGraphics.fillRoundedRect(x + 2, cardY + 2, w, cardH, 8);
                // Glass background
                cardGraphics.fillStyle(0x0a0f1d, 0.95);
                cardGraphics.fillRoundedRect(x, cardY, w, cardH, 8);
                // Header highlight
                cardGraphics.fillStyle(data.color, 0.15);
                cardGraphics.fillRoundedRect(x, cardY, w, 22, { tl: 8, tr: 8, bl: 0, br: 0 });
                // Neon outline
                cardGraphics.lineStyle(1.5, data.color, 0.85);
                cardGraphics.strokeRoundedRect(x, cardY, w, cardH, 8);

                // Character name + HP badge
                const nameT = this.add.text(x + 10, cardY + 4, `${data.label}  ABILITIES`, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '11px',
                    color: hexCol
                })
                    .setDepth(3)
                    .setShadow(1, 1, '#000000', 2);
                this.optionElements.push(nameT);

                const hpT = this.add.text(x + w - 10, cardY + 4, `HP  ${data.hp}`, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '11px',
                    color: '#44ff44'
                })
                    .setDepth(3)
                    .setOrigin(1, 0)
                    .setShadow(1, 1, '#000000', 2);
                this.optionElements.push(hpT);

                // Ability lines
                data.lines.forEach((line, li) => {
                    const isKey = !line.startsWith(' ');
                    const lt = this.add.text(x + 12, cardY + 28 + li * lineH, line, {
                        fontFamily: '"Silkscreen"',
                        fontSize: '11px',
                        color: isKey ? '#ffffff' : '#888888'
                    })
                        .setDepth(3)
                        .setShadow(1, 1, '#000000', 1);
                    this.optionElements.push(lt);
                });
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER INSTRUCTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderInstructions() {
        const { x, y, w } = this.optionsConfig;

        // Define viewport dimensions for masking/scrollbar
        const panelX = this.scale.width * 0.42;
        const panelY = 50;
        const panelW = this.scale.width * 0.53;
        const panelH = this.scale.height - 70;

        const maskX = panelX + 10;
        const maskY = panelY + 50;
        const maskW = panelW - 20;
        const maskH = panelH - 80;

        // 1. Create a container for the instructions
        this.instrContainer = this.add.container(0, 0);
        this.optionElements.push(this.instrContainer);

        // 2. Create the scroll viewport mask
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(maskX, maskY, maskW, maskH);
        const mask = maskShape.createGeometryMask();
        this.instrContainer.setMask(mask);
        this.optionElements.push(maskShape);

        // Render relative to coordinates starting at maskY
        let curY = maskY;

        const addSection = (title, color, lines) => {
            const hexColor = '#' + color.toString(16).padStart(6, '0');

            // Draw a rounded header box on a custom Graphics object
            const headerG = this.make.graphics().setDepth(2);
            headerG.fillStyle(0x0a101d, 0.9);
            headerG.fillRoundedRect(x, curY, w, 24, 4);
            headerG.lineStyle(1.5, color, 0.85);
            headerG.strokeRoundedRect(x, curY, w, 24, 4);
            this.instrContainer.add(headerG);

            const headerText = this.add.text(x + 10, curY + 5, title, {
                fontFamily: '"Silkscreen"',
                fontSize: '12px',
                color: hexColor
            })
                .setDepth(3)
                .setShadow(1, 1, '#000000', 2);
            this.instrContainer.add(headerText);

            curY += 30;

            lines.forEach(line => {
                const isBullet = line.startsWith('•');
                const lineText = this.add.text(x + (isBullet ? 14 : 8), curY, line, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '10px',
                    color: isBullet ? '#cccccc' : hexColor,
                    wordWrap: { width: w - 24 }
                })
                    .setDepth(3)
                    .setShadow(1, 1, '#000000', 1);
                this.instrContainer.add(lineText);
                curY += lineText.height + 6;
            });

            curY += 12; // gap between sections
        };

        // ── CONTROLS ───────────────────────────────────────────
        addSection('CONTROLS', 0x44aaff, [
            '• Move:        A / D',
            '• Jump:        W',
            '• High Jump:   Q  (also mid-air after normal jump)',
            '• Dash:        SHIFT',
            '• Attack:      SPACE',
            '• Spell / Ability:  R',
            '• Taunt:       T',
            '• Build Block: Left Click + Drag',
            '• Delete Block: X + Click  or  Right Click',
            '• Block Type:  1 = Normal  2 = Bounce  3 = Slide',
            '• Exit:        ESC',
        ]);

        // ── CHARACTER ABILITIES ────────────────────────────────
        addSection('CHARACTER ABILITIES', 0xffaa00, [
            '[ KNIGHT  P1 ] — HP: 130',
            '• Spell (R): Shield Block — 2s full immunity, repels foes',
            '• Taunt (T): FORTRESS — 5s  50% damage reduction',
            '               15s cooldown. Gold tint + particles.',
            '',
            '[ SHADOW  P2 ] — HP: 100',
            '• Dash (SHIFT): 2 charges, fast blink dash',
            '• Double Jump: press W again mid-air',
            '• Spell (R): Fast orange orb (r=22, speed x1.8)',
            '               Orange trail particles follow it.',
            '',
            '[ BERSERKER  P3 ] — HP: 100',
            '• Rage Mode: triggers at 30% HP — speed & damage +50%',
            '               Red pulsing tint, larger sprite, particles.',
            '• Undying Rage: first fatal hit restores FULL HP,',
            '               triggers permanent rage until HP drains.',
        ]);

        // ── BLOCK TYPES ────────────────────────────────────────
        addSection('BLOCK TYPES  (1 / 2 / 3)', 0x00e5ff, [
            '[ 1 ] NORMAL  — grey border, standard platform.',
            '[ 2 ] BOUNCE  — gold border, launches you high on contact.',
            '[ 3 ] SLIDE   — cyan border, ice friction, high speed boost.',
            '                 Momentum carries past edge briefly.',
            '',
            '• Build Points shown top-right (max 300,000).',
            '• Blocks decay after 15s (blink warning at 12s).',
            '• Placing a block over an enemy block subtracts it.',
        ]);

        // ── COMBAT TIPS ────────────────────────────────────────
        addSection('COMBAT TIPS', 0xff6688, [
            '• Spawn Protection: 2s invincibility on respawn (cyan blink).',
            '• Portals: step into glowing portals to teleport.',
            '• Enemies retreat at low HP (Shadow retreats most).',
            '• Berserker AI has shorter attack cooldown than others.',
            '• High Jump (Q) can be chained once per airtime.',
            '• Shield (Knight R) blocks 100% — but you cannot attack.',
            '• Kill enemies to rack up your kill count. Stay alive!',
        ]);

        // 3. Set up scrolling limits and scrollbar UI
        const totalHeight = curY - maskY;
        const maxScroll = Math.min(0, -(totalHeight - maskH));

        if (totalHeight > maskH) {
            // Draw Scrollbar Track
            const trackX = panelX + panelW - 12;
            const track = this.add.rectangle(trackX, maskY, 6, maskH, 0x1a1a1a).setOrigin(0).setDepth(2);
            track.setStrokeStyle(1, 0x333333);
            this.optionElements.push(track);

            // Draw Scrollbar Handle
            const handleH = Math.max(30, (maskH / totalHeight) * maskH);
            const maxHandleY = maskH - handleH;
            const handle = this.add.rectangle(trackX, maskY, 6, handleH, 0x555555).setOrigin(0).setDepth(3);
            this.optionElements.push(handle);

            // Wheel scroll handler
            const wheelListener = (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
                if (this.activeTab !== 'instructions') return;
                let targetY = this.instrContainer.y - deltaY * 0.5;
                targetY = Phaser.Math.Clamp(targetY, maxScroll, 0);
                this.instrContainer.y = targetY;

                // Update handle position
                const scrollRatio = targetY / maxScroll;
                handle.y = maskY + scrollRatio * maxHandleY;
            };
            this.input.on('wheel', wheelListener);
            this.instrWheelListener = wheelListener;

            // Handle drag behavior
            handle.setInteractive({ useHandCursor: true, draggable: true });
            handle.on('pointerover', () => handle.setFillStyle(0x777777));
            handle.on('pointerout', () => handle.setFillStyle(0x555555));

            handle.on('drag', (pointer, dragX, dragY) => {
                let localY = dragY - maskY;
                localY = Phaser.Math.Clamp(localY, 0, maxHandleY);
                handle.y = maskY + localY;

                const scrollRatio = localY / maxHandleY;
                const targetY = scrollRatio * maxScroll;
                this.instrContainer.y = targetY;
            });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  UPDATE PREVIEW
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


    updatePreview() {
        // Update sprite texture and animation
        this.previewSprite.anims.stop();
        this.previewSprite.setTexture(`${PlayerData.character}_idle`);
        this.previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        // Update tint
        const tint = PlayerData.getColorTint();
        if (tint) {
            this.previewSprite.setTint(tint);
        } else {
            this.previewSprite.clearTint();
        }

        // Update labels
        this.charLabel.setText(PlayerData.getCharacterInfo().name);
        this.colorLabel.setText(`COLOR: ${PlayerData.color.toUpperCase()}`);
    }
}