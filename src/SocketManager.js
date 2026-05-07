const SocketManager = {
    socket: null,
    roomId: null,

    connect(url = 'http://localhost:8081') {
        if (this.socket && this.socket.connected) {
            console.log('♻️ Reusing existing socket:', this.socket.id);
            return this.socket;
        }

        // ✅ If socket exists but disconnected, clean it up
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket = null;
        }

        this.socket = io(url);

        this.socket.on('connect', () => {
            console.log('✅ SocketManager connected:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ SocketManager disconnected');
        });

        return this.socket;
    },

    disconnect() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.roomId = null;
    },

    get() {
        return this.socket;
    },

    setRoom(roomId) {
        this.roomId = roomId;
    },

    getRoom() {
        return this.roomId;
    }
};

export default SocketManager;