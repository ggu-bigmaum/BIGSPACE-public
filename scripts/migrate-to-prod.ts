/**
 * 응급출동 데이터 dev → prod 마이그레이션 스크립트
 *
 * 사용법:
 *   npx tsx scripts/migrate-to-prod.ts <프로덕션URL>
 *
 * 예시:
 *   npx tsx scripts/migrate-to-prod.ts https://workspace--bigmaum99.replit.app
 */
import pg from "pg";

const { Pool } = pg;

const MIGRATE_TOKEN = "5ccade24-da86-45e8-bc19-59ddafaf3556";
const BATCH_SIZE = 2000;

// dev layer ID → prod layer ID 매핑
const LAYER_MAPPING: Record<string, string> = {
  "1582edb6-cf87-4869-a442-8082733a58ba": "5dc329e1-c7ab-4477-afea-02b03fc5521b", // 응급출동 2020
  "95338849-8b75-4054-926f-a7e61480aee1": "94eba986-8d5e-4dbf-b5f3-979bbc261ed8", // 응급출동 2021
  "b75e1fed-a176-4cdc-ae9c-9838d56b0fa9": "da3a2e9c-ce16-4801-80e0-03bcc268e376", // 응급출동 2022
};

const LAYER_NAMES: Record<string, string> = {
  "1582edb6-cf87-4869-a442-8082733a58ba": "응급출동 현황 2020",
  "95338849-8b75-4054-926f-a7e61480aee1": "응급출동 현황 2021",
  "b75e1fed-a176-4cdc-ae9c-9838d56b0fa9": "응급출동 현황 2022",
};

async function postBatch(
  prodUrl: string,
  layerId: string,
  rows: any[]
): Promise<number> {
  const resp = await fetch(`${prodUrl}/api/admin/import-features`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-migrate-token": MIGRATE_TOKEN,
    },
    body: JSON.stringify({ layerId, rows }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt}`);
  }
  const json = (await resp.json()) as { inserted: number };
  return json.inserted;
}

async function syncStats(prodUrl: string, layerIds: string[]): Promise<void> {
  const resp = await fetch(`${prodUrl}/api/admin/sync-layer-stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-migrate-token": MIGRATE_TOKEN,
    },
    body: JSON.stringify({ layerIds }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`sync-layer-stats HTTP ${resp.status}: ${txt}`);
  }
  const json = (await resp.json()) as { results: { layerId: string; count: number }[] };
  console.log("\n레이어 통계 동기화 완료:");
  for (const r of json.results) {
    console.log(`  ${r.layerId}: ${r.count.toLocaleString()} 피처`);
  }
}

async function main() {
  const prodUrl = process.argv[2]?.replace(/\/$/, "");
  if (!prodUrl) {
    console.error("사용법: npx tsx scripts/migrate-to-prod.ts <프로덕션URL>");
    console.error("예시: npx tsx scripts/migrate-to-prod.ts https://myapp.replit.app");
    process.exit(1);
  }

  // 엔드포인트 연결 확인
  console.log(`\n프로덕션 URL: ${prodUrl}`);
  console.log("엔드포인트 연결 확인 중...");
  try {
    const ping = await fetch(`${prodUrl}/api/stats`);
    if (!ping.ok) {
      console.error(`⚠ /api/stats 응답 코드: ${ping.status} — URL을 확인하세요`);
    } else {
      const stats = (await ping.json()) as { layerCount: number; totalFeatures: number };
      console.log(`✓ 연결 성공 (레이어 ${stats.layerCount}개, 피처 ${stats.totalFeatures.toLocaleString()}개)\n`);
    }
  } catch (e: any) {
    console.error(`✗ 연결 실패: ${e.message}`);
    process.exit(1);
  }

  const devPool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const startTime = Date.now();
    let grandTotal = 0;

    for (const [devLayerId, prodLayerId] of Object.entries(LAYER_MAPPING)) {
      const layerName = LAYER_NAMES[devLayerId];
      console.log(`\n━━━ ${layerName} ━━━`);

      const countResult = await devPool.query(
        "SELECT COUNT(*) FROM features WHERE layer_id = $1",
        [devLayerId]
      );
      const total = parseInt(countResult.rows[0].count);
      console.log(`총 ${total.toLocaleString()} 피처`);

      let offset = 0;
      let layerTotal = 0;
      const layerStart = Date.now();

      while (offset < total) {
        const result = await devPool.query(
          `SELECT
             geometry,
             properties,
             lng,
             lat,
             min_lng  AS "minLng",
             min_lat  AS "minLat",
             max_lng  AS "maxLng",
             max_lat  AS "maxLat"
           FROM features
           WHERE layer_id = $1
           ORDER BY id
           LIMIT $2 OFFSET $3`,
          [devLayerId, BATCH_SIZE, offset]
        );

        if (result.rows.length === 0) break;

        const inserted = await postBatch(prodUrl, prodLayerId, result.rows);
        layerTotal += inserted;
        offset += result.rows.length;

        const pct = Math.round((offset / total) * 100);
        const elapsed = ((Date.now() - layerStart) / 1000).toFixed(0);
        const rate = Math.round(layerTotal / ((Date.now() - layerStart) / 1000));
        process.stdout.write(
          `\r  [${pct}%] ${layerTotal.toLocaleString()} / ${total.toLocaleString()} — ${rate}/초 (${elapsed}초 경과)   `
        );
      }

      grandTotal += layerTotal;
      const elapsed = ((Date.now() - layerStart) / 1000).toFixed(1);
      console.log(`\n  ✓ 완료: ${layerTotal.toLocaleString()} 피처 (${elapsed}초)`);
    }

    const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n총 ${grandTotal.toLocaleString()} 피처 마이그레이션 완료 (${totalSec}초)`);

    // 통계 동기화
    console.log("\n레이어 통계 재계산 중...");
    await syncStats(prodUrl, Object.values(LAYER_MAPPING));

  } finally {
    await devPool.end();
  }
}

main().catch((e) => {
  console.error("\n오류:", e.message);
  process.exit(1);
});
