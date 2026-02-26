'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { updateStreak, checkAndAwardBadges, BADGES } from '../lib/gamification';
import Layout from '../components/Layout';

export default function Dashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newBadges, setNewBadges] = useState<typeof BADGES>([]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [streakBonus, setStreakBonus] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        const result = await updateStreak(u.uid);
        if (result) {
          if (result.bonusXP) setStreakBonus(result.bonusXP);
          if (result.newBadges?.length > 0) { setNewBadges(result.newBadges); setShowBadgeModal(true); }
          const updatedSnap = await getDoc(doc(db, 'users', u.uid));
          if (updatedSnap.exists()) setUserData(updatedSnap.data());
        }
        const badges = await checkAndAwardBadges(u.uid, data);
        if (badges.length > 0) { setNewBadges(badges); setShowBadgeModal(true); }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', alignItems:'center', justifyContent:'center', color:'#F1F0FF' }}>
      로딩 중... ⏳
    </div>
  );

  const xp = userData?.totalXP || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp - (level - 1) * 100;
  const streak = userData?.streak || 0;

  return (
    <Layout>
      {/* 뱃지 모달 */}
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
              style={{ width:'100%', padding:'12px', background:'#4F46E5', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:700 }}>
              확인 ✓
            </button>
          </div>
        </div>
      )}

      <h1 style={{ fontSize:'1.5rem', fontWeight:900, marginBottom:'4px' }}>👋 안녕하세요, {userData?.nickname || '학습자'}님!</h1>
      <p style={{ color:'#8B8BAA', marginBottom:'20px', fontSize:'0.9rem' }}>오늘의 목표를 완성해보세요</p>

      {/* 스트릭 배너 */}
      {streak >= 2 && (
        <div style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1))', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'16px', padding:'16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ fontSize:'2rem' }}>🔥</div>
          <div>
            <div style={{ fontWeight:900, color:'#F59E0B' }}>{streak}일 연속 학습 중!</div>
            <div style={{ color:'#8B8BAA', fontSize:'0.82rem' }}>
              {streak < 7 ? `7일까지 ${7-streak}일 남았어요!` : streak < 30 ? `30일까지 ${30-streak}일 남았어요! 👑` : '대단해요! 30일 이상! 👑'}
            </div>
          </div>
        </div>
      )}

      {/* 오늘의 목표 */}
      <div style={{ background:'rgba(79,70,229,0.1)', border:'1px solid rgba(79,70,229,0.25)', borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
        <h3 style={{ marginBottom:'14px', fontWeight:800, fontSize:'1rem' }}>📋 오늘의 목표</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
          {[
            { label:'단어', value:`${userData?.wordsDoneToday||0}/30`, pct:Math.min(((userData?.wordsDoneToday||0)/30)*100,100), color:'#4F46E5' },
            { label:'퀴즈', value:`${userData?.quizToday||0}/1회`, pct:Math.min(((userData?.quizToday||0)/1)*100,100), color:'#F59E0B' },
            { label:'오늘 XP', value:`${userData?.xpToday||0}XP`, pct:Math.min(((userData?.xpToday||0)/100)*100,100), color:'#10B981' },
          ].map(g => (
            <div key={g.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'12px' }}>
              <div style={{ fontSize:'0.72rem', color:'#8B8BAA', marginBottom:'6px' }}>{g.label}</div>
              <div style={{ fontWeight:900, fontSize:'1.1rem', marginBottom:'6px' }}>{g.value}</div>
              <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
                <div style={{ height:'100%', width:`${g.pct}%`, background:g.color, borderRadius:'4px' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 스탯 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px', marginBottom:'16px' }}>
        {[
          { icon:'🔥', val:streak, label:'연속 학습일', color:'#F59E0B' },
          { icon:'⭐', val:xp, label:'총 XP', color:'#6366F1' },
          { icon:'📊', val:`Lv.${level}`, label:'현재 레벨', color:'#10B981' },
          { icon:'🏅', val:(userData?.badges||[]).length, label:'획득 뱃지', color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'16px' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'6px' }}>{s.icon}</div>
            <div style={{ fontWeight:900, fontSize:'1.6rem', color:s.color }}>{s.val}</div>
            <div style={{ color:'#8B8BAA', fontSize:'0.78rem', marginTop:'2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 빠른 시작 */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {[
          { label:'📚 단어 학습 시작', path:'/learn', bg:'#4F46E5' },
          { label:'🎮 퀴즈 도전', path:'/quiz', bg:'#F59E0B' },
          { label:'💬 AI 회화 연습', path:'/conversation', bg:'#10B981' },
        ].map(b => (
          <button key={b.path} onClick={() => router.push(b.path)}
            style={{ padding:'14px', background:b.bg, color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:600, fontSize:'1rem', width:'100%' }}>
            {b.label}
          </button>
        ))}
      </div>
    </Layout>
  );
}