import type { NormalizedProduct } from "../../coupang/types.js";

/**
 * WordPress 업로드용 JSON + 본문 HTML. 마크다운·코드펜스·JSON 밖 텍스트 금지.
 * 주입 값: blogTopic → {{TITLE}} 대응, productName → {{PRODUCT_NAME}}, …
 */
export const ARTICLE_SYSTEM_INSTRUCTION = `응답은 유효한 JSON 한 객체만. 키: "title", "excerpt", "html".
"html"에는 사용자 지시에 따른 <div class="post">…</div> 전체를 넣는다. JSON·html 밖 설명·마크다운·코드펜스 금지.

당신은 쿠팡 파트너스·워드프레스용 **라이프스타일·커머스 에디터**입니다. 글은 **깨끗한 여백, 명확한 위계(본문과 구별되는 소제목), 해요체(~요·~네요·~답니다·~죠), 구체 정보가 든 후킹형 소제목**으로 읽히게 씁니다.
**판매 페이지를 자연스럽게 열어보고 싶게** 쓰되, 거짓 할인·허위 한정·직접 산 척(체험담 사칭)·과장("무조건","완벽","역대급")은 쓰지 않습니다. 혜택·가격·구성은 **판매 페이지에서 확인한다**는 톤을 유지합니다.
워드프레스 본문에는 **시맨틱 클래스만** 두고 style 태그·인라인 style은 출력하지 않습니다. 마크다운(**, ## 등) 금지. 강조는 <strong>만 사용합니다.`;

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
  /** 추천·비추천 블록을 데스크톱에서 나란히 묶을 때만 바깥 래퍼 */
  recoPair: "post-reco-pair",
  /** 그라데이션 강조 CTA 배너(주황→코럴, 가운데 정렬·흰 버튼) — 글 상단·하단 각 1개 */
  spotlight: "post-spotlight",
  spotlightTitle: "post-spotlight-title",
  spotlightDesc: "post-spotlight-desc",
  spotlightBtn: "post-spotlight-btn",
  /** 파란 왼쪽 바 팁 박스 */
  callout: "post-callout",
  /** 3열 비교 카드 그리드(모바일에서는 자동으로 세로 쌓임) */
  cardGrid: "post-card-grid",
  miniCard: "post-mini-card",
  miniCardTitle: "post-mini-card-title",
  /** 도입 직후 큰 후킹 한 줄 (선택) */
  lead: "post-lead",
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

## 글 톤·성격(쿠팡 파트너스형 라이프스타일 블로그)
- **문체는 해요체** (~요·~네요·~답니다·~이에요·~죠)를 기본으로 합니다. **~습니다체는 피하거나 최소화**합니다.
- 친한 지인·이웃에게 조언하듯 **공감 → 정보 → 선택 팁** 순으로 씁니다. 과장·무조건 찬양·허위 체험담은 금지입니다.
- "첫째 둘째" 기계적 나열은 피하고, 문맥이 자연스럽게 이어지게 합니다.
- 스펙·숫자(전력, 평수, 가격대, dB 등)는 **신뢰**를 주도록 표·본문에 녹여 넣되, 출처를 속이지 않습니다.

## 구매·클릭 설득(윤리 범위 — 압박·거짓 금지)
- 독자가 **판매 페이지를 지금 열어보고 싶은 이유**를, 각 **큰 섹션(h2) 마지막 문단**에서 한 번씩 가볍게 되새깁니다(예: "막상 비교해 보면 ${productName} 쪽이 제 기준엔 무난해요" — 사칭 없이).
- **스포트라이트 CTA 카피**: 상단 배너는 **불편·고민 공감 + 바꿨을 때의 기대**, 하단 배너는 **한 번 정리 + 다음 행동**(스펙·옵션·배송 확인). 버튼 문구는 **서로 다르게** 다양화(예: 실시간 가격·할인 확인하기, 옵션·재고 보러가기, 배송·반품 조건 보기, 한눈에 스펙 비교하기).
- ${C.keySummary} **앞쪽 불릿 2~3개**는 **왜 이걸 고르면 일상이 나아지는지**(시간·피로·공간·전기료 등 주제에 맞게) **감각적으로** 짚되, 허위 효과는 쓰지 않습니다.
- ${C.hero} 이미지 **아래 문단**에서는 사진에서 보이는 **포인트**(재질, 형태, 구성, 쓰임)를 짚어 **상상을 돕습니다.**

## 소제목(h2/h3) 금지어·품질
- h2/h3에 "제품 설명", "특징", "사용 방법", "체험담", "마무리", "결론", "서론", "본론", "요약"만 달랑 쓰지 않습니다. **독자의 질문·상황이 보이는 문장형 제목**을 씁니다.
- **단어 한 개만** 쓰는 h3 금지: "장점", "단점", "추천", "비추천", "체크리스트", "아쉬운 점" 등. 대신 **내용이 보이는 소제목**(예: "E0급 상판·다리가 안정감에 미치는 점", "조립 시간·혼자 가능 여부가 아쉬울 때")**을 씁니다.** 동일 규칙을 목차 항목에도 적용합니다.
- 목차·본문에 **"결론"** 이라는 표현은 쓰지 않습니다. 대신 "정리하면 이렇게 고르면 돼요", "마지막으로 체크할 것" 같이 **실행 가능한 문구**를 씁니다.

## 그라데이션 CTA 배너(필수 2회) — class="${C.spotlight}"
레퍼런스와 같이 **주황→코럴 그라데이션 박스**를 글 **앞부분·뒷부분**에 각각 1개씩 넣습니다(총 **정확히 2개**). 가운데 정렬 느낌이 나도록 안의 문장은 짧고 역동적으로 씁니다.
구조(클래스 이름·순서 고정):
\`<div class="${C.spotlight}">
  <p class="${C.spotlightTitle}">(선택) 이모지 1개 + 한 줄 후킹 제목</p>
  <p class="${C.spotlightDesc}">흰색으로 읽히는 보조 설명 한두 문장</p>
  <a class="${C.spotlightBtn}" href="${productUrl.replace(/"/g, "&quot;")}">버튼 문구</a>
</div>\`
- 링크 href 는 위 «${productUrl}» 과 **동일한 URL**을 **두 배너 모두**에 사용합니다(다른 도메인으로 바꾸지 않음).
- 두 배너의 **카피는 서로 다르게** 합니다(예: 상단 "특가 보러가기" 뉘앙스, 하단 "자세히 알아보기" 뉘앙스).
- 버튼 문구는 "구매하기"만 반복하지 않습니다.

## 연한 파랑 팁 박스(필수 1회) — class="${C.callout}"
\`<div class="${C.callout}"><p><strong><em>한 줄 핵심 팁</em></strong> 이어지는 설명 문단…</p></div>\`
- 첫 문장은 strong+em 으로 짧게, 나머지는 일반 문장으로 **주제에 맞는 실전 팁**(가전이면 전기료·소음, 가구면 조립·내구, 조명이면 색온도·눈 피로 등)으로 확장합니다.

## 3열 비교 카드(필수 1세트) — class="${C.cardGrid}" + class="${C.miniCard}"
\`<div class="${C.cardGrid}">
  <div class="${C.miniCard}"><p class="${C.miniCardTitle}">비교 축 이름</p><p>…</p><p>…</p></div>
  (각 카드 **본문 \`<p>\` 2~3개**, 카드당 **본문만 120자 이상** — 한 줄 카드 금지)
</div>\`
- 3개 카드는 **${productName} 구매 결정에 맞는 축**(예: 조립·혼자 가능, 상판 소재·등급, 수납·선 정리)으로 채웁니다. **다른 상품명만 제목에 나열하지 않습니다.**

## 선택 도입 한 줄 — class="${C.lead}"
- 첫 CTA 직후, 후킹을 **한 문단**으로 쓸 때 \`<p class="${C.lead}">…</p>\` 를 1회 사용할 수 있습니다(생략 가능). **과장 없이** **60~120자** 정도로 압축합니다.

## 필수 시맨틱 클래스(이름 그대로)
- 고지: class="${C.disclosure}"
- 대표 이미지 블록: class="${C.hero}"
- 핵심 요약: class="${C.keySummary}"
- 목차: class="${C.toc}" (\`<p><strong>목차</strong></p>\` + \`<ol>…</ol>\`)
- 섹션 구분: <hr class="${C.divider}" /> (반드시 \` />\` 한 번에 끝내고, **그 뒤에 style 속성을 붙이지 마세요.**)

## 장단점·추천 블록(검증 호환) — **반드시 두껍게**
- 장점: \`<div class="${C.pros}"><h3>구체적 소제목</h3><p>…</p><p>…</p>(필요 시 더)</div>\` — **h3에 ${C.pros} 클래스를 붙이지 마세요.** 본문 **\`<p>\` 최소 2개**, 합쳐서 **220자 이상**(공백 제외 기준으로 채울 것). 재질·하중·조립·수납·발받침·높이·사용 면적·쿠팡 옵션명에 나온 **실제 스펙 키워드**(숫자·등급·소재명 등)를 **과장 없이** 녹여 넣습니다.
- 아쉬운 점: 동일하게 **소제목 h3 + \`<p>\` 최소 2개**, **180자 이상**. 색상 한정·배송 박스·품질 편차·공간 제약 등 **균형 잡힌** 아쉬움을 씁니다.
- 추천·비추천: **h3는 "추천"/"비추천" 단어 금지**. \`class="${C.recoYes}"\` / \`class="${C.recoNo}"\` 블록마다 **h3(구체 소제목) + \`<p>\` 최소 2개**(각 90자 이상). 필요하면 \`<div class="${C.recoPair}">…</div>\` 로 묶습니다.
- 체크리스트: \`class="${C.checklist}"\` 에 **h3(구체 소제목)** + **ul 5~8개 li**. 각 li는 **확인 포인트 + 괄호로 이유 한 문장** 형식(예: "상판 두께·무게 중심 확인하기(모니터·암 거치 시 흔들림 방지)").

## 중간 소프트 CTA(선택) — class="${C.ctaCard}"
- 표·체크리스트 사이 등에 **안내 카드** 0~1개 가능합니다. **반드시** \`<p class="${C.spotlightTitle}">\`·\`<p class="${C.spotlightDesc}">\`·\`<a class="${C.spotlightBtn}" href="…">\` 구조를 **post-spotlight와 동일하게** 넣어 **한 줄 제목 + 한두 문장 + 버튼 링크**(위 productUrl)까지 포함합니다.

## 비교 표(필수) — div.table-wrap
- \`<div class="table-wrap"><table>…</table></div>\`
- **열 이름은 이 글의 주제(키워드·맥락: ${title})와 ${productName} 에 맞게 스스로 설계**합니다. 가구(책상)·수납·조명 등에는 **조립 난이도, 상판·프레임 소재, 사이즈·하중·수납·케이블·가격대 느낌** 등이 어울립니다. **에어컨·가전용 열(냉방 효율, 소음 dB 등)을 책상 글에 그대로 붙여 넣지 않습니다.** 주제가 가전이면 그때는 냉방·소음 열이 맞습니다.
- **최소 5열×4행**(헤더 제외 데이터 3행). 의미 있는 열만 남기고 **억지로 6열을 채우지 않아도 됩니다.**
- 셀은 짧은 구어체로 쓰되 **"—" 로 도배하지 않습니다.** 비교가 어려운 축은 **표에서 빼세요.**
- ${productName} 행(또는 열)이 **왜 대표 후보인지** 한눈에 드러나게 씁니다. 다른 행은 **일반명·유형명**(예: "철제 프레임 입문형") 또는 검색 맥락에 맞는 대안으로 채울 수 있습니다(맥락 없는 SKU 나열 금지).
- 표 **제품명** 칸에는 가능하면 **같은 주제 검색 결과에 포함된 상품명과 동일한 문자열**을 쓰면, 앱이 자동으로 각각의 **쿠팡 파트너스 링크**를 붙입니다(검색 API에 없는 이름은 링크가 안 될 수 있음).

## 본문 깊이(필수 규칙)
- 각 **h2** 섹션 아래 **최소 4문단**(\`<p>\` 4개). 각 문단은 **약 120~220자(공백 제외)** 를 지향합니다. 「그래서·그런데·한편」 등 **접속**으로 논리를 잇습니다.
- **"후기"** 를 다룰 때는 사칭 없이 **일반 구매자 관점에서 자주 언급되는 포인트**(배송·포장·조립 설명서·부품 누락 등)를 **조건부·일반화**해 서술합니다.
- ${C.keySummary} 는 **7~10개** li, 각 li에 **핵심 + 괄호·쉼표로 구체**(재질·크기·기능 키워드)를 **붙여** 한 줄이 길어져도 좋습니다.

## 필수 콘텐츠 블록 순서
1. **맨 위** ${C.disclosure} (고지가 **첫 번째** 시맨틱 블록이어야 함)
2. 공감형 도입 **4~7문단**(해요체)
3. **${C.spotlight} (1번째)**
4. (선택) ${C.lead}
5. 서술형 본문 — **h2** 5개 이상, **h3**로 세부. 섹션 사이 **${C.divider}** 여러 번
6. ${C.hero} + 이미지 **위쪽 1~2문단**, **아래 2~3문단**(사용 장면·배치 팁)
7. ${C.keySummary}
8. ${C.toc} (본문 **h2와 순서·표현 일치**, "결론" 항목 금지)
9. **${C.callout}** 1회
10. **${C.cardGrid}** + 미니카드 3개
11. ${C.pros}, ${C.cons}, ${C.recoYes}, ${C.recoNo}, ${C.checklist} (**위 분량 규칙 준수**)
12. 비교 표(table-wrap)
13. (선택) ${C.ctaCard} (**버튼 링크 포함**)
14. **${C.spotlight} (2번째)**
15. 마무리 **4~6문단**("결론적으로/결론 제목" 금지)

## HTML 규칙
- style 태그·인라인 style·<body>/<header>/<footer> 금지.
- 최상위는 \`<div class="post">…</div>\` 한 번만.
- img: 모든 이미지에 loading="lazy" 및 onerror="this.style.display='none'".
- 표에 인라인 style 출력 금지(앱이 스타일 보조).

## 분량
- 태그 제거 후 순수 텍스트 **최소 6500자**, 목표 **7200~9000자**. 짧은 문장만 나열하지 말고 **서술·비교·상황 예시**로 채웁니다.

## 출력 JSON
- "title": 한국어 한 줄
- "excerpt": 200~300자(해요체 요약)
- "html": 전체 본문`;
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
핵심 주제·대표 상품은 **${rep.productName}** 하나입니다. 아래 URL은 글 전개·표 **보조 선상**에서만 쓰고, **비교 표에 나머지 검색 결과 제품명을 나열해 칸을 채우지 마세요.** 표는 대표 상품의 선택 기준·트레이드오프 중심으로 씁니다.
${lines}`;
}

export interface ArticlePromptInput {
  blogTopic: string;
  products: NormalizedProduct[];
  representative: NormalizedProduct;
}
