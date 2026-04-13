// TODO: move crud login from web socket to the api section

import {Server as Engine} from "@socket.io/bun-engine";
import { Server, Socket } from "socket.io";
import {default as jwt} from "jsonwebtoken";
import { type Player} from "@bazzi/shared";
import {MemoryAdaptor} from "@bazzi/shared";
import { Game } from "./lib/game";

type EventType = "declare" | "play" | "roundend";

class Event {

    public resolver: string;
    public eventType: EventType;
    // timeout 
    public time = 12;

    constructor(resolver: string, eventType: EventType) {
        this.resolver = resolver;
        this.eventType = eventType;
    }

}

const rooms = new Set();

class GameExtention {

    public game: Game;
    private playerSocketMap: Map<string, Socket>;
    public expected_players: string[];

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

    public start() {
        return this.game.start();
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
            callback({ok: false, code: "no_room", message: "room doesn't exist"});
            return;
        }

        if(gameExt.players().includes(socket.data.username)) {
            callback({ok: false, code: "already_joined", message: "already joined"});
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
        let hands = gameExt.start();
        // I am 99.99 precent sure there is no need for the update method
        // unlike the room manager the GamesManager is completly stored in memory
        gamesManager.update(roomID, gameExt);
        
        for(const [i, player] of gameExt.expected_players.entries()) {
            const socket = gameExt.get_socket(player);
            socket.emit("hand", hands.slice(i*13, i*13 + 13));
        };

        io.to(roomID).emit("start");

        const ev = gameExt.game.nextEvent();

        gameExt.get_socket(ev.resolver).emit(ev.eventType);

    });

    socket.on("declare", (hokm: string, callback) => {

        if(!socket.data.game) {
            callback({ok: false, code: 2, msg: "Not in a game"});
        }

        const ext = gamesManager.get_game(socket.data.game)!;
        const resolver = socket.data.username;

        if(resolver !== ext.game.currentEvent.resolver ||
           "declare" !== ext.game.currentEvent.eventType
        ) {
            callback({ok: false, code: 3, msg: "Could not resolve event"});
        }

        try {

            ext.game.resolveEvent(resolver, "declare", hokm);

            socket.to(socket.data.game).emit("declartion", hokm);
            return

        } catch {
            callback({ok: false, code: 3, msg: "illegal move"});
        }

    });

    socket.on("play", (card, callback) => {

        if(!socket.data.game) {
            callback({ok: false, code: 2, msg: "Not in a game"});
        }

        const ext = gamesManager.get_game(socket.data.game)!;
        const resolver = socket.data.username;

        if(resolver !== ext.game.currentEvent.resolver ||
           "play" !== ext.game.currentEvent.eventType
        ) {
            callback({ok: false, code: 3, msg: "Could not resolve event"});
        }

        try {

            ext.game.resolveEvent(resolver, "play", card);

            socket.to(socket.data.game).emit("played", card);
            return

        } catch {
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
            }));
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
