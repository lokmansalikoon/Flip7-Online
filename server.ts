import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { nanoid } from "nanoid";

// --- Game Constants & Types ---

type CardType = number | 'FLIP3' | 'FREEZE' | 'DOUBLE' | 'SECOND_CHANCE';

interface Card {
  id: string;
  type: CardType;
  value: number;
}

interface Player {
  id: string;
  name: string;
  isBot: boolean;
  score: number;
  currentTurnCards: Card[];
  hasSecondChance: boolean;
  isDoubled: boolean;
  isDone: boolean;
}

interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  discardPile: Card[];
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  winnerId: string | null;
  logs: string[];
  isBusting: boolean;
}

const WINNING_SCORE = 200;

function createDeck(): Card[] {
  const deck: Card[] = [];
  // Numbers 1-12: Quantity = Value
  for (let i = 1; i <= 12; i++) {
    for (let j = 0; j < i; j++) {
      deck.push({ id: nanoid(), type: i, value: i });
    }
  }
  // Special Cards
  for (let i = 0; i < 3; i++) deck.push({ id: nanoid(), type: 'FLIP3', value: 0 });
  for (let i = 0; i < 3; i++) deck.push({ id: nanoid(), type: 'FREEZE', value: 0 });
  for (let i = 0; i < 2; i++) deck.push({ id: nanoid(), type: 'DOUBLE', value: 0 });
  for (let i = 0; i < 2; i++) deck.push({ id: nanoid(), type: 'SECOND_CHANCE', value: 0 });
  
  return shuffle(deck);
}

function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Server Setup ---

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const rooms: Map<string, GameState> = new Map();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_game", ({ name, botCount }: { name: string, botCount: number }) => {
      // Simple matchmaking: find a lobby or create one
      let room = Array.from(rooms.values()).find(r => r.status === 'LOBBY' && r.players.length < 8);
      
      if (!room) {
        const roomId = nanoid(6);
        room = {
          id: roomId,
          players: [],
          currentPlayerIndex: 0,
          deck: createDeck(),
          discardPile: [],
          status: 'LOBBY',
          winnerId: null,
          logs: ["Game lobby created."],
          isBusting: false
        };
        rooms.set(roomId, room);
      }

      const newPlayer: Player = {
        id: socket.id,
        name: name || `Player ${room.players.length + 1}`,
        isBot: false,
        score: 0,
        currentTurnCards: [],
        hasSecondChance: false,
        isDoubled: false,
        isDone: false
      };

      room.players.push(newPlayer);
      socket.join(room.id);
      
      // If we have a botCount requested, add bots
      if (botCount > 0) {
        for (let i = 0; i < botCount; i++) {
          room.players.push({
            id: `bot-${nanoid(4)}`,
            name: `Bot ${i + 1}`,
            isBot: true,
            score: 0,
            currentTurnCards: [],
            hasSecondChance: false,
            isDoubled: false,
            isDone: false
          });
        }
      }

      io.to(room.id).emit("game_state", room);
    });

    socket.on("start_game", (roomId: string) => {
      const room = rooms.get(roomId);
      if (room && room.status === 'LOBBY') {
        room.status = 'PLAYING';
        room.logs.push("Game started!");
        io.to(room.id).emit("game_state", room);
        
        // Check if first player is bot
        checkBotTurn(room);
      }
    });

    socket.on("flip_card", (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'PLAYING') return;
      
      const currentPlayer = room.players[room.currentPlayerIndex];
      if (currentPlayer.id !== socket.id) return;

      handleFlip(room, currentPlayer);
    });

    socket.on("bank_points", (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'PLAYING') return;
      
      const currentPlayer = room.players[room.currentPlayerIndex];
      if (currentPlayer.id !== socket.id) return;

      handleBank(room, currentPlayer);
    });

    socket.on("force_next_turn", (roomId: string) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'PLAYING') return;
      // Only allow host (first player) to force next turn
      if (room.players[0].id !== socket.id) return;

      const currentPlayer = room.players[room.currentPlayerIndex];
      room.logs.push(`Host forced next turn. ${currentPlayer.name}'s turn skipped.`);
      currentPlayer.currentTurnCards.forEach(c => room.discardPile.push(c));
      currentPlayer.currentTurnCards = [];
      currentPlayer.isDoubled = false;
      currentPlayer.hasSecondChance = false;
      nextTurn(room);
      io.to(room.id).emit("game_state", room);
    });

    function handleFlip(room: GameState, player: Player) {
      if (room.deck.length === 0) {
        room.deck = shuffle([...room.discardPile]);
        room.discardPile = [];
        room.logs.push("Deck reshuffled.");
      }

      const card = room.deck.pop()!;
      player.currentTurnCards.push(card);
      room.logs.push(`${player.name} flipped ${typeof card.type === 'number' ? card.value : card.type}.`);

      // Check for bust
      const numbers = player.currentTurnCards.filter(c => typeof c.type === 'number');
      const duplicates = numbers.filter((c, index) => numbers.findIndex(n => n.type === c.type) !== index);

      if (duplicates.length > 0) {
        if (player.hasSecondChance) {
          player.hasSecondChance = false;
          // Remove the duplicate card from turn cards
          const index = player.currentTurnCards.indexOf(card);
          if (index > -1) player.currentTurnCards.splice(index, 1);
          room.discardPile.push(card);
          room.logs.push(`${player.name} used Second Chance to avoid bust!`);
        } else {
          room.logs.push(`${player.name} busted!`);
          room.isBusting = true;
          io.to(room.id).emit("game_state", room);

          setTimeout(() => {
            player.currentTurnCards.forEach(c => room.discardPile.push(c));
            player.currentTurnCards = [];
            player.isDoubled = false;
            player.hasSecondChance = false;
            room.isBusting = false;
            nextTurn(room);
            io.to(room.id).emit("game_state", room);
          }, 3000);
          return;
        }
      }

      // Handle special cards
      if (card.type === 'FREEZE') {
        room.logs.push(`${player.name} hit FREEZE! Banking points.`);
        handleBank(room, player);
        return;
      } else if (card.type === 'DOUBLE') {
        player.isDoubled = true;
      } else if (card.type === 'SECOND_CHANCE') {
        player.hasSecondChance = true;
      } else if (card.type === 'FLIP3') {
        room.logs.push(`${player.name} hit FLIP 3! (Note: In this version, you just get to keep flipping)`);
        // For now, FLIP3 just adds to the score potential without busting.
        // A more complex version would force 3 flips.
      }

      io.to(room.id).emit("game_state", room);
      
      // If it's a bot, they might flip again
      if (player.isBot) {
        checkBotTurn(room);
      }
    }

    function handleBank(room: GameState, player: Player) {
      let turnScore = player.currentTurnCards.reduce((acc, c) => acc + c.value, 0);
      if (player.isDoubled) turnScore *= 2;
      
      player.score += turnScore;
      room.logs.push(`${player.name} banked ${turnScore} points. Total: ${player.score}`);
      
      player.currentTurnCards.forEach(c => room.discardPile.push(c));
      player.currentTurnCards = [];
      player.isDoubled = false;
      player.hasSecondChance = false;

      if (player.score >= WINNING_SCORE) {
        room.status = 'GAME_OVER';
        room.winnerId = player.id;
        room.logs.push(`${player.name} wins the game!`);
      } else {
        nextTurn(room);
      }
      
      io.to(room.id).emit("game_state", room);
    }

    function nextTurn(room: GameState) {
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
      checkBotTurn(room);
    }

    function checkBotTurn(room: GameState) {
      const currentPlayer = room.players[room.currentPlayerIndex];
      if (currentPlayer && currentPlayer.isBot && room.status === 'PLAYING') {
        setTimeout(() => {
          // Bot logic: simple heuristic
          const turnScore = currentPlayer.currentTurnCards.reduce((acc, c) => acc + c.value, 0);
          const cardCount = currentPlayer.currentTurnCards.length;
          
          // If they have few cards or low score, flip
          if (cardCount < 3 || (turnScore < 15 && cardCount < 5)) {
            handleFlip(room, currentPlayer);
          } else {
            handleBank(room, currentPlayer);
          }
        }, 1500);
      }
    }

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Handle player leaving room
      rooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
          if (room.players.filter(p => !p.isBot).length === 0) {
            rooms.delete(roomId);
          } else {
            // Adjust currentPlayerIndex if needed
            if (room.currentPlayerIndex >= room.players.length) {
              room.currentPlayerIndex = 0;
            }
            io.to(roomId).emit("game_state", room);
            // If it's now a bot's turn, trigger it
            checkBotTurn(room);
          }
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:3000`);
  });
}

startServer();
