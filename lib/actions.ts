// P1TD player 1 played ten of diomands (server to client)
// A announce your "Hokm" (server to client)
// L8SJH.... list of cards you got (server to client)
// T1 team 1 won

// P7C0 play 7 of clib (client to server)
// HC "Hokm" is clubs (client to server)

// actions have two types incoming actions and outgoing actions
// some action types are bidirectional while others are not
// an action type may be treated diffrently based on it's direction
export type ActionType = "PLAY" | "ANNOUNCE" | "LIST" | "WINNER" | "ERR" | "ROUNDWINNER";

// play is bi
// announce is bi
// list is only outgoing
// winner is only outgoing
// err is when a player makes move that is not allowed

export class Action {

    public type: ActionType;
    public subject: string;
    public payload: string;

    constructor(type: ActionType, subject: string, payload: string) {
        this.subject = subject;
        this.payload = payload;
        this.type = type;
    }

}