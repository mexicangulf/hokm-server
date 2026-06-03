import {Server as Engine} from "@socket.io/bun-engine";
import { Server, Socket } from "socket.io";
import {default as jwt} from "jsonwebtoken";
import { type Player} from "@bazzi/shared";
import {MemoryAdaptor} from "@bazzi/shared";
import { Game } from "./lib/game";

type MessageType = "declare" | "play" | "roundend";

class Message {

    public resolver: string;
    public messageType: MessageType;
    // timeout 
    public time = 12;

    constructor(resolver: string, messageType: MessageType) {
        this.resolver = resolver;   
        this.messageType = messageType;
    }

}

const rooms = new Set();

class GameExtention {

    public game: Game;
    private playerSocketMap: Map<string, Socket>;
    public expected_players: string[];

    public replay: string[][] = [];

    constructor(id: string, expected_players: string[]) {
        this.playerSocketMap = new Map();
        this.game = new Game(id);
        this.expected_players = expected_players;
    }

    public add_player(player: string, socket: Socket) {
        
        if(player !in this.expected_players) {
            throw new Error("Player is not in the player list");
        }

        this.playerSocketMap.set(player, socket);

    };

    public load_players() {
        for(const player of this.expected_players) {
            this.game.addPlayer(player);
        }
    };

    public assign_player_socket(player: string, socket: Socket) {
        this.playerSocketMap.set(player, socket);
    }

    public get_socket(player: string) {
        return this.playerSocketMap.get(player)!;
    }

    public players() {
        return Array.from(this.playerSocketMap.keys());
    }

    public start(turn?: number) {
        return this.game.start(turn);
    }

}

class GamesManager { 

    public games: Map<string, GameExtention>;

    constructor() {
        this.games = new Map();
    }

    public add_game(room: string, game: GameExtention) {
        this.games.set(room, game);
    }

    public delete_game() {

    }

    public get_game(room: string) {
        return this.games.get(room);   
    }

    public update(room: string, game: GameExtention) {
        this.games.set(room, game);
    }

}

const gamesManager = new GamesManager();

const io = new Server();

const engine = new Engine({
    cors: {
        origin: "*",
        allowedHeaders: ["Content-Type"],
        credentials: false
    }
});

io.bind(engine);

const {websocket} = engine.handler();

io.on("connection", (socket) => {

    socket.data.authenticated = false;
    socket.data.player;

    socket.on("auth", async (token, callback) => {

        // ENABLE THIS FOR AUTH
        // try {
            
        //     const payload = jwt.verify(token, process.env.JWT_SECRET!);
            
        //     socket.data.player = payload;
        //     socket.data.authenticated = true;
        //     socket.emit("auth_success", { message: "Authentication successful" });
        // } catch (err) {

        //     socket.emit("auth_error", { message: "Invalid or expired token" });
        //     socket.disconnect(true);
        // }

        socket.data.player = token;
        socket.data.username = token;
        socket.data.authenticated = true;
        console.log(token, "connected");
        callback({ok: true, msg: "Authentication successful"})

    });

    socket.on("join", (roomID, callback) => {

        if(!callback) {
            callback = () => {};
        }

        if(!socket.data.player) {
            callback({
                ok: false,
                code: "not_logged_in",
                message: "loggin first"
            });
            return;
        }

        const gameExt = gamesManager.get_game(roomID);

        if(!gameExt) {
            callback({ok: false, error: "no_room", message: "room doesn't exist"});
            return;
        }

        if(gameExt.players().includes(socket.data.username)) {
            callback({ok: false, error: "already_joined", message: "already joined"});
            return
        }

        socket.join(roomID);
        socket.data.game = roomID;
        gameExt.add_player(socket.data.username, socket);
        gamesManager.update(roomID, gameExt);

        const players = gameExt.players();

        callback({ok: true, msg: "joined"});

        if(players.length < 4) {
            return;
        }

        gameExt.load_players();
        let hands = gameExt.start(3);
        // I am 99.99 precent sure there is no need for the update method
        // unlike the room manager the GamesManager is completly stored in memory
        gamesManager.update(roomID, gameExt);
        
        for(const [i, player] of gameExt.expected_players.entries()) {
            const socket = gameExt.get_socket(player);
            socket.emit("hand", hands.slice(i*13, i*13 + 5));
        };

        io.to(roomID).emit("start", gameExt.game.playerTurn);

    });

    socket.on("declare", (hokm: string, callback) => {

        if(callback == undefined) {
            callback = () => {};
        }

        if(!socket.data.game) {
            callback({ok: false, code: 2, msg: "Not in a game"});
        }

        const ext = gamesManager.get_game(socket.data.game)!;
        const resolver = socket.data.username;

        try {

            ext.game.declare(hokm, resolver);
            ext.replay.push(["declare", hokm, resolver]);
            socket.broadcast.to(socket.data.game).emit("declare", hokm);
            
            for(const [i, player] of ext.expected_players.entries()) {
                const socket = ext.get_socket(player);
                socket.emit("hand",
                    ext.game.core.state.playerHands[i].slice(5, 13)
                )
            };

            return

        } catch {
            callback({ok: false, code: 3, msg: "illegal move"});
        }

    });

    socket.on("play", (card, callback) => {
    
        if(callback == undefined) {
            callback = () => {};
        }

        if(!socket.data.game) {
            callback({ok: false, code: 2, msg: "Not in a game"});
        }

        const ext = gamesManager.get_game(socket.data.game)!;
        const resolver = socket.data.username;

        try {

            const ch = ext.game.play(card, resolver);
            
            ext.replay.push(["play", card, resolver]);
            socket.broadcast.to(socket.data.game).emit("play", card);

            if(ch.eoh) {

            ext.replay.push(["hand_end", ch.value]);
            io.to(socket.data.game).emit("hand_end", ch.value);
            return;

            }

            if(ch.eor) {

            const turnStart = ext.game.turnStart;
            const winnerTeam = Number(ch.value);

            let hands: string[] = [];

            if(turnStart%2 != winnerTeam) {
                // this sets the turns properly
                hands = ext.game.restart((turnStart + 1)%4);
                
                ext.game.core.state.turn = ext.game.turnStart;
            } else {
                // this sets the turns properly
                hands = ext.game.restart(turnStart);
                ext.game.core.state.turn = ext.game.turnStart;
            }

            ext.replay.push(["hand_end", ch.value, String(ch.value)]);
            io.to(socket.data.game).emit("hand_end", ch.value);

            ext.replay.push(["round_end", ch.value, String(ext.game.turnStart)]);
            io.to(socket.data.game).emit("round_end", ch.value, ext.game.turnStart);

            for(const [i, player] of ext.expected_players.entries()) {
                const socket = ext.get_socket(player);
                socket.emit("hand", hands.slice(i*13, i*13 + 5));
            };

            ext.replay.push(["round_start", String(ext.game.turnStart)]);
            io.to(socket.data.game).emit("start", ext.game.playerTurn);
            
            return;

            };

            return

        } catch(e) {
            console.log(e);
            callback({ok: false, code: 3, msg: "illegal move"});
        }

    });

});

function withAuthorization(req: Bun.BunRequest) {

        const AuthHeader = req.headers.get("Authorization");

        // the first part is Bearer
        let token = AuthHeader?.split(" ")[1];

        if(!token) {
            const temp = req.cookies.get("authorization");
            if(temp == null) {
                token = undefined
            } else {
                token = temp;
            }
        }

        if(!token) {
            return false;
        }

        const user = jwt.verify(token, process.env["JWT_SECRET"]!);

};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const server = Bun.serve({
    port: 3000,
    routes: {

        "/health": _ => {
            return new Response("OK" , {status: 200});
        },


        "/api/rooms": _ => {},

        // game results
        "/api/results/:id": _ => {},

        "/api/game/:id" : (req, params) => {

            if(req.method !== "GET") {
                return new Response("Not Found", {status: 404});
            }

            const {id} = req.params;

            let game = gamesManager.get_game(id);

            if(game == undefined) {
                return new Response("Not Found", {status: 404});
            }

            game = game!;
            return new Response(JSON.stringify({
                "id": id,
                "players": game.players,
                "score": game.game.gameScore,
                "expected_players": game.expected_players,
            }), {headers: corsHeaders()});
        },

        "/api/game/create": async (req, params) => {

            if(req.method !== "POST") {
                return new Response("Not Found", {status: 404});
            }

            const body = await req.json();
            const id = body.id;

            if(!id) {
                return new Response("Bad Request", {status: 400});
            }

            const authHeader = req.headers.get("Authorization");
            const [verb, key] = authHeader?.split(" ")!;

            // this snippet is stupid
            // if(verb !== "Basic" && verb !== "App") {
            //     return new Response("Bad Request", {status: 400});
            // }

            if(!key) {
                return new Response("Not Authorized", {status: 401});
            }

            let data = undefined;
                
            try {
                data = jwt.verify(key, process.env.JWT_SECRET!);            
            } catch {
                return new Response("Not Authorized", {status: 401});
            }

            if((data as jwt.JwtPayload).scope == "*") {
                gamesManager.add_game(id, new GameExtention(id, body.players));
            };

        },

    },

    fetch(req, server) {

        const url = new URL(req.url);
        
        // if(server.upgrade(req)) {
        //     return
        // }

        if (url.pathname.startsWith("/socket.io")) {
            return engine.handleRequest(req, server);
        }

        if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders()
        });
        }

        return new Response("Not Found", {status: 404});

    },
    websocket,
});

console.log(`Server running on http://localhost:${server.port}`);
gamesManager.add_game("0", new GameExtention("0", ["player0", "player1",
     "player2", "player3"]));