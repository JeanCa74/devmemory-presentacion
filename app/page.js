'use client';

import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export default function Home() {
  // --- ESTADOS (Variables reactivas) ---
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [panicMode, setPanicMode] = useState(false);
  const [showTimeBonus, setShowTimeBonus] = useState(false);

  // Referencia para el audio de fondo (para poder pausarlo/reanudarlo)
  const bgMusicRef = useRef(null);

  // --- EFECTOS (Lifecycle) ---

  // 1. Cargar Leaderboard y configurar Audio al iniciar
  useEffect(() => {
    const storedScores = JSON.parse(localStorage.getItem('devMemoryScores')) || [];
    setLeaderboard(storedScores);
    
    // Inicializar audio solo en el cliente
    bgMusicRef.current = new Audio('/bg-music.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.3;

    return () => {
      if (bgMusicRef.current) bgMusicRef.current.pause();
    };
  }, []);

  // 2. Temporizador
  useEffect(() => {
    let timerInterval;
    if (isPlaying && !isPaused && !isGameOver) {
      timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleGameOver();
            return 0;
          }
          // Activar modo pánico si queda poco tiempo
          if (prev <= 11) setPanicMode(true);
          else setPanicMode(false);
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [isPlaying, isPaused, isGameOver]);

// 3. Lógica de Match (Comparar cartas)
  // TODO: [Maria Jose] debe implementar esta lógica.
  // Detectar si las 2 cartas volteadas son iguales.
  // Si son iguales: sonar acierto, sumar puntos, sumar tiempo y limpiar volteadas.
  // Si no son iguales: esperar 800ms y volver a voltearlas.
  useEffect(() => {
     if (flippedCards.length === 2) {
      const [first, second] = flippedCards;
      
      if (first.value === second.value) {
        playSound('/match.mp3', 0.6);
        setCards((prev) =>
          prev.map((card) =>
            card.id === first.id || card.id === second.id
              ? { ...card, isMatched: true }
              : card
          )
        );
        setMatchedPairs((prev) => prev + 1);
        setScore((prev) => prev + (10 * level));
        setTimeLeft((prev) => prev + 5);
        triggerTimeBonus();
        setFlippedCards([]);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card) =>
              card.id === first.id || card.id === second.id
                ? { ...card, isFlipped: false }
                : card
            )
          );
          setFlippedCards([]);
        }, 800);
      }
     }
  }, [flippedCards]);


  // 4. Verificar Nivel Completado
  useEffect(() => {
    if (matchedPairs > 0 && matchedPairs === cards.length / 2) {
      setTimeout(nextLevel, 1000);
    }
  }, [matchedPairs]);

  // --- FUNCIONES LÓGICAS ---

  const playSound = (path, volume = 0.4) => {
    if (isMuted) return;
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(() => {});
  };

  const toggleSound = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (bgMusicRef.current) {
      if (newMuted) bgMusicRef.current.pause();
      else if (isPlaying && !isPaused) bgMusicRef.current.play();
    }
  };

  const generateLevel = (currentLevel) => {
    const numPairs = Math.min(8 + (currentLevel * 2), 28);
    const uniqueSeeds = new Set();
    
    while(uniqueSeeds.size < numPairs) {
      uniqueSeeds.add(`robot-${Math.floor(Math.random() * 999999)}`);
    }

    const levelIcons = Array.from(uniqueSeeds).map(seed => 
      `https://robohash.org/${seed}?set=set1&bgset=bg1&size=150x150`
    );

    const deck = [...levelIcons, ...levelIcons]
      .sort(() => 0.5 - Math.random())
      .map((img, index) => ({
        id: index, // ID único para React keys
        value: img,
        isFlipped: false,
        isMatched: false
      }));

    setCards(deck);
  };

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setTimeLeft(60);
    setIsPlaying(true);
    setIsPaused(false);
    setIsGameOver(false);
    setMatchedPairs(0);
    setFlippedCards([]);
    setPanicMode(false);
    
    generateLevel(1);
    
    if (!isMuted && bgMusicRef.current) {
      bgMusicRef.current.play().catch(e => console.log("Audio play failed"));
    }
  };

  const handleCardClick = (clickedCard) => {
    if (!isPlaying || isPaused || clickedCard.isFlipped || clickedCard.isMatched || flippedCards.length >= 2) return;

    playSound('/flip.mp3');

    // Voltear visualmente
    setCards((prev) => 
      prev.map(c => c.id === clickedCard.id ? { ...c, isFlipped: true } : c)
    );
    
    setFlippedCards((prev) => [...prev, clickedCard]);
  };

  const nextLevel = () => {
    const nextLvl = level + 1;
    setLevel(nextLvl);
    setScore((prev) => prev + 100);
    setTimeLeft((prev) => prev + 10);
    setMatchedPairs(0);
    setFlippedCards([]);
    generateLevel(nextLvl);
  };

  const handleGameOver = () => {
    setIsGameOver(true);
    setIsPlaying(false);
    if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current.currentTime = 0;
    }
    setPanicMode(false);
  };

  const saveScore = () => {
    // TODO: [Jhon] debe implementar el guardado.
    // 1. Crear objeto con nombre, puntaje y fecha.
    // 2. Guardar en LocalStorage y actualizar estado.
    // 3. Lanzar confeti.
    // 4. Cerrar modal.
    const name = playerName.trim() || "Anonimo";
    const newRecord = { name, score, date: new Date().toLocaleDateString() };
    const newLeaderboard = [...leaderboard, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    localStorage.setItem('devMemoryScores', JSON.stringify(newLeaderboard));
    setLeaderboard(newLeaderboard);
    
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());

    setIsGameOver(false);
  };

  const triggerTimeBonus = () => {
    setShowTimeBonus(true);
    setTimeout(() => setShowTimeBonus(false), 1000);
  };

  const clearLeaderboard = () => {
      if(confirm("¿Borrar records?")) {
          localStorage.removeItem('devMemoryScores');
          setLeaderboard([]);
      }
  };

  // --- RENDERIZADO (JSX) ---
  return (
    <div className={`min-h-screen flex justify-center items-center ${panicMode ? 'panic-mode-bg' : ''}`}>
      {/* Usamos el CSS global, pero aplicamos clases aquí */}
      <div className={`game-container ${panicMode ? 'panic-mode' : ''}`}>
        
        <header>
          <h1>&lt;DevMemory /&gt;</h1>
          <div className="stats-bar">
            <div className="stat-box">Nivel: <span>{level}</span></div>
            <div className="stat-box">Puntos: <span>{score}</span></div>
            <div className="stat-box timer" style={{ position: 'relative' }}>
              Tiempo: <span style={{ color: timeLeft < 10 ? '#f43f5e' : '#f8fafc' }}>{timeLeft}</span>s
              {showTimeBonus && <div className="time-bonus">+5s</div>}
            </div>
          </div>
        </header>

        {/* Tablero */}
        <div className="game-board">
          {cards.map((card) => (
            <div 
              key={card.id} 
              className={`card ${card.isFlipped || card.isMatched ? 'flipped' : ''} ${card.isMatched ? 'matched' : ''}`}
              onClick={() => handleCardClick(card)}
            >
              <div className="card-face card-front">?</div>
              <div className="card-face card-back">
                {/* Nota: Usamos <img> normal, si usas Next/Image necesitas configurar dominios */}
                <img src={card.value} alt="robot" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Controles */}
        <div className="controls">
          <button onClick={startGame} disabled={isPlaying} className="btn primary">
            {isPlaying ? "Jugando..." : "Iniciar Partida"}
          </button>
          
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            disabled={!isPlaying || isGameOver} 
            className="btn warning"
          >
            {isPaused ? "Reanudar" : "Pausar"}
          </button>
          
          <button onClick={toggleSound} className={`btn primary ${isMuted ? 'sound-off' : ''}`}>
            {isMuted ? "🔇 OFF" : "🔊 ON"}
          </button>
          
          <button 
            onClick={() => { if(confirm("¿Rendirse?")) handleGameOver(); }} 
            disabled={!isPlaying} 
            className="btn danger"
          >
            Rendirse
          </button>
          
          <button onClick={clearLeaderboard} className="btn danger-outline">Borrar Records</button>
        </div>

        {/* Leaderboard */}
        <div className="leaderboard-section">
          <h3>Top 5 Jugadores</h3>
          <ul>
            {leaderboard.length === 0 ? (
              <li>No hay registros aún.</li>
            ) : (
              leaderboard.map((rec, i) => (
                <li key={i}>
                  <span>#{i + 1} <strong style={{ color: 'var(--accent)' }}>{rec.name}</strong></span>
                  <span>{rec.score} pts</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Modal Pausa */}
      {isPaused && (
        <div className="modal">
          <div className="modal-content">
            <h2>⏸ Juego Pausado</h2>
            <button onClick={() => setIsPaused(false)} className="btn primary">Reanudar</button>
          </div>
        </div>
      )}

      {/* Modal Game Over */}
      {isGameOver && (
        <div className="modal">
          <div className="modal-content">
            <h2>¡System Failure!</h2>
            <p>Puntuación Final: {score}</p>
            <input 
              type="text" 
              placeholder="Tu Nickname" 
              maxLength="15" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            <button onClick={saveScore} className="btn primary">Guardar Record</button>
          </div>
        </div>
      )}
    </div>
  );
}