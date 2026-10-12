import React, { useEffect, useRef } from "react";
import { Brain, Sparkles, TimerReset, Trophy, ArrowRight, Check, AlarmClock } from "lucide-react";
import Logo from "../components/Logo";

function SparkleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let animationFrame;
    const stars = Array.from({ length: 58 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.00035 + 0.00008,
      phase: Math.random() * Math.PI * 2,
      color: ["#c4b5fd", "#f9a8d4", "#93c5fd", "#ffffff"][Math.floor(Math.random() * 4)],
    }));

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    const draw = (time) => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      stars.forEach((star) => {
        const pulse = 0.35 + Math.abs(Math.sin(time * star.speed + star.phase)) * 0.65;
        const x = star.x * window.innerWidth;
        const y = star.y * window.innerHeight;
        context.save();
        context.globalAlpha = pulse;
        context.fillStyle = star.color;
        context.shadowBlur = 10;
        context.shadowColor = star.color;
        context.translate(x, y);
        context.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const angle = (Math.PI * i) / 4;
          const radius = i % 2 === 0 ? star.size * 2.1 : star.size * 0.55;
          if (i === 0) context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          else context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        context.fill();
        context.restore();
      });
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="landing-sparkles" />;
}

const features = [
  { icon: Brain, title: "Brain puzzles", text: "Solve a quick challenge to stop your alarm." },
  { icon: TimerReset, title: "No sleepy snooze", text: "Build mornings that actually begin on time." },
  { icon: Trophy, title: "Streaks & progress", text: "Make every consistent wake-up count." },
];

export default function LandingPage({ onNavigateLogin, onNavigateRegister }) {
  return (
    <main className="compact-landing">
      <style>{`
        .compact-landing { min-height: 100svh; overflow: hidden; position: relative; isolation: isolate; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #090b1d; display: flex; flex-direction: column; }
        .compact-landing::before { content: ''; position: absolute; inset: 0; z-index: -2; background: radial-gradient(circle at 15% 15%, rgba(109, 40, 217, .46), transparent 30%), radial-gradient(circle at 86% 82%, rgba(219, 39, 119, .34), transparent 31%), linear-gradient(135deg, #090b1d 0%, #11163a 52%, #090b1d 100%); }
        .compact-landing::after { content: ''; position: absolute; inset: 0; z-index: -1; opacity: .32; background-image: linear-gradient(rgba(196,181,253,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(196,181,253,.08) 1px, transparent 1px); background-size: 46px 46px; mask-image: linear-gradient(to bottom, black, transparent); }
        .landing-sparkles { pointer-events: none; position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; }
        .landing-nav { height: 82px; padding: 0 clamp(20px, 5vw, 76px); display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2; }
        .landing-actions { display: flex; align-items: center; gap: 10px; }
        .landing-button { border: 0; border-radius: 12px; padding: 11px 19px; color: #fff; cursor: pointer; font: 700 14px inherit; transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
        .landing-button:hover { transform: translateY(-2px); }
        .landing-login { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); }
        .landing-login:hover { background: rgba(255,255,255,.15); }
        .landing-signup { background: linear-gradient(135deg, #8b5cf6, #db2777); box-shadow: 0 10px 24px rgba(139,92,246,.32); }
        .landing-signup:hover { box-shadow: 0 14px 30px rgba(139,92,246,.48); }
        .landing-content { flex: 1; width: min(1120px, calc(100% - 40px)); margin: auto; display: grid; grid-template-columns: 1.1fr .9fr; gap: clamp(32px, 7vw, 96px); align-items: center; padding: 18px 0 42px; }
        .landing-eyebrow { display: inline-flex; gap: 8px; align-items: center; padding: 7px 12px; border: 1px solid rgba(196,181,253,.34); border-radius: 999px; background: rgba(139,92,246,.13); color: #ddd6fe; font-size: 12px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
        .landing-heading { font-size: clamp(42px, 5.3vw, 74px); line-height: .98; letter-spacing: -.065em; margin: 20px 0 18px; max-width: 650px; }
        .landing-gradient { background: linear-gradient(105deg, #c4b5fd, #f9a8d4 55%, #7dd3fc); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .landing-description { color: #b6bfd3; font-size: clamp(15px, 1.4vw, 18px); line-height: 1.65; max-width: 560px; margin: 0 0 26px; }
        .landing-cta { display: inline-flex; align-items: center; gap: 10px; border: 0; border-radius: 14px; padding: 15px 22px; color: #fff; cursor: pointer; background: linear-gradient(135deg, #8b5cf6, #db2777); box-shadow: 0 14px 32px rgba(139,92,246,.34); font: 800 15px inherit; transition: transform .2s ease, box-shadow .2s ease; }
        .landing-cta:hover { transform: translateY(-3px); box-shadow: 0 18px 38px rgba(139,92,246,.5); }
        .feature-list { display: flex; gap: 12px; margin-top: 28px; }
        .feature-item { flex: 1; min-width: 0; padding: 13px; border: 1px solid rgba(255,255,255,.1); border-radius: 15px; background: rgba(255,255,255,.045); backdrop-filter: blur(12px); }
        .feature-item svg { color: #c4b5fd; margin-bottom: 8px; }
        .feature-item strong { display: block; font-size: 13px; margin-bottom: 4px; }
        .feature-item span { display: block; color: #9aa7c0; font-size: 11px; line-height: 1.42; }
        .alarm-preview { width: min(100%, 385px); justify-self: end; position: relative; padding: 28px; border: 1px solid rgba(255,255,255,.18); border-radius: 28px; background: linear-gradient(145deg, rgba(30, 35, 78, .84), rgba(16, 18, 46, .82)); box-shadow: 0 28px 70px rgba(0,0,0,.37), inset 0 1px rgba(255,255,255,.12); backdrop-filter: blur(18px); }
        .alarm-preview::before { content: ''; position: absolute; width: 170px; height: 170px; border-radius: 50%; background: #8b5cf6; filter: blur(85px); opacity: .35; right: -55px; top: -50px; z-index: -1; }
        .alarm-preview-top { display: flex; align-items: center; justify-content: space-between; color: #bfc7db; font-size: 13px; }
        .alarm-time { font-size: clamp(56px, 6vw, 76px); line-height: 1; font-weight: 850; letter-spacing: -.07em; margin: 27px 0 5px; }
        .alarm-day { color: #9ba9c3; font-size: 14px; }
        .puzzle-card { margin-top: 25px; padding: 17px; border-radius: 18px; background: rgba(139,92,246,.13); border: 1px solid rgba(196,181,253,.28); }
        .puzzle-label { color: #c4b5fd; font-size: 11px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
        .puzzle-question { margin: 8px 0 14px; font-size: 17px; font-weight: 750; }
        .answers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .answer { padding: 9px; border-radius: 10px; background: rgba(255,255,255,.08); text-align: center; color: #dce2ef; font-weight: 700; font-size: 13px; }
        .answer.active { background: linear-gradient(135deg, #8b5cf6, #db2777); color: #fff; }
        .alarm-footer { display: flex; gap: 8px; align-items: center; margin-top: 17px; color: #86efac; font-size: 12px; font-weight: 700; }
        @media (max-width: 760px) { .landing-nav { height: 68px; padding: 0 18px; } .landing-nav .logo-subtitle { display: none; } .landing-button { padding: 9px 12px; } .landing-content { grid-template-columns: 1fr; gap: 22px; padding: 20px 0 24px; } .landing-heading { margin-top: 15px; } .feature-list { margin-top: 20px; } .alarm-preview { display: none; } }
        @media (max-height: 710px) and (min-width: 761px) { .landing-nav { height: 66px; } .landing-heading { font-size: clamp(38px, 5vw, 60px); margin: 13px 0; } .landing-description { margin-bottom: 17px; } .feature-list { margin-top: 18px; } .alarm-preview { transform: scale(.86); transform-origin: center right; margin: -22px 0; } }
      `}</style>

      <SparkleField />
      <nav className="landing-nav" aria-label="Main navigation">
        <Logo size="md" />
        <div className="landing-actions">
          <button className="landing-button landing-login" type="button" onClick={onNavigateLogin}>Log in</button>
          <button className="landing-button landing-signup" type="button" onClick={onNavigateRegister}>Sign up</button>
        </div>
      </nav>

      <section className="landing-content">
        <div>
          <div className="landing-eyebrow"><Sparkles size={14} /> A smarter way to wake up</div>
          <h1 className="landing-heading">Stop snoozing.<br /><span className="landing-gradient">Start thinking.</span></h1>
          <p className="landing-description">CognitiveWake turns your alarm into a small brain challenge, helping you wake up alert, consistent, and ready for the day.</p>
          <button className="landing-cta" type="button" onClick={onNavigateRegister}>Create your free alarm <ArrowRight size={18} /></button>
          <div className="feature-list">
            {features.map(({ icon: Icon, title, text }) => <div className="feature-item" key={title}><Icon size={19} /><strong>{title}</strong><span>{text}</span></div>)}
          </div>
        </div>

        <aside className="alarm-preview" aria-label="Cognitive alarm preview">
          <div className="alarm-preview-top"><span><AlarmClock size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Morning alarm</span><span>Daily</span></div>
          <div className="alarm-time">06:30</div>
          <div className="alarm-day">Friday, October 9</div>
          <div className="puzzle-card"><div className="puzzle-label">Puzzle 1 of 3</div><div className="puzzle-question">What is 14 × 7 + 23?</div><div className="answers"><span className="answer">98</span><span className="answer active">121</span><span className="answer">120</span><span className="answer">105</span></div></div>
          <div className="alarm-footer"><Check size={15} /> Your brain is waking up</div>
        </aside>
      </section>
    </main>
  );
}
