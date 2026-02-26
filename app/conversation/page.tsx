'use client';
import { useEffect, useState, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';

const SCENARIOS = [
  { id:'cafe',      icon:'☕',  name:'카페 주문',    desc:'카페에서 음료를 주문해요',       aiFirst:'Hello! Welcome to our cafe! What can I get for you today? ☕\n(안녕하세요! 카페에 오신 걸 환영해요! 무엇을 드릴까요?)\n[헬로! 웰컴 투 아워 카페!]' },
  { id:'direction', icon:'🗺️', name:'길 묻기',      desc:'길을 잃었을 때 도움을 요청해요',  aiFirst:'Hi there! You look a bit lost. Can I help you? 😊\n(안녕하세요! 길을 잃으신 것 같아요. 도와드릴까요?)\n[하이 데어! 유 룩 어 빗 로스트]' },
  { id:'intro',     icon:'👋',  name:'자기소개',     desc:'새로운 친구에게 나를 소개해요',   aiFirst:"Hi! I'm Alex. Nice to meet you! What's your name? 😄\n(안녕! 나는 Alex야. 만나서 반가워! 이름이 뭐야?)\n[하이! 아임 알렉스. 나이스 투 밋 유!]" },
  { id:'shopping',  icon:'🛍️', name:'쇼핑',         desc:'쇼핑몰에서 물건을 사요',          aiFirst:'Hello! Welcome to our store! Are you looking for anything special? 🛍️\n(안녕하세요! 저희 가게에 오신 걸 환영해요! 찾으시는 것이 있나요?)\n[헬로! 웰컴 투 아워 스토어!]' },
  { id:'hotel',     icon:'🏨',  name:'호텔 체크인',  desc:'호텔에 도착해서 체크인해요',      aiFirst:'Good evening! Welcome to Grand Hotel! Do you have a reservation? 🏨\n(안녕하세요! 그랜드 호텔에 오신 걸 환영합니다! 예약하셨나요?)\n[굿 이브닝! 웰컴 투 그랜드 호텔!]' },
];

const HINTS: Record<string, string[]> = {
  cafe:      ['Can I have a coffee, please? (커피 한 잔 주세요)', 'How much is it? (얼마예요?)', 'For here, please. (여기서 마실게요)'],
  direction: ['Excuse me, where is the subway? (실례지만 지하철이 어디예요?)', 'How long does it take? (얼마나 걸려요?)', 'Thank you so much! (정말 감사해요!)'],
  intro:     ['My name is ___. (제 이름은 ___이에요)', 'I am from Korea. (한국에서 왔어요)', 'Nice to meet you too! (저도 만나서 반가워요!)'],
  shopping:  ['How much is this? (이거 얼마예요?)', 'Do you have a bigger size? (더 큰 사이즈 있나요?)', 'Can I try this on? (입어봐도 될까요?)'],
  hotel:     ['I have a reservation. (예약했어요)', 'What time is check-out? (체크아웃은 몇 시예요?)', 'Could I have the WiFi password? (와이파이 비밀번호 알려주세요)'],
};

type Message = { role:'user'|'assistant'; content:string; };

export default function ConversationPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [selectedScenario, setSelectedScenario] = useState<typeof SCENARIOS[0]|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  function selectScenario(scenario: typeof SCENARIOS[0]) {
    setSelectedScenario(scenario);
    setMessages([{ role:'assistant', content:scenario.aiFirst }]);
    setTurnCount(0); setCompleted(false); setShowHint(false); setInput('');
  }

  function speak(text: string) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const englishOnly = text.split('\n')[0].replace(/[^\w\s!?.,']/g,'');
      const u = new SpeechSynthesisUtterance(englishOnly);
      u.lang='en-US'; u.rate=0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  function startListening() {
    if (typeof window==='undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Chrome 브라우저를 사용해주세요!'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang='ko-KR'; recognition.interimResults=false; recognition.maxAlternatives=1;
    recognition.onstart=()=>setIsListening(true);
    recognition.onend=()=>setIsListening(false);
    recognition.onresult=(event: any)=>setInput(event.results[0][0].transcript);
    recognition.onerror=()=>setIsListening(false);
    recognition.start();
  }

  async function sendMessage() {
    if (!input.trim()||loading||!selectedScenario) return;
    const userMsg: Message = { role:'user', content:input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages:newMessages, scenario:selectedScenario.name+' - '+selectedScenario.desc }),
      });
      const json = await res.json();
      if (json.message) {
        setMessages(m=>[...m,{ role:'assistant', content:json.message }]);
        const newTurn = turnCount+1;
        setTurnCount(newTurn);
        if (newTurn>=5&&!completed) {
          setCompleted(true);
          if (user) await updateDoc(doc(db,'users',user.uid), { totalXP:increment(60) });
        }
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  return (
    <Layout>
      <h1 style={{ fontSize:'1.5rem', fontWeight:900, marginBottom:'4px' }}>💬 AI 회화 연습</h1>
      <p style={{ color:'#8B8BAA', marginBottom:'20px', fontSize:'0.88rem' }}>실제 상황에서 영어로 대화해봐요!</p>

      {/* 시나리오 선택 */}
      {!selectedScenario && (
        <div>
          <div style={{ fontSize:'0.88rem', color:'#8B8BAA', marginBottom:'14px' }}>상황을 선택하세요 👇</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'10px' }}>
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={()=>selectScenario(s)}
                style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px 16px', cursor:'pointer', textAlign:'left' }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='#4F46E5')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.08)')}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>{s.icon}</div>
                <div style={{ fontWeight:700, fontSize:'0.92rem', marginBottom:'3px', color:'#F1F0FF' }}>{s.name}</div>
                <div style={{ fontSize:'0.75rem', color:'#8B8BAA' }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 채팅 화면 */}
      {selectedScenario && (
        <div>
          {/* 헤더 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'12px 16px', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'1.5rem' }}>{selectedScenario.icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{selectedScenario.name}</div>
                <div style={{ fontSize:'0.72rem', color:'#8B8BAA' }}>대화 {turnCount}/5</div>
              </div>
            </div>
            <button onClick={()=>setSelectedScenario(null)}
              style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#EF4444', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'0.78rem' }}>
              나가기
            </button>
          </div>

          {/* 완료 배너 */}
          {completed && (
            <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'12px', padding:'12px 16px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
              <span style={{ fontWeight:700, color:'#10B981', fontSize:'0.9rem' }}>🎉 완료! +60 XP 획득!</span>
              <button onClick={()=>setSelectedScenario(null)}
                style={{ background:'#10B981', border:'none', color:'white', borderRadius:'8px', padding:'6px 14px', cursor:'pointer', fontWeight:600, fontSize:'0.82rem' }}>
                다른 상황 연습하기
              </button>
            </div>
          )}

          {/* 메시지 */}
          <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'16px', marginBottom:'10px', height:'340px', overflowY:'auto' }}>
            {messages.map((m,i) => (
              <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', marginBottom:'14px' }}>
                {m.role==='assistant' && (
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'linear-gradient(135deg,#4F46E5,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', marginRight:'8px', flexShrink:0, marginTop:'2px' }}>
                    🤖
                  </div>
                )}
                <div style={{ maxWidth:'78%' }}>
                  <div style={{ background:m.role==='user'?'#4F46E5':'#252540', borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px', padding:'10px 14px', fontSize:'0.88rem', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
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

          {/* 힌트 */}
          {showHint && (
            <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'12px', padding:'12px', marginBottom:'10px' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#F59E0B', marginBottom:'8px' }}>💡 이렇게 말해보세요!</div>
              {HINTS[selectedScenario.id]?.map((h,i) => (
                <div key={i} onClick={()=>{ setInput(h.split(' (')[0]); setShowHint(false); }}
                  style={{ background:'rgba(245,158,11,0.1)', borderRadius:'8px', padding:'8px 10px', marginBottom:'5px', cursor:'pointer', fontSize:'0.82rem', color:'#F1F0FF' }}>
                  {h}
                </div>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <button onClick={()=>setShowHint(h=>!h)}
              style={{ background:showHint?'rgba(245,158,11,0.2)':'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', color:'#F59E0B', borderRadius:'10px', padding:'11px 12px', cursor:'pointer', fontSize:'0.9rem', flexShrink:0 }}>
              💡
            </button>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
              placeholder="한국어 또는 영어로 입력하세요..."
              style={{ flex:1, background:'#1E1E35', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'11px 14px', color:'#F1F0FF', fontSize:'0.88rem', outline:'none' }}
            />
            <button onClick={startListening} disabled={isListening}
              style={{ background:isListening?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.15)', border:`1px solid ${isListening?'#EF4444':'rgba(16,185,129,0.3)'}`, color:isListening?'#EF4444':'#10B981', borderRadius:'10px', padding:'11px 12px', cursor:isListening?'not-allowed':'pointer', fontSize:'1rem', flexShrink:0 }}>
              {isListening?'🔴':'🎤'}
            </button>
            <button onClick={sendMessage} disabled={loading||!input.trim()}
              style={{ background:loading||!input.trim()?'rgba(79,70,229,0.3)':'#4F46E5', border:'none', color:'white', borderRadius:'10px', padding:'11px 16px', cursor:loading?'not-allowed':'pointer', fontWeight:700, fontSize:'0.88rem', flexShrink:0 }}>
              전송→
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}