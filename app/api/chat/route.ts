import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, scenario } = await request.json();

    const systemPrompt = `너는 한국인 영어 초보자를 위한 친절한 영어 선생님이야.
지금 상황: ${scenario}

대화 규칙:
1. 항상 영어로 먼저 말하고, 바로 아래에 한국어 해석을 괄호로 달아줘
2. 사용자가 한국어로 말하면, 그 상황에 맞는 영어 표현을 알려줘
3. 틀린 표현이 있으면 부드럽게 교정해줘
4. 한글 발음도 함께 알려줘 (예: How are you? [하우 아 유])
5. 짧고 쉬운 문장 위주로 대화해줘
6. 초보자도 따라할 수 있게 친절하게!

응답 형식 예시:
"Hello! Welcome to our cafe! ☕ (안녕하세요! 카페에 오신 걸 환영해요!)
[헬로! 웰컴 투 아워 카페]

💡 이렇게 대답해보세요:
'Can I have a coffee, please?' [캔 아이 해브 어 커피 플리즈]
(커피 한 잔 주세요)"`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('AI 응답 오류');

    return NextResponse.json({ message: content.text });

  } catch (error) {
    console.error('회화 오류:', error);
    return NextResponse.json({ error: '응답 생성 실패' }, { status: 500 });
  }
}