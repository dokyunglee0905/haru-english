'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import { BADGES } from '../lib/gamification';

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/auth'); return; }
      setUser(u);
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) setUserData(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    router.push('/auth');
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', alignItems:'center', justifyContent:'center', color:'#F1F0FF' }}>
      로딩 중... ⏳
    </div>
  );

  const xp = userData?.totalXP || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp - (level - 1) * 100;
  const earnedBadges: string[] = userData?.badges || [];

  const stats = [
    { icon:'📝', label:'총 학습 단어', value:`${userData?.wordsStudied||0}개`, color:'#6366F1' },
    { icon:'🎮', label:'퀴즈 횟수',    value:`${userData?.quizCount||0}회`,    color:'#F59E0B' },
    { icon:'🔥', label:'연속 학습일',  value:`${userData?.streak||0}일`,       color:'#EF4444' },
    { icon:'⭐', label:'총 XP',        value:`${xp} XP`,                       color:'#10B981' },
  ];

  return (
    <Layout>
      <h1 style={{ fontSize:'1.5rem', fontWeight:900, marginBottom:'4px' }}>👤 마이페이지</h1>
      <p style={{ color:'#8B8BAA', marginBottom:'20px', fontSize:'0.88rem' }}>나의 학습 현황을 확인해요</p>

      {/* 프로필 카드 */}
      <div style={{ background:'linear-gradient(135deg,rgba(79,70,229,0.2),rgba(99,102,241,0.1))', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', padding:'20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'16px' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'linear-gradient(135deg,#4F46E5,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem', flexShrink:0, overflow:'hidden' }}>
          {user?.photoURL ? <img src={user.photoURL} style={{ width:'64px', height:'64px', borderRadius:'50%' }} /> : '👤'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:'1.2rem', marginBottom:'3px' }}>{userData?.nickname||'학습자'}</div>
          <div style={{ color:'#8B8BAA', fontSize:'0.78rem', marginBottom:'10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ background:'rgba(79,70,229,0.2)', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', padding:'3px 12px', fontSize:'0.78rem', color:'#6366F1', fontWeight:700, flexShrink:0 }}>
              Lv.{level}
            </span>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.68rem', color:'#8B8BAA', marginBottom:'3px' }}>
                <span>다음 레벨</span><span>{xpInLevel}/100</span>
              </div>
              <div style={{ height:'5px', background:'rgba(255,255,255,0.1)', borderRadius:'4px' }}>
                <div style={{ height:'100%', width:`${xpInLevel}%`, background:'linear-gradient(90deg,#4F46E5,#6366F1)', borderRadius:'4px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>📊 학습 통계</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px', marginBottom:'20px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'16px' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'6px' }}>{s.icon}</div>
            <div style={{ fontWeight:900, fontSize:'1.6rem', color:s.color, marginBottom:'2px' }}>{s.value}</div>
            <div style={{ color:'#8B8BAA', fontSize:'0.75rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 뱃지 컬렉션 */}
      <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>
        🏅 뱃지 ({earnedBadges.length}/{BADGES.length})
      </div>
      <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'16px', marginBottom:'20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:'8px' }}>
          {BADGES.map(badge => {
            const earned = earnedBadges.includes(badge.id);
            return (
              <div key={badge.id} style={{ background:earned?'rgba(79,70,229,0.15)':'rgba(255,255,255,0.03)', border:`1px solid ${earned?'rgba(79,70,229,0.3)':'rgba(255,255,255,0.06)'}`, borderRadius:'10px', padding:'10px 6px', textAlign:'center', opacity:earned?1:0.4 }}>
                <div style={{ fontSize:'1.6rem', marginBottom:'4px', filter:earned?'none':'grayscale(100%)' }}>{badge.icon}</div>
                <div style={{ fontWeight:700, fontSize:'0.7rem', marginBottom:'2px', color:earned?'#F1F0FF':'#8B8BAA' }}>{badge.name}</div>
                <div style={{ fontSize:'0.62rem', color:'#8B8BAA', lineHeight:1.3 }}>{badge.desc}</div>
                {earned && <div style={{ marginTop:'4px', fontSize:'0.62rem', color:'#6366F1', fontWeight:700 }}>✓ 획득!</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#8B8BAA', marginBottom:'5px' }}>
            <span>달성률</span><span>{Math.round((earnedBadges.length/BADGES.length)*100)}%</span>
          </div>
          <div style={{ height:'5px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
            <div style={{ height:'100%', width:`${(earnedBadges.length/BADGES.length)*100}%`, background:'linear-gradient(90deg,#4F46E5,#F59E0B)', borderRadius:'4px' }}></div>
          </div>
        </div>
      </div>

      {/* 빠른 이동 */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
        {[
          { label:'📚 학습 하러가기', path:'/learn',        bg:'#4F46E5' },
          { label:'🎮 퀴즈 도전',    path:'/quiz',         bg:'#F59E0B' },
          { label:'💬 회화 연습',    path:'/conversation', bg:'#10B981' },
        ].map(b => (
          <button key={b.path} onClick={()=>router.push(b.path)}
            style={{ padding:'13px', background:b.bg, color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:600, fontSize:'0.9rem' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* 로그아웃 */}
      <button onClick={handleLogout}
        style={{ width:'100%', padding:'13px', background:'transparent', border:'1px solid rgba(239,68,68,0.3)', color:'#EF4444', borderRadius:'12px', cursor:'pointer', fontWeight:600 }}>
        🚪 로그아웃
      </button>
    </Layout>
  );
}