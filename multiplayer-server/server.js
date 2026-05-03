// @ts-nocheck

const http = require("http");
const express = require("express");
const { Server, Room } = require("colyseus");

const app = express();
const server = http.createServer(app);

// optional (fixes CORS issues)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

class GameRoom extends Room {

    onCreate() {
        this.maxClients = 10;

        const code = Math.floor(100000 + Math.random() * 900000);
        this.setMetadata({ code });

        this.players = {};

        console.log("Room created:", code);

        // ✅ MOVE HANDLERS HERE
        this.onMessage("move", (client, data) => {
            if (this.players[client.sessionId]) {
                this.players[client.sessionId].x = data.x;
                this.players[client.sessionId].y = data.y;
            }
        });

        this.onMessage("sync", (client) => {
            client.send("state", this.players);
        });
    }

    onJoin(client, options) {
        this.players[client.sessionId] = {
            x: 0,
            y: 0,
            alias: options.alias || "Player"
        };

        console.log("Player joined:", client.sessionId);
    }

    onLeave(client) {
        delete this.players[client.sessionId];
    }
}

const gameServer = new Server({ server });

gameServer.define("battle", GameRoom);

const PORT = process.env.PORT || 2567;
gameServer.listen(PORT);

console.log("Server running on port:", PORT);