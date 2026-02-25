'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, increment, getDoc, arrayUnion } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const DAILY_GOAL = 30;

type Word = { en:string; ko:string; pronun:string; exEn:string; exKo:string; };
type Quiz = { q:string; blank:string; answer:string; opts:string[]; };
type Grammar = { title:string; icon:string; desc:string; detail:string; examples:{en:string;ko:string}[]; quizzes:Quiz[]; };

export default function LearnPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);

  // 단어
  const [words, setWords] = useState<Word[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [doneToday, setDoneToday] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [wordCompleted, setWordCompleted] = useState(false);

  // 문법
  const [grammar, setGrammar] = useState<Grammar[]>([]);
  const [loadingGrammar, setLoadingGrammar] = useState(false);
  const [grammarAnswered, setGrammarAnswered] = useState<Record<string,any>>({});
  const [isReview, setIsReview] = useState(false);

  const [step, setStep] = useState<'words'|'grammar'>('words');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        const done = data.wordsDoneToday || 0;
        setDoneToday(done);
        if (done >= DAILY_GOAL) setWordCompleted(true);
        else fetchWords(data);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (step === 'grammar' && grammar.length === 0 && userData) {
      fetchGrammar(userData);
    }
  }, [step]);

  function getLevel(data: any) {
    const lv = data?.currentLevel || 1;
    return lv <= 3 ? 'beginner' : lv <= 6 ? 'intermediate' : 'advanced';
  }

  async function fetchWords(data: any) {
    setLoadingWords(true);
    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: getLevel(data),
          wordsStudied: data.wordsStudied || 0,
          wrongWords: data.wrongWords || [],
        }),
      });
      const json = await res.json();
      if (json.words) setWords(json.words);
    } catch (e) { console.error('단어 로딩 실패:', e); }
    setLoadingWords(false);
  }

  async function fetchGrammar(data: any) {
    setLoadingGrammar(true);
    try {
      // 미완료 문법 (배웠지만 퀴즈 안 푼 것)
      const incompleteGrammar = data.incompleteGrammar || [];
      // 완료한 문법
      const learnedGrammar = data.learnedGrammar || [];

      const res = await fetch('/api/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: getLevel(data),
          learnedGrammar,
          incompleteGrammar,
        }),
      });
      const json = await res.json();
      if (json.grammar) {
        setGrammar(json.grammar);
        setIsReview(json.isReview || false);

        // 미완료 문법이 아닌 경우에만 incompleteGrammar에 추가
        if (!json.isReview && user) {
          const newTitles = json.grammar.map((g: Grammar) => g.title);
          await updateDoc(doc(db, 'users', user.uid), {
            incompleteGrammar: arrayUnion(...newTitles),
          });
        }
      }
    } catch (e) { console.error('문법 로딩 실패:', e); }
    setLoadingGrammar(false);
  }

  function speak(text: string) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  async function handleWordResult(isCorrect: boolean) {
    if (!user || words.length === 0) return;
    const currentWord = words[currentIdx % words.length];
    if (isCorrect) {
      const newDone = doneToday + 1;
      setDoneToday(newDone);
      setCorrect(c => c + 1);
      await updateDoc(doc(db, 'users', user.uid), {
        wordsDoneToday: increment(1),
        wordsStudied: increment(1),
        totalXP: increment(6),
      });
      if (newDone >= DAILY_GOAL) {
        await updateDoc(doc(db, 'users', user.uid), { totalXP: increment(30) });
        setWordCompleted(true);
        return;
      }
    } else {
      setWrong(w => w + 1);
      await updateDoc(doc(db, 'users', user.uid), {
        wrongWords: [...(userData?.wrongWords || []), currentWord.en].slice(-20),
      });
    }
    setFlipped(false);
    setTimeout(() => setCurrentIdx(i => (i + 1) % words.length), 100);
  }

  async function handleGrammarAnswer(gi: number, qi: number, ans: string) {
    const key = `${gi}_${qi}`;
    if (grammarAnswered[key]) return;
    setGrammarAnswered(prev => ({ ...prev, [key]: true, [`${gi}_${qi}_ans`]: ans }));
    if (ans === grammar[gi].quizzes[qi].answer && user) {
      await updateDoc(doc(db, 'users', user.uid), { totalXP: increment(8) });
    }

    // 해당 문법의 모든 퀴즈가 완료됐는지 확인
    const allQuizDone = grammar[gi].quizzes.every((_, qIdx) =>
      qIdx === qi ? true : grammarAnswered[`${gi}_${qIdx}`]
    );

    if (allQuizDone && user) {
      const grammarTitle = grammar[gi].title;
      // 완료 목록에 추가 + 미완료 목록에서 제거
      const currentIncomplete = userData?.incompleteGrammar || [];
      const updatedIncomplete = currentIncomplete.filter((g: string) => g !== grammarTitle);
      await updateDoc(doc(db, 'users', user.uid), {
        learnedGrammar: arrayUnion(grammarTitle),
        incompleteGrammar: updatedIncomplete,
        totalXP: increment(40),
      });
      // 로컬 userData 업데이트
      setUserData((prev: any) => ({
        ...prev,
        learnedGrammar: [...(prev?.learnedGrammar || []), grammarTitle],
        incompleteGrammar: updatedIncomplete,
      }));
    }
  }

  const w = words[currentIdx % (words.length || 1)];
  const pct = Math.round((doneToday / DAILY_GOAL) * 100);
  const levelLabel = getLevel(userData || {}) === 'beginner' ? '🌱 초급'
    : getLevel(userData || {}) === 'intermediate' ? '📘 중급' : '🔥 고급';

  const sidebarItems = [
    { label:'🏠 대시보드', path:'/dashboard' },
    { label:'📚 학습', path:'/learn' },
    { label:'🎮 퀴즈', path:'/quiz' },
    { label:'💬 회화', path:'/conversation' },
    { label:'👤 마이페이지', path:'/mypage' },
    { label:'⚙️ 설정', path:'/settings' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#F1F0FF', fontFamily:'sans-serif', display:'flex' }}>
      {/* 사이드바 */}
      <div style={{ width:'220px', background:'#1A1A2E', borderRight:'1px solid rgba(255,255,255,0.08)', padding:'24px 16px', position:'fixed', top:0, left:0, height:'100vh', display:'flex', flexDirection:'column' }}>
        <div style={{ fontWeight:900, fontSize:'1.4rem', color:'#6366F1', marginBottom:'36px' }}>Haru<span style={{color:'#F59E0B'}}>EN</span></div>
        {sidebarItems.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', borderRadius:'12px', border:'none', background: item.path==='/learn' ? 'rgba(79,70,229,0.2)' : 'transparent', color: item.path==='/learn' ? '#6366F1' : '#8B8BAA', cursor:'pointer', fontSize:'0.9rem', fontWeight:500, marginBottom:'4px', width:'100%', textAlign:'left' }}>
            {item.label}
          </button>
        ))}
      </div>

      {/* 메인 */}
      <div style={{ marginLeft:'220px', padding:'32px', flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
          <h1 style={{ fontSize:'1.8rem', fontWeight:900 }}>📚 학습</h1>
          <span style={{ background:'rgba(79,70,229,0.15)', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', padding:'4px 14px', fontSize:'0.85rem', color:'#6366F1', fontWeight:600 }}>{levelLabel}</span>
        </div>
        <p style={{ color:'#8B8BAA', marginBottom:'24px' }}>AI가 오늘의 맞춤 학습을 준비했어요 ✨</p>

        {/* 탭 */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'28px' }}>
          {[{id:'words',label:'📝 단어'},{id:'grammar',label:'✏️ 문법'}].map(t => (
            <button key={t.id} onClick={() => setStep(t.id as any)}
              style={{ padding:'10px 20px', borderRadius:'10px', border:'1px solid', borderColor: step===t.id ? '#4F46E5' : 'rgba(255,255,255,0.08)', background: step===t.id ? '#4F46E5' : 'transparent', color: step===t.id ? 'white' : '#8B8BAA', cursor:'pointer', fontWeight:500, fontSize:'0.88rem' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== 단어 탭 ===== */}
        {step === 'words' && (
          <>
            {loadingWords && (
              <div style={{ textAlign:'center', padding:'60px 0' }}>
                <div style={{ fontSize:'3rem', marginBottom:'16px' }}>✨</div>
                <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:'8px' }}>AI가 맞춤 단어를 준비 중이에요...</div>
                <div style={{ color:'#8B8BAA', fontSize:'0.88rem' }}>레벨과 학습 기록을 분석하고 있어요 🤖</div>
              </div>
            )}

            {!loadingWords && !wordCompleted && words.length > 0 && (
              <div>
                <div style={{ marginBottom:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'#8B8BAA', marginBottom:'6px' }}>
                    <span>오늘 학습 진행</span><span>{doneToday}/{DAILY_GOAL}</span>
                  </div>
                  <div style={{ height:'8px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#059669,#10B981)', borderRadius:'4px', transition:'width 0.5s' }}></div>
                  </div>
                </div>
                <div style={{ textAlign:'center', marginBottom:'12px', color:'#8B8BAA', fontSize:'0.85rem' }}>단어 {doneToday+1} / {DAILY_GOAL}</div>

                <div onClick={() => { setFlipped(f => !f); if (!flipped) speak(w?.en); }}
                  style={{ width:'100%', maxWidth:'400px', height:'260px', margin:'0 auto 24px', cursor:'pointer', perspective:'800px' }}>
                  <div style={{ width:'100%', height:'100%', position:'relative', transformStyle:'preserve-3d', transition:'transform 0.55s', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                    <div style={{ position:'absolute', width:'100%', height:'100%', backfaceVisibility:'hidden', background:'linear-gradient(135deg,#1A1A2E,#1E1E35)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px' }}>
                      <div style={{ fontSize:'2.8rem', fontWeight:900, color:'#6366F1', marginBottom:'8px' }}>{w?.en}</div>
                      <div style={{ color:'#8B8BAA', fontSize:'0.9rem', marginBottom:'12px' }}>[ {w?.pronun} ]</div>
                      <div style={{ color:'#8B8BAA', fontSize:'0.78rem' }}>👆 클릭해서 뜻 확인</div>
                    </div>
                    <div style={{ position:'absolute', width:'100%', height:'100%', backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:'linear-gradient(135deg,rgba(79,70,229,0.15),#1E1E35)', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px' }}>
                      <div style={{ fontSize:'1.8rem', fontWeight:700, marginBottom:'8px' }}>{w?.ko}</div>
                      <div style={{ color:'#8B8BAA', fontSize:'0.85rem', textAlign:'center', lineHeight:1.6 }}>{w?.exEn}<br/>{w?.exKo}</div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign:'center', marginBottom:'20px' }}>
                  <button onClick={() => speak(w?.en)}
                    style={{ background:'rgba(79,70,229,0.15)', border:'1px solid rgba(79,70,229,0.3)', color:'#6366F1', borderRadius:'8px', padding:'8px 18px', cursor:'pointer', fontSize:'0.88rem' }}>
                    🔊 발음 듣기
                  </button>
                </div>
                <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
                  <button onClick={() => handleWordResult(false)}
                    style={{ padding:'12px 32px', background:'#EF4444', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:700, fontSize:'1rem' }}>
                    ❌ 모르겠어요
                  </button>
                  <button onClick={() => handleWordResult(true)}
                    style={{ padding:'12px 32px', background:'#10B981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:700, fontSize:'1rem' }}>
                    ✅ 알았어요!
                  </button>
                </div>
              </div>
            )}

            {!loadingWords && wordCompleted && (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:'5rem', marginBottom:'16px' }}>🎉</div>
                <h2 style={{ fontSize:'2rem', fontWeight:900, marginBottom:'8px' }}>오늘 단어 완료!</h2>
                <p style={{ color:'#8B8BAA', marginBottom:'8px', lineHeight:1.7 }}>{DAILY_GOAL}개 단어를 모두 배웠어요! 👏</p>
                <p style={{ color:'#8B8BAA', marginBottom:'24px' }}>✅ 알았어요: {correct}개 &nbsp;|&nbsp; ❌ 모르겠어요: {wrong}개</p>
                <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'12px', padding:'12px 24px', marginBottom:'28px' }}>
                  <span>⭐</span><span style={{ fontWeight:800, color:'#F59E0B', fontSize:'1.1rem' }}>+30 XP 획득!</span>
                </div>
                <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={() => { setWordCompleted(false); setDoneToday(0); setCurrentIdx(0); setCorrect(0); setWrong(0); fetchWords(userData); }}
                    style={{ padding:'12px 24px', background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'#F1F0FF', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                    🔄 새 단어로 다시하기
                  </button>
                  <button onClick={() => setStep('grammar')}
                    style={{ padding:'12px 24px', background:'#4F46E5', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                    ✏️ 문법 학습하기 →
                  </button>
                  <button onClick={() => router.push('/quiz')}
                    style={{ padding:'12px 24px', background:'#10B981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                    🎮 퀴즈 도전하기 →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== 문법 탭 ===== */}
        {step === 'grammar' && (
          <>
            {loadingGrammar && (
              <div style={{ textAlign:'center', padding:'60px 0' }}>
                <div style={{ fontSize:'3rem', marginBottom:'16px' }}>📖</div>
                <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:'8px' }}>
                  {isReview ? '📝 미완료 문법을 다시 가져오는 중...' : 'AI가 오늘의 문법을 준비 중이에요...'}
                </div>
                <div style={{ color:'#8B8BAA', fontSize:'0.88rem' }}>레벨에 맞는 문법을 생성하고 있어요 🤖</div>
              </div>
            )}

            {/* 복습 안내 배너 */}
            {!loadingGrammar && isReview && (
              <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'12px', padding:'14px 20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'1.4rem' }}>🔄</span>
                <div>
                  <div style={{ fontWeight:700, color:'#F59E0B' }}>지난번에 퀴즈를 완료하지 않은 문법이에요!</div>
                  <div style={{ color:'#8B8BAA', fontSize:'0.85rem', marginTop:'2px' }}>퀴즈까지 완료해야 새로운 문법으로 넘어가요 💪</div>
                </div>
              </div>
            )}

            {!loadingGrammar && grammar.map((g, gi) => {
              const allDone = g.quizzes.every((_,qi) => grammarAnswered[`${gi}_${qi}`]);
              return (
                <div key={gi} style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                    <span style={{ fontSize:'1.8rem' }}>{g.icon}</span>
                    <div>
                      <div style={{ fontWeight:900, fontSize:'1.1rem' }}>{g.title}</div>
                      <div style={{ color:'#8B8BAA', fontSize:'0.82rem', marginTop:'2px' }}>{g.desc}</div>
                    </div>
                  </div>
                  <div style={{ background:'rgba(79,70,229,0.07)', borderLeft:'3px solid #6366F1', borderRadius:'0 10px 10px 0', padding:'12px 16px', marginBottom:'16px', fontSize:'0.88rem', lineHeight:1.9 }}
                    dangerouslySetInnerHTML={{ __html: g.detail }} />
                  <div style={{ marginBottom:'16px' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>📖 예문</div>
                    {g.examples.map((e, ei) => (
                      <div key={ei} style={{ display:'flex', alignItems:'flex-start', gap:'10px', background:'#252540', borderRadius:'8px', padding:'10px 14px', marginBottom:'6px' }}>
                        <button onClick={() => speak(e.en)}
                          style={{ background:'rgba(79,70,229,0.15)', border:'none', borderRadius:'6px', padding:'3px 8px', color:'#6366F1', cursor:'pointer', fontSize:'0.75rem', flexShrink:0 }}>🔊</button>
                        <div>
                          <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{e.en}</div>
                          <div style={{ color:'#8B8BAA', fontSize:'0.82rem', marginTop:'2px' }}>{e.ko}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:'12px', padding:'16px' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#F59E0B', marginBottom:'14px' }}>✏️ 퀴즈 — 다 풀어야 완료예요!</div>
                    {g.quizzes.map((qz, qi) => {
                      const key = `${gi}_${qi}`;
                      const answered = grammarAnswered[key];
                      const selectedAns = grammarAnswered[`${gi}_${qi}_ans`];
                      return (
                        <div key={qi} style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom: qi < g.quizzes.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <div style={{ fontSize:'0.82rem', color:'#8B8BAA', marginBottom:'5px' }}>Q{qi+1}. {qz.q}</div>
                          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'10px' }}>{qz.blank}</div>
                          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                            {qz.opts.map(o => {
                              let bg='transparent', bc='rgba(255,255,255,0.1)', cl='#F1F0FF';
                              if (answered) {
                                if (o===qz.answer) { bg='rgba(16,185,129,0.25)'; bc='#10B981'; cl='#10B981'; }
                                else if (o===selectedAns) { bg='rgba(239,68,68,0.18)'; bc='#EF4444'; cl='#EF4444'; }
                              }
                              return (
                                <button key={o} disabled={!!answered} onClick={() => handleGrammarAnswer(gi, qi, o)}
                                  style={{ padding:'8px 16px', borderRadius:'8px', border:`1px solid ${bc}`, background:bg, color:cl, cursor: answered ? 'not-allowed' : 'pointer', fontSize:'0.82rem' }}>
                                  {o}
                                </button>
                              );
                            })}
                          </div>
                          {answered && (
                            <div style={{ fontSize:'0.82rem', fontWeight:600, color: selectedAns===qz.answer ? '#10B981' : '#EF4444' }}>
                              {selectedAns===qz.answer ? '🎉 정답이에요!' : `💡 정답은 "${qz.answer}" 이에요!`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {allDone && (
                      <div style={{ textAlign:'center', paddingTop:'8px', background:'rgba(16,185,129,0.1)', borderRadius:'8px', padding:'12px' }}>
                        <span style={{ fontWeight:800, color:'#10B981' }}>🎊 이 문법 완료! +40 XP</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 문법 전체 완료 */}
            {!loadingGrammar && grammar.length > 0 && grammar.every((_,gi) => grammar[gi].quizzes.every((_,qi) => grammarAnswered[`${gi}_${qi}`])) && (
              <div style={{ background:'rgba(79,70,229,0.1)', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', padding:'36px', textAlign:'center', marginTop:'16px' }}>
                <div style={{ fontSize:'4rem', marginBottom:'12px' }}>🏆</div>
                <div style={{ fontWeight:900, fontSize:'1.6rem', marginBottom:'8px' }}>문법 학습 완료!</div>
                <p style={{ color:'#8B8BAA', marginBottom:'24px' }}>모든 퀴즈를 완료했어요! 새로운 문법으로 넘어갈 수 있어요 🎊</p>
                <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={() => { setGrammar([]); setGrammarAnswered({}); fetchGrammar(userData); }}
                    style={{ padding:'12px 24px', background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'#F1F0FF', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                    📖 새 문법 배우기
                  </button>
                  <button onClick={() => router.push('/quiz')}
                    style={{ padding:'12px 24px', background:'#4F46E5', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                    🎮 퀴즈 도전하기
                  </button>
                  <button onClick={() => router.push('/conversation')}
                    style={{ padding:'12px 24px', background:'#10B981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600 }}>
                    💬 회화 연습하기
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}