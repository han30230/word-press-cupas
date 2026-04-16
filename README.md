# Coupang Partners → OpenAI(GPT) → WordPress 자동 발행

쿠팡 파트너스 상품 검색 결과를 바탕으로 정보형 HTML 글을 생성하고, WordPress REST API로 업로드하는 Node.js(TypeScript) 도구입니다.

## 요구 사항

- Node.js 18+
- 쿠팡 파트너스 Open API 키
- OpenAI API 키(GPT)
- WordPress 사용자명 + 애플리케이션 비밀번호(Application Password)

## 설치

```bash
cd word_press_cupas
npm install
```

## 환경 변수

`.env.example`을 복사해 `.env`를 만든 뒤 값을 채웁니다.

```bash
copy .env.example .env
```

- `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`: 파트너스 콘솔에서 발급
- `COUPANG_SUB_ID`: 문서의 `subId`(채널/추적용)
- `OPENAI_API_KEY`, `OPENAI_MODEL` (JSON 응답 모드 사용, 기본 `gpt-4o-mini`)
- **WordPress:** `WP_BASE_URL`, `WP_USERNAME`, `WP_APPLICATION_PASSWORD` 를 **셋 다** 채우면 글이 REST API로 업로드됩니다. 하나라도 비어 있으면 **쿠팡 + GPT + `output/` HTML**까지만 하고, 발행 이력은 갱신하지 않습니다.
- `WP_POST_STATUS`: `draft`(임시저장) 또는 `publish`(바로 공개)

**WordPress만 연결 확인:** `npm run test:wp` 로 인증을 확인할 수 있습니다.

**WordPress.com (`*.wordpress.com`)** 은 사이트 주소의 `/wp-json` Basic 인증으로 글을 못 올리는 경우가 많습니다. 이 프로젝트는 [WordPress.com OAuth](https://developer.wordpress.com/docs/oauth2/)로 토큰을 받은 뒤 `public-api.wordpress.com` 으로 업로드합니다. [앱 등록](https://developer.wordpress.com/apps/) 후 `WPCOM_CLIENT_ID`, `WPCOM_CLIENT_SECRET` 을 `.env`에 넣고, `WP_USERNAME` / `WP_APPLICATION_PASSWORD` 는 WordPress.com 계정(2FA 시 앱 비밀번호)을 사용합니다.
- `KEYWORDS_FILE`: 키워드 JSON 경로(기본 `./data/keywords.json`)
- `PUBLISHED_STATE_FILE`: 발행 이력(동일 키워드 재발행 방지)
- `MIN_PRODUCTS`, `MAX_PRODUCTS`: 글에 쓸 상품 수(쿠팡 검색 `limit` 최대 10)
- `LOG_FILE`: 로그 파일 경로
- `OUTPUT_DIR`: GPT로 만든 **본문 HTML 파일** 저장 위치(기본 `./output`). 실행 후 `2026-04-16T12-34-56-키워드.html` 형식으로 생깁니다. 브라우저로 열거나 에디터로 열어 확인하면 됩니다.
- `CRON_SCHEDULE`: 상시 스케줄러(`schedule`) 실행 시 cron 표현식(기본 `0 9,15,21 * * *` — 하루 3회). **Windows 작업 스케줄러로만 돌릴 때는** exe에 `--once` 를 주고 여기 값은 무시됩니다.

### 로그·발행 확인

- **텍스트 로그:** `LOG_FILE`(기본 `logs/app.log`)에 실행·성공·실패가 쌓입니다.
- **요약 대시보드:** 매 실행 후 `output/reports/dashboard.html` 이 갱신됩니다. 브라우저로 열면 최근 실행의 성공/실패, 키워드, 제목, WordPress 링크, 로컬 HTML 경로, 본문 미리보기(일부)를 볼 수 있습니다. 원본은 `output/*.html` 파일을 열어보면 됩니다.
- **기계 읽기용:** `output/reports/runs.jsonl` (한 줄에 JSON 하나)

## Windows GUI (Electron · 권장)

**Electron**은 VS Code·Discord 등에서도 쓰는 방식으로, **화면은 웹 기술로 만들고** 결과물은 **일반 Windows `.exe`** 로 묶는 도구입니다. 사용자 입장에서는 **다른 프로그램과 같이 더블클릭해서 쓰는 실행 파일**입니다.

창이 열리고 **지금 발행**, **발행 기록**, **폴더 열기** 등으로 조작합니다. 백그라운드에서 `.env`의 `CRON_SCHEDULE` 대로 자동 실행도 됩니다.

개발 PC에서 빌드:

```bash
npm install
npm run build:electron-app
```

생성물: **`dist-electron/CoupangWPublisher-portable.exe`**

**같은 폴더**에 다음을 둡니다.

- `.env`
- `data/keywords.json` (`data` 폴더 생성 후 넣기)

더블클릭하면 UI가 뜹니다. **창을 닫으면 cron 스케줄도 같이 종료**됩니다.

개발 중 UI만 보려면:

```bash
npm run electron:dev
```

빌드가 코드서명 단계에서 막히면 PowerShell에서 `CSC_IDENTITY_AUTO_DISCOVERY=false` 를 켠 뒤 `npm run build:electron-app` 을 다시 시도하세요.

---

## Windows 콘솔 전용 exe (pkg)

GUI 없이 백그라운드/콘솔만 필요할 때:

```bash
npm run build:exe
```

→ `release/coupang-wp-publisher.exe` (창이 잠깐만 보일 수 있음)

**배포:** exe와 같은 폴더에 `.env`, `data/keywords.json`.

### 방법 A — exe를 켜 두고 cron (`CRON_SCHEDULE`)

1. `CRON_SCHEDULE=0 9,15,21 * * *` (PC **로컬 시간** 기준, 하루 3회 예시)
2. exe 실행 후 **창을 닫지 않기** (또는 시작 프로그램에 등록)

### 방법 B — 작업 스케줄러 + `--once`

- **프로그램:** `coupang-wp-publisher.exe` 또는 `CoupangWPublisher-portable.exe`
- **인수:** `--once` → 창 없이 한 번만 발행하고 종료 (두 exe 모두 지원)

일반 실행(인수 없음)은 **Electron**만 창이 뜨고, **pkg** exe는 콘솔/백그라운드 동작에 가깝습니다.

## 키워드 목록

`data/keywords.example.json`을 참고해 `data/keywords.json`을 만듭니다.

```json
{
  "keywords": ["무선 청소기", "가습기 비교"]
}
```

매 실행마다 `published-state.json`에 없는 키워드를 순서대로 골라 사용합니다. 한 번 발행된 키워드는 기본적으로 다시 쓰이지 않습니다.

**같은 키워드만 반복될 때:** WordPress 업로드가 실패하면 발행 이력이 저장되지 않아, 다음에도 같은 키워드가 선택됩니다. 업로드가 성공하면 그때부터 다음 키워드로 넘어갑니다.

## 실행

### WordPress 업로드까지 하려면

1. 관리자 → 사용자 → 프로필에서 **애플리케이션 비밀번호** 생성
2. `.env`에 `WP_BASE_URL`, `WP_USERNAME`, `WP_APPLICATION_PASSWORD` 입력 (공백 없이 세 줄 모두)
3. (선택) `npm run test:wp` 로 로그인 확인
4. `npm run dev` 로 전체 파이프라인 실행 → 로그에 `WordPress 발행 완료: postId=... url=...` 가 나오면 성공

### 한 번만 실행(수동)

```bash
npm run dev
```

빌드 후:

```bash
npm run build
npm start
```

### 스케줄(크론)

```bash
npm run dev:schedule
```

또는:

```bash
npm run build
npm run schedule
```

## 동작 요약

1. 키워드 저장소에서 미발행 키워드 1개 선택
2. 쿠팡 파트너스 검색 API(HMAC 서명)로 상품 조회 후 상위 N개 정규화
3. OpenAI Chat Completions로 제목·요약·HTML 본문 생성(프롬프트는 `src/modules/openai/prompts/articlePrompt.ts`)
4. WordPress에 글 생성(제목 중복·슬러그 중복 시 자동 보정)
5. 성공 시 발행 이력 저장 및 `post id` / URL 로그 출력

실패 시 로그에 상세를 남기고, 상태 파일은 성공 시에만 갱신되어 다음 실행에 영향을 최소화합니다.

## 프로젝트 구조

- `src/config/env.ts` — 환경 변수
- `src/modules/coupang/` — HMAC, 검색, 상품 정규화
- `src/modules/openai/` — 프롬프트 분리, GPT 글 생성
- `src/modules/wordpress/` — REST 클라이언트, 업로드·중복 처리
- `src/modules/keywords/` — 키워드·발행 이력 JSON
- `src/jobs/publishJob.ts` — 메인 파이프라인
- `src/index.ts` — 단발 실행
- `src/schedule.ts` — `node-cron` 스케줄

## 참고

- 쿠팡 API는 계정·승인 상태에 따라 응답 필드가 다를 수 있습니다. 상품 수가 부족하면 `CoupangSearchError`로 처리됩니다.
- WordPress는 사이트 설정에서 REST API가 막혀 있지 않은지, 애플리케이션 비밀번호가 맞는지 확인하세요.
