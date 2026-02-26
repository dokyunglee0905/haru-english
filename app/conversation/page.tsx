'use client';
import { useEffect, useState, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';

type Message = { role:'user'|'assistant'; content:string; };

export default function ConversationPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [todayWords, setTodayWords] = useState<string[]>([]);
  const [todayGrammar, setTodayGrammar] = useState<string[]>([]);
  const [loadingStart, setLoadingStart] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        // 오늘 배운 단어/문법 가져오기
        setTodayWords(data.todayWords || []);
        setTodayGrammar(data.learnedGrammar?.slice(-3) || []);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  function speak(text: string) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const englishOnly = text.split('\n')[0].replace(/[^\w\s!?.,']/g,'');
      const u = new SpeechSynthesisUtterance(englishOnly);
      u.lang='en-US'; u.rate=0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  async function startConversation() {
    setLoadingStart(true);
    try {
      const level = userData?.currentLevel || 1;
      const levelLabel = level <= 3 ? '초급' : level <= 6 ? '중급' : '고급';
      
      const systemPrompt = `너는 한국인 영어 초보자를 위한 친절한 영어 선생님이야.
오늘 학습한 단어: ${todayWords.slice(0,10).join(', ') || '없음'}
최근 배운 문법: ${todayGrammar.join(', ') || '없음'}
학습자 레벨: ${levelLabel}

위의 단어와 문법을 자연스럽게 활용하는 대화를 시작해줘.
반드시 이 형식으로 답해줘:
영어 문장
(한국어 해석)
[한글 발음]

오늘 배운 단어나 문법이 포함된 간단한 질문으로 대화를 시작해줘.`;

      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          messages: [{ role:'user', content:'대화를 시작해줘' }],
          systemPrompt,
        }),
      });
      const json = await res.json();
      if (json.message) {
        setMessages([{ role:'assistant', content:json.message }]);
        setStarted(true);
      }
    } catch(e) { console.error(e); }
    setLoadingStart(false);
  }

  function toggleListening() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Safari 브라우저를 사용해주세요!'); return; }

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch(e) {}
      setIsListening(false);
      setInterimText('');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => { setIsListening(true); setInterimText(''); };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) { final += transcript; }
          else { interim += transcript; }
        }
        if (final) { setInput(final); setInterimText(''); }
        else if (interim) { setInterimText(interim); }
      };

      recognition.onend = () => { setIsListening(false); setInterimText(''); };
      recognition.onerror = (event: any) => {
        setIsListening(false); setInterimText('');
        if (event.error === 'not-allowed') alert('마이크 권한을 허용해주세요!');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch(e) { setIsListening(false); }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role:'user', content:input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setLoading(true);

    try {
      const systemPrompt = `너는 한국인 영어 초보자를 위한 친절한 영어 선생님이야.
오늘 학습한 단어: ${todayWords.slice(0,10).join(', ') || '없음'}
최근 배운 문법: ${todayGrammar.join(', ') || '없음'}

오늘 배운 단어와 문법을 자연스럽게 활용해서 대화를 이어가줘.
반드시 이 형식으로 답해줘:
영어 문장
(한국어 해석)
[한글 발음]

사용자가 틀린 표현이 있으면 부드럽게 교정해줘.
짧고 간단한 문장을 사용해줘.`;

      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages:newMessages, systemPrompt }),
      });
      const json = await res.json();
      if (json.message) {
        setMessages(m=>[...m,{ role:'assistant', content:json.message }]);
        const newTurn = turnCount + 1;
        setTurnCount(newTurn);
        if (newTurn >= 5 && !completed) {
          setCompleted(true);
          if (user) await updateDoc(doc(db,'users',user.uid), {
            totalXP: increment(60),
            conversationCount: increment(1),
          });
        }
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  return (
    <Layout>
      <h1 style={{ fontSize:'1.5rem', fontWeight:900, marginBottom:'4px' }}>💬 오늘의 회화 연습</h1>
      <p style={{ color:'#8B8BAA', marginBottom:'20px', fontSize:'0.88rem' }}>오늘 배운 단어와 문법으로 대화해봐요! ✨</p>

      {/* 시작 전 화면 */}
      {!started && (
        <div>
          {/* 오늘 배운 내용 요약 */}
          <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:'14px' }}>📖 오늘 배운 내용으로 연습해요!</div>
            
            <div style={{ marginBottom:'14px' }}>
              <div style={{ fontSize:'0.75rem', color:'#8B8BAA', fontWeight:700, marginBottom:'8px' }}>📝 최근 배운 단어</div>
              {todayWords.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {todayWords.slice(0,12).map((w,i) => (
                    <span key={i} style={{ background:'rgba(79,70,229,0.15)', border:'1px solid rgba(79,70,229,0.2)', borderRadius:'20px', padding:'4px 10px', fontSize:'0.8rem', color:'#6366F1', fontWeight:600 }}>
                      {w}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color:'#8B8BAA', fontSize:'0.85rem' }}>
                  아직 학습한 단어가 없어요!
                  <button onClick={()=>router.push('/learn')}
                    style={{ marginLeft:'8px', color:'#4F46E5', background:'none', border:'none', cursor:'pointer', fontSize:'0.85rem', fontWeight:600 }}>
                    단어 학습하러 가기 →
                  </button>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize:'0.75rem', color:'#8B8BAA', fontWeight:700, marginBottom:'8px' }}>✏️ 최근 배운 문법</div>
              {todayGrammar.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {todayGrammar.map((g,i) => (
                    <span key={i} style={{ background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'20px', padding:'4px 10px', fontSize:'0.8rem', color:'#F59E0B', fontWeight:600 }}>
                      {g}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color:'#8B8BAA', fontSize:'0.85rem' }}>
                  아직 학습한 문법이 없어요!
                  <button onClick={()=>router.push('/learn')}
                    style={{ marginLeft:'8px', color:'#4F46E5', background:'none', border:'none', cursor:'pointer', fontSize:'0.85rem', fontWeight:600 }}>
                    문법 학습하러 가기 →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 안내 */}
          <div style={{ background:'rgba(79,70,229,0.08)', border:'1px solid rgba(79,70,229,0.2)', borderRadius:'14px', padding:'16px', marginBottom:'20px' }}>
            <div style={{ fontWeight:700, marginBottom:'8px', fontSize:'0.9rem' }}>💡 이렇게 진행돼요</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                '🤖 AI가 오늘 배운 단어로 영어로 말을 걸어요',
                '💬 한국어 또는 영어로 자유롭게 대답하세요',
                '✅ 틀린 표현은 AI가 부드럽게 교정해줘요',
                '🎉 5번 대화하면 +60 XP 획득!',
              ].map((t,i) => (
                <div key={i} style={{ fontSize:'0.85rem', color:'#8B8BAA' }}>{t}</div>
              ))}
            </div>
          </div>

          <button onClick={startConversation} disabled={loadingStart}
            style={{ width:'100%', padding:'16px', background: loadingStart ? 'rgba(79,70,229,0.3)' : '#4F46E5', color:'white', border:'none', borderRadius:'14px', fontSize:'1.05rem', fontWeight:700, cursor: loadingStart ? 'not-allowed' : 'pointer' }}>
            {loadingStart ? '🤖 AI가 준비 중...' : '🚀 오늘의 회화 시작!'}
          </button>
        </div>
      )}

      {/* 채팅 화면 */}
      {started && (
        <div style={{ display:'flex', flexDirection:'column' }}>
          {/* 헤더 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'12px 16px', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'1.5rem' }}>🤖</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.95rem' }}>AI 회화 연습</div>
                <div style={{ fontSize:'0.72rem', color:'#8B8BAA' }}>대화 {turnCount}/5</div>
              </div>
            </div>
            <button onClick={()=>{ setStarted(false); setMessages([]); setTurnCount(0); setCompleted(false); }}
              style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#EF4444', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'0.78rem' }}>
              다시 시작
            </button>
          </div>

          {/* 완료 배너 */}
          {completed && (
            <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'12px', padding:'12px 16px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
              <span style={{ fontWeight:700, color:'#10B981', fontSize:'0.9rem' }}>🎉 완료! +60 XP 획득!</span>
              <button onClick={()=>{ setStarted(false); setMessages([]); setTurnCount(0); setCompleted(false); }}
                style={{ background:'#10B981', border:'none', color:'white', borderRadius:'8px', padding:'6px 14px', cursor:'pointer', fontWeight:600, fontSize:'0.82rem' }}>
                한 번 더 연습하기
              </button>
            </div>
          )}

          {/* 진행률 */}
          <div style={{ marginBottom:'10px' }}>
            <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
              <div style={{ height:'100%', width:`${Math.min((turnCount/5)*100,100)}%`, background:'linear-gradient(90deg,#4F46E5,#10B981)', borderRadius:'4px', transition:'width 0.5s' }}></div>
            </div>
          </div>

          {/* 메시지 */}
          <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'16px', marginBottom:'10px', height:'320px', overflowY:'auto' }}>
            {messages.map((m,i) => (
              <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', marginBottom:'14px' }}>
                {m.role==='assistant' && (
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'linear-gradient(135deg,#4F46E5,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', marginRight:'8px', flexShrink:0, marginTop:'2px' }}>
                    🤖
                  </div>
                )}
                <div style={{ maxWidth:'78%' }}>
                  <div style={{ background:m.role==='user'?'#4F46E5':'#252540', borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px', padding:'10px 14px', fontSize:'0.88rem', lineHeight:1.7, whiteSpace:'pre-wrap', color:'#F1F0FF' }}>
                    {m.content}
                  </div>
                  {m.role==='assistant' && (
                    <button onClick={()=>speak(m.content)}
                      style={{ background:'none', border:'none', color:'#8B8BAA', cursor:'pointer', fontSize:'0.72rem', marginTop:'3px', padding:'2px 4px' }}>
                      🔊 발음 듣기
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', marginBottom:'14px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'linear-gradient(135deg,#4F46E5,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', marginRight:'8px' }}>🤖</div>
                <div style={{ background:'#252540', borderRadius:'16px 16px 16px 4px', padding:'10px 14px', color:'#8B8BAA', fontSize:'0.88rem' }}>입력 중...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 음성 인식 중 표시 */}
          {(isListening || interimText) && (
            <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', padding:'10px 14px', marginBottom:'8px', fontSize:'0.85rem' }}>
              <span style={{ color:'#EF4444', fontWeight:700 }}>🎤 듣는 중... </span>
              <span style={{ color:'#8B8BAA' }}>{interimText || '말씀해주세요!'}</span>
            </div>
          )}

          {/* 입력창 */}
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
              placeholder="한국어 또는 영어로 입력하세요..."
              style={{ flex:1, minWidth:0, background:'#1E1E35', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'11px 12px', color:'#F1F0FF', fontSize:'0.88rem', outline:'none' }}
            />
            <button onClick={toggleListening}
              style={{
                background: isListening ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.15)',
                border: `1px solid ${isListening ? '#EF4444' : 'rgba(16,185,129,0.3)'}`,
                color: isListening ? '#EF4444' : '#10B981',
                borderRadius:'10px', padding:'11px 10px', cursor:'pointer', fontSize:'1rem', flexShrink:0,
              }}>
              {isListening ? '⏹️' : '🎤'}
            </button>
            <button onClick={sendMessage} disabled={loading||!input.trim()}
              style={{ background:loading||!input.trim()?'rgba(79,70,229,0.3)':'#4F46E5', border:'none', color:'white', borderRadius:'10px', padding:'11px 12px', cursor:loading?'not-allowed':'pointer', fontWeight:700, fontSize:'0.88rem', flexShrink:0, whiteSpace:'nowrap' }}>
              전송→
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}