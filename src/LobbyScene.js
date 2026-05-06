export default class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
        this.socket = null;
        this.serverList = [];
        this.serverListElements = [];
    }

    preload() {
        this.load.image('menu_bg', '../assets/background.png');
    }

    create() {
        const { width, height } = this.scale;

        // ─── Background ───────────────────────────────────
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0);

        // ─── Title ────────────────────────────────────────
        this.add.text(width / 2, 30, 'MULTIPLAYER LOBBY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ─── Back Button (top-left) ──────────────────────
        const backBtn = this.add.text(20, 20, '← BACK', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            color: '#ff4444',
            backgroundColor: '#222',
            padding: { x: 10, y: 6 }
        })
        .setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => {
            backBtn.setStyle({ backgroundColor: '#555' });
            backBtn.setScale(1.05);
        });
        backBtn.on('pointerout', () => {
            backBtn.setStyle({ backgroundColor: '#222' });
            backBtn.setScale(1);
        });
        backBtn.on('pointerdown', () => {
            this.cleanup();
            this.scene.start('MenuScene');
        });

        // ─── Layout: Left Panel (Server List) ────────────
        const panelLeft = {
            x: 30,
            y: 70,
            w: width * 0.6,
            h: height - 100
        };

        this.add.rectangle(
            panelLeft.x, panelLeft.y,
            panelLeft.w, panelLeft.h,
            0x111111, 0.8
        ).setOrigin(0);

        this.add.text(panelLeft.x + 15, panelLeft.y + 12, 'AVAILABLE SERVERS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            color: '#aaaaaa'
        });

        const headerY = panelLeft.y + 40;
        this.add.text(panelLeft.x + 15, headerY, 'NAME', {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#666666'
        });
        this.add.text(panelLeft.x + panelLeft.w * 0.5, headerY, 'PLAYERS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#666666'
        });
        this.add.text(panelLeft.x + panelLeft.w * 0.75, headerY, 'STATUS', {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#666666'
        });

        this.add.rectangle(
            panelLeft.x + 10, headerY + 18,
            panelLeft.w - 20, 1,
            0x333333
        ).setOrigin(0);

        this.listConfig = {
            x: panelLeft.x,
            startY: headerY + 30,
            w: panelLeft.w,
            rowH: 36
        };

        this.loadingText = this.add.text(
            panelLeft.x + panelLeft.w / 2,
            this.listConfig.startY + 60,
            'Connecting...',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '10px',
                color: '#555555'
            }
        ).setOrigin(0.5);

        // ─── Layout: Right Panel (Create Server) ─────────
        const panelRight = {
            x: panelLeft.x + panelLeft.w + 20,
            y: 70,
            w: width - (panelLeft.x + panelLeft.w + 20) - 30,
            h: height - 100
        };

        this.add.rectangle(
            panelRight.x, panelRight.y,
            panelRight.w, panelRight.h,
            0x111111, 0.8
        ).setOrigin(0);

        this.add.text(
            panelRight.x + panelRight.w / 2,
            panelRight.y + 20,
            'CREATE\nSERVER',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '12px',
                color: '#aaaaaa',
                align: 'center'
            }
        ).setOrigin(0.5, 0);

        // ── Server Name Input ─────────────────────────────
        this.add.text(panelRight.x + 15, panelRight.y + 80, 'SERVER NAME:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#888888'
        });

        const inputBg = this.add.rectangle(
            panelRight.x + 15,
            panelRight.y + 100,
            panelRight.w - 30,
            30,
            0x222222
        ).setOrigin(0).setStrokeStyle(1, 0x444444);

        this.serverNameValue = 'My Server';

        this.serverNameText = this.add.text(
            panelRight.x + 22,
            panelRight.y + 107,
            this.serverNameValue,
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '9px',
                color: '#ffffff'
            }
        );

        inputBg.setInteractive({ useHandCursor: true });
        inputBg.on('pointerdown', () => {
            const name = prompt('Enter server name:', this.serverNameValue);
            if (name && name.trim().length > 0) {
                this.serverNameValue = name.trim().substring(0, 20);
                this.serverNameText.setText(this.serverNameValue);
            }
        });

        // ── Max Players Selector ──────────────────────────
        this.add.text(panelRight.x + 15, panelRight.y + 150, 'MAX PLAYERS:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#888888'
        });

        // ✅ Default set to 4, min 1, max 10
        this.maxPlayers = 4;

        const minusBtn = this.add.text(
            panelRight.x + 15,
            panelRight.y + 172,
            ' - ',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#333',
                padding: { x: 6, y: 4 }
            }
        )
        .setInteractive({ useHandCursor: true });

        this.maxPlayersText = this.add.text(
            panelRight.x + 65,
            panelRight.y + 175,
            String(this.maxPlayers),
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '12px',
                color: '#ffffff'
            }
        );

        const plusBtn = this.add.text(
            panelRight.x + 95,
            panelRight.y + 172,
            ' + ',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#333',
                padding: { x: 6, y: 4 }
            }
        )
        .setInteractive({ useHandCursor: true });

        // ✅ Min = 1, Max = 10
        minusBtn.on('pointerdown', () => {
            if (this.maxPlayers > 1) {
                this.maxPlayers--;
                this.maxPlayersText.setText(String(this.maxPlayers));
            }
        });

        plusBtn.on('pointerdown', () => {
            if (this.maxPlayers < 10) {
                this.maxPlayers++;
                this.maxPlayersText.setText(String(this.maxPlayers));
            }
        });

        [minusBtn, plusBtn].forEach(btn => {
            btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
            btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#333' }));
        });

        // ── CREATE Button ─────────────────────────────────
        const createBtn = this.add.text(
            panelRight.x + panelRight.w / 2,
            panelRight.y + panelRight.h - 60,
            'CREATE',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#228B22',
                padding: { x: 20, y: 12 }
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        createBtn.on('pointerover', () => {
            createBtn.setStyle({ backgroundColor: '#32CD32' });
            createBtn.setScale(1.05);
        });

        createBtn.on('pointerout', () => {
            createBtn.setStyle({ backgroundColor: '#228B22' });
            createBtn.setScale(1);
        });

        createBtn.on('pointerdown', () => {
            this.createServer();
        });

        // ── Refresh Button ───────────────────────────────
        const refreshBtn = this.add.text(
            panelLeft.x + panelLeft.w / 2,
            panelLeft.y + panelLeft.h - 25,
            '↻ REFRESH',
            {
                fontFamily: '"Press Start 2P"',
                fontSize: '9px',
                color: '#4488ff',
                backgroundColor: '#1a1a1a',
                padding: { x: 10, y: 6 }
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        refreshBtn.on('pointerover', () => {
            refreshBtn.setStyle({ backgroundColor: '#333' });
            refreshBtn.setScale(1.05);
        });
        refreshBtn.on('pointerout', () => {
            refreshBtn.setStyle({ backgroundColor: '#1a1a1a' });
            refreshBtn.setScale(1);
        });
        refreshBtn.on('pointerdown', () => {
            this.requestServerList();
        });

        // ─── Connect to Socket.io ────────────────────────
        this.connectToLobby();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  SOCKET.IO — LOBBY CONNECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    connectToLobby() {
        this.socket = io('http://localhost:8081');

        this.socket.on('connect', () => {
            console.log('✅ Connected to lobby server:', this.socket.id);
            this.requestServerList();
        });

        // Server pushes updated list (on create/join/leave/disconnect)
        this.socket.on('serverList', (servers) => {
            console.log('📋 Server list received:', servers);
            this.serverList = servers;
            this.renderServerList();
        });

        this.socket.on('serverCreated', (serverData) => {
            console.log('🎮 Server created, joining game:', serverData);
            this.scene.start('GameScene', {
                mode: 'multiplayer',
                roomId: serverData.roomId,
                socket: this.socket
            });
        });

        this.socket.on('joinedServer', (serverData) => {
            console.log('🎮 Joined server:', serverData);
            this.scene.start('GameScene', {
                mode: 'multiplayer',
                roomId: serverData.roomId,
                socket: this.socket
            });
        });

        this.socket.on('lobbyError', (msg) => {
            console.warn('⚠️ Lobby error:', msg);
            alert(msg);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from lobby');
        });
    }

    requestServerList() {
        if (this.loadingText) {
            this.loadingText.setText('Refreshing...');
            this.loadingText.setVisible(true);
        }
        this.socket.emit('getServers');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER THE SERVER LIST
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderServerList() {
        this.serverListElements.forEach(el => el.destroy());
        this.serverListElements = [];

        const { x, startY, w, rowH } = this.listConfig;

        if (this.loadingText) this.loadingText.setVisible(false);

        if (!this.serverList || this.serverList.length === 0) {
            const noServers = this.add.text(
                x + w / 2,
                startY + 60,
                'No servers found.\nCreate one!',
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '9px',
                    color: '#555555',
                    align: 'center'
                }
            ).setOrigin(0.5);
            this.serverListElements.push(noServers);
            return;
        }

        this.serverList.forEach((server, index) => {
            const rowY = startY + index * rowH;

            const rowBg = this.add.rectangle(
                x + 5, rowY,
                w - 10, rowH - 4,
                index % 2 === 0 ? 0x1a1a1a : 0x1f1f1f
            )
            .setOrigin(0)
            .setInteractive({ useHandCursor: true });

            const nameText = this.add.text(
                x + 15, rowY + 10,
                server.name || 'Unnamed',
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '9px',
                    color: '#ffffff'
                }
            );

            const isFull = server.players >= server.maxPlayers;
            const playersText = this.add.text(
                x + w * 0.5, rowY + 10,
                `${server.players}/${server.maxPlayers}`,
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '9px',
                    color: isFull ? '#ff4444' : '#44ff44'
                }
            );

            const statusLabel = isFull ? 'FULL' : 'OPEN';
            const statusColor = isFull ? '#ff4444' : '#44ff44';
            const statusText = this.add.text(
                x + w * 0.75, rowY + 10,
                statusLabel,
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '9px',
                    color: statusColor
                }
            );

            rowBg.on('pointerover', () => {
                rowBg.setFillStyle(0x333333);
                nameText.setColor('#ffff00');
            });

            rowBg.on('pointerout', () => {
                rowBg.setFillStyle(index % 2 === 0 ? 0x1a1a1a : 0x1f1f1f);
                nameText.setColor('#ffffff');
            });

            rowBg.on('pointerdown', () => {
                if (isFull) {
                    alert('Server is full!');
                    return;
                }
                this.joinServer(server.roomId);
            });

            this.serverListElements.push(rowBg, nameText, playersText, statusText);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ACTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createServer() {
        if (!this.socket || !this.socket.connected) {
            alert('Not connected to server!');
            return;
        }

        this.socket.emit('createServer', {
            name: this.serverNameValue,
            maxPlayers: this.maxPlayers
        });
    }

    joinServer(roomId) {
        if (!this.socket || !this.socket.connected) {
            alert('Not connected to server!');
            return;
        }

        this.socket.emit('joinServer', { roomId });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  CLEANUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    cleanup() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.serverList = [];
        this.serverListElements = [];
    }
}