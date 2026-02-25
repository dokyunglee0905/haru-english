'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

type Question = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

const DAILY_GOAL = 10;

export default function QuizPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);

  // 퀴즈 상태
  const [screen, setScreen] = useState<'start'|'loading'|'game'|'result'>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string|null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timer, setTimer] = useState(15);
  const [timerActive, setTimerActive] = useState(false);
  const [results, setResults] = useState<{q:string, correct:boolean, answer:string}[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, []);

  // 타이머
  useEffect(() => {
    if (!timerActive) return;
    if (timer === 0) { handleTimeout(); return; }
    const t = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, timerActive]);

  function getLevel(data: any) {
    const lv = data?.currentLevel || 1;
    return lv <= 3 ? 'beginner' : lv <= 6 ? 'intermediate' : 'advanced';
  }

  async function startQuiz() {
    setScreen('loading');
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: getLevel(userData) }),
      });
      const json = await res.json();
      if (json.questions) {
        setQuestions(json.questions);
        setCurrentQ(0);
        setScore(0);
        setCorrectCount(0);
        setResults([]);
        setTimer(15);
        setTimerActive(true);
        setSelected(null);
        setScreen('game');
      }
    } catch (e) {
      console.error('퀴즈 로딩 실패:', e);
      setScreen('start');
    }
  }

  function handleTimeout() {
    if (selected !== null) return;
    const q = questions[currentQ];
    setSelected('__timeout__');
    setTimerActive(false);
    setResults(r => [...r, { q: q.question, correct: false, answer: q.answer }]);
    setTimeout(() => nextQuestion(), 1500);
  }

  function handleAnswer(opt: string) {
    if (selected !== null) return;
    const q = questions[currentQ];
    const isCorrect = opt === q.answer;
    const timeBonus = timer >= 10 ? 15 : 10;
    setSelected(opt);
    setTimerActive(false);
    setResults(r => [...r, { q: q.question, correct: isCorrect, answer: q.answer }]);
    if (isCorrect) {
      setScore(s => s + timeBonus);
      setCorrectCount(c => c + 1);
    }
    setTimeout(() => nextQuestion(), 1500);
  }

  function nextQuestion() {
    if (currentQ + 1 >= questions.length) {
      finishQuiz();
    } else {
      setCurrentQ(i => i + 1);
      setSelected(null);
      setTimer(15);
      setTimerActive(true);
    }
  }

  async function finishQuiz() {
    setTimerActive(false);
    setScreen('result');
    if (!user) return;
    const isPerfect = correctCount + 1 === questions.length;
    const xpEarned = isPerfect ? 70 : 20;
    await updateDoc(doc(db, 'users', user.uid), {
      totalXP: increment(xpEarned),
      quizCount: increment(1),
    });
  }

  const sidebarItems = [
    { label:'🏠 대시보드', path:'/dashboard' },
    { label:'📚 학습', path:'/learn' },
    { label:'🎮 퀴즈', path:'/quiz' },
    { label:'💬 회화', path:'/conversation' },
    { label:'👤 마이페이지', path:'/mypage' },
    { label:'⚙️ 설정', path:'/settings' },
  ];

  const q = questions[currentQ];
  const timerColor = timer <= 5 ? '#EF4444' : timer <= 10 ? '#F59E0B' : '#10B981';

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#F1F0FF', fontFamily:'sans-serif', display:'flex' }}>
      {/* 사이드바 */}
      <div style={{ width:'220px', background:'#1A1A2E', borderRight:'1px solid rgba(255,255,255,0.08)', padding:'24px 16px', position:'fixed', top:0, left:0, height:'100vh', display:'flex', flexDirection:'column' }}>
        <div style={{ fontWeight:900, fontSize:'1.4rem', color:'#6366F1', marginBottom:'36px' }}>Haru<span style={{color:'#F59E0B'}}>EN</span></div>
        {sidebarItems.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', borderRadius:'12px', border:'none', background: item.path==='/quiz' ? 'rgba(79,70,229,0.2)' : 'transparent', color: item.path==='/quiz' ? '#6366F1' : '#8B8BAA', cursor:'pointer', fontSize:'0.9rem', fontWeight:500, marginBottom:'4px', width:'100%', textAlign:'left' }}>
            {item.label}
          </button>
        ))}
      </div>

      {/* 메인 */}
      <div style={{ marginLeft:'220px', padding:'32px', flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* 시작 화면 */}
        {screen === 'start' && (
          <div style={{ textAlign:'center', maxWidth:'480px', width:'100%', marginTop:'40px' }}>
            <div style={{ fontSize:'4rem', marginBottom:'16px' }}>🎯</div>
            <h1 style={{ fontSize:'2rem', fontWeight:900, marginBottom:'8px' }}>퀴즈 도전!</h1>
            <p style={{ color:'#8B8BAA', marginBottom:'28px', lineHeight:1.7 }}>
              AI가 내 레벨에 맞는 문제를 출제해요<br/>
              10문제 · 문제당 15초 · 빠른 정답 보너스!
            </p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap', marginBottom:'28px' }}>
              {[
                { icon:'📝', label:'10문제' },
                { icon:'⏱️', label:'15초 타이머' },
                { icon:'⚡', label:'빠른 정답 보너스' },
                { icon:'🏆', label:'만점 시 +70 XP' },
              ].map(b => (
                <div key={b.label} style={{ background:'rgba(79,70,229,0.1)', border:'1px solid rgba(79,70,229,0.2)', borderRadius:'20px', padding:'6px 14px', fontSize:'0.82rem', color:'#6366F1', fontWeight:600 }}>
                  {b.icon} {b.label}
                </div>
              ))}
            </div>
            <button onClick={startQuiz}
              style={{ width:'100%', padding:'16px', background:'#4F46E5', color:'white', border:'none', borderRadius:'12px', fontSize:'1.1rem', fontWeight:700, cursor:'pointer' }}>
              퀴즈 시작! 🚀
            </button>
          </div>
        )}

        {/* 로딩 화면 */}
        {screen === 'loading' && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:'3rem', marginBottom:'16px' }}>🤖</div>
            <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:'8px' }}>AI가 맞춤 문제를 만들고 있어요...</div>
            <div style={{ color:'#8B8BAA', fontSize:'0.88rem' }}>레벨에 맞는 10문제를 생성 중이에요!</div>
          </div>
        )}

        {/* 게임 화면 */}
        {screen === 'game' && q && (
          <div style={{ width:'100%', maxWidth:'560px', marginTop:'20px' }}>
            {/* 상단 헤더 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <div style={{ fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'4px' }}>문제 {currentQ+1} / {questions.length}</div>
                <div style={{ height:'6px', width:'200px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
                  <div style={{ height:'100%', width:`${((currentQ+1)/questions.length)*100}%`, background:'#4F46E5', borderRadius:'4px', transition:'width 0.3s' }}></div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'2px' }}>점수</div>
                <div style={{ fontWeight:900, fontSize:'1.4rem', color:'#F59E0B' }}>{score}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'2px' }}>남은 시간</div>
                <div style={{ fontWeight:900, fontSize:'1.8rem', color:timerColor, minWidth:'40px' }}>{timer}</div>
              </div>
            </div>

            {/* 문제 */}
            <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'28px', marginBottom:'20px', textAlign:'center' }}>
              <div style={{ fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>빈칸에 알맞은 단어는?</div>
              <div style={{ fontSize:'1.4rem', fontWeight:700, lineHeight:1.6 }}>{q.question}</div>
            </div>

            {/* 선택지 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              {q.options.map((opt, i) => {
                let bg = '#1E1E35', border = 'rgba(255,255,255,0.08)', color = '#F1F0FF';
                if (selected) {
                  if (opt === q.answer) { bg='rgba(16,185,129,0.2)'; border='#10B981'; color='#10B981'; }
                  else if (opt === selected) { bg='rgba(239,68,68,0.2)'; border='#EF4444'; color='#EF4444'; }
                }
                return (
                  <button key={i} onClick={() => handleAnswer(opt)} disabled={!!selected}
                    style={{ padding:'16px', background:bg, border:`1px solid ${border}`, borderRadius:'12px', color, cursor: selected ? 'not-allowed' : 'pointer', fontWeight:600, fontSize:'1rem', transition:'all 0.2s' }}>
                    {String.fromCharCode(65+i)}. {opt}
                  </button>
                );
              })}
            </div>

            {/* 정답 설명 */}
            {selected && (
              <div style={{ marginTop:'16px', background: selected===q.answer ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${selected===q.answer ? '#10B981' : '#EF4444'}`, borderRadius:'12px', padding:'14px', textAlign:'center' }}>
                <div style={{ fontWeight:700, marginBottom:'4px', color: selected===q.answer ? '#10B981' : '#EF4444' }}>
                  {selected==='__timeout__' ? '⏰ 시간 초과!' : selected===q.answer ? '🎉 정답!' : '❌ 오답!'}
                </div>
                <div style={{ color:'#8B8BAA', fontSize:'0.85rem' }}>{q.explanation}</div>
              </div>
            )}
          </div>
        )}

        {/* 결과 화면 */}
        {screen === 'result' && (
          <div style={{ width:'100%', maxWidth:'520px', marginTop:'20px', textAlign:'center' }}>
            <div style={{ fontSize:'4rem', marginBottom:'12px' }}>
              {correctCount === questions.length ? '🏆' : correctCount >= questions.length * 0.7 ? '🎉' : '💪'}
            </div>
            <h2 style={{ fontSize:'2rem', fontWeight:900, marginBottom:'4px' }}>퀴즈 완료!</h2>
            <div style={{ color:'#8B8BAA', marginBottom:'20px' }}>
              정답 {correctCount} / {questions.length}
            </div>

            {/* 점수 */}
            <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'20px' }}>
              <div style={{ fontSize:'3.5rem', fontWeight:900, color:'#F59E0B', marginBottom:'4px' }}>{score}</div>
              <div style={{ color:'#8B8BAA', fontSize:'0.88rem', marginBottom:'16px' }}>점</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'12px', padding:'8px 20px' }}>
                <span>⭐</span>
                <span style={{ fontWeight:800, color:'#F59E0B' }}>
                  {correctCount === questions.length ? '+70 XP (만점 보너스!)' : '+20 XP'}
                </span>
              </div>
            </div>

            {/* 오답 목록 */}
            {results.filter(r => !r.correct).length > 0 && (
              <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px', marginBottom:'20px', textAlign:'left' }}>
                <div style={{ fontWeight:700, marginBottom:'12px', color:'#EF4444' }}>❌ 틀린 문제</div>
                {results.filter(r => !r.correct).map((r, i) => (
                  <div key={i} style={{ background:'rgba(239,68,68,0.08)', borderRadius:'8px', padding:'10px 14px', marginBottom:'8px', fontSize:'0.85rem' }}>
                    <div style={{ color:'#8B8BAA', marginBottom:'4px' }}>{r.q}</div>
                    <div style={{ color:'#10B981', fontWeight:600 }}>정답: {r.answer}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={startQuiz}
                style={{ padding:'12px 24px', background:'#4F46E5', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                🔄 다시 도전
              </button>
              <button onClick={() => router.push('/learn')}
                style={{ padding:'12px 24px', background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'#F1F0FF', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                📚 학습으로 돌아가기
              </button>
              <button onClick={() => router.push('/conversation')}
                style={{ padding:'12px 24px', background:'#10B981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                💬 회화 연습하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}