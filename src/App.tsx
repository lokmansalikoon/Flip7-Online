import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, RotateCcw, Trophy, MessageSquare, Shield, Zap, Snowflake, TrendingUp } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---

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
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  winnerId: string | null;
  logs: string[];
  isBusting: boolean;
}

// --- Components ---

const CardView = ({ card, isNew, isDuplicate }: { card: Card, isNew?: boolean, isDuplicate?: boolean, key?: string }) => {
  const getCardContent = () => {
    if (typeof card.type === 'number') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-4xl font-bold">{card.type}</span>
          <div className="grid grid-cols-3 gap-1 mt-2">
             {Array.from({ length: Math.min(card.type, 9) }).map((_, i) => (
               <div key={i} className="w-1.5 h-1.5 bg-current rounded-full" />
             ))}
          </div>
        </div>
      );
    }
    switch (card.type) {
      case 'FLIP3': return <div className="flex flex-col items-center"><Zap className="w-8 h-8 mb-1" /><span className="text-xs font-bold">FLIP 3</span></div>;
      case 'FREEZE': return <div className="flex flex-col items-center"><Snowflake className="w-8 h-8 mb-1" /><span className="text-xs font-bold">FREEZE</span></div>;
      case 'DOUBLE': return <div className="flex flex-col items-center"><TrendingUp className="w-8 h-8 mb-1" /><span className="text-xs font-bold">DOUBLE</span></div>;
      case 'SECOND_CHANCE': return <div className="flex flex-col items-center"><Shield className="w-8 h-8 mb-1" /><span className="text-xs font-bold">2ND CHANCE</span></div>;
    }
  };

  const getCardColor = () => {
    if (typeof card.type === 'number') {
      if (isDuplicate) return 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/50';
      if (card.type <= 4) return 'bg-slate-100 text-slate-800 border-slate-300';
      if (card.type <= 8) return 'bg-blue-100 text-blue-800 border-blue-300';
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    }
    switch (card.type) {
      case 'FLIP3': return 'bg-yellow-100 text-yellow-800 border-yellow-400';
      case 'FREEZE': return 'bg-cyan-100 text-cyan-800 border-cyan-400';
      case 'DOUBLE': return 'bg-emerald-100 text-emerald-800 border-emerald-400';
      case 'SECOND_CHANCE': return 'bg-rose-100 text-rose-800 border-rose-400';
    }
  };

  return (
    <motion.div
      initial={isNew ? { scale: 0, rotateY: 180 } : false}
      animate={{ scale: 1, rotateY: 0 }}
      className={`w-24 h-36 rounded-xl border-2 shadow-sm flex items-center justify-center ${getCardColor()}`}
    >
      {getCardContent()}
    </motion.div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState('');
  const [botCount, setBotCount] = useState(1);
  const [showSidebar, setShowSidebar] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('game_state', (state: GameState) => {
      setGameState(state);
      if (state.status === 'GAME_OVER' && state.winnerId === newSocket.id) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.logs]);

  const joinGame = () => {
    socket?.emit('join_game', { name, botCount });
  };

  const startGame = () => {
    if (gameState) socket?.emit('start_game', gameState.id);
  };

  const flipCard = () => {
    if (gameState) socket?.emit('flip_card', gameState.id);
  };

  const bankPoints = () => {
    if (gameState) socket?.emit('bank_points', gameState.id);
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-black/5"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-black rounded-xl flex items-center justify-center text-white font-bold text-xl md:text-2xl">7</div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter italic">FLIP 7 ONLINE</h1>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Your Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full px-4 py-3 rounded-xl border-2 border-black/10 focus:border-black outline-none transition-colors font-medium text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Opponent Bots ({botCount})</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setBotCount(n)}
                    className={`flex-1 py-2 rounded-lg border-2 font-bold text-sm transition-all ${botCount === n ? 'bg-black text-white border-black' : 'bg-white text-black border-black/10 hover:border-black/30'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={joinGame}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold text-base md:text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/20 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              JOIN LOBBY
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-black/40 font-medium leading-relaxed">
            Flip cards to score points. Don't flip the same number twice or you'll bust! First to 200 points wins.
          </p>
        </motion.div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === socket?.id;

  // Find duplicates for highlighting
  const numbers = currentPlayer?.currentTurnCards.filter(c => typeof c.type === 'number') || [];
  const duplicateTypes = numbers.filter((c, index) => numbers.findIndex(n => n.type === c.type) !== index).map(c => c.type);

  return (
    <div className="h-screen bg-[#E4E3E0] font-sans text-black flex flex-col md:flex-row overflow-hidden relative">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-black/5 p-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold text-sm">7</div>
          <h2 className="text-lg font-black italic tracking-tighter">FLIP 7</h2>
        </div>
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          className="p-2 bg-black/5 rounded-lg text-black/60"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar: Players & Logs */}
      <div className={`
        fixed inset-0 z-30 bg-white md:relative md:translate-x-0 transition-transform duration-300 ease-in-out
        w-full md:w-80 border-r border-black/5 flex flex-col h-full
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-black/5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black italic tracking-tighter">GAME INFO</h2>
            <button 
              onClick={() => setShowSidebar(false)}
              className="md:hidden p-2 bg-black/5 rounded-lg text-black/60"
            >
              <Play className="w-5 h-5 rotate-180" />
            </button>
          </div>

          <div className="mb-6 space-y-2">
             <button 
               onClick={() => window.location.reload()}
               className="w-full py-2 bg-black/5 text-black/40 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black/10 transition-colors"
             >
               Leave Game
             </button>
             {gameState.players[0]?.id === socket?.id && gameState.status === 'PLAYING' && (
               <button 
                 onClick={() => socket?.emit('force_next_turn', gameState.id)}
                 className="w-full py-2 bg-rose-50 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-100 transition-colors"
               >
                 Force Next Turn
               </button>
             )}
          </div>

          <div className="space-y-3">
            {gameState.players.map((p, idx) => (
              <div 
                key={p.id} 
                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${idx === gameState.currentPlayerIndex ? 'border-black bg-black/5' : 'border-transparent opacity-60'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.isBot ? 'bg-slate-200' : 'bg-black text-white'}`}>
                    {p.isBot ? 'B' : p.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-none mb-1">{p.name}</div>
                    <div className="text-[10px] font-bold text-black/40 uppercase tracking-wider">{p.score} PTS</div>
                  </div>
                </div>
                {idx === gameState.currentPlayerIndex && (
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 bg-black rounded-full"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 text-[10px] font-bold uppercase tracking-widest text-black/30 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" /> Game Log
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {gameState.logs.map((log, i) => (
              <div key={i} className="text-xs font-medium text-black/60 leading-tight border-l-2 border-black/5 pl-2 py-1">
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {gameState.status === 'LOBBY' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center space-y-6">
              <Users className="w-12 h-12 md:w-16 md:h-16 mx-auto text-black/10" />
              <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase">WAITING</h2>
              <p className="text-sm text-black/40 font-medium">Invite friends or start with bots.</p>
              <button 
                onClick={startGame}
                className="px-10 py-4 bg-black text-white rounded-2xl font-bold text-lg md:text-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20"
              >
                START GAME
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-12 overflow-y-auto">
            {/* Current Turn Display */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
              <div className="text-center mb-6 md:mb-8">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/30 mb-2">
                  {isMyTurn ? "YOUR TURN" : `${currentPlayer?.name}'S TURN`}
                </h3>
                <div className="text-5xl md:text-6xl font-black italic tracking-tighter flex items-center justify-center gap-3">
                   {currentPlayer?.currentTurnCards.reduce((acc, c) => acc + c.value, 0) * (currentPlayer?.isDoubled ? 2 : 1)}
                   {currentPlayer?.isDoubled && <span className="text-emerald-500 text-xl md:text-2xl">x2</span>}
                </div>
                <div className="flex justify-center gap-2 mt-4">
                  {currentPlayer?.hasSecondChance && (
                    <div className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full border border-rose-200 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> 2ND CHANCE
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 md:gap-4 max-w-3xl">
                <AnimatePresence mode="popLayout">
                  {currentPlayer?.currentTurnCards.map((card, i) => (
                    <div key={card.id} className="scale-75 md:scale-100 origin-center">
                      <CardView 
                        card={card} 
                        isNew={i === currentPlayer.currentTurnCards.length - 1} 
                        isDuplicate={gameState.isBusting && duplicateTypes.includes(card.type)}
                      />
                    </div>
                  ))}
                  {currentPlayer?.currentTurnCards.length === 0 && (
                    <div className="w-20 h-28 md:w-24 md:h-36 rounded-xl border-2 border-dashed border-black/10 flex items-center justify-center text-black/10">
                      <Play className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Controls */}
            <div className="h-24 md:h-32 flex items-center justify-center gap-3 md:gap-4 mt-auto relative">
              {gameState.isBusting && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                >
                  <div className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-4xl italic tracking-tighter shadow-2xl shadow-rose-600/50 rotate-[-5deg]">
                    BUST!
                  </div>
                </motion.div>
              )}
              {gameState.status === 'GAME_OVER' ? (
                <div className="text-center">
                  <h2 className="text-2xl md:text-3xl font-black italic mb-4">
                    {gameState.winnerId === socket?.id ? "YOU WON!" : "GAME OVER"}
                  </h2>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-black text-white rounded-xl font-bold flex items-center gap-2 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> PLAY AGAIN
                  </button>
                </div>
              ) : (
                <>
                  <button
                    disabled={!isMyTurn}
                    onClick={flipCard}
                    className={`flex-1 md:flex-none h-16 md:h-20 px-6 md:px-12 rounded-2xl font-black text-base md:text-xl flex items-center justify-center gap-2 transition-all shadow-lg ${isMyTurn ? 'bg-black text-white hover:scale-105 active:scale-95 shadow-black/20' : 'bg-black/5 text-black/20 cursor-not-allowed'}`}
                  >
                    FLIP
                  </button>
                  <button
                    disabled={!isMyTurn || currentPlayer?.currentTurnCards.length === 0}
                    onClick={bankPoints}
                    className={`flex-1 md:flex-none h-16 md:h-20 px-6 md:px-12 rounded-2xl font-black text-base md:text-xl flex items-center justify-center gap-2 transition-all shadow-lg ${isMyTurn && currentPlayer?.currentTurnCards.length > 0 ? 'bg-white text-black border-2 border-black hover:scale-105 active:scale-95 shadow-black/5' : 'bg-black/5 text-black/20 cursor-not-allowed'}`}
                  >
                    BANK
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

