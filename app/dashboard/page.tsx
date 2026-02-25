'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { updateStreak, checkAndAwardBadges, BADGES } from '../lib/gamification';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newBadges, setNewBadges] = useState<typeof BADGES>([]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [streakBonus, setStreakBonus] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);

        // 스트릭 업데이트
        const result = await updateStreak(u.uid);
        if (result) {
          if (result.bonusXP) setStreakBonus(result.bonusXP);
          if (result.newBadges?.length > 0) {
            setNewBadges(result.newBadges);
            setShowBadgeModal(true);
          }
          // 업데이트된 데이터 다시 불러오기
          const updatedSnap = await getDoc(doc(db, 'users', u.uid));
          if (updatedSnap.exists()) setUserData(updatedSnap.data());
        }

        // 뱃지 체크
        const badges = await checkAndAwardBadges(u.uid, data);
        if (badges.length > 0) {
          setNewBadges(badges);
          setShowBadgeModal(true);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', alignItems:'center', justifyContent:'center', color:'#F1F0FF', fontSize:'1.2rem' }}>
      로딩 중... ⏳
    </div>
  );

  const xp = userData?.totalXP || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp - (level - 1) * 100;
  const streak = userData?.streak || 0;

  const sidebarItems = [
    { label:'🏠 대시보드', path:'/dashboard' },
    { label:'📚 학습', path:'/learn' },
    { label:'🎮 퀴즈', path:'/quiz' },
    { label:'💬 회화', path:'/conversation' },
    { label:'👤 마이페이지', path:'/mypage' },
    { label:'⚙️ 설정', path:'/settings' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#F1F0FF', fontFamily:'sans-serif' }}>

      {/* 뱃지 획득 모달 */}
      {showBadgeModal && newBadges.length > 0 && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={() => setShowBadgeModal(false)}>
          <div style={{ background:'#1E1E35', border:'1px solid rgba(79,70,229,0.4)', borderRadius:'24px', padding:'36px', textAlign:'center', maxWidth:'380px', width:'90%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'3rem', marginBottom:'12px' }}>🎊</div>
            <h2 style={{ fontWeight:900, fontSize:'1.5rem', marginBottom:'8px' }}>새 뱃지 획득!</h2>
            <p style={{ color:'#8B8BAA', marginBottom:'24px', fontSize:'0.88rem' }}>축하해요! 새로운 뱃지를 얻었어요!</p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap', marginBottom:'24px' }}>
              {newBadges.map(b => (
                <div key={b.id} style={{ background:'rgba(79,70,229,0.15)', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'16px', padding:'16px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'6px' }}>{b.icon}</div>
                  <div style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:'2px' }}>{b.name}</div>
                  <div style={{ color:'#8B8BAA', fontSize:'0.75rem' }}>{b.desc}</div>
                </div>
              ))}
            </div>
            {streakBonus > 0 && (
              <div style={{ background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'10px', padding:'10px', marginBottom:'16px', color:'#F59E0B', fontWeight:700 }}>
                🔥 스트릭 보너스 +{streakBonus} XP!
              </div>
            )}
            <button onClick={() => setShowBadgeModal(false)}
              style={{ width:'100%', padding:'12px', background:'#4F46E5', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:700, fontSize:'1rem' }}>
              확인 ✓
            </button>
          </div>
        </div>
      )}

      {/* 사이드바 */}
      <div style={{ position:'fixed', top:0, left:0, width:'220px', height:'100vh', background:'#1A1A2E', borderRight:'1px solid rgba(255,255,255,0.08)', padding:'24px 16px', display:'flex', flexDirection:'column' }}>
        <div style={{ fontWeight:900, fontSize:'1.4rem', color:'#6366F1', marginBottom:'36px' }}>Haru<span style={{color:'#F59E0B'}}>EN</span></div>
        {sidebarItems.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', borderRadius:'12px', border:'none', background: item.path==='/dashboard' ? 'rgba(79,70,229,0.2)' : 'transparent', color: item.path==='/dashboard' ? '#6366F1' : '#8B8BAA', cursor:'pointer', fontSize:'0.9rem', fontWeight:500, marginBottom:'4px', width:'100%', textAlign:'left' }}>
            {item.label}
          </button>
        ))}
        {/* XP 바 */}
        <div style={{ marginTop:'auto', background:'#252540', borderRadius:'8px', padding:'14px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#8B8BAA', marginBottom:'6px' }}>
            <span>레벨 {level}</span><span>{xpInLevel}/100 XP</span>
          </div>
          <div style={{ height:'6px', background:'rgba(255,255,255,0.1)', borderRadius:'4px' }}>
            <div style={{ height:'100%', width:`${xpInLevel}%`, background:'linear-gradient(90deg,#4F46E5,#6366F1)', borderRadius:'4px' }}></div>
          </div>
          <div style={{ fontSize:'0.8rem', color: streak > 0 ? '#F59E0B' : '#8B8BAA', textAlign:'center', marginTop:'8px', fontWeight: streak > 0 ? 700 : 400 }}>
            {streak > 0 ? `🔥 ${streak}일 연속 학습 중!` : '오늘 학습을 시작해요!'}
          </div>
        </div>
      </div>

      {/* 메인 */}
      <div style={{ marginLeft:'220px', padding:'32px' }}>
        <h1 style={{ fontSize:'1.8rem', fontWeight:900, marginBottom:'4px' }}>👋 안녕하세요, {userData?.nickname || '학습자'}님!</h1>
        <p style={{ color:'#8B8BAA', marginBottom:'28px' }}>오늘의 목표를 완성해보세요</p>

        {/* 스트릭 배너 */}
        {streak >= 2 && (
          <div style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1))', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'16px', padding:'16px 24px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ fontSize:'2.5rem' }}>🔥</div>
            <div>
              <div style={{ fontWeight:900, fontSize:'1.1rem', color:'#F59E0B' }}>{streak}일 연속 학습 중!</div>
              <div style={{ color:'#8B8BAA', fontSize:'0.85rem', marginTop:'2px' }}>
                {streak < 7 ? `7일 연속까지 ${7 - streak}일 남았어요!` :
                 streak < 30 ? `30일 연속까지 ${30 - streak}일 남았어요! 👑` :
                 '대단해요! 30일 이상 연속 학습 중이에요! 👑'}
              </div>
            </div>
          </div>
        )}

        {/* 오늘의 목표 */}
        <div style={{ background:'rgba(79,70,229,0.1)', border:'1px solid rgba(79,70,229,0.25)', borderRadius:'16px', padding:'24px', marginBottom:'20px' }}>
          <h3 style={{ marginBottom:'16px', fontWeight:800 }}>📋 오늘의 목표</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
            {[
              { label:'단어 학습', value:`${userData?.wordsDoneToday || 0} / 30개`, pct:Math.min(((userData?.wordsDoneToday||0)/30)*100,100), color:'#4F46E5' },
              { label:'퀴즈', value:`${userData?.quizToday || 0} / 1회`, pct:Math.min(((userData?.quizToday||0)/1)*100,100), color:'#F59E0B' },
              { label:'오늘 획득 XP', value:`${userData?.xpToday || 0} XP`, pct:Math.min(((userData?.xpToday||0)/100)*100,100), color:'#10B981' },
            ].map(g => (
              <div key={g.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'8px' }}>{g.label}</div>
                <div style={{ fontWeight:900, fontSize:'1.3rem', marginBottom:'8px' }}>{g.value}</div>
                <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
                  <div style={{ height:'100%', width:`${g.pct}%`, background:g.color, borderRadius:'4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 스탯 카드 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px' }}>
          {[
            { icon:'🔥', val: streak, label:'연속 학습일', color:'#F59E0B' },
            { icon:'⭐', val: xp, label:'총 XP', color:'#6366F1' },
            { icon:'📊', val: `Lv.${level}`, label:'현재 레벨', color:'#10B981' },
            { icon:'🏅', val: (userData?.badges || []).length, label:'획득 뱃지', color:'#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px' }}>
              <div style={{ fontSize:'1.8rem', marginBottom:'8px' }}>{s.icon}</div>
              <div style={{ fontWeight:900, fontSize:'2rem', color:s.color }}>{s.val}</div>
              <div style={{ color:'#8B8BAA', fontSize:'0.8rem', marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 빠른 시작 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          <div>
            <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>오늘의 단어 미리보기</div>
            <div onClick={() => router.push('/learn')} style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px', cursor:'pointer' }}>
              <div style={{ fontSize:'0.75rem', color:'#8B8BAA', marginBottom:'4px' }}>클릭해서 배우기 →</div>
              <div style={{ fontSize:'2rem', fontWeight:900, color:'#6366F1' }}>apple</div>
              <div style={{ color:'#8B8BAA', marginTop:'4px' }}>사과 · 애플</div>
              <button onClick={(e) => { e.stopPropagation(); window.speechSynthesis.speak(new SpeechSynthesisUtterance('apple')); }}
                style={{ marginTop:'12px', background:'rgba(79,70,229,0.15)', border:'1px solid rgba(79,70,229,0.3)', color:'#6366F1', borderRadius:'8px', padding:'6px 14px', cursor:'pointer', fontSize:'0.85rem' }}>
                🔊 발음 듣기
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>빠른 시작</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { label:'📚 단어 학습 시작', path:'/learn', primary:true },
                { label:'🎮 퀴즈 도전', path:'/quiz', primary:false },
                { label:'💬 AI 회화 연습', path:'/conversation', primary:false },
              ].map(b => (
                <button key={b.path} onClick={() => router.push(b.path)}
                  style={{ padding:'14px', background: b.primary ? '#4F46E5' : 'transparent', border: b.primary ? 'none' : '1px solid rgba(255,255,255,0.08)', color:'#F1F0FF', borderRadius:'12px', cursor:'pointer', fontWeight:600, fontSize:'1rem' }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}