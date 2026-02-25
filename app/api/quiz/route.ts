import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { level } = await request.json();

    const levelLabel = level === 'beginner' ? '초급 (쉬운 단어, 기본 문법)'
      : level === 'intermediate' ? '중급 (일상 단어, 시제)'
      : '고급 (고급 어휘, 복잡한 문법)';

    const prompt = `당신은 한국인 영어 학습자를 위한 퀴즈 출제자예요.

레벨: ${levelLabel}

이 레벨에 맞는 영어 퀴즈 10문제를 만들어주세요.

문제 유형을 골고루 섞어주세요:
- 영어 단어 뜻 맞추기 (예: "apple"의 뜻은?)
- 빈칸 채우기 (예: I ___ a student.)
- 올바른 문장 고르기

반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 없이 JSON만:
[
  {
    "question": "apple의 뜻은 무엇인가요?",
    "options": ["사과", "바나나", "오렌지", "포도"],
    "answer": "사과",
    "explanation": "apple은 '사과'라는 뜻이에요."
  }
]

규칙:
1. 반드시 10문제
2. options는 반드시 4개
3. answer는 반드시 options 중 하나
4. explanation은 한국어로 친절하게
5. 문제는 한국어로 작성
6. 레벨에 맞는 난이도 유지`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('AI 응답 오류');

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON 파싱 오류');

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });

  } catch (error) {
    console.error('퀴즈 생성 오류:', error);
    return NextResponse.json({ error: '퀴즈 생성 실패' }, { status: 500 });
  }
}