'use client';

import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export default function Home() {
  // --- ESTADOS DEL JUEGO ---
  const [showMenu, setShowMenu] = useState(true);
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // Estados de Control
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [panicMode, setPanicMode] = useState(false);

  // Estados de Datos
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);

  // Estados de "Game Feel" (Efectos visuales)
  const [comboCount, setComboCount] = useState(0);     // Racha actual
  const [showCombo, setShowCombo] = useState(null);    // Texto flotante (ej: "x2")
  const [shakingCards, setShakingCards] = useState([]); // Cartas que tiemblan (error)
  const [showTimeBonus, setShowTimeBonus] = useState(false); // Texto "+5s"

  // Referencias (Audio y Tiempo)
  const lastMatchTime = useRef(0); 
  const bgMusicRef = useRef(null);
  const panicAudioRef = useRef(null); 

  // --- EFECTOS (LIFECYCLE) ---

  // 1. Inicialización (Cargar Leaderboard y Configurar Audio)
  useEffect(() => {
    const storedScores = JSON.parse(localStorage.getItem('devMemoryScores')) || [];
    setLeaderboard(storedScores);
    
    // Configuración Música de Fondo
    bgMusicRef.current = new Audio('/bg-music.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.3;

    // Configuración Sonido Pánico (Latido/Reloj)
    panicAudioRef.current = new Audio('/panic.mp3'); 
    panicAudioRef.current.loop = true;
    panicAudioRef.current.volume = 0.5;

    return () => {
      if (bgMusicRef.current) bgMusicRef.current.pause();
      if (panicAudioRef.current) panicAudioRef.current.pause();
    };
  }, []);

  // 2. Control Inteligente de Audio (Mezcla Pánico y Música)
  useEffect(() => {
    // Solo suena el pánico si estamos jugando, con poco tiempo y NO muteados
    if (panicMode && isPlaying && !isPaused && !showMenu && !isGameOver && !isLevelingUp && !isMuted) {
        panicAudioRef.current.play().catch(() => {});
        // Bajamos la música de fondo para dar tensión
        if(bgMusicRef.current) bgMusicRef.current.volume = 0.1; 
    } else {
        // Apagamos pánico
        panicAudioRef.current.pause();
        panicAudioRef.current.currentTime = 0;
        // Restauramos volumen normal
        if(bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.3;
    }
  }, [panicMode, isPlaying, isPaused, showMenu, isGameOver, isLevelingUp, isMuted]);

  // 3. Temporizador Principal
  useEffect(() => {
    let timerInterval;
    if (isPlaying && !isPaused && !isGameOver && !showMenu && !isLevelingUp) {
      timerInterval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleGameOver();
            return 0;
          }
          // Activar Modo Pánico si quedan 11 segundos o menos
          if (prev <= 11) setPanicMode(true);
          else setPanicMode(false);
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [isPlaying, isPaused, isGameOver, showMenu, isLevelingUp]);

  // 4. Lógica de Juego: Comparación de Cartas
  useEffect(() => {
    if (flippedCards.length === 2) {
      const [first, second] = flippedCards;
      
      if (first.value === second.value) {
        // --- ACIERTO (MATCH) ---
        handleMatchSuccess(first, second);
      } else {
        // --- ERROR (NO MATCH) ---
        // 1. Activar temblor visual
        setShakingCards([first.id, second.id]);
        playSound('/flip.mp3', 0.5); 

        // 2. Esperar y voltear
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card) =>
              card.id === first.id || card.id === second.id
                ? { ...card, isFlipped: false }
                : card
            )
          );
          setFlippedCards([]);
          setShakingCards([]); // Quitar temblor
          setComboCount(0);    // Romper combo
        }, 800);
      }
    }
  }, [flippedCards]);

  // 5. Detectar Fin de Nivel
  useEffect(() => {
    if (matchedPairs > 0 && matchedPairs === cards.length / 2) {
      handleLevelUpSequence();
    }
  }, [matchedPairs]);

  // --- FUNCIONES LÓGICAS ---

  // Maneja todo lo que pasa cuando aciertas un par
  const handleMatchSuccess = (first, second) => {
    playSound('/match.mp3', 0.6);
    
    // --- LÓGICA DE COMBOS ---
    const now = Date.now();
    let newCombo = 1;
    // Si acertaste hace menos de 4 segundos, aumentamos combo
    if (now - lastMatchTime.current < 4000) {
        newCombo = comboCount + 1;
    }
    setComboCount(newCombo);
    lastMatchTime.current = now;

    // Mostrar Texto Flotante (ej: x2, x3)
    if (newCombo > 1) {
        setShowCombo(`x${newCombo}`);
        setTimeout(() => setShowCombo(null), 800);
    }

    // Calcular puntos (Base * Nivel * Combo)
    const points = (10 * level) * newCombo;
    setScore((prev) => prev + points);

    // Actualizar estados de cartas
    setCards((prev) =>
      prev.map((card) =>
        card.id === first.id || card.id === second.id
          ? { ...card, isMatched: true }
          : card
      )
    );
    setMatchedPairs((prev) => prev + 1);
    setTimeLeft((prev) => prev + 5); // +5s por acierto
    triggerTimeBonus(); // Animación visual
    setFlippedCards([]);
  };

  const playSound = (path, volume = 0.4) => {
    if (isMuted) return;
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(() => {});
  };

  const toggleSound = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    // Control manual inmediato para respuesta rápida
    if (bgMusicRef.current) {
      if (newMuted) bgMusicRef.current.pause();
      else if (isPlaying && !isPaused && !showMenu) bgMusicRef.current.play();
    }
    if (panicAudioRef.current) {
       if (newMuted) panicAudioRef.current.pause();
    }
  };

  // Efecto de Confeti (Fuego)
  const triggerFireEffect = () => {
    const duration = 1000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: ['#ef4444', '#f97316', '#eab308'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: ['#ef4444', '#f97316', '#eab308'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const handleLevelUpSequence = () => {
    setIsLevelingUp(true);
    triggerFireEffect();
    // Pausa dramática de 2.5s antes del siguiente nivel
    setTimeout(() => {
        nextLevel();
        setIsLevelingUp(false);
    }, 2500);
  };

  const generateLevel = (currentLevel) => {
    // Límite aumentado a 30 pares (60 cartas) para niveles avanzados
    const numPairs = Math.min(8 + (currentLevel * 2), 30); 
    
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
        id: index,
        value: img,
        isFlipped: false,
        isMatched: false
      }));
    setCards(deck);
  };

  // --- CALIBRACIÓN DE TAMAÑO DE GRILLA ---
  const getBoardClass = () => {
      // Si hay muchas cartas (aprox Nivel 10+), usa modo SUPER COMPACTO
      if (cards.length >= 48) return "game-board super-compact";
      // Si hay bastantes cartas (aprox Nivel 7-9), usa modo COMPACTO
      if (cards.length >= 36) return "game-board compact";
      // Niveles 1-6: Tamaño normal (GRANDE)
      return "game-board";
  };

  const startGame = () => {
    setShowMenu(false);
    setScore(0);
    setLevel(1);
    setTimeLeft(60);
    setIsPlaying(true);
    setIsPaused(false);
    setIsGameOver(false);
    setIsLevelingUp(false);
    setMatchedPairs(0);
    setFlippedCards([]);
    setPanicMode(false);
    setComboCount(0);
    generateLevel(1);
    
    if (!isMuted && bgMusicRef.current) {
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.play().catch(e => console.log("Audio play failed"));
    }
  };

  const returnToMenu = () => {
    if(confirm("¿Salir al menú principal? (No se guardará el récord)")) {
        exitWithoutSaving();
    }
  };

  // Función de Limpieza Total al Salir
  const exitWithoutSaving = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsGameOver(false); // Cierra modal Game Over
      setIsLevelingUp(false);
      setPanicMode(false);
      setShowMenu(true);    // Muestra menú
      
      // Detener todos los audios
      if (bgMusicRef.current) {
          bgMusicRef.current.pause();
          bgMusicRef.current.currentTime = 0;
      }
      if (panicAudioRef.current) panicAudioRef.current.pause();
  };

  const handleCardClick = (clickedCard) => {
    // Validaciones estrictas anti-click
    if (!isPlaying || isPaused || isLevelingUp || clickedCard.isFlipped || clickedCard.isMatched || flippedCards.length >= 2) return;
    
    playSound('/flip.mp3');
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
    if (bgMusicRef.current) bgMusicRef.current.pause();
    if (panicAudioRef.current) panicAudioRef.current.pause();
    setPanicMode(false);
  };

  const saveScore = () => {
    const name = playerName.trim() || "Anonimo";
    const newRecord = { name, score, date: new Date().toLocaleDateString() };
    const newLeaderboard = [...leaderboard, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    localStorage.setItem('devMemoryScores', JSON.stringify(newLeaderboard));
    setLeaderboard(newLeaderboard);
    
    setIsGameOver(false);
    setShowMenu(true);
    
    // Confeti de Celebración Final
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  };

  const triggerTimeBonus = () => {
    setShowTimeBonus(true);
    setTimeout(() => setShowTimeBonus(false), 1000);
  };

  // Genera el Ranking en Vivo (Mezcla LocalStorage + Puntaje Actual)
  const getLiveLeaderboard = () => {
    let mixedList = [...leaderboard];
    if (!showMenu) mixedList.push({ name: "TÚ (Ahora)", score: score, isCurrent: true });
    mixedList.sort((a, b) => b.score - a.score);
    return mixedList.slice(0, 5);
  };
  const liveList = getLiveLeaderboard();


  // --- RENDERIZADO (JSX) ---
  return (
    <div className={`min-h-screen ${panicMode ? 'panic-mode-bg' : ''}`}>
      
      {/* 1. PANTALLA DE MENÚ */}
      {showMenu ? (
        <div className="menu-screen">
            <h1 className="title-large">&lt;DevMemory /&gt;</h1>
            <p className="subtitle" style={{color:'#94a3b8', marginBottom:'30px'}}>Mahjong Edition</p>
            
            <button onClick={startGame} className="btn primary btn-large">
                ▶ Jugar Ahora
            </button>

            <div className="menu-leaderboard">
                <h3 style={{color:'var(--accent)'}}>🏆 Hall of Fame</h3>
                <ul>
                    {leaderboard.length === 0 ? <li>Sin registros aún</li> : 
                        leaderboard.map((rec, i) => (
                            <li key={i}>
                                <span>#{i+1} {rec.name}</span>
                                <span>{rec.score} pts</span>
                            </li>
                        ))
                    }
                </ul>
            </div>
            <div style={{marginTop:'30px', color:'#64748b', fontSize:'0.8rem'}}>Powered by Next.js & RoboHash</div>
        </div>
      ) : (
        /* 2. PANTALLA DE JUEGO */
        <div className={`game-container ${panicMode ? 'panic-mode' : ''}`}>
            
            {/* BARRA LATERAL (IZQUIERDA) */}
            <div className="sidebar">
                <header>
                  <h2 style={{margin:0, color:'var(--accent)'}}>Nivel {level}</h2>
                  <div className="stats-bar">
                    <div className="stat-box timer" style={{ position: 'relative' }}>
                      ⏳ <span style={{ color: timeLeft < 10 ? '#f43f5e' : '#f8fafc' }}>{timeLeft}s</span>
                      {showTimeBonus && <div className="time-bonus">+5s</div>}
                    </div>
                    <div className="stat-box">Score: {score}</div>
                  </div>
                </header>

                <div className="controls">
                  <div className="mini-controls">
                      <button onClick={() => setIsPaused(!isPaused)} className="btn warning">
                        {isPaused ? "▶" : "⏸"}
                      </button>
                      <button onClick={toggleSound} className={`btn primary ${isMuted ? 'sound-off' : ''}`}>
                        {isMuted ? "🔇" : "🔊"}
                      </button>
                  </div>
                  
                  <button 
                    onClick={() => { if(confirm("¿Rendirse y guardar puntaje?")) handleGameOver(); }} 
                    className="btn danger"
                  >
                    🏳 Rendirse
                  </button>

                  <button onClick={returnToMenu} className="btn danger-outline">
                    🏠 Salir al Menú
                  </button>
                </div>

                {/* RANKING EN VIVO */}
                <div className="leaderboard-mini">
                  <h4 style={{margin:'0 0 10px 0', color:'#94a3b8'}}>Ranking En Vivo</h4>
                  <ul>
                    {liveList.map((rec, i) => (
                        <li 
                            key={i} 
                            style={rec.isCurrent ? { 
                                background: 'rgba(6, 182, 212, 0.2)', 
                                border: '1px solid var(--accent)',
                                borderRadius: '4px',
                                padding: '5px'
                            } : {}}
                        >
                            <span style={rec.isCurrent ? {color: '#86efac', fontWeight:'bold'} : {}}>
                                {i+1}. {rec.name}
                            </span> 
                            <span>{rec.score}</span>
                        </li>
                    ))}
                  </ul>
                </div>
            </div>

            {/* ZONA DE TABLERO (DERECHA) */}
            <div className="game-board-wrapper">
                
                {/* TEXTO DE COMBO (FLOTANTE) */}
                {showCombo && <div className="combo-text">{showCombo}!</div>}

                {/* GRILLA DE CARTAS (Se ajusta con getBoardClass) */}
                <div className={getBoardClass()}>
                {cards.map((card) => (
                    <div 
                    key={card.id} 
                    className={`card 
                        ${card.isFlipped || card.isMatched ? 'flipped' : ''} 
                        ${card.isMatched ? 'matched' : ''}
                        ${shakingCards.includes(card.id) ? 'shake' : ''} 
                    `}
                    onClick={() => handleCardClick(card)}
                    >
                    <div className="card-face card-front">?</div>
                    <div className="card-face card-back">
                        <img src={card.value} alt="robot" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                    </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
      )}

      {/* --- MODALES --- */}

      {/* 1. LEVEL UP */}
      {isLevelingUp && (
        <div className="modal" style={{background:'rgba(0,0,0,0.5)'}}>
            <div className="level-up-content">
                <h2 className="level-up-title">🔥 ¡NIVEL {level} SUPERADO! 🔥</h2>
                <div className="level-up-stats">
                    <p>Bonus de Tiempo: +10s</p>
                    <p>Bonus de Nivel: +100pts</p>
                </div>
                <p style={{fontSize:'0.9rem', marginTop:'20px'}}>Cargando siguiente nivel...</p>
            </div>
        </div>
      )}

      {/* 2. PAUSA */}
      {isPaused && (
        <div className="modal">
          <div className="modal-content">
            <h2>⏸ Pausa</h2>
            <button onClick={() => setIsPaused(false)} className="btn primary">Continuar</button>
          </div>
        </div>
      )}

      {/* 3. GAME OVER */}
      {isGameOver && (
        <div className="modal">
          <div className="modal-content">
            <h2 style={{color: timeLeft > 0 ? 'var(--warning)' : 'var(--danger)'}}>
                {timeLeft > 0 ? "¡Partida Finalizada!" : "¡System Failure!"}
            </h2>
            <p style={{fontSize:'1.2rem'}}>Puntuación Final: {score}</p>
            <input 
              type="text" 
              placeholder="Ingresa tu Nickname" 
              maxLength="15" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              autoFocus
            />
            <button onClick={saveScore} className="btn primary" style={{width:'100%', marginBottom:'10px'}}>
                Guardar Record 💾
            </button>
            <button onClick={exitWithoutSaving} className="btn danger-outline" style={{width:'100%'}}>
                Salir sin guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}