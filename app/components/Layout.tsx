'use client';
import { useRouter, usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label:'대시보드', icon:'🏠', path:'/dashboard' },
  { label:'학습',     icon:'📚', path:'/learn' },
  { label:'퀴즈',     icon:'🎮', path:'/quiz' },
  { label:'회화',     icon:'💬', path:'/conversation' },
  { label:'마이',     icon:'👤', path:'/mypage' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#F1F0FF', fontFamily:'sans-serif' }}>

      {/* 반응형 CSS */}
      <style>{`
        .sidebar-pc {
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          height: 100vh;
          background: #1A1A2E;
          border-right: 1px solid rgba(255,255,255,0.08);
          padding: 24px 16px;
          z-index: 50;
        }
        .mobile-tabbar {
          display: none;
        }
        .main-content {
          margin-left: 220px;
          padding: 32px;
          min-height: 100vh;
        }

        @media (max-width: 768px) {
          .sidebar-pc {
            display: none !important;
          }
          .mobile-tabbar {
            display: flex !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #1A1A2E;
            border-top: 1px solid rgba(255,255,255,0.08);
            justify-content: space-around;
            padding: 8px 0 20px;
            z-index: 100;
          }
          .main-content {
            margin-left: 0 !important;
            padding: 16px 16px 90px !important;
          }
        }
      `}</style>

      {/* PC 사이드바 */}
      <div className="sidebar-pc">
        <div style={{ fontWeight:900, fontSize:'1.4rem', color:'#6366F1', marginBottom:'36px' }}>
          Haru<span style={{color:'#F59E0B'}}>EN</span>
        </div>
        {NAV_ITEMS.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', borderRadius:'12px', border:'none', background: pathname===item.path ? 'rgba(79,70,229,0.2)' : 'transparent', color: pathname===item.path ? '#6366F1' : '#8B8BAA', cursor:'pointer', fontSize:'0.9rem', fontWeight:500, marginBottom:'4px', width:'100%', textAlign:'left' }}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <div className="main-content">
        {children}
      </div>

      {/* 모바일 하단 탭바 */}
      <div className="mobile-tabbar">
        {NAV_ITEMS.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', color: pathname===item.path ? '#6366F1' : '#8B8BAA', cursor:'pointer', padding:'6px 12px', borderRadius:'10px', minWidth:'56px' }}>
            <span style={{ fontSize:'1.4rem' }}>{item.icon}</span>
            <span style={{ fontSize:'0.65rem', fontWeight: pathname===item.path ? 700 : 400 }}>{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}