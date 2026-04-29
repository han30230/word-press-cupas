import path from "node:path";
import { loadAppConfig, type AccountConfig, type AppConfigFile } from "../config/appConfig.js";
import { resolveEnvForAccount } from "../config/resolveAccountEnv.js";
import type { AppEnv } from "../config/env.js";
import { createCoupangAxios } from "../modules/coupang/client.js";
import type { NormalizedProduct } from "../modules/coupang/types.js";
import {
  COUPANG_SEARCH_PATH,
  CoupangSearchError,
  fetchGoldboxProducts,
  pickGoldboxPublication,
  pickProductsForArticle,
  searchProductsByKeyword,
} from "../modules/coupang/search.js";
import { generateArticleHtml } from "../modules/openai/generate.js";
import { prepareWordPressPostContent } from "../modules/openai/articlePostProcess.js";
import {
  appendPublication,
  ensureStateFileDir,
  loadKeywordsFile,
  loadState,
  pickNextKeyword,
  saveState,
} from "../modules/keywords/store.js";
import { createWordPressHttpClient } from "../modules/wordpress/createClient.js";
import { uploadProductImagesAndReplaceInHtml } from "../modules/wordpress/media.js";
import { createWordPressPost } from "../modules/wordpress/upload.js";
import { appRootDir } from "../utils/appRoot.js";
import { createLogger } from "../utils/logger.js";
import {
  canManualRun,
  recordPublishSuccess,
} from "../utils/scheduleGate.js";
import { appendRunReport, previewFromHtml } from "../utils/runReport.js";
import { saveGeneratedArticleHtml } from "../utils/saveArticleFile.js";

export type PublishJobSource = "manual" | "scheduled";

export interface RunPublishJobOptions {
  accountId?: string;
  source?: PublishJobSource;
}

export interface PublishJobResult {
  ok: boolean;
  /** ok가 false일 때 UI·로그에 표시 */
  error?: string;
}

function resolveLogPath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(appRootDir(), p);
}

function pickAccount(config: AppConfigFile, accountId?: string): AccountConfig | null {
  const enabled = config.accounts.filter((a) => a.enabled);
  if (accountId) {
    const a = config.accounts.find((x) => x.id === accountId);
    return a && a.enabled ? a : null;
  }
  return enabled[0] ?? null;
}

export async function runPublishJob(
  opts?: RunPublishJobOptions,
): Promise<PublishJobResult> {
  const source: PublishJobSource = opts?.source ?? "manual";
  const config = loadAppConfig();
  const account = pickAccount(config, opts?.accountId);
  if (!account) {
    const err = "사용할 수 있는 계정이 없습니다. (활성 계정을 선택하거나 app-config에서 enabled를 켜세요)";
    console.error("[publish]", err);
    return { ok: false, error: err };
  }

  const now = new Date();
  const logger = createLogger(resolveLogPath(account.logFile));

  if (source === "manual") {
    if (!canManualRun(account.id, account.schedule, now)) {
      const msg =
        "오늘 발행 가능 횟수를 모두 사용했거나, 자동화 기간 밖입니다. (설정의 기간·일일 횟수 확인)";
      logger.warn(msg);
      appendRunReport({
        at: new Date().toISOString(),
        ok: false,
        accountId: account.id,
        accountName: account.name,
        error: msg,
      });
      return { ok: false, error: msg };
    }
  }

  let env: AppEnv;
  try {
    env = resolveEnvForAccount(config.global, account);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[config]", msg);
    appendRunReport({
      at: new Date().toISOString(),
      ok: false,
      accountId: account.id,
      accountName: account.name,
      error: msg,
    });
    return { ok: false, error: msg };
  }

  const reportMeta = { accountId: account.id, accountName: account.name };
  logger.info(`발행 작업 시작 (${source})`);

  let keywordForReport: string | undefined;

  try {
    ensureStateFileDir(env.publishedStateFile, logger);
    const topicSrc = account.topicSource ?? "keywords";

    const coupang = createCoupangAxios(env.coupangAccessKey, env.coupangSecretKey);
    let state = loadState(env.publishedStateFile);

    let keyword: string;
    let blogTopic: string;
    let keywordIndex: number;
    let keywordCountForCursor: number;
    let products: NormalizedProduct[];
    let representative: NormalizedProduct;

    if (topicSrc === "goldbox") {
      const goldboxList = await fetchGoldboxProducts(coupang, {
        subId: env.coupangSubId,
        limit: 20,
      });
      const gb = pickGoldboxPublication(
        goldboxList,
        state,
        env.minProducts,
        env.maxProducts,
      );
      if (!gb) {
        logger.warn(
          "골드박스: 새로 발행할 특가 상품이 없습니다. (이미 발행한 상품만 있거나, 응답 상품 수가 부족합니다.)",
        );
        appendRunReport({
          at: new Date().toISOString(),
          ok: true,
          ...reportMeta,
          error: "골드박스 발행 가능 상품 없음",
        });
        return { ok: true };
      }
      keyword = gb.keyword;
      products = gb.products;
      representative = gb.representative;
      blogTopic = `쿠팡 골드박스 특가 추천: ${representative.productName}`;
      keywordIndex = 0;
      keywordCountForCursor = 1;
    } else {
      ensureStateFileDir(env.keywordsFile, logger);
      const keywords = loadKeywordsFile(env.keywordsFile);
      const picked = pickNextKeyword(keywords, state);
      if (!picked) {
        logger.warn("발행 가능한 키워드가 없습니다. (모든 키워드가 이미 발행됨)");
        appendRunReport({
          at: new Date().toISOString(),
          ok: true,
          ...reportMeta,
          error: "발행 가능한 키워드 없음(모두 기록됨)",
        });
        return { ok: true };
      }
      keyword = picked.keyword;
      keywordIndex = picked.index;
      keywordCountForCursor = keywords.length;
      blogTopic = keyword;

      const rawProducts = await searchProductsByKeyword(coupang, COUPANG_SEARCH_PATH, {
        keyword,
        limit: 10,
        subId: env.coupangSubId,
      });
      products = pickProductsForArticle(rawProducts, env.minProducts, env.maxProducts);
      representative = products[0];
    }

    keywordForReport = keyword;
    logger.info(
      topicSrc === "goldbox"
        ? `골드박스 기준 글감: ${keyword} (${representative.productName})`
        : `선택된 키워드: ${keyword}`,
    );

    const article = await generateArticleHtml({
      apiKey: env.openaiApiKey,
      model: env.openaiModel,
      blogTopic,
      products,
      representative,
    });
    if (article.qualityWarnings.length > 0) {
      logger.warn("생성 HTML 품질 휴리스틱(필요 시 재생성·수정)", article.qualityWarnings);
    }

    let savedPath = "";
    try {
      savedPath = saveGeneratedArticleHtml(env.outputDir, keyword, article);
      logger.info(`생성 본문 저장: ${savedPath}`);
    } catch (e) {
      logger.warn("생성 본문 파일 저장 실패(로그·콘솔로만 확인 가능)", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    let contentPreview = previewFromHtml(article.html);
    let htmlForPublish = article.html;
    let featuredMediaId: number | undefined;

    if (!env.wpEnabled) {
      logger.info(
        "WordPress 미설정(WP_BASE_URL·WP_USERNAME·WP_APPLICATION_PASSWORD): 글 생성까지만 수행했습니다. 업로드·발행 이력 저장은 하지 않습니다.",
      );
      logger.info(`생성 제목: ${article.title}`);
      logger.info(`본문 HTML 길이: ${article.html.length}자`);
      if (savedPath) {
        logger.info(`파일로 열어보기: ${savedPath}`);
      }
      appendRunReport({
        at: new Date().toISOString(),
        ok: true,
        ...reportMeta,
        keyword,
        title: article.title,
        excerpt: article.excerpt,
        contentPreview,
        localHtmlPath: savedPath || undefined,
      });
      recordPublishSuccess(account.id, now);
      return { ok: true };
    }

    const wp = await createWordPressHttpClient(env);
    const afterMedia = await uploadProductImagesAndReplaceInHtml(
      wp,
      products,
      representative,
      htmlForPublish,
      logger,
    );
    htmlForPublish = afterMedia.html;
    if (afterMedia.featuredMediaId !== undefined) {
      featuredMediaId = afterMedia.featuredMediaId;
    }
    if (htmlForPublish !== article.html) {
      contentPreview = previewFromHtml(htmlForPublish);
    }

    htmlForPublish = prepareWordPressPostContent(htmlForPublish);
    contentPreview = previewFromHtml(htmlForPublish);

    const created = await createWordPressPost(
      wp,
      logger,
      {
        title: article.title,
        content: htmlForPublish,
        excerpt: article.excerpt,
        status: env.wpPostStatus,
        featuredMediaId,
      },
      keyword,
    );

    state = appendPublication(
      state,
      {
        keyword,
        postId: created.id,
        title: created.title,
        slug: created.slug,
        publishedAt: new Date().toISOString(),
      },
      keywordCountForCursor,
      keywordIndex,
    );
    try {
      saveState(env.publishedStateFile, state);
    } catch (e) {
      logger.error(
        "발행 이력 저장 실패(다음 실행에서 동일 키워드가 다시 선택될 수 있음)",
        { error: e instanceof Error ? e.message : String(e) },
      );
    }

    logger.info(`WordPress 발행 완료: postId=${created.id} url=${created.url}`);

    appendRunReport({
      at: new Date().toISOString(),
      ok: true,
      ...reportMeta,
      keyword,
      title: created.title,
      excerpt: article.excerpt,
      contentPreview,
      postId: created.id,
      postUrl: created.url,
      localHtmlPath: savedPath || undefined,
    });

    recordPublishSuccess(account.id, now);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof CoupangSearchError) {
      logger.error(`쿠팡 API 단계 실패: ${msg}`, { code: e.code });
    } else {
      logger.error("발행 작업 실패", {
        message: msg,
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
    appendRunReport({
      at: new Date().toISOString(),
      ok: false,
      ...reportMeta,
      keyword: keywordForReport,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}
