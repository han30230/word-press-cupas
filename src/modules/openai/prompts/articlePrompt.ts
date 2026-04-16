import type { NormalizedProduct } from "../../coupang/types.js";

export const ARTICLE_SYSTEM_INSTRUCTION = `당신은 한국어 정보형 블로그 작성자입니다.
- 쿠팡 파트너스 링크가 포함될 수 있음을 전제로, 과장 광고 문구는 피하고 사실·비교 중심으로 작성합니다.
- "직접 써봤다", "체험", "협찬", "리얼 후기" 등 실제 사용을 암시하는 허위 체험 표현은 사용하지 마세요.
- 특정 상품이 무조건 최고라고 단정하지 말고, 선택 기준과 장단점을 균형 있게 제시합니다.
- 출력은 반드시 JSON 한 개만 반환합니다. JSON 외 텍스트, 마크다운 코드펜스 금지.
- 본문 HTML은 WordPress에 그대로 넣을 수 있어야 하며, 최상위는 반드시 <div class="post"> 로 시작합니다.
- <body>, <html> 태그를 사용하지 마세요.
- 모든 <img> 태그에는 onerror="this.style.display='none'" 속성을 포함하세요.
- 표는 <table>과 <thead>/<tbody>, <th>, <td>를 사용해 깔끔하게 작성합니다.
- 링크는 제공된 productUrl을 사용하세요(임의로 URL을 만들지 마세요).`;

export interface ArticlePromptInput {
  blogTopic: string;
  products: NormalizedProduct[];
  representative: NormalizedProduct;
}

function productJson(p: NormalizedProduct): Record<string, unknown> {
  return {
    rank: p.rank,
    productName: p.productName,
    productUrl: p.productUrl,
    productImage: p.productImage,
    price: p.price,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isRocket: p.isRocket,
    isFreeShipping: p.isFreeShipping,
  };
}

export function buildArticleUserPrompt(input: ArticlePromptInput): string {
  const list = input.products.map(productJson);
  const hero = productJson(input.representative);

  return `다음 입력으로 정보형 글을 작성하세요.

[블로그 주제/키워드]
${input.blogTopic}

[대표 상품(비교·서론 기준의 기준점)]
${JSON.stringify(hero, null, 2)}

[상품 목록 3~5개]
${JSON.stringify(list, null, 2)}

[글 구조]
1) 상단 고지문: 쿠팡 파트너스 활동으로 일정 수수료를 받을 수 있음을 짧고 명확히 안내
2) 문제 상황 공감 또는 주제 소개
3) 선택 기준(가격, 배송, 리뷰 수, 로켓 등) — 과장 없이
4) 추천 상품 비교표
5) 상품별 특징/장단점
6) 어떤 사람에게 맞는지
7) 정리
8) 중간과 하단에 CTA 박스(구매 전 확인할 점, 링크 확인)

[출력 스키마]
반드시 아래 JSON 형식만 반환:
{
  "title": "string",
  "excerpt": "string",
  "html": "<div class=\\"post\\">...</div>"
}

요구사항:
- title은 60자 이내로 간결하게
- excerpt는 160자 내외
- html 내부에는 본문 전체가 포함되어야 하며, 고지문/비교표/CTA 포함
- 이미지: 대표 상품(representative)의 productImage URL을 본문 상단(고지문 직후 등)에 최소 1회 <img src="(해당 URL)" alt="상품명" loading="lazy" /> 형태로 넣으세요. 다른 상품을 소개할 때도 가능하면 각 상품의 productImage를 사용하세요. 외부 이미지 URL을 임의로 만들지 마세요.
`;
}
