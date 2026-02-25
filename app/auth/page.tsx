'use client';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();

  async function handleGoogleLogin() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Firestore에 사용자 저장
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          nickname: user.displayName,
          email: user.email,
          totalXP: 0,
          currentLevel: 1,
          streak: 0,
          lastStudyDate: null,
          badges: [],
          createdAt: new Date(),
        });
      }
      router.push('/dashboard');
    } catch (error) {
      console.error('로그인 오류:', error);
      alert('로그인에 실패했어요. 다시 시도해주세요.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F0F1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#1E1E35',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        padding: '48px',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🌟</div>
        <h1 style={{
          fontFamily: 'sans-serif',
          fontSize: '2rem',
          fontWeight: 900,
          color: '#F1F0FF',
          marginBottom: '8px',
        }}>하루영어</h1>
        <p style={{ color: '#8B8BAA', marginBottom: '32px', lineHeight: 1.6 }}>
          찐초보를 위한 무료 영어 학습<br />
          하루 10분으로 시작해요!
        </p>
        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '14px',
            background: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}>
          🔑 구글로 시작하기
        </button>
        <p style={{ color: '#8B8BAA', fontSize: '0.78rem', marginTop: '16px' }}>
          무료 · 광고 없음 · 언제든 탈퇴 가능
        </p>
      </div>
    </div>
  );
}