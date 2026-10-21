import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  BrainCircuit, Trophy, Target, Clock, Flame, Play,
  Calculator, Puzzle, Brain, Type, Grid3X3, MessageSquare, ListTodo, X, Sparkles
} from 'lucide-react';

import API_URL from '../../config/api';

const CHALLENGE_TYPES = [
  { id: 'Math Problems', icon: Calculator, color: 'bg-[#6366f1]', label: 'Math Problems' },
  { id: 'Logic Puzzles', icon: Puzzle, color: 'bg-[#ec4899]', label: 'Logic Puzzles' },
  { id: 'Memory Challenges', icon: Brain, color: 'bg-[#10b981]', label: 'Memory Challenges' },
  { id: 'Word Games', icon: Type, color: 'bg-[#f59e0b]', label: 'Word Games' },
  { id: 'Pattern Recognition', icon: Grid3X3, color: 'bg-[#8b5cf6]', label: 'Pattern Recognition' },
  { id: 'Riddles', icon: MessageSquare, color: 'bg-[#06b6d4]', label: 'Riddles' },
  { id: 'Quick Quizzes', icon: ListTodo, color: 'bg-[#ef4444]', label: 'Quick Quizzes' },
  { id: 'All Types', icon: Sparkles, color: 'bg-[#14b8a6]', label: 'All Types (Mixed)' },
];

const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

function WakeUpChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const alarmId = location.state?.alarmId;
  const isTest = Boolean(location.state?.isTest);

  // Hub State
  const [stats, setStats] = useState(null);
  const [selectedType, setSelectedType] = useState('Math Problems');
  const [selectedDifficulty, setSelectedDifficulty] = useState(location.state?.difficulty || 'Beginner');

  const initialSoundTone = location.state?.soundTone || 'Gentle Chimes';

  // Active Challenge State
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [isPractice, setIsPractice] = useState(!alarmId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answer, setAnswer] = useState('');
  const [attempt, setAttempt] = useState(1);
  const [challengeNumber, setChallengeNumber] = useState(1);
  const [startTime, setStartTime] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [pendingAlarm, setPendingAlarm] = useState(null);
  
  const audioRef = useRef(null);

  useEffect(() => {
    fetchStats();
    if (alarmId) {
      setPendingAlarm(alarmId);
      setLoading(false);
      
      // Start ringing immediately while the overlay is shown
      if (audioRef.current) {
        audioRef.current.src = `/sounds/${initialSoundTone}.wav`;
        audioRef.current.play().catch(e => console.log('Audio autoplay failed (requires interaction):', e));
      }
    } else {
      setLoading(false);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [alarmId]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/challenges/analytics/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const startPracticeChallenge = async () => {
    setLoading(true);
    setError(null);
    setIsPractice(true);
    setResult(null);
    try {
      const token = localStorage.getItem('access_token');
      
      const alarmRes = await fetch(`${API_URL}/alarms`, { headers: { 'Authorization': `Bearer ${token}` }});
      let dummyAlarmId = null;
      if (alarmRes.ok) {
        const alarms = await alarmRes.json();
        if (alarms.length > 0) dummyAlarmId = alarms[0].id;
      }
      
      if (!dummyAlarmId) {
        setError("Please create at least one alarm before starting a practice challenge!");
        setLoading(false);
        return;
      }

      const challengeRes = await fetch(`${API_URL}/challenges/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
           alarm_id: dummyAlarmId,
           difficulty: selectedDifficulty,
           challenge_type: selectedType
        }) 
      });

      if (!challengeRes.ok) throw new Error('Failed to generate practice challenge');
      const data = await challengeRes.json();
      
      data.question = `[Practice: ${selectedDifficulty} ${selectedType}] ${data.question}`;
      
      setActiveChallenge(data);
      setChallengeNumber(1);
      setAnswer('');
      setAttempt(1);
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startWakeUpVerification = async () => {
    setLoading(true);
    setError(null);
    setIsPractice(false);
    try {
      const token = localStorage.getItem('access_token');
      const eventRes = await fetch(`${API_URL}/challenges/wake-up/start?alarm_id=${alarmId}&is_test=${isTest}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });

      if (!eventRes.ok) throw new Error((await eventRes.json()).detail || 'Failed to start wake-up verification');
      const eventData = await eventRes.json();
      
      const tone = eventData.sound_tone || 'Gentle Chimes';
      if (audioRef.current) {
        const expectedSrc = `/sounds/${tone}.wav`;
        if (!audioRef.current.src.includes(encodeURIComponent(tone)) && !audioRef.current.src.includes(tone)) {
          audioRef.current.src = expectedSrc;
          audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
      }

      const challengeRes = await fetch(`${API_URL}/challenges/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ alarm_id: alarmId, wake_up_event_id: eventData.id, is_test: isTest })
      });

      if (!challengeRes.ok) throw new Error('Failed to generate challenge');
      setActiveChallenge(await challengeRes.json());
      setChallengeNumber(1);
      setAnswer('');
      setAttempt(1);
      setStartTime(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlarm = async () => {
    if (isPractice) return;
    const token = localStorage.getItem('access_token');
    await fetch(`${API_URL}/alarms/${alarmId}/dismiss`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  const handleSubmit = async () => {
    if (!answer.trim() || !activeChallenge || submitting) return;
    setSubmitting(true);
    setError(null);

    const solveTime = Math.floor((Date.now() - startTime) / 1000);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/challenges/${activeChallenge.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ answer: answer.trim(), solve_time: solveTime })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit answer');

      if (data.correct && (isPractice || data.verified)) {
        try {
          await dismissAlarm();
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          setResult({ 
            correct: true, 
            score: data.score, 
            solveTime: data.solve_time, 
            message: data.message,
            alarmDifficulty: data.alarm_difficulty,
            adaptation: data.adaptation
          });
          fetchStats(); 
        } catch (dismissError) {
          setError(dismissError.message);
        }
      } else if (data.next_challenge) {
         setActiveChallenge(data.next_challenge);
         setChallengeNumber(prev => prev + 1);
         setAnswer('');
         setAttempt(1);
         setStartTime(Date.now());
         if (data.correct) {
            setError(`✅ Correct! You have completed ${data.completed_challenges} out of ${data.required_challenges} challenges.`);
         } else {
            setError(`❌ Incorrect! A replacement challenge has been generated.`);
         }
      } else {
        if (data.status === 'failed') {
          setResult({ correct: false, score: 0, solveTime: 0, message: data.message, failed: true });
        } else {
          setAttempt(data.attempt ? data.attempt + 1 : attempt + 1);
          setAnswer('');
          setStartTime(Date.now());
          setError(data.message);
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderActiveChallenge = () => (
    <div className="fixed inset-0 z-50 bg-[#0a0e1a]/95 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-lg p-8 relative shadow-2xl shadow-[#6366f1]/10">
        {isPractice && (
           <button onClick={() => { setActiveChallenge(null); setResult(null); }} className="absolute top-4 right-4 text-[#64748b] hover:text-slate-900 dark:text-white">
             <X className="w-5 h-5" />
           </button>
        )}
        
        {!result ? (
          <>
            <div className="text-center mb-8">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${isPractice ? 'bg-[#6366f1]/20 text-[#6366f1]' : 'bg-[#ef4444]/20 text-[#ef4444] animate-pulse'}`}>
                <BrainCircuit className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{isPractice ? 'Practice Challenge' : 'WAKE UP!'}</h2>
              <p className="text-slate-500 dark:text-[#94a3b8]">{isPractice ? 'Keep your mind sharp.' : 'Solve this challenge to dismiss your alarm.'}</p>
              
              {activeChallenge && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30">
                    Current Difficulty: <strong>{activeChallenge.difficulty || 'Beginner'}</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/30">
                    Challenge Type: <strong>{activeChallenge.challenge_type}</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
                    Challenge Number: <strong>{challengeNumber}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-6 whitespace-pre-wrap">{activeChallenge.question}</h3>
              {activeChallenge.options ? (
                <div className="flex flex-col gap-3">
                  {activeChallenge.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAnswer(opt)}
                      className={`py-3 px-4 rounded-lg font-medium transition-colors border ${
                        answer === opt ? 'bg-[#6366f1] text-slate-900 dark:text-white border-[#6366f1]' : 'bg-white dark:bg-[#1e293b] text-slate-500 dark:text-[#cbd5e1] border-slate-200 dark:border-[#334155] hover:border-[#6366f1]/50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg py-3 px-4 text-slate-900 dark:text-white text-center focus:outline-none focus:border-[#6366f1]"
                  placeholder="Enter your answer"
                />
              )}
            </div>

            {error && <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-lg p-3 text-sm text-center mb-4">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !answer.trim()}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-slate-900 dark:text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Verifying...' : 'Submit Answer'}
            </button>
            <div className="text-center text-xs text-[#64748b] mt-4 font-medium">Attempt: {attempt}</div>
          </>
        ) : (
          <div className="text-center py-6">
             <div className="text-6xl mb-6">{result.correct ? '🎉' : '❌'}</div>
             <h2 className={`text-2xl font-bold mb-2 ${result.correct ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
               {result.correct ? 'VERIFIED ✓' : 'FAILED'}
             </h2>
             <p className="text-slate-500 dark:text-[#cbd5e1] mb-8">{result.message}</p>
             
             {result.correct && (
               <>
                 <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 flex justify-around mb-4 border border-slate-200 dark:border-[#334155]">
                   <div><div className="text-[#64748b] text-xs">Score</div><div className="text-slate-900 dark:text-white font-bold text-lg">{result.score}</div></div>
                   <div><div className="text-[#64748b] text-xs">Time</div><div className="text-slate-900 dark:text-white font-bold text-lg">{result.solveTime}s</div></div>
                   <div><div className="text-[#64748b] text-xs">Challenge</div><div className="text-slate-900 dark:text-white font-bold text-lg">#{challengeNumber}</div></div>
                 </div>
                 {result.adaptation ? (
                   <div className="mb-6 p-4 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/30 text-center">
                     <span className="text-xs text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider block mb-1">
                       Adaptive Intelligence Engine (PostgreSQL Verified)
                     </span>
                     <div className="text-xs text-slate-600 dark:text-[#cbd5e1] mb-2">
                       Assessed Performance: <span className="font-bold text-[#8b5cf6]">{result.adaptation.performance}</span>
                       {" · "}
                       Action: <span className="font-bold text-[#6366f1]">
                         {result.adaptation.action === 2 ? 'Harder (+1)' : result.adaptation.action === 0 ? 'Easier (-1)' : 'Same (0)'}
                       </span>
                     </div>
                     <div className="text-sm font-semibold text-slate-900 dark:text-white">
                       {result.adaptation.current_difficulty !== result.adaptation.next_difficulty ? (
                         <span>
                           Alarm Difficulty updated: <span className="line-through text-slate-400 dark:text-slate-500 mr-1">{result.adaptation.current_difficulty}</span>
                           → <span className="text-[#10b981] font-bold">{result.adaptation.next_difficulty}</span>
                           <span className="block text-xs font-normal text-slate-500 dark:text-[#94a3b8] mt-1">
                             Saved to database. This will take effect on your next scheduled alarm.
                           </span>
                         </span>
                       ) : (
                         <span>
                           Alarm Difficulty maintained: <span className="text-[#10b981] font-bold">{result.adaptation.next_difficulty}</span>
                           <span className="block text-xs font-normal text-slate-500 dark:text-[#94a3b8] mt-1">
                             Saved in database for your next alarm.
                           </span>
                         </span>
                       )}
                     </div>
                   </div>
                 ) : result.alarmDifficulty ? (
                   <div className="mb-6 p-3 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 text-center">
                     <span className="text-xs text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider block mb-1">Adaptive Intelligence</span>
                     <span className="text-sm font-semibold text-slate-900 dark:text-white">
                       Next Alarm Difficulty: <span className="text-[#10b981] font-bold">{result.alarmDifficulty}</span> (Database verified)
                     </span>
                   </div>
                 ) : null}
               </>
             )}

             <button
               onClick={() => {
                 setActiveChallenge(null);
                 setResult(null);
                 if (!isPractice) navigate('/dashboard');
               }}
               className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-slate-900 dark:text-white font-semibold py-3 rounded-xl transition-colors"
             >
               {isPractice ? 'Back to Hub' : 'Go to Dashboard'}
             </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <audio ref={audioRef} loop style={{ display: 'none' }} />
      {pendingAlarm && (
        <div className="fixed inset-0 z-50 bg-[#0a0e1a]/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e293b] border border-[#ef4444] rounded-2xl w-full max-w-lg p-10 text-center relative shadow-2xl shadow-[#ef4444]/20">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6 animate-pulse text-[#ef4444]">Wake Up Alarm</h1>
            <p className="text-xl text-slate-500 dark:text-[#cbd5e1] mb-10">Your alarm is ringing. Wake up and complete your challenge to dismiss it.</p>
            <button
              onClick={() => {
                 setPendingAlarm(null);
                 // If the autoplay worked, it's already playing. If it was blocked, this click will unlock it and play it.
                 if (audioRef.current) {
                   audioRef.current.play().catch(e => console.log('Audio play failed:', e));
                 }
                 startWakeUpVerification();
              }}
              className="w-full py-4 bg-[#ef4444] hover:bg-[#dc2626] text-slate-900 dark:text-white font-bold text-xl rounded-xl transition-colors shadow-lg shadow-[#ef4444]/30"
            >
              Start Challenge
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6 pb-10">
        {error && !activeChallenge && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-xl p-4 text-center mt-4 mx-4 shadow-lg shadow-[#ef4444]/10">
            <strong>Error:</strong> {error}
          </div>
        )}
        {/* Hub Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <BrainCircuit className="w-8 h-8 text-[#8b5cf6]" /> Wake-Up Challenge
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Train your brain. Beat the alarm. Start your day smarter.</p>
          </div>
          <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-4 hidden md:block">
            <p className="text-sm font-medium text-slate-500 dark:text-[#cbd5e1] italic">"A sharper mind leads to a brighter day."</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center"><Trophy className="w-5 h-5 text-[#8b5cf6]"/></div>
            <div><div className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.completed || 0}</div><div className="text-xs text-slate-500 dark:text-[#94a3b8]">Challenges Completed</div></div>
          </div>
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#10b981]/10 flex items-center justify-center"><Target className="w-5 h-5 text-[#10b981]"/></div>
            <div><div className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.success_rate || 0}%</div><div className="text-xs text-slate-500 dark:text-[#94a3b8]">Success Rate</div></div>
          </div>
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center"><Clock className="w-5 h-5 text-[#3b82f6]"/></div>
            <div><div className="text-2xl font-bold text-slate-900 dark:text-white">{(stats?.average_solve_time || 0).toFixed(1)}s</div><div className="text-xs text-slate-500 dark:text-[#94a3b8]">Avg Solve Time</div></div>
          </div>
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center"><Flame className="w-5 h-5 text-[#f59e0b]"/></div>
            <div><div className="text-2xl font-bold text-slate-900 dark:text-white">0</div><div className="text-xs text-slate-500 dark:text-[#94a3b8]">Day Streak</div></div>
          </div>
        </div>

        {/* Challenge Types & Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Challenge Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CHALLENGE_TYPES.map(ct => (
                  <button 
                    key={ct.id}
                    onClick={() => setSelectedType(ct.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-colors ${
                      selectedType === ct.id ? 'bg-[#334155] border-[#6366f1] ring-1 ring-[#6366f1]' : 'bg-slate-50 dark:bg-[#0f172a] border-slate-200 dark:border-[#334155] hover:border-[#64748b]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${ct.color} flex items-center justify-center mb-2`}>
                      <ct.icon className="w-5 h-5 text-slate-900 dark:text-white" />
                    </div>
                    <span className="text-xs font-medium text-center text-slate-500 dark:text-[#cbd5e1]">{ct.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Select Difficulty Level</h3>
              <p className="text-xs text-slate-500 dark:text-[#94a3b8] mb-4">Choose the difficulty that suits you</p>
              <div className="flex bg-slate-50 dark:bg-[#0f172a] rounded-xl p-1">
                {DIFFICULTIES.map(diff => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedDifficulty === diff ? 'bg-[#6366f1] text-slate-900 dark:text-white shadow-md' : 'text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:text-white hover:bg-white dark:bg-[#1e293b]'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Available Challenges</h3>
                  <p className="text-xs text-slate-500 dark:text-[#94a3b8]">Select a challenge to start practicing</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Simple Addition", desc: "Solve basic arithmetic problems", type: "Math Problems", icon: Calculator, color: "text-[#6366f1]", time: "~1 min" },
                  { title: "Number Sequence", desc: "Find the next number in the sequence", type: "Logic Puzzles", icon: Puzzle, color: "text-[#ec4899]", time: "~2 min" },
                  { title: "Memory Recall", desc: "Memorize and answer the sequence", type: "Memory Challenges", icon: Brain, color: "text-[#10b981]", time: "~2 min" },
                  { title: "Word Scramble", desc: "Unscramble the letters", type: "Word Games", icon: Type, color: "text-[#f59e0b]", time: "~1 min" },
                ].map((c, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-xl p-4 hover:border-[#6366f1]/50 transition-colors flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b]">MEDIUM</span>
                      <c.icon className={`w-5 h-5 ${c.color}`} />
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-1">{c.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-[#94a3b8] mb-4 flex-1">{c.desc}</p>
                    <div className="flex items-center gap-4 text-xs text-[#64748b] mb-4">
                      <span className="flex items-center gap-1"><c.icon className="w-3 h-3"/> {c.type.split(' ')[0]}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {c.time}</span>
                    </div>
                    <button 
                      className="w-full bg-[#6366f1]/10 hover:bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/20 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      onClick={() => {
                        setSelectedType(c.type);
                        setSelectedDifficulty('Medium');
                        startPracticeChallenge();
                      }}
                    >
                      <Play className="w-3 h-3" /> Start Challenge
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white dark:from-[#1e293b] to-slate-50 dark:to-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-xl p-8 relative overflow-hidden flex flex-col items-center justify-center text-center h-full min-h-[400px]">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1]/10 blur-3xl rounded-full"></div>
             <BrainCircuit className="w-20 h-20 text-[#6366f1] mb-8 relative z-10" />
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 relative z-10">Practice Mode</h3>
             <p className="text-base text-slate-500 dark:text-[#94a3b8] mb-10 relative z-10 max-w-sm">
               Ready to train your brain? Start a practice challenge using the selected type and difficulty. No active alarms required!
             </p>
             <button 
               onClick={startPracticeChallenge}
               className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-slate-900 dark:text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] border-0 relative z-10 transition-all hover:scale-[1.02]"
             >
               <Play className="w-5 h-5" /> Start Challenge
             </button>
          </div>
        </div>
      </div>

      {activeChallenge && renderActiveChallenge()}
    </DashboardLayout>
  );
}

export default WakeUpChallenge;