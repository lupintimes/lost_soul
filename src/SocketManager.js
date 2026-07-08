import geckos from '@geckos.io/client';

const SocketManager = {
    socket: null,
    geckosChannel: null,
    roomId: null,

    connect(url) {
        if (!url) {
            url = 'https://lost-soul-server.onrender.com';
        }

        if (this.socket && this.socket.connected) {
            console.log('♻️ Reusing existing socket:', this.socket.id);
            return this.socket;
        }

        // ✅ If socket exists but disconnected, clean it up
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket = null;
        }

        console.log('🔌 Connecting to socket server at:', url);
        this.socket = io(url);

        this.socket.on('connect', () => {
            console.log('✅ SocketManager connected:', this.socket.id);
            // If Geckos connects later/earlier, sync room
            if (this.geckosChannel && this.roomId) {
                this.geckosChannel.emit('joinRoom', { roomId: this.roomId, playerId: this.socket.id });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('❌ SocketManager disconnected');
        });

        return this.socket;
    },

    connectGeckos(url) {
        if (this.geckosChannel) {
            // Already connected/connecting, just return it
            return this.geckosChannel;
        }

        let host = 'http://192.168.1.4';
        if (url) {
            try {
                const parsed = new URL(url);
                host = `${parsed.protocol}//${parsed.hostname}`;
            } catch (e) {
                host = url;
            }
        } else {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '192.168.1.4' || window.location.protocol === 'file:';
            host = isLocal ? 'http://192.168.1.4' : 'https://lost-soul-server.onrender.com';
        }

        console.log('🔌 Connecting Geckos WebRTC UDP to:', host, 'on port 9208');
        this.geckosChannel = geckos({
            url: host,
            port: 9208
        });
        this.geckosChannel.isConnected = false;

        this.geckosChannel.onConnect(error => {
            if (error) {
                console.error('❌ Geckos connection error:', error.message);
                if (this.geckosChannel) {
                    this.geckosChannel.isConnected = false;
                }
                return;
            }
            console.log('✅ Geckos connected:', this.geckosChannel.id);
            if (this.geckosChannel) {
                this.geckosChannel.isConnected = true;
            }
            if (this.roomId && this.socket) {
                this.geckosChannel.emit('joinRoom', { roomId: this.roomId, playerId: this.socket.id });
            }
        });

        this.geckosChannel.onDisconnect(() => {
            console.log('❌ Geckos disconnected');
            if (this.geckosChannel) {
                this.geckosChannel.isConnected = false;
            }
        });

        return this.geckosChannel;
    },

    disconnect() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        if (this.geckosChannel) {
            this.geckosChannel.isConnected = false;
            this.geckosChannel.close();
            this.geckosChannel = null;
        }
        this.roomId = null;
    },

    get() {
        return this.socket;
    },

    getGeckos() {
        return this.geckosChannel;
    },

    setRoom(roomId) {
        this.roomId = roomId;
        if (this.geckosChannel && this.socket && this.socket.connected) {
            this.geckosChannel.emit('joinRoom', { roomId, playerId: this.socket.id });
        }
    },

    getRoom() {
        return this.roomId;
    }
};

export default SocketManager;
