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

class SpecialCharacter {    

    public nothing: boolean = false;
    // Enf of hand
    public eoh: boolean = false;
    // End of round
    public eor: boolean = false;

    public value: string;

    constructor(value: string) {
        this.value = value;
        this.nothing = true;
    };

    static Nothing(value: string) {
        return new SpecialCharacter(value);
    }

    static Eoh(value: string) {
        const s = new SpecialCharacter(value);
        s.nothing = false;
        s.eoh = true;
        return s;
    }

    static Eor(value: string) {
        const s = new SpecialCharacter(value);
        s.nothing = false;
        s.eor = true; 
        return s;
    }

};

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

    // having bad cards in the floor will result in bad winner evaluation
    evalWinner() {

        let zamineh = this.state.floor[0][0];
        let winnerValue = this.state.floor[0][1];
        let winner = 0;
        let cut = false;

        for(let i = 1; i < 4; i++) {
            
            const card = this.state.floor[i]!;
            const khal = card[0];
            const value = card[1];

            if(khal !== this.state.hokm && khal !== zamineh) {
                continue;
            }

            if(cut && khal == this.state.hokm && compareCardValues(value, winnerValue)) {
                winner = i;
                winnerValue = value;
                continue
            };

            if(!cut && khal == this.state.hokm && khal !== zamineh) {
                winner = i;
                winnerValue = value;
                cut = true;
                continue
            }

            if(!cut && compareCardValues(value, winnerValue)) {
                winner = i;
                winnerValue = value;
            }

        };

        return ((this.state.turn + 1)%4 + winner)%4;

    };

    declare(hokm: string, player: string) {
            
        if(this.outOfTurn(player)) {
            throw new Error("out_of_turn");
        }

        if(!["C", "S", "H", "D"].includes(hokm)) {
            throw new Error("invalid_hokm");
        };

        this.state.hokm = hokm;

    }

    play(card: string, player: string): SpecialCharacter {
 
        if(this.outOfTurn(player)) {
            throw new Error("out  of turn");
        }

        let hand = this.state.playerHands[this.state.turn]!;
        const cardIdx = hand.indexOf(card);

        if(cardIdx == -1) {
            throw new Error("card not in hand");
        }

        if(this.state.floor.length == 0) {
            hand.splice(cardIdx, 1);
            this.state.playerHands[this.state.turn] = hand;
            this.state.floor.push(card);
            this.state.turn = (1 + this.state.turn)%4;
            return SpecialCharacter.Nothing("");
        };

        if(card[0] !== this.state.floor[0][0]) {
            for(const handCard of hand) {
                if(handCard[0] == this.state.floor[0]![0])
                    throw new Error("illegal");
            };
        };

        hand.splice(cardIdx, 1);
        this.state.playerHands[this.state.turn] = hand;
        this.state.floor.push(card);
        this.state.turn = (1 + this.state.turn)%4;

        if(this.state.floor.length == 4) {

            this.state.turn -= 1;
            const winner = this.evalWinner();
            const idx = winner%2;
            this.state.roundScore[idx] = this.state.roundScore[idx]! + 1;
            this.state.turn = winner;

            this.state.floor = [];

            // round score of the first team [x, _, x, _] are stored in roundScore[0]
            if(this.state.roundScore[0] == 3) {
                return SpecialCharacter.Eor("0");
            }

            if(this.state.roundScore[1] == 3) {
                return SpecialCharacter.Eor("1");
            }
            
            return SpecialCharacter.Eoh(this.players[winner]!);

        };

        return SpecialCharacter.Nothing("");

    }

    get playerTurn() {return this.players[this.state.turn]!}

};

type MessageType = "declare" | "play" | "handend" | "roundend" | "gameend" | "nomessage";

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

export class Game {

    private players: [string, string, string, string] = ["", "", "", ""];
    public id: string = "";    
    public init: boolean = true;
    public gameScore: [number, number];

    public deck: Deck;
    public core: GameCore = new GameCore();
    public turnStart: number = -1;

    public history: string[] = [];

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
        const playerIndex = this.players.indexOf(player);

        if(player in team1) {
            return 1;
        } 
        
        return 2;

    }

    public start(turn?: number) {
        this.deck.reset();
        this.deck.shuffle(5);
        this.core.setPlayers(this.players);
        this.core.setPlayerHands(this.deck.deck);
        if(!turn) {
            const rand = Math.floor(Math.random()*4);
            this.core.state.turn = rand;
            this.turnStart = rand;
        }
        else {
            this.core.state.turn = turn;
            this.turnStart = turn;
        }
        return this.deck.deck;
    };

    public restart(turn?: number) {
        this.deck.reset();
        this.deck.shuffle(8);
        this.core.state.roundScore = [0, 0];
        this.core.setPlayers(this.players);
        this.core.setPlayerHands(this.deck.deck);
        if(!turn) {
            const rand = Math.floor(Math.random()*4);
            this.core.state.turn = rand;
            this.turnStart = rand;
        }
        else {
            this.core.state.turn = turn;
            this.turnStart = turn;
        }
        return this.deck.deck;
    };

    get playerTurn() {
        return this.core.playerTurn;
    };

    get turn() {
        return this.core.state.turn;
    }

    public declare(hokm: string, player: string) {
        return this.core.declare(hokm, player);
    };

    public play(card: string, player: string) {
        try {
            const r = this.core.play(card, player);
            this.history.push(card);
            return r;
        } catch(e) {
            throw e;
        }
    }

} 
