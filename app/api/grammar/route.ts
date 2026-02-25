import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { level, learnedGrammar, incompleteGrammar } = await request.json();

    const levelLabel = level === 'beginner' ? '초급 (아주 기본적인 문법)'
      : level === 'intermediate' ? '중급 (시제, 조동사 등)'
      : '고급 (가정법, 수동태 등)';

    // 미완료 문법이 있으면 그걸 다시 출제
    if (incompleteGrammar?.length > 0) {
      const prompt = `당신은 한국인 영어 초보자를 위한 문법 선생님이에요.

아래 문법들을 이전에 배웠지만 퀴즈를 완료하지 않았어요. 똑같은 문법을 다시 가르쳐주되, 예문과 퀴즈는 새롭게 만들어주세요:
${incompleteGrammar.map((g: string, i: number) => `${i+1}. ${g}`).join('\n')}

반드시 아래 JSON 형식으로만 답하세요:
[
  {
    "title": "문법 제목 (위 목록과 동일하게)",
    "icon": "📌",
    "desc": "한 줄 설명 (한국어)",
    "detail": "자세한 설명 HTML (bold 태그 사용 가능)",
    "examples": [
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" }
    ],
    "quizzes": [
      {
        "q": "한국어 문장",
        "blank": "영어 빈칸 문장",
        "answer": "정답",
        "opts": ["보기1", "보기2", "보기3", "보기4"]
      }
    ]
  }
]

규칙:
1. 미완료 문법 개수만큼만 출제 (최대 3개)
2. 각 문법마다 예문 5개, 퀴즈 5개
3. opts는 반드시 4개
4. 이전과 다른 새로운 예문과 퀴즈로!`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      const content = message.content[0];
      if (content.type !== 'text') throw new Error('AI 응답 오류');
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('JSON 파싱 오류');
      const grammar = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ grammar, isReview: true });
    }

    // 새로운 문법 생성
    const learnedList = learnedGrammar?.length > 0
      ? `\n\n이미 완료한 문법 (절대 중복 금지):\n${learnedGrammar.map((g: string, i: number) => `${i+1}. ${g}`).join('\n')}`
      : '';

    const prompt = `당신은 한국인 영어 초보자를 위한 문법 선생님이에요.

레벨: ${levelLabel}${learnedList}

위에서 이미 완료한 문법과 절대 겹치지 않는 새로운 문법 3가지를 가르쳐주세요.

반드시 아래 JSON 형식으로만 답하세요:
[
  {
    "title": "문법 제목",
    "icon": "📌",
    "desc": "한 줄 설명 (한국어)",
    "detail": "자세한 설명 HTML (bold 태그 사용 가능)",
    "examples": [
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" },
      { "en": "영어 예문", "ko": "한국어 해석" }
    ],
    "quizzes": [
      {
        "q": "한국어 문장",
        "blank": "영어 빈칸 문장",
        "answer": "정답",
        "opts": ["보기1", "보기2", "보기3", "보기4"]
      }
    ]
  }
]

규칙:
1. 문법 3개
2. 각 문법마다 예문 5개, 퀴즈 5개
3. opts는 반드시 4개
4. 한국어 설명은 쉽고 친절하게
5. 이미 완료한 문법과 절대 겹치지 않게!`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = message.content[0];
    if (content.type !== 'text') throw new Error('AI 응답 오류');
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON 파싱 오류');
    const grammar = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ grammar, isReview: false });

  } catch (error) {
    console.error('문법 생성 오류:', error);
    return NextResponse.json({ error: '문법 생성 실패' }, { status: 500 });
  }
}