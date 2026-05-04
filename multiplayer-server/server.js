const http = require("http");
const express = require("express");
const cors = require("cors");

const { Server, Room } = require("colyseus");
const { Schema, type, MapSchema } = require("@colyseus/schema");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

/* =========================
   🔥 SCHEMA DEFINITIONS
========================= */

class Player extends Schema {
    constructor() {
        super();
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.hp = 100;
        this.isAttacking = false;
    }
}

type("number")(Player.prototype, "x");
type("number")(Player.prototype, "y");
type("number")(Player.prototype, "vx");
type("number")(Player.prototype, "vy");
type("number")(Player.prototype, "hp");
type("boolean")(Player.prototype, "isAttacking");

class GameState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
    }
}

type({ map: Player })(GameState.prototype, "players");

/* =========================
   🎮 GAME ROOM
========================= */

class GameRoom extends Room {

    onCreate() {
        console.log("Room created");

        this.setState(new GameState()); // 🔥 REQUIRED

        // 🔥 INPUT FROM CLIENT
        this.onMessage("input", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            player.vx = data.vx || 0;
            player.vy = data.vy || 0;

            if (data.attack) {
                player.isAttacking = true;
            }
        });

        // 🔄 GAME LOOP
        this.setSimulationInterval((dt) => this.update(dt));
    }

    onJoin(client, options) {
        console.log("Player joined:", client.sessionId);

        const player = new Player();
        player.x = 200 + Math.random() * 200;
        player.y = 200;

        this.state.players.set(client.sessionId, player);
    }

    onLeave(client) {
        console.log("Player left:", client.sessionId);
        this.state.players.delete(client.sessionId);
    }

    update(dt) {
        this.state.players.forEach((p, id) => {

            // basic movement
            p.x += p.vx * dt / 1000;
            p.y += p.vy * dt / 1000;

            // 🔥 SIMPLE COMBAT (distance-based)
            if (p.isAttacking) {
                this.state.players.forEach((target, tid) => {
                    if (tid === id) return;

                    const dist = Math.abs(p.x - target.x);
                    if (dist < 60) {
                        target.hp -= 10;

                        if (target.hp <= 0) {
                            // respawn
                            target.x = 200;
                            target.y = 200;
                            target.hp = 100;
                        }
                    }
                });
            }

            // reset attack flag
            p.isAttacking = false;
        });
    }
}

/* =========================
   🚀 SERVER START
========================= */

const gameServer = new Server({ server });
gameServer.define("battle", GameRoom);

const PORT = 2567;

server.listen(PORT, () => {
    console.log("✅ Server running on http://localhost:" + PORT);
});