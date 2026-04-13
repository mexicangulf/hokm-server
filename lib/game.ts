import { Action, type ActionType } from "./actions";

type dist_item = {
    v: number,
    p: number
}

const chunk_size_distribution: dist_item[] = [
    {v: 1, p: 10},
    {v: 2, p: 2},
    {v: 3, p: 1},
    {v: 4, p: 0.5},
    {v: 5, p: 0.2}];

function distributedRandom(dist: dist_item[]): number {

  const total = dist.reduce((sum, item) => sum + item.p, 0);
  const r = Math.random() * total;

  let cumulative = 0;
  for (const item of dist) {
    cumulative += item.p;
    if (r < cumulative) return item.v;
  }

  // will never happen
  return dist[0]!.v;

}

function card_riffle(deck: string[], dist: dist_item[]) {

    let i = 0;
    let j = 0;
    let riffled: string[] = [];

    const upper_half = deck.slice(0, Math.floor(deck.length/2));
    const lower_half = deck.slice(Math.floor(deck.length/2));

    while(true) {

        const n = Math.min(distributedRandom(dist) , upper_half.length - i);
        const m = Math.min(distributedRandom(dist), lower_half.length - j);

        riffled = riffled.concat(upper_half.slice(i, i + n));
        riffled = riffled.concat(lower_half.slice(j, j + m));

        i += n;
        j += m;

        if(i >= upper_half.length && j < lower_half.length) {
            riffled = riffled.concat(lower_half.slice(j));
            break
        }

        if(j >= lower_half.length && i < upper_half.length) {
            riffled = riffled.concat(upper_half.slice(i));
            break
        }

        if(i >= upper_half.length && j >= lower_half.length) {
            break
        }

    }

    return riffled;

};

// riffle dist and number of riffs
function shuffle(deck: string[], n: number) {

    let shuffled = card_riffle(deck, chunk_size_distribution);

    for(let i = 0; i < n - 1; i++) {
        shuffled = card_riffle(shuffled, chunk_size_distribution);
    };

    return shuffled;

};

function sliceAndRemove<T>(arr: Array<T>, start: number, end: number):
     [Array<T>, Array<T>] {

    const sliced = arr.slice(start, end);
    const remain = arr.slice(0, start).concat(arr.slice(end));

    return [sliced, remain];

}

// I don't know why I'm not using an enum
const stages = {
    "announcment": 0,
    "dealing": 1,
    "playing": 2,
}

function isDigit(a: string) {
    
    if(a.length != 1) {
        throw new Error("dumb ass");
    }
    
    if('0' <= a[0]! && a[0]! <= '9') {
        return true;
    }

    return false;

}

function compareCardValues(a: string, b: string) {

    let A = a;
    let B = b;

    if(isDigit(A) && isDigit(B)) {
        return Number(A) > Number(B);
    }

    if(!isDigit(A) && !isDigit(B)) {

        let ranking = {
            "T": 0,
            "J": 1,
            "Q": 2,
            "K": 3,
            "A": 4
        }

        if(!(A in ranking)) {
            throw new Error("card is not real");
        }

        if(!(B in ranking)) {
            throw new Error("card is not real");
        }

        return ranking[A as keyof typeof ranking] > ranking[B as keyof typeof ranking];

    }

    return isDigit(B);

};

class Deck {

    public deck: string[] = [];
    public last: number;

    constructor() {

        this.last = -1;
        this.deck = [];
        this.hard_reset();

    }

    public reset() {
        this.last = -1;
    }

    public hard_reset() {

        this.deck = [];

        for(let i=0; i < 52; i++) {

            const suit = ["S", "H", "C", "D"][Math.floor(i/13)];
            const card = ["2", "3", "4", "5", "6", "7", "8", "9",
                 "T", "J", "Q", "K", "A"][i%13];

            this.deck.push(suit! + card!);

        };

        this.last = -1;

    }

    public takeOut(n: number): string[] {

        const start = this.last + 1;
        this.last += n;
        if(start >= this.deck.length) {
            throw new Error("the card deck is empty");
        }
        return this.deck.slice(start, start + n);

    };

    public shuffle(n: number) {
        this.deck = shuffle(this.deck, n);
    };

}

class Result<T> {
    
    public ok: boolean;
    public value: T;

    constructor(ok: boolean, value: T) {
        this.ok = ok;
        this.value = value;
    }

}

class Ok<T> extends Result<T> {
    constructor(value: T) {
        super(true, value);
    }
}

class Err<T> extends Result<T> {
    constructor(value: T) {
        super(false, value);
    }
}

function ok<T>(r: Result<T>) {
    if(!r.ok)
        throw new Error("result was an error");
    return r.value;
}

class GameState {

    public roundScore: [number, number] = [0 ,0];
    public floor: string[] = [];
    public stacks: string[][] = [];
    public playerHands: string[][] =  [];
    public hokm: string = "";
    public turn = -1;

    constructor() {};

}

class GameCore {

    private players: [string, string, string, string] = ["", "", "", ""];
    public state: GameState = new GameState();

    constructor() {};

    static format(card: string) {
    }

    setPlayers(players: [string, string, string, string]) {
        this.players = players;    
    };

    setPlayerHands(hands: string[]) {
        this.state.playerHands[0] = sliceAndRemove(hands, 0, 13)[0];
        this.state.playerHands[1] = sliceAndRemove(hands, 13, 26)[0];
        this.state.playerHands[2] = sliceAndRemove(hands, 26, 39)[0];
        this.state.playerHands[3] = sliceAndRemove(hands, 39, 52)[0];
    }

    outOfTurn(player: string) {
        return this.players[this.state.turn] !== player; 
    }

    evalWinner() {

        let cut = false;
        let winnerValue = this.state.floor[0]![1]!;
        let winner = 0;

        for(let i = 0; i < 4; i++) {
            
            const card = this.state.floor[i]!;
            const khal = card[0];
            const value = card[1]!;

            if(cut && khal == this.state.hokm && compareCardValues(value, winnerValue)) {
                winner = i;
                winnerValue = value; 
            }

            if(compareCardValues(value, winnerValue)) {
                winner = i;
                winnerValue = value;
            }

        };

        return (this.state.turn + 3 - winner);

    };

    declare(hokm: string, player: string): Result<string> {
            
        if(this.outOfTurn(player)) {
            return new Err("out_of_turn");
        }

        if(!["C", "S", "H", "D"].includes(hokm)) {
            return new Err("invalid_hokm");
        };

        this.state.hokm = hokm;
        return new Ok("");

    }

    play(card: string, player: string): Result<string> {

        if(this.outOfTurn(player)) {
            return new Err("illegal");
        }

        
        let hand = this.state.playerHands[this.state.turn]!;
        const cardIdx = hand.indexOf(card);

        if(cardIdx == -1) {
            return new Err("illegal");
        }

        if(this.state.floor.length == 0) {
            hand = hand.splice(cardIdx, 1);
            this.state.playerHands[this.state.turn] = hand;
            this.state.floor.push(card);
            this.state.turn += 1;
            return new Ok("");
        };

        if(hand[0] != this.state.floor[0]![0] || hand[0] != this.state.hokm) {
            return new Err("illegal");
        }

        hand.splice(cardIdx);
        this.state.playerHands[this.state.turn] = hand;
        this.state.floor.push(card);
        this.state.turn += 1;

        if(this.state.floor.length == 4) {

            const winner = this.evalWinner();
            const idx = Math.ceil(winner/2);
            this.state.roundScore[idx] = this.state.roundScore[idx]! + 1;
            this.state.turn = winner;

        };

        return new Ok("");

    }

    get playerTurn() {return this.players[this.state.turn]!}

};

type EventType = "declare" | "play" | "handend" | "roundend" | "gameend" | "noevent";

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

export class Game {

    private players: [string, string, string, string] = ["", "", "", ""];
    public id: string = "";    
    public init: boolean = true;
    public gameScore: [number, number];

    public deck: Deck;
    public core: GameCore = new GameCore();

    public currentEvent: Event = new Event("server", "noevent");

    constructor(id: string) {
        
        this.id = id;
        this.deck = new Deck();

        this.gameScore = [0, 0];

    }

    public playerJoinAnyTeam(player: string, balance=false) {

        const index = this.players.indexOf("");
        this.players[index] = player;

    }

    public addPlayer(player: string) {
        if(this.players.length <= 4) {
            this.playerJoinAnyTeam(player);
        }
    }


    public removePlayer(player: string) {
        const index = this.players.lastIndexOf(player);
        this.players[index] = "";
    }

    public playerTeam(player: string) {
     
        const team1 = this.players.slice(0, 2);

        if(player in team1) {
            return 1;
        } 
        
        return 2;

    }

    public start() {
        this.deck.reset();
        this.deck.shuffle(5);
        this.core.setPlayers(this.players);
        this.core.setPlayerHands(this.deck.deck);
        this.core.state.turn = Math.floor(Math.random()*4);
        return this.deck.deck;
    };

    public nextEvent() {

        if(this.currentEvent.eventType == "noevent") {
            this.currentEvent = new Event(this.core.playerTurn, "declare");
        };

        if(this.currentEvent.eventType == "play") {

        if(Math.max(...this.core.state.roundScore) == 7) {
            
            const firstTeamScore = this.core.state.roundScore[0];
            const secondTeamScore = this.core.state.roundScore[1];

            if(firstTeamScore == 7) {
                
                if(secondTeamScore == 0) {
                    // marce (aka winning all the hands)
                    this.currentEvent = new Event("m1", "handend");
                }
                this.currentEvent = new Event("n1", "handend");
            }

            if(firstTeamScore == 0) {
                this.currentEvent = new Event("m2", "handend");
            }
            this.currentEvent = new Event("n2", "handend");
            
        } else
        this.currentEvent = new Event(this.core.playerTurn + 1, "play");
    
        }

        return this.currentEvent;
        
    };

    public resolveEvent(player: string, type: EventType, resolveArg: string) {

        if(type == "declare") {
            const result = this.core.declare(resolveArg, player);
            return result.value;
        }

        if(type == "play") {
            const result = this.core.play(resolveArg, player); 
            return result;
        }

    };

} 
