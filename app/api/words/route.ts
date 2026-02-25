import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { level, wordsStudied, wrongWords } = await request.json();

    const levelLabel = level === 'beginner' ? '초급 (아주 쉬운 일상 단어)' 
      : level === 'intermediate' ? '중급 (일상 + 비즈니스 단어)'
      : '고급 (고급 어휘, 관용구)';

    const prompt = `당신은 한국인 영어 학습자를 위한 단어 추천 AI예요.

사용자 정보:
- 레벨: ${levelLabel}
- 지금까지 학습한 단어 수: ${wordsStudied}개
- 틀렸던 단어들: ${wrongWords?.join(', ') || '없음'}

위 정보를 바탕으로 오늘 학습할 단어 30개를 추천해주세요.

규칙:
1. 레벨에 맞는 난이도
2. 틀렸던 단어가 있으면 그 단어도 포함
3. 실생활에서 자주 쓰는 단어 위주
4. 다양한 카테고리 (음식, 감정, 행동, 장소 등) 골고루

반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 없이 JSON만:
[
  {
    "en": "apple",
    "ko": "사과",
    "pronun": "애플",
    "exEn": "I eat an apple every day.",
    "exKo": "나는 매일 사과를 먹어요."
  }
]`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('AI 응답 오류');
    }

    // JSON 파싱
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON 파싱 오류');
    
    const words = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ words });

  } catch (error) {
    console.error('단어 추천 오류:', error);
    return NextResponse.json({ error: '단어 추천 실패' }, { status: 500 });
  }
}