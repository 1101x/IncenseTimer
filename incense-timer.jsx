import { useState, useEffect, useRef, useCallback } from "react";

const MAX_SECONDS = 3600;
const STICK_MAX_HEIGHT = 120;
const SEC_PER_PX = MAX_SECONDS / STICK_MAX_HEIGHT;

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function SmokeParticle({ id }) {
  const dur   = (2.5 + Math.random() * 2).toFixed(2);
  const drift = ((Math.random() - 0.5) * 40).toFixed(1);
  const delay = (Math.random() * 1.5).toFixed(2);
  return (
    <div style={{
      position: "absolute", left: 26, top: 0,
      width: 8, height: 8, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(220,80,80,0.7), rgba(180,40,40,0))",
      animation: `smokeRise ${dur}s ease-out ${delay}s forwards`,
      "--drift": `${drift}px`,
      pointerEvents: "none",
    }} />
  );
}

export default function IncenseTimer() {
  const [totalSeconds, setTotalSeconds] = useState(3600);
  const [remaining,    setRemaining]    = useState(3600);
  const [running,      setRunning]      = useState(false);
  const [finished,     setFinished]     = useState(false);
  const [dragging,     setDragging]     = useState(false);
  const [particles,    setParticles]    = useState([]);

  const intervalRef    = useRef(null);
  const particleRef    = useRef(null);
  const particleIdRef  = useRef(0);
  const audioCtxRef    = useRef(null);
  const totalSecRef    = useRef(3600); // stale-closure 없이 현재값 추적
  const lastYRef       = useRef(null);

  // ── 연기 파티클 ──────────────────────────────────────────
  useEffect(() => {
    if (running) {
      particleRef.current = setInterval(() => {
        setParticles(prev => [
          ...prev.filter(p => Date.now() - p.born < 4500),
          { id: particleIdRef.current++, born: Date.now() },
        ]);
      }, 220);
    } else {
      clearInterval(particleRef.current);
      setParticles([]);
    }
    return () => clearInterval(particleRef.current);
  }, [running]);

  // ── 카운트다운 ────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setFinished(true);
            triggerAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // ── 알람 ─────────────────────────────────────────────────
  function triggerAlarm() {
    try {
      navigator.vibrate?.([300, 100, 300, 100, 500]);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      [[880,0,.5],[1100,.5,.5],[880,1,.5],[1320,1.5,1]].forEach(([freq, start, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      });
    } catch (_) {}
  }

  // ── 버튼 핸들러 ──────────────────────────────────────────
  function handleStart() {
    if (finished) { setFinished(false); setRemaining(totalSeconds); }
    setRunning(true);
  }

  function handlePause() { setRunning(false); }

  function handleReset() {
    setRunning(false);
    setFinished(false);
    setRemaining(totalSeconds);
    totalSecRef.current = totalSeconds;
    setParticles([]);
  }

  // ── 드래그 (슬라이더 방식) ────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (running || finished) return;
    e.preventDefault();
    lastYRef.current = e.clientY;
    setDragging(true);
  }, [running, finished]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault();
    const dy = lastYRef.current - e.clientY;
    lastYRef.current = e.clientY;
    const next = Math.min(MAX_SECONDS, Math.max(60, Math.round(totalSecRef.current + dy * SEC_PER_PX)));
    totalSecRef.current = next;
    setTotalSeconds(next);
    setRemaining(next);
  }, [dragging]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup",   handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup",   handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  // ── 향 높이 계산 ──────────────────────────────────────────
  const displayHeight = Math.max(2,
    ((running || finished ? remaining : totalSeconds) / MAX_SECONDS) * STICK_MAX_HEIGHT
  );

  const label = finished ? "시간이 완료되었습니다"
              : running  ? "향이 타고 있습니다"
              :            "향 길이로 시간을 설정하세요";

  // 4. 커서: 조작 가능할 때만 ns-resize
  const sceneCursor = (!running && !finished) ? "ns-resize" : "default";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600&family=Cinzel:wght@400;600&display=swap');

        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

        html, body {
          background: #0a0a0f;
          overflow: hidden;
          overscroll-behavior: none;
          height: 100%; width: 100%;
          position: fixed;
          touch-action: none;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Noto Serif KR', serif;
        }

        @keyframes smokeRise {
          0%   { transform: translate(0,0) scale(1); opacity: .8; }
          50%  { transform: translate(calc(var(--drift)*.5),-60px) scale(2.5); opacity: .5; }
          100% { transform: translate(var(--drift),-140px) scale(4); opacity: 0; }
        }
        @keyframes glowPulse {
          0%,100% { filter: drop-shadow(0 0 8px rgba(200,160,60,.5)); }
          50%     { filter: drop-shadow(0 0 18px rgba(220,180,80,.85)); }
        }
        @keyframes emberGlow {
          0%,100% { box-shadow: 0 0 6px 2px rgba(220,60,40,.8), 0 0 12px 4px rgba(255,120,60,.4); }
          50%     { box-shadow: 0 0 10px 4px rgba(255,100,30,1), 0 0 20px 8px rgba(255,60,20,.6); }
        }
        @keyframes floatUp {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-6px); }
        }

        .app-wrapper {
          width: 390px; min-height: 844px;
          background: radial-gradient(ellipse at 50% 30%, #1a1428 0%, #0d0d15 50%, #060608 100%);
          position: relative;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          overflow: hidden; border-radius: 40px;
          box-shadow: 0 0 80px rgba(0,0,0,.9);
          margin: auto;
        }

        .bg-circle { position: absolute; border-radius: 50%; pointer-events: none; }

        .scene {
          position: relative; width: 220px; height: 420px;
          display: flex; flex-direction: column; align-items: center;
          animation: floatUp 4s ease-in-out infinite;
          touch-action: none; user-select: none;
        }

        .smoke-area {
          position: absolute; left: 50%; transform: translateX(-50%);
          width: 60px; height: 180px;
          pointer-events: none; overflow: visible;
        }

        .incense-stick-wrap {
          position: absolute; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center;
          user-select: none; z-index: 2;
        }

        .ember {
          width: 9px; height: 9px; border-radius: 50%;
          background: radial-gradient(circle, #ff6a2a, #cc2200);
          animation: emberGlow 1s ease-in-out infinite;
          margin-bottom: -1px; flex-shrink: 0;
        }
        .ember.off { background: #2a1a1a; box-shadow: none; animation: none; }

        .stick {
          width: 7px; border-radius: 3px 3px 0 0;
          background: linear-gradient(to bottom, #2d7a3a, #1f5a28);
          box-shadow: 0 0 4px rgba(60,180,80,.3);
          transition: height .95s linear;
        }
        .stick-base { width: 7px; height: 6px; background: #5a3a1a; border-radius: 0 0 2px 2px; }

        .burner-svg { animation: glowPulse 3s ease-in-out infinite; margin-top: -8px; }

        .time-display {
          font-family: 'Cinzel', serif; font-size: 42px; font-weight: 400;
          color: rgba(255,255,255,.92); letter-spacing: 4px;
          margin-top: 48px; text-shadow: 0 0 30px rgba(180,140,60,.4);
        }
        .time-label {
          font-family: 'Noto Serif KR', serif; font-size: 11px;
          color: rgba(180,150,80,.5); letter-spacing: 3px;
          margin-top: 6px; text-transform: uppercase;
          min-height: 1.4em;
        }

        .controls { display: flex; gap: 16px; margin-top: 36px; margin-bottom: 60px; }

        /* 2. 모든 버튼 동일 너비 */
        .btn {
          font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px;
          width: 120px; padding: 12px 0;
          border: 1px solid rgba(180,150,60,.4); background: transparent;
          color: rgba(220,190,100,.85); border-radius: 2px;
          cursor: pointer; transition: all .25s; text-transform: uppercase;
          text-align: center;
        }
        .btn:hover { background: rgba(180,150,60,.12); border-color: rgba(220,190,100,.7); color: rgba(255,220,120,1); }
        .btn.primary {
          background: linear-gradient(135deg, rgba(180,140,50,.25), rgba(140,100,30,.15));
          border-color: rgba(200,170,70,.6);
        }
        .btn.primary:hover { background: linear-gradient(135deg, rgba(200,160,60,.4), rgba(160,120,40,.25)); }
      `}</style>

      <div className="app-wrapper">
        <div className="bg-circle" style={{ width:300, height:300, top:-80, left:-60, background:"radial-gradient(circle, rgba(100,80,30,0.08), transparent 70%)" }} />
        <div className="bg-circle" style={{ width:200, height:200, bottom:100, right:-40, background:"radial-gradient(circle, rgba(40,60,100,0.06), transparent 70%)" }} />

        {/* 씬 */}
        <div
          className="scene"
          onPointerDown={handlePointerDown}
          style={{ cursor: sceneCursor }}
        >
          {running && (
            <div className="smoke-area" style={{ top: 420 - 155 - displayHeight - 19 }}>
              {particles.map(p => <SmokeParticle key={p.id} id={p.id} />)}
            </div>
          )}

          <div className="incense-stick-wrap" style={{ bottom: 155 }}>
            <div className={`ember${running ? "" : " off"}`} />
            <div className="stick" style={{ height: displayHeight }} />
            <div className="stick-base" />
          </div>

          {/* 향로 SVG */}
          <div style={{ position:"absolute", bottom:0 }}>
            <svg className="burner-svg" width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="celadonBody" cx="50%" cy="40%" r="60%">
                  <stop offset="0%"   stopColor="#8fbcaa" />
                  <stop offset="50%"  stopColor="#6a9e8c" />
                  <stop offset="100%" stopColor="#3d6b5a" />
                </radialGradient>
                <radialGradient id="celadonTop" cx="50%" cy="30%" r="60%">
                  <stop offset="0%"   stopColor="#9ecfba" />
                  <stop offset="100%" stopColor="#4d8070" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              <ellipse cx="100" cy="165" rx="72" ry="10" fill="#2a1f0e" opacity="0.5" />
              <rect x="34" y="145" width="132" height="18" rx="4" fill="url(#celadonBody)" />
              <ellipse cx="100" cy="145" rx="66" ry="8" fill="#7aaa96" />
              <ellipse cx="52"  cy="162" rx="10" ry="7"  fill="url(#celadonBody)" />
              <ellipse cx="148" cy="162" rx="10" ry="7"  fill="url(#celadonBody)" />
              <circle  cx="49"  cy="158" r="2" fill="#2d5448" />
              <circle  cx="151" cy="158" r="2" fill="#2d5448" />

              {[...Array(10)].map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                const cx2 = 100 + 52 * Math.cos(a);
                const cy2 = 120 + 18 * Math.sin(a) * 0.5;
                return <ellipse key={i} cx={cx2} cy={cy2} rx="14" ry="22" fill="url(#celadonBody)" transform={`rotate(${(i/10)*360},${cx2},${cy2})`} opacity="0.9" />;
              })}

              <ellipse cx="100" cy="108" rx="46" ry="14" fill="#7aaa96" />
              <path d="M54 108 Q58 135 100 140 Q142 135 146 108 Z" fill="url(#celadonBody)" />
              <ellipse cx="100" cy="108" rx="46" ry="14" fill="url(#celadonTop)" opacity="0.7" />

              <circle cx="100" cy="72" r="34" fill="none" stroke="url(#celadonBody)" strokeWidth="3.5" />
              {[...Array(4)].map((_, row) =>
                [...Array(6)].map((_, col) => {
                  const phi   = (row + 0.5) / 4 * Math.PI;
                  const theta = (col / 6) * Math.PI * 2;
                  const x = 100 + 28 * Math.sin(phi) * Math.cos(theta);
                  const y =  72 - 28 * Math.cos(phi) + 28 * Math.sin(phi) * Math.sin(theta) * 0.25;
                  return <ellipse key={`${row}-${col}`} cx={x} cy={y} rx="5" ry="4" fill="#1a2820" opacity="0.7" />;
                })
              )}
              <circle  cx="100" cy="72"  r="34"  fill="none" stroke="#6a9e8c" strokeWidth="1" opacity="0.5" />
              <ellipse cx="90"  cy="58"  rx="10" ry="7" fill="rgba(200,240,220,0.15)" />
              <ellipse cx="100" cy="108" rx="47" ry="14" fill="none" stroke="#c4933a" strokeWidth="1.5" opacity="0.6" />
              <rect x="33" y="143" width="134" height="3" rx="1" fill="#c4933a" opacity="0.4" />
              <circle cx="100" cy="38" r="4" fill="#1a2820" />
              <circle cx="100" cy="38" r="4" fill="none" stroke="#8fbcaa" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* 시간 표시 */}
        <div className="time-display">{formatTime(remaining)}</div>
        <div className="time-label">{label}</div>

        {/* 버튼 */}
        <div className="controls">
          {!running && !finished && (
            <button className="btn primary" onClick={handleStart}>
              {remaining === totalSeconds ? "시작" : "다시시작"}
            </button>
          )}
          {running && (
            <button className="btn" onClick={handlePause}>일시정지</button>
          )}
          {(running || remaining < totalSeconds || finished) && (
            <button className="btn" onClick={handleReset}>초기화</button>
          )}
        </div>
      </div>
    </>
  );
}
