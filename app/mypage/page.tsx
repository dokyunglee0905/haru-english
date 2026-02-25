'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
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
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', alignItems:'center', justifyContent:'center', color:'#F1F0FF', fontSize:'1.2rem' }}>
      로딩 중... ⏳
    </div>
  );

  const xp = userData?.totalXP || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp - (level - 1) * 100;
  const wordsStudied = userData?.wordsStudied || 0;
  const quizCount = userData?.quizCount || 0;
  const streak = userData?.streak || 0;
  const createdAt = userData?.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '알 수 없음';
  const earnedBadges: string[] = userData?.badges || [];

  const stats = [
    { icon:'📝', label:'총 학습 단어', value:`${wordsStudied}개`, color:'#6366F1' },
    { icon:'🎮', label:'퀴즈 횟수',    value:`${quizCount}회`,   color:'#F59E0B' },
    { icon:'🔥', label:'연속 학습일',  value:`${streak}일`,      color:'#EF4444' },
    { icon:'⭐', label:'총 XP',        value:`${xp} XP`,         color:'#10B981' },
  ];

  const sidebarItems = [
    { label:'🏠 대시보드', path:'/dashboard' },
    { label:'📚 학습',     path:'/learn' },
    { label:'🎮 퀴즈',     path:'/quiz' },
    { label:'💬 회화',     path:'/conversation' },
    { label:'👤 마이페이지', path:'/mypage' },
    { label:'⚙️ 설정',    path:'/settings' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#F1F0FF', fontFamily:'sans-serif', display:'flex' }}>
      {/* 사이드바 */}
      <div style={{ width:'220px', background:'#1A1A2E', borderRight:'1px solid rgba(255,255,255,0.08)', padding:'24px 16px', position:'fixed', top:0, left:0, height:'100vh', display:'flex', flexDirection:'column' }}>
        <div style={{ fontWeight:900, fontSize:'1.4rem', color:'#6366F1', marginBottom:'36px' }}>Haru<span style={{color:'#F59E0B'}}>EN</span></div>
        {sidebarItems.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', borderRadius:'12px', border:'none', background: item.path==='/mypage' ? 'rgba(79,70,229,0.2)' : 'transparent', color: item.path==='/mypage' ? '#6366F1' : '#8B8BAA', cursor:'pointer', fontSize:'0.9rem', fontWeight:500, marginBottom:'4px', width:'100%', textAlign:'left' }}>
            {item.label}
          </button>
        ))}
      </div>

      {/* 메인 */}
      <div style={{ marginLeft:'220px', padding:'32px', flex:1, maxWidth:'800px' }}>
        <h1 style={{ fontSize:'1.8rem', fontWeight:900, marginBottom:'4px' }}>👤 마이페이지</h1>
        <p style={{ color:'#8B8BAA', marginBottom:'28px' }}>나의 학습 현황을 확인해요</p>

        {/* 프로필 카드 */}
        <div style={{ background:'linear-gradient(135deg,rgba(79,70,229,0.2),rgba(99,102,241,0.1))', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', padding:'28px', marginBottom:'24px', display:'flex', alignItems:'center', gap:'24px', flexWrap:'wrap' }}>
          <div style={{ width:'80px', height:'80px', borderRadius:'50%', background:'linear-gradient(135deg,#4F46E5,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', flexShrink:0, overflow:'hidden' }}>
            {user?.photoURL
              ? <img src={user.photoURL} style={{ width:'80px', height:'80px', borderRadius:'50%' }} />
              : '👤'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, fontSize:'1.4rem', marginBottom:'4px' }}>{userData?.nickname || '학습자'}</div>
            <div style={{ color:'#8B8BAA', fontSize:'0.85rem', marginBottom:'12px' }}>{user?.email} · 가입일 {createdAt}</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
              <span style={{ background:'rgba(79,70,229,0.2)', border:'1px solid rgba(79,70,229,0.3)', borderRadius:'20px', padding:'4px 14px', fontSize:'0.82rem', color:'#6366F1', fontWeight:700 }}>
                Lv.{level}
              </span>
              <div style={{ flex:1, minWidth:'120px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'#8B8BAA', marginBottom:'4px' }}>
                  <span>다음 레벨까지</span><span>{xpInLevel}/100 XP</span>
                </div>
                <div style={{ height:'6px', background:'rgba(255,255,255,0.1)', borderRadius:'4px' }}>
                  <div style={{ height:'100%', width:`${xpInLevel}%`, background:'linear-gradient(90deg,#4F46E5,#6366F1)', borderRadius:'4px' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div style={{ marginBottom:'8px', fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px' }}>📊 학습 통계</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'16px', marginBottom:'24px' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'22px' }}>
              <div style={{ fontSize:'1.8rem', marginBottom:'8px' }}>{s.icon}</div>
              <div style={{ fontWeight:900, fontSize:'2rem', color:s.color, marginBottom:'2px' }}>{s.value}</div>
              <div style={{ color:'#8B8BAA', fontSize:'0.82rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 뱃지 컬렉션 */}
        <div style={{ marginBottom:'8px', fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px' }}>
          🏅 뱃지 컬렉션 ({earnedBadges.length}/{BADGES.length})
        </div>
        <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'22px', marginBottom:'24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'12px' }}>
            {BADGES.map(badge => {
              const earned = earnedBadges.includes(badge.id);
              return (
                <div key={badge.id}
                  style={{ background: earned ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.03)', border:`1px solid ${earned ? 'rgba(79,70,229,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius:'12px', padding:'14px', textAlign:'center', transition:'all 0.2s', opacity: earned ? 1 : 0.4 }}>
                  <div style={{ fontSize:'2rem', marginBottom:'6px', filter: earned ? 'none' : 'grayscale(100%)' }}>
                    {badge.icon}
                  </div>
                  <div style={{ fontWeight:700, fontSize:'0.78rem', marginBottom:'3px', color: earned ? '#F1F0FF' : '#8B8BAA' }}>
                    {badge.name}
                  </div>
                  <div style={{ fontSize:'0.7rem', color:'#8B8BAA', lineHeight:1.4 }}>
                    {badge.desc}
                  </div>
                  {earned && (
                    <div style={{ marginTop:'6px', fontSize:'0.68rem', color:'#6366F1', fontWeight:700 }}>✓ 획득!</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 진행률 */}
          <div style={{ marginTop:'20px', paddingTop:'16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:'#8B8BAA', marginBottom:'6px' }}>
              <span>뱃지 달성률</span>
              <span>{Math.round((earnedBadges.length/BADGES.length)*100)}%</span>
            </div>
            <div style={{ height:'6px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
              <div style={{ height:'100%', width:`${(earnedBadges.length/BADGES.length)*100}%`, background:'linear-gradient(90deg,#4F46E5,#F59E0B)', borderRadius:'4px', transition:'width 0.5s' }}></div>
            </div>
          </div>
        </div>

        {/* 오늘의 학습 현황 */}
        <div style={{ marginBottom:'8px', fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px' }}>📅 오늘의 현황</div>
        <div style={{ background:'#1E1E35', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'22px', marginBottom:'24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
            {[
              { label:'오늘 학습 단어', value:`${userData?.wordsDoneToday || 0} / 30`, pct:Math.min(((userData?.wordsDoneToday||0)/30)*100,100), color:'#6366F1' },
              { label:'오늘 퀴즈',      value:`${userData?.quizToday || 0} / 1`,       pct:Math.min(((userData?.quizToday||0)/1)*100,100),  color:'#F59E0B' },
              { label:'오늘 획득 XP',  value:`${userData?.xpToday || 0} XP`,          pct:Math.min(((userData?.xpToday||0)/100)*100,100),  color:'#10B981' },
            ].map(g => (
              <div key={g.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'0.75rem', color:'#8B8BAA', marginBottom:'6px' }}>{g.label}</div>
                <div style={{ fontWeight:900, fontSize:'1.2rem', marginBottom:'8px' }}>{g.value}</div>
                <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'4px' }}>
                  <div style={{ height:'100%', width:`${g.pct}%`, background:g.color, borderRadius:'4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 빠른 이동 */}
        <div style={{ marginBottom:'8px', fontSize:'0.75rem', fontWeight:700, color:'#8B8BAA', textTransform:'uppercase', letterSpacing:'1px' }}>🚀 빠른 이동</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'28px' }}>
          {[
            { label:'📚 학습 하러가기', path:'/learn',        bg:'#4F46E5' },
            { label:'🎮 퀴즈 도전',    path:'/quiz',         bg:'#F59E0B' },
            { label:'💬 회화 연습',    path:'/conversation', bg:'#10B981' },
          ].map(b => (
            <button key={b.path} onClick={() => router.push(b.path)}
              style={{ padding:'14px', background:b.bg, color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:600, fontSize:'0.88rem' }}>
              {b.label}
            </button>
          ))}
        </div>

        {/* 로그아웃 */}
        <button onClick={handleLogout}
          style={{ width:'100%', padding:'14px', background:'transparent', border:'1px solid rgba(239,68,68,0.3)', color:'#EF4444', borderRadius:'12px', cursor:'pointer', fontWeight:600, fontSize:'0.95rem' }}>
          🚪 로그아웃
        </button>
      </div>
    </div>
  );
}