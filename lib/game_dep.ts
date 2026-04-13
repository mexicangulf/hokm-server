import { Action, type ActionType } from "./actions";

type dist_item = {
    v: number,
    p: number
}

const chunk_size_distribution: dist_item[] = [
    {v: 1, p: 0.566},
    {v: 2, p: 0.308},
    {v: 3, p: 0.029},
    {v: 4, p: 0.064},
    {v: 5, p: 0.0322}];

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
            riffled.concat(lower_half.slice(j));
            break
        }

        if(j >= lower_half.length && i < upper_half.length) {
            riffled.concat(upper_half.slice(i));
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
            const card = ["1", "2", "3", "4", "5", "6", "7", "8", "9",
                 "T", "J", "Q", "K"][i%13];

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

export class Game {

    public id: string = "";
    private players: [string, string, string, string] = ["", "", "", ""];
    
    public stage = stages["announcment"];
    public ruler = -1;
    public hokm: string;
    public gameScore: [number, number];

    public roundScore: [number, number];
    public floor: [number, string][];
    public played_cards: Set<string>;
    public turn: number = -1;

    public deck: Deck;

    constructor(id: string) {
        
        this.id = id;
        this.deck = new Deck();
        this.hokm = "";

        this.gameScore = [0, 0];
        this.roundScore = [0, 0];

        this.floor = [];
        this.played_cards = new Set();
        this.ruler = -1;

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

    public playerJoinAnyTeam(player: string, balance=false) {

        const index = this.players.indexOf("");
        this.players[index] = player;

    } 

    public playerJoinTeam(player: string, team: number) {
        
        const team1 = this.players.slice(0, 2);
        const team2 = this.players.slice(2, 4);

        if(team == 1) {

            if(team1[0] == "") {
                team1[0] = player;
            }
            else if(team1[1] == "") {
                team1[1] = player;
            } else {
                return;
            }

            if(player in team2) {
                const index = team2.indexOf(player);
                team2[index + 2] = "";
            }

        } 

        if(team == 2) {
    // public startGame() {
    //     this.status = "started";

    // }

            if(team2[0] == "") {
                team2[0] = player;
            }
            else if(team2[1] == "") {
                team2[1] = player;
            } else {
                return;
            }

            if(player in team1) {
                const index = team1.indexOf(player);
                team1[index] = "";
            }

        } 

    }

    public playerTeam(player: string) {
     
        const team1 = this.players.slice(0, 2);

        if(player in team1) {
            return 1;
        } 
        
        return 2;

    }

    private handle_announce(subject: string, payload: string): Action {

        if(subject == this.players[this.ruler]) {
            if(payload.length == 1) {
                this.hokm == payload;
                return new Action("ANNOUNCE", "*", payload);
            }
        }

        return new Action("ERR", subject, "");

    };

    // apply games rules
    // TODO: add the person that played the card to the payload if you
    // see the need
    private handle_play(subject: string, payload: string): Action {

        if(payload.length != 2) {
            return new Action("ERR", subject, "");
        }

        if(subject != this.players[this.turn]) {
            return new Action("ERR", subject, "");
        }

        if(payload in this.played_cards || !(payload in this.deck)) {
            return new Action("ERR", subject, "");
        }

        if(this.floor.length == 0) {
            this.floor.push([this.turn, payload]);
            this.turn += 1;
            this.played_cards.add(payload);
            return new Action("PLAY", "*", payload);
        }

        const suit = payload[0];
        const card = payload[1];

        if(suit != this.hokm && suit != this.floor[0]![1]) {
            return new Action("ERR", subject, "");
        };

        this.floor.push([this.turn, payload]);
        this.turn += 1;
        this.played_cards.add(payload);

        if(this.floor.length != 4) {
            return new Action("PLAY", "*", payload);
        }
            
        let winner = -1;
        let winnerCard = "";
        let cut = false;

        for(let i = 0; i < 4; i++) {

            let [player, card] = this.floor[i]!;

            let suit = card[0]!;
            let value = card[1]!;

            if(cut) {
                if(compareCardValues(value, winnerCard)) {
                    winnerCard = card;
                    winner = player;
                }
                continue
            }

            if(winnerCard) {

                if(suit == winnerCard[0]) {
                    if(compareCardValues(value, winnerCard)) {
                        winnerCard = card;
                        winner = player;
                    }
                    continue
                }

                winnerCard = card;
                winner = player;
                cut = true;
                
                continue

            }

            winnerCard = card;
            winner = player;

        };

        if(winner in [0, 1]) {
            this.roundScore[0] += 1;
        } else {
            this.roundScore[1] += 1;
        }

        if(this.roundScore[0] == 7) {
            this.gameScore[0] += 1;
            if(this.gameScore[0] == 7) {
                return new Action("WINNER", "*", "1");
            }
            return new Action("ROUNDWINNER", "*", "1");
        }

        if(this.roundScore[0] == 7) {
            this.gameScore[0] += 1;
            if(this.gameScore[0] == 7) {
                return new Action("WINNER", "*", "1");
            }
            return new Action("ROUNDWINNER", "*", "1");
        }

        if(this.roundScore[1] == 7) {
            this.gameScore[1] += 1;
            if(this.gameScore[1] == 7) {
                return new Action("WINNER", "*", "2");
            }
            return new Action("ROUNDWINNER", "*", "2");
        }

        // this will never be called i hope
        return new Action("ERR", "*", "Something went wrong");

    };

    public nextTurn(action?: Action): Action[] {
    
        if(this.stage == stages["announcment"]) {

            if(this.ruler == -1) {
                this.ruler = Math.floor(Math.random()*4);
            }

            const rullingPlayer = this.players[this.ruler]!;

            // TODO: don't always reset the deck
            // make the played cards influence the shuffled deck
            this.deck.reset();
            this.deck.shuffle(5);

            let first_hand = this.deck.takeOut(5);

            this.stage = stages["dealing"];

            return [new Action("LIST", rullingPlayer, first_hand.join(",")),
                    new Action("ANNOUNCE", rullingPlayer, "")
            ];

        };

        if(this.stage == stages["dealing"]) {

            let hands: string[][] = [];

            hands.push([]);
            hands.push(this.deck.takeOut(5));
            hands.push(this.deck.takeOut(5));
            hands.push(this.deck.takeOut(5));

            for(let i = 0; i < 8; i++) {
                hands[i]?.concat(this.deck.takeOut(4));
            }

            let actions = [];

            
            let player1 = this.players[this.ruler]!;
            // we add two beacuse the first two players (the players on the first team)
            // are stored next to each other
            let player2 = this.players[(this.ruler + 2)%4]!;
            let player3 = this.players[(this.ruler + 1)%4]!;
            let player4 = this.players[(this.ruler + 3)%4]!;

            actions.push(new Action("LIST", player1, hands[0]!.join(",")));
            actions.push(new Action("LIST", player2, hands[1]!.join(",")));
            actions.push(new Action("LIST", player3, hands[2]!.join(",")));
            actions.push(new Action("LIST", player4, hands[3]!.join(",")));

            this.stage = stages["playing"];

            this.turn = this.ruler;

            return actions;


        };

        if(!action) {
            throw new Error("action required");
        }

        if(action.type == "ANNOUNCE") {
            return [this.handle_announce(action.subject, action.payload)];
        }

        if(action.type == "PLAY") {

            const responseAction = this.handle_play(action.subject, action.payload);
            // TODO: handle starting another round
            if(responseAction.type == "ROUNDWINNER") {
                const rulerTeam = this.ruler < 2 ? "1" : "2";
                // the other team won
                if(rulerTeam !== responseAction.payload) {
                    this.ruler = (this.ruler += 2)%4;
                }
                this.stage = stages["announcment"];
            };
            return [responseAction];
            
        }

        return [new Action("ERR", "*", "Something went wrong")];
    
    };

} 