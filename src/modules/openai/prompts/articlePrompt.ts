import type { NormalizedProduct } from "../../coupang/types.js";

/**
 * WordPress 업로드용 JSON + 본문 HTML. 마크다운·코드펜스·JSON 밖 텍스트 금지.
 * 주입 값: blogTopic → {{TITLE}} 대응, productName → {{PRODUCT_NAME}}, …
 */
export const ARTICLE_SYSTEM_INSTRUCTION = `응답은 유효한 JSON 한 객체만. 키: "title", "excerpt", "html".
"html"에는 사용자 지시에 따른 <div class="post">…</div> 전체를 넣는다. JSON·html 밖 설명·마크다운·코드펜스 금지.

이 글은 단순 상품 소개문이 아니라, 워드프레스에서 바로 봤을 때 완성도 높은 분석형 리뷰 HTML이어야 합니다.
제품 정보를 항목별로 짧게 나열하는 데 그치지 말고, 독자의 상황을 짚은 뒤 제품이 주목받는 이유, 실제 사용 장면에서의 의미, 장점과 한계, 어떤 분께 맞는지, 구매 시 확인할 점까지 차분하게 풀어서 설명해야 합니다.
요약 박스·장단점·비교표·체크리스트·CTA 등 구조는 유지하되, 문장은 최대한 길고 자세하게 작성하여 이해를 돕습니다.
문체는 정중한 존댓말(~습니다·ㅂ니다·해 주십시오 계열)로 통일하고, 과장된 광고 문구·과도한 색감을 연상시키는 표현은 피합니다.
워드프레스 본문에는 시맨틱 클래스가 붙은 HTML만 두고, CSS는 본문에 넣지 않습니다.`;

/** 품질 검사·스타일 일관용 — 본문 래퍼에 이 클래스들을 쓰도록 모델에 지시한다. */
export const POST_SEMANTIC_CLASSES = {
  disclosure: "post-disclosure",
  hero: "post-hero",
  keySummary: "post-key-summary",
  divider: "post-divider",
  pros: "post-pros",
  cons: "post-cons",
  recoYes: "post-reco-yes",
  recoNo: "post-reco-no",
  checklist: "post-checklist",
  ctaCard: "post-cta-card",
  /** 선택: 추천·비추천 두 블록을 데스크톱에서 나란히 묶을 때만 바깥 래퍼로 사용 */
  recoPair: "post-reco-pair",
  /** 본문 목차(소제목 스캔용) */
  toc: "post-toc",
} as const;

function buildReviewStyleUserPrompt(
  title: string,
  productName: string,
  productImage: string,
  productUrl: string,
): string {
  const C = POST_SEMANTIC_CLASSES;
  return `아래 값은 각각 템플릿 변수와 동일한 의미다.
- {{TITLE}}(제목/키워드·맥락): ${title}
- {{PRODUCT_NAME}}(상품명): ${productName}
- {{PRODUCT_IMAGE}}(상품 이미지 URL): ${productImage}
- {{PRODUCT_URL}}(상품 링크): ${productUrl}

## 절대 출력 금지
- JSON·html 외 텍스트, 마크다운, \`\`\`html 같은 코드펜스, 설명 문장.

## 이 글의 성격(차박·캠핑 등 실사용 리뷰)
- 감성만 드러나는 홍보글이 아니라, 실제 구매 판단에 참고가 되도록 근거와 맥락을 길게 설명하는 분석형 리뷰·구매 가이드 톤으로 유지합니다.
- 각 주요 섹션마다 **왜 그렇게 말할 수 있는지** 배경을 덧붙입니다. 한두 문장으로 끝내지 말고, 독자가 따라올 수 있도록 단계를 밟아 설명합니다.
- 스펙·수치는 표나 목록에만 두지 말고, 해당 수치가 실제 사용 환경(인원, 공간, 계절, 설치 조건 등)에서 어떤 의미인지 풀어서 서술합니다.
- 장점과 아쉬운 점을 **비슷한 분량**으로 균형 있게 작성합니다. 한쪽만 길게 쓰지 않습니다.

## 문체(반드시 존댓말·장문 설명)
- **전체를 정중한 존댓말**로 통일합니다. (~요 체·반말·독자를 지칭하는 과도한 구어체는 사용하지 않습니다.)
- 인사말은 넣지 않습니다. ("안녕하세요", "소개해 드리겠습니다" 등 금지)
- 뻔한 맺음말 표현("마무리하겠습니다", "결론적으로", "오늘은 여기까지" 등)은 피합니다.
- "최고", "완벽", "무조건 구매" 등 과장된 광고 표현은 쓰지 않습니다.
- 실제 구매·개인 체험을 사칭하는 표현(예: "제가 직접 구매하여")은 쓰지 않습니다. 대신 일반적으로 상상할 수 있는 사용 장면을 구체적으로 설명합니다.
- 같은 어미·접속사를 연속으로 반복하지 않도록 문장 길이와 리듬을 바꿉니다.
- 서술 시점은 2026년 기준으로 자연스럽게 맞춥니다.

## 소제목(h2/h3) 금지어
- h2/h3 텍스트에 다음과 같은 기계적인 표현을 쓰지 않습니다: "제품 설명", "특징", "장점", "사용 방법", "체험담", "마무리", "결론", "서론", "본론".
- 독자의 상황이나 판단 포인트가 드러나도록 구체적인 제목을 붙입니다.

## 필수 시맨틱 클래스(검증·일관성용 — 아래 이름을 그대로 사용)
- 파트너스 고지 래퍼: class="${C.disclosure}"
- 대표 이미지 섹션 래퍼: class="${C.hero}"
- 핵심 요약 박스: class="${C.keySummary}"
- 목차 블록: class="${C.toc}" (\`<p><strong>목차</strong></p>\` + \`<ol>…</ol>\`)
- 섹션 구분선: <hr class="${C.divider}" /> (본문 중 여러 번 사용 가능)
- 장점 블록: class="${C.pros}"
- 아쉬운 점 블록: class="${C.cons}"
- 추천 대상: class="${C.recoYes}"
- 비추천·아쉬울 사람: class="${C.recoNo}"
- 구매 전 체크포인트: class="${C.checklist}"
- 카드형 CTA(총 2개): 각각 최상위에 class="${C.ctaCard}"

## 필수 콘텐츠·디자인 블록(빠지면 실패)
1. **상단 고지문** ${C.disclosure}: 파트너스 수수료 고지를 짧고 단정하게 적습니다.
2. **공감형 도입** 4~6문단: 검색·구매 맥락, 흔한 고민, 선택 시 유의점을 넉넉히 설명합니다.
3. **대표 이미지** ${C.hero}: URL이 있으면 이미지 위·아래에 설명 문단을 둡니다.
4. **핵심 요약** ${C.keySummary}: 불릿 5~8개, 항목마다 중요성을 한두 문장으로 부연합니다.
5. **목차** ${C.toc}: \`<p><strong>목차</strong></p>\` 와 \`<ol>…</ol>\` 로 이후 본문 **h2 흐름과 같은 순서·취지**의 항목 5~8개를 적습니다.
6. **섹션 구분** ${C.divider}: 본문 중 여러 번 사용합니다.
7. **분석·사용·팁·Q&A**: 아래 «콘텐츠 순서»대로 h2/h3 로 나누고, 각 h2 아래 문단을 충분히 둡니다.
8. **장점** ${C.pros} / **아쉬운 점** ${C.cons}: 각각 h3 제목과 여러 문단으로 균형 있게 씁니다.
9. **추천** ${C.recoYes} / **비추천** ${C.recoNo}: 필요 시 div.${C.recoPair} 로 묶습니다.
10. **비교표**: 반드시 div.table-wrap 안에 \`<table>…</table>\`, **최소 4열×4행**(헤더 행 제외) 이상으로 채웁니다. thead/tbody/th/td 구조를 지킵니다.
11. **체크리스트** ${C.checklist}: 항목마다 확인 이유를 덧붙입니다.
12. **CTA** ${C.ctaCard} ×2: 각각 h3 + 설명 3~5문장 + 링크 버튼.
13. **마지막 정리** 4~6문단, "결론" 표현 금지.

## 콘텐츠 순서(이 흐름을 따릅니다)
1. 상단 고지문 (${C.disclosure})
2. 공감형 도입 4~6문단(배경·고민·선택 시 유의점을 넉넉히)
3. 대표 이미지 (${C.hero})
4. 핵심 요약 박스 (${C.keySummary})
5. 목차 (${C.toc})
6. 왜 이 제품이 주목받는지 분석(h2, 문단 여러 개)
7. 실제 사용 장면·실전 팁(h2)
8. 자주 막히는 지점 Q&A(h2 또는 h3 묶음)
9. 장점 (${C.pros})
10. 아쉬운 점 (${C.cons})
11. 추천 대상 (${C.recoYes}) / 비추천 (${C.recoNo})
12. 비교표(table-wrap)
13. 구매 전 체크포인트 (${C.checklist})
14. **중간** CTA (${C.ctaCard})
15. **하단** CTA (${C.ctaCard})
16. 마지막 정리(여러 문단)

## 글 깊이(유익함)
- 각 본문 **h2** 아래에는 통상 **3문단 이상** 두며, 짧은 문장만 나열하지 않습니다.
- 비교·트레이드오프(공간 대 편의, 가격 대 내구 등)를 **구체 숫자가 없더라도** 서술로 설명합니다.
- 체크리스트·표의 각 줄이 **실제 결정에 어떻게 쓰이는지** 독자 관점에서 풀어 씁니다.

## HTML 규칙 (WordPress 본문 — 클래스만, 스타일 태그 금지)
- **절대 출력 금지**: style 태그(여는·닫는 태그 포함), 인라인 style 태그, 본문 안의 CSS 규칙 문자열(.post { … } 같은 블록). WordPress.com 등에서 적용되지 않거나 글에 그대로 노출될 수 있다.
- 최상위 구조(반드시 유지): 여는 태그 div class=post 한 개로 시작하고, 그 안에 시맨틱 블록만 넣은 뒤 닫는 /div 로 끝낸다. (h2/h3·p·ul·table·a 등)
- 최상위 .post 에는 style 속성, padding, margin, background 를 **붙이지 말 것**(테마·추가 CSS에서 처리).
- 시각적 위계는 **클래스 이름과 HTML 구조**로 표현한다. (실제 색·간격은 사이트 전역 CSS에서 .post 하위 선택자로 맞춘다고 가정.)
- **h2**: 본문의 큰 목차 역할. **h3**: 하위 단락·Q&A·카드 내부 제목. 계층이 드러나도록 번호 없이도 순서를 지킵니다.
- 소제목 옆이나 문장 안에서 강조가 필요하면 **strong** 을 사용합니다(문장 전체를 굵게 하지는 않습니다).
- 박스·카드·표·CTA는 지정한 클래스로 래핑합니다. 과도하게 화려한 광고 문구는 피하고 차분한 안내 톤을 유지합니다.
- 넓은 표는 div.table-wrap 안에 table 을 넣는다.
- 헤더·푸터·사이드바 금지.
- img: loading="lazy" 와 onerror="this.style.display='none'" 를 **모든** img에.
- 표: 표준 table / thead / tbody 구조, 헤더 셀은 th 로만 구조화한다. **모델은 인라인 style을 출력하지 않는다**(앱이 게시 시 가독성 보조를 한다).

## 분량
- 태그·style 제거 후 순수 텍스트 **최소 5200자**, 목표 **5800~7200자**. 정보 밀도를 높이되 문장은 읽기 쉽게 유지합니다.

## 출력 JSON
- "title": 읽을 만한 한국어 한 줄
- "excerpt": 200~300자(본문과 같은 존댓말·요약)
- "html": div.post 로 감싼 전체 HTML 한 덩어리(위 금지 사항 준수)`;
}

export function buildArticleUserPrompt(input: ArticlePromptInput): string {
  const rep = input.representative;
  const base = buildReviewStyleUserPrompt(
    input.blogTopic,
    rep.productName,
    rep.productImage,
    rep.productUrl,
  );
  const others = input.products.filter(
    (p) =>
      p.productUrl !== rep.productUrl || p.productName !== rep.productName,
  );
  if (others.length === 0) {
    return base;
  }
  const lines = others
    .slice(0, 6)
    .map((p) => `- ${p.productName} (${p.productUrl})`)
    .join("\n");
  return `${base}

## 같은 주제·검색 맥락의 다른 상품(참고)
핵심 주제·대표 상품은 **${rep.productName}** 하나. 아래는 비교·맥락용 — 필요한 것만 표/분석에 쓰고 나열만 하지 말 것.
${lines}`;
}

export interface ArticlePromptInput {
  blogTopic: string;
  products: NormalizedProduct[];
  representative: NormalizedProduct;
}
