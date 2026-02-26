'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';

type Question = { question:string; options:string[]; answer:string; explanation:string; };

export default function QuizPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [screen, setScreen] = useState<'start'|'loading'|'game'|'result'>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string|null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timer, setTimer] = useState(15);
  const [timerActive, setTimerActive] = useState(false);
  const [results, setResults] = useState<{q:string,correct:boolean,answer:string}[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
      const snap = await getDoc(doc(db,'users',u.uid));
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!timerActive) return;
    if (timer===0) { handleTimeout(); return; }
    const t = setTimeout(() => setTimer(t=>t-1), 1000);
    return () => clearTimeout(t);
  }, [timer, timerActive]);

  function getLevel(data: any) {
    const lv = data?.currentLevel||1;
    return lv<=3?'beginner':lv<=6?'intermediate':'advanced';
  }

  async function startQuiz() {
    setScreen('loading');
    try {
      const res = await fetch('/api/quiz', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ level:getLevel(userData) }),
      });
      const json = await res.json();
      if (json.questions) {
        setQuestions(json.questions);
        setCurrentQ(0); setScore(0); setCorrectCount(0); setResults([]);
        setTimer(15); setTimerActive(true); setSelected(null);
        setScreen('game');
      }
    } catch(e) { setScreen('start'); }
  }

  function handleTimeout() {
    if (selected!==null) return;
    const q = questions[currentQ];
    setSelected('__timeout__'); setTimerActive(false);
    setResults(r=>[...r,{q:q.question,correct:false,answer:q.answer}]);
    setTimeout(()=>nextQuestion(), 1500);
  }

  function handleAnswer(opt: string) {
    if (selected!==null) return;
    const q = questions[currentQ];
    const isCorrect = opt===q.answer;
    const timeBonus = timer>=10?15:10;
    setSelected(opt); setTimerActive(false);
    setResults(r=>[...r,{q:q.question,correct:isCorrect,answer:q.answer}]);
    if (isCorrect) { setScore(s=>s+timeBonus); setCorrectCount(c=>c+1); }
    setTimeout(()=>nextQuestion(), 1500);
  }

  function nextQuestion() {
    if (currentQ+1>=questions.length) finishQuiz();
    else { setCurrentQ(i=>i+1); setSelected(null); setTimer(15); setTimerActive(true); }
  }

  async function finishQuiz() {
    setTimerActive(false); setScreen('result');
    if (!user) return;
    const isPerfect = correctCount+1===questions.length;
    await updateDoc(doc(db,'users',user.uid), { totalXP:increment(isPerfect?70:20), quizCount:increment(1) });
  }

  const q = questions[currentQ];
  const timerColor = timer<=5?'#EF4444':timer<=10?'#F59E0B':'#10B981';

  return (
    <Layout>
      {/* 시작 화면 */}
      {screen==='start' && (
        <div style={{ textAlign:'center', maxWidth:'440px', margin:'0 auto', paddingTop:'20px' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:'14px' }}>🎯</div>
          <h1 style={{ fontSize:'1.8rem', fontWeight:900, marginBottom:'8px' }}>퀴즈 도전!</h1>
          <p style={{ color:'#8B8BAA', marginBottom:'24px', lineHeight:1.7, fontSize:'0.9rem' }}>
            AI가 내 레벨에 맞는 문제를 출제해요<br/>10문제 · 15초 타이머 · 빠른 정답 보너스!
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center', marginBottom:'24px' }}>
            {['📝 10문제','⏱️ 15초','⚡ 빠른 보너스','🏆 만점 +70XP'].map(b=>(
              <span key={b} style={{ background:'rgba(79,70,229,0.1)', border:'1px solid rgba(79,70,229,0.2)', borderRadius:'20px', padding:'5px 12px', fontSize:'0.8rem', color:'#6366F1', fontWeight:600 }}>{b}</span>
            ))}
          </div>
          <button onClick={startQuiz}
            style={{ width:'100%', padding:'16px', background:'#4F46E5', color:'white', border:'none', borderRadius:'12px', fontSize:'1.05rem', fontWeight:700, cursor:'pointer' }}>
            퀴즈 시작! 🚀
          </button>
        </div>
      )}

      {/* 로딩 */}
      {screen==='loading' && (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{ fontSize:'3rem', marginBottom:'16px' }}>🤖</div>
          <div style={{ fontWeight:700, marginBottom:'8px' }}>AI가 맞춤 문제를 만들고 있어요...</div>
          <div style={{ color:'#8B8BAA', fontSize:'0.88rem' }}>레벨에 맞는 10문제 생성 중!</div>
        </div>
      )}

      {/* 게임 */}
      {screen==='game' && q && (
        <div style={{ maxWidth:'520px', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'4px' }}>문제 {currentQ+1}/{questions.length}</div>
              <div style={{ height:'6px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
                <div style={{ height:'100%', width:`${((currentQ+1)/questions.length)*100}%`, background:'#4F46E5', borderRadius:'4px' }}></div>
              </div>
            </div>
            <div style={{ textAlign:'center', marginLeft:'16px' }}>
              <div style={{ fontSize:'0.72rem', color:'#8B8BAA' }}>점수</div>
              <div style={{ fontWeight:900, fontSize:'1.3rem', color:'#F59E0B' }}>{score}</div>
            </div>
            <div style={{ textAlign:'center', marginLeft:'12px' }}>
              <div style={{ fontSize:'0.72rem', color:'#8B8BAA' }}>시간</div>
              <div style={{ fontWeight:900, fontSize:'1.6rem', color:timerColor, minWidth:'36px' }}>{timer}</div>
            </div>
          </div>

          <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'16px', textAlign:'center' }}>
            <div style={{ fontSize:'0.72rem', color:'#8B8BAA', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>빈칸에 알맞은 단어는?</div>
            <div style={{ fontSize:'1.2rem', fontWeight:700, lineHeight:1.6 }}>{q.question}</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {q.options.map((opt,i) => {
              let bg='#1E1E35', border='rgba(255,255,255,0.08)', color='#F1F0FF';
              if (selected) {
                if (opt===q.answer) { bg='rgba(16,185,129,0.2)'; border='#10B981'; color='#10B981'; }
                else if (opt===selected) { bg='rgba(239,68,68,0.2)'; border='#EF4444'; color='#EF4444'; }
              }
              return (
                <button key={i} onClick={()=>handleAnswer(opt)} disabled={!!selected}
                  style={{ padding:'14px', background:bg, border:`1px solid ${border}`, borderRadius:'12px', color, cursor:selected?'not-allowed':'pointer', fontWeight:600, fontSize:'0.95rem' }}>
                  {String.fromCharCode(65+i)}. {opt}
                </button>
              );
            })}
          </div>

          {selected && (
            <div style={{ marginTop:'14px', background:selected===q.answer?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${selected===q.answer?'#10B981':'#EF4444'}`, borderRadius:'12px', padding:'12px', textAlign:'center' }}>
              <div style={{ fontWeight:700, marginBottom:'4px', color:selected===q.answer?'#10B981':'#EF4444' }}>
                {selected==='__timeout__'?'⏰ 시간 초과!':selected===q.answer?'🎉 정답!':'❌ 오답!'}
              </div>
              <div style={{ color:'#8B8BAA', fontSize:'0.82rem' }}>{q.explanation}</div>
            </div>
          )}
        </div>
      )}

      {/* 결과 */}
      {screen==='result' && (
        <div style={{ maxWidth:'480px', margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:'10px' }}>
            {correctCount===questions.length?'🏆':correctCount>=questions.length*0.7?'🎉':'💪'}
          </div>
          <h2 style={{ fontSize:'1.8rem', fontWeight:900, marginBottom:'4px' }}>퀴즈 완료!</h2>
          <div style={{ color:'#8B8BAA', marginBottom:'16px' }}>정답 {correctCount}/{questions.length}</div>

          <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
            <div style={{ fontSize:'3rem', fontWeight:900, color:'#F59E0B', marginBottom:'4px' }}>{score}</div>
            <div style={{ color:'#8B8BAA', fontSize:'0.85rem', marginBottom:'12px' }}>점</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'10px', padding:'8px 16px' }}>
              <span>⭐</span>
              <span style={{ fontWeight:800, color:'#F59E0B' }}>
                {correctCount===questions.length?'+70 XP (만점 보너스!)':'+20 XP'}
              </span>
            </div>
          </div>

          {results.filter(r=>!r.correct).length>0 && (
            <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'16px', marginBottom:'16px', textAlign:'left' }}>
              <div style={{ fontWeight:700, marginBottom:'10px', color:'#EF4444', fontSize:'0.9rem' }}>❌ 틀린 문제</div>
              {results.filter(r=>!r.correct).map((r,i)=>(
                <div key={i} style={{ background:'rgba(239,68,68,0.08)', borderRadius:'8px', padding:'10px', marginBottom:'6px', fontSize:'0.82rem' }}>
                  <div style={{ color:'#8B8BAA', marginBottom:'3px' }}>{r.q}</div>
                  <div style={{ color:'#10B981', fontWeight:600 }}>정답: {r.answer}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <button onClick={startQuiz}
              style={{ padding:'13px', background:'#4F46E5', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
              🔄 다시 도전
            </button>
            <button onClick={()=>router.push('/learn')}
              style={{ padding:'13px', background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'#F1F0FF', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
              📚 학습으로 돌아가기
            </button>
            <button onClick={()=>router.push('/conversation')}
              style={{ padding:'13px', background:'#10B981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
              💬 회화 연습하기
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}