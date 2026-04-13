// P1TD player 1 played ten of diomands (server to client)
// A announce your "Hokm" (server to client)
// L8SJH.... list of cards you got (server to client)
// T1 team 1 won

// P7C0 play 7 of clib (client to server)
// HC "Hokm" is clubs (client to server)

export function PlayPacket(player: string, card: string) {
    return `${player}${card}`;
}

export function AnnouncePacket() {
    return "A";
}

export function ListPacket(cards: string[]) {
    return `L${cards.join()}`;
} 

export function WinnerPacket(team: string) {
    return `T${team}`
} 