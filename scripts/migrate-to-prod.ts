/**
 * 응급출동 데이터 dev → prod 마이그레이션 스크립트 (커서 기반 페이지네이션)
 *
 * 사용법:
 *   npx tsx scripts/migrate-to-prod.ts <프로덕션URL>
 */
import pg from "pg";

const { Pool } = pg;

const MIGRATE_TOKEN = "5ccade24-da86-45e8-bc19-59ddafaf3556";
const BATCH_SIZE = 2000;
const MAX_RETRIES = 3;
const CONCURRENCY = 3; // 동시 요청 수

const LAYER_MAPPING: Record<string, string> = {
  "1582edb6-cf87-4869-a442-8082733a58ba": "5dc329e1-c7ab-4477-afea-02b03fc5521b",
  "95338849-8b75-4054-926f-a7e61480aee1": "94eba986-8d5e-4dbf-b5f3-979bbc261ed8",
  "b75e1fed-a176-4cdc-ae9c-9838d56b0fa9": "da3a2e9c-ce16-4801-80e0-03bcc268e376",
};

const LAYER_NAMES: Record<string, string> = {
  "1582edb6-cf87-4869-a442-8082733a58ba": "응급출동 현황 2020",
  "95338849-8b75-4054-926f-a7e61480aee1": "응급출동 현황 2021",
  "b75e1fed-a176-4cdc-ae9c-9838d56b0fa9": "응급출동 현황 2022",
};

async function postBatch(prodUrl: string, layerId: string, rows: any[]): Promise<number> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(`${prodUrl}/api/admin/import-features`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-migrate-token": MIGRATE_TOKEN,
        },
        body: JSON.stringify({ layerId, rows }),
        signal: AbortSignal.timeout(60000),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${txt}`);
      }
      const json = (await resp.json()) as { inserted: number };
      return json.inserted;
    } catch (e: any) {
      if (attempt === MAX_RETRIES) throw e;
      console.error(`\n  ⚠ 배치 재시도 ${attempt}/${MAX_RETRIES}: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  return 0;
}

async function migrateLayer(
  devPool: pg.Pool,
  prodUrl: string,
  devLayerId: string,
  prodLayerId: string,
  layerName: string
): Promise<number> {
  console.log(`\n━━━ ${layerName} ━━━`);

  const countResult = await devPool.query(
    "SELECT COUNT(*) FROM features WHERE layer_id = $1",
    [devLayerId]
  );
  const total = parseInt(countResult.rows[0].count);
  console.log(`총 ${total.toLocaleString()} 피처`);

  let lastId = "";
  let layerTotal = 0;
  const layerStart = Date.now();

  while (true) {
    // 커서 기반 페이지네이션: OFFSET 대신 id > lastId 사용
    const result = await devPool.query(
      `SELECT
         id,
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
         AND id > $2
       ORDER BY id
       LIMIT $3`,
      [devLayerId, lastId, BATCH_SIZE]
    );

    if (result.rows.length === 0) break;

    lastId = result.rows[result.rows.length - 1].id;
    const rows = result.rows.map(({ id, ...rest }) => rest);

    const inserted = await postBatch(prodUrl, prodLayerId, rows);
    layerTotal += inserted;

    const elapsed = (Date.now() - layerStart) / 1000;
    const rate = Math.round(layerTotal / elapsed);
    const pct = Math.min(100, Math.round((layerTotal / total) * 100));
    process.stdout.write(
      `\r  [${pct}%] ${layerTotal.toLocaleString()} / ${total.toLocaleString()} — ${rate.toLocaleString()}/초 (${elapsed.toFixed(0)}초 경과)   `
    );
  }

  const elapsed = ((Date.now() - layerStart) / 1000).toFixed(1);
  console.log(`\n  ✓ 완료: ${layerTotal.toLocaleString()} 피처 (${elapsed}초)`);
  return layerTotal;
}

async function syncStats(prodUrl: string, layerIds: string[]): Promise<void> {
  console.log("\n레이어 통계 재계산 중...");
  const resp = await fetch(`${prodUrl}/api/admin/sync-layer-stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-migrate-token": MIGRATE_TOKEN },
    body: JSON.stringify({ layerIds }),
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) throw new Error(`sync-layer-stats HTTP ${resp.status}`);
  const json = (await resp.json()) as { results: { layerId: string; count: number }[] };
  console.log("레이어 통계:");
  for (const r of json.results) {
    console.log(`  → ${r.layerId.slice(0, 8)}: ${r.count.toLocaleString()} 피처`);
  }
}

async function buildCache(prodUrl: string, layerIds: string[]): Promise<void> {
  const levels = ["sido", "sigungu", "eupmyeondong"];
  const bbox = "124,33,132,39"; // 전국 bbox
  console.log("\n경계 집계 캐시 생성 중 (9회 API 호출)...");
  for (const layerId of layerIds) {
    for (const level of levels) {
      const resp = await fetch(
        `${prodUrl}/api/layers/${layerId}/boundary-aggregate?level=${level}&bbox=${bbox}`,
        { signal: AbortSignal.timeout(300000) }
      );
      if (!resp.ok) {
        console.error(`  ⚠ ${layerId.slice(0, 8)} / ${level}: HTTP ${resp.status}`);
        continue;
      }
      const data = (await resp.json()) as any[];
      console.log(`  ✓ ${level.padEnd(14)} → ${data.length}개 경계`);
    }
  }
}

async function createIndexes(prodUrl: string): Promise<void> {
  console.log("\n공간인덱스 생성 중...");
  const resp = await fetch(`${prodUrl}/api/admin/create-indexes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-migrate-token": MIGRATE_TOKEN },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) {
    console.error(`  ⚠ 인덱스 생성 HTTP ${resp.status} — 수동 실행 필요`);
    return;
  }
  const json = (await resp.json()) as { indexes: string[] };
  for (const idx of json.indexes || []) {
    console.log(`  ✓ ${idx}`);
  }
}

async function main() {
  const prodUrl = process.argv[2]?.replace(/\/$/, "");
  if (!prodUrl) {
    console.error("사용법: npx tsx scripts/migrate-to-prod.ts <프로덕션URL>");
    process.exit(1);
  }

  console.log(`\n프로덕션 URL: ${prodUrl}`);
  console.log("엔드포인트 연결 확인 중...");
  try {
    const ping = await fetch(`${prodUrl}/api/stats`, { signal: AbortSignal.timeout(10000) });
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
    const stats = (await ping.json()) as { layerCount: number; totalFeatures: number };
    console.log(`✓ 연결 성공 (레이어 ${stats.layerCount}개, 피처 ${stats.totalFeatures.toLocaleString()}개)\n`);
  } catch (e: any) {
    console.error(`✗ 연결 실패: ${e.message}`);
    process.exit(1);
  }

  const devPool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const startTime = Date.now();
    let grandTotal = 0;

    for (const [devLayerId, prodLayerId] of Object.entries(LAYER_MAPPING)) {
      const count = await migrateLayer(
        devPool, prodUrl, devLayerId, prodLayerId, LAYER_NAMES[devLayerId]
      );
      grandTotal += count;
    }

    const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n총 ${grandTotal.toLocaleString()} 피처 마이그레이션 완료 (${totalSec}초)`);

    // 레이어 통계 동기화
    await syncStats(prodUrl, Object.values(LAYER_MAPPING));

    // 경계 집계 캐시 생성
    await buildCache(prodUrl, Object.values(LAYER_MAPPING));

    // 공간인덱스 생성
    await createIndexes(prodUrl);

    console.log("\n✅ 모든 작업 완료!\n");
  } finally {
    await devPool.end();
  }
}

main().catch((e) => {
  console.error("\n오류:", e.message);
  process.exit(1);
});
