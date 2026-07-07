// scripts/update-prices.mjs
// ------------------------------------------------------------
// products.config.json 에 정의된 상품들을 네이버 쇼핑 API로 검색해서
// 최저가를 찾아 prices.json 으로 저장합니다.
// 실행: GitHub Actions에서 매일 09:00(KST) 자동 실행 + main에 push될 때 실행
// ------------------------------------------------------------
import fs from "fs";

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없습니다. (GitHub Secrets 설정 확인)");
  process.exit(1);
}

function stripTags(str) {
  return str.replace(/<\/?b>/g, "");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNaverLowest(keyword) {
  const url =
    "https://openapi.naver.com/v1/search/shop.json?query=" +
    encodeURIComponent(keyword) +
    "&display=10&sort=asc";

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": CLIENT_ID,
      "X-Naver-Client-Secret": CLIENT_SECRET
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`네이버 API 오류 (${keyword}) [${res.status}] ${body}`);
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    return null;
  }

  const item = data.items[0];
  return {
    price: Number(item.lprice),
    url: item.link,
    mallName: item.mallName,
    matchedTitle: stripTags(item.title)
  };
}

async function main() {
  const config = JSON.parse(fs.readFileSync("products.config.json", "utf-8"));
  const results = [];

  for (const p of config.products) {
    let naver = null;
    try {
      naver = await fetchNaverLowest(p.searchKeyword);
      console.log(
        `[${p.id}] "${p.searchKeyword}" -> ${
          naver ? naver.price + "원 (" + naver.mallName + ")" : "검색결과 없음"
        }`
      );
    } catch (e) {
      console.error(`[${p.id}] 조회 실패: ${e.message}`);
    }

    results.push({
      id: p.id,
      name: p.name,
      image: p.image,
      detailUrl: p.detailUrl,
      coupangPrice: p.coupangPrice ?? null,
      coupangUrl: p.coupangUrl ?? "",
      naverPrice: naver ? naver.price : null,
      naverUrl: naver ? naver.url : "",
      naverMatchedTitle: naver ? naver.matchedTitle : null
    });

    // 네이버 API 호출 제한 대비 약간의 텀
    await wait(300);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    products: results
  };

  fs.writeFileSync("prices.json", JSON.stringify(output, null, 2));
  console.log("prices.json 갱신 완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
