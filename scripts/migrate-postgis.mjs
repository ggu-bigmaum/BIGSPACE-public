/**
 * PostGIS 마이그레이션 스크립트
 *
 * 목적:
 *   - features.geom          geometry(Geometry, 4326) 컬럼 추가 + GIST 인덱스
 *   - administrative_boundaries.geom  동일
 *   - jsonb geometry → PostGIS geometry 변환 (ST_GeomFromGeoJSON)
 *
 * 실행:
 *   node scripts/migrate-postgis.mjs
 *
 * 필요: DATABASE_URL 환경변수 (.env 자동 로드)
 */

import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// .env 로드
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
try {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 환경변수가 없습니다.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function run() {
  await client.connect();
  log("✅ DB 연결 완료");

  // ── 0. PostGIS 확인 ───────────────────────────────────────────────────────
  const pgisCheck = await client.query(
    "SELECT extname FROM pg_extension WHERE extname = 'postgis'"
  );
  if (pgisCheck.rows.length === 0) {
    log("PostGIS 미설치 → CREATE EXTENSION 시도");
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
    log("✅ PostGIS extension 생성 완료");
  } else {
    log("✅ PostGIS 이미 설치됨");
  }

  // ── 1. features 테이블 ────────────────────────────────────────────────────
  log("── features 테이블 마이그레이션 시작 ──");

  // 컬럼 존재 확인
  const featureGeomExists = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'features' AND column_name = 'geom'
  `);

  if (featureGeomExists.rows.length === 0) {
    log("features.geom 컬럼 추가 중...");
    await client.query(
      "ALTER TABLE features ADD COLUMN geom geometry(Geometry, 4326)"
    );
    log("✅ features.geom 컬럼 추가 완료");
  } else {
    log("features.geom 컬럼 이미 존재 → 스킵");
  }

  // 인덱스 존재 확인
  const featureIdxExists = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'features' AND indexname = 'features_geom_gist_idx'
  `);
  if (featureIdxExists.rows.length === 0) {
    log("features GIST 인덱스 생성 중... (잠시 시간이 걸릴 수 있음)");
    await client.query(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS features_geom_gist_idx ON features USING GIST(geom)"
    );
    log("✅ features GIST 인덱스 생성 완료");
  } else {
    log("features GIST 인덱스 이미 존재 → 스킵");
  }

  // NULL인 geom 채우기 (배치 처리, 5000건씩)
  const nullCount = await client.query(
    "SELECT COUNT(*)::int AS cnt FROM features WHERE geom IS NULL AND geometry IS NOT NULL"
  );
  const total = nullCount.rows[0].cnt;
  log(`features.geom NULL 건수: ${total.toLocaleString()}건 → 변환 시작`);

  if (total > 0) {
    const batchSize = 5000;
    let processed = 0;
    while (processed < total) {
      const result = await client.query(`
        UPDATE features
        SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
        WHERE id IN (
          SELECT id FROM features
          WHERE geom IS NULL AND geometry IS NOT NULL
          LIMIT ${batchSize}
        )
      `);
      processed += result.rowCount;
      const pct = Math.min(100, Math.round((processed / total) * 100));
      log(`  features 변환: ${processed.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`);
    }
    log("✅ features.geom 변환 완료");
  }

  // ── 2. administrative_boundaries 테이블 ──────────────────────────────────
  log("── administrative_boundaries 테이블 마이그레이션 시작 ──");

  const abGeomExists = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'administrative_boundaries' AND column_name = 'geom'
  `);

  if (abGeomExists.rows.length === 0) {
    log("administrative_boundaries.geom 컬럼 추가 중...");
    await client.query(
      "ALTER TABLE administrative_boundaries ADD COLUMN geom geometry(Geometry, 4326)"
    );
    log("✅ administrative_boundaries.geom 컬럼 추가 완료");
  } else {
    log("administrative_boundaries.geom 컬럼 이미 존재 → 스킵");
  }

  const abIdxExists = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'administrative_boundaries' AND indexname = 'admin_boundaries_geom_gist_idx'
  `);
  if (abIdxExists.rows.length === 0) {
    log("administrative_boundaries GIST 인덱스 생성 중...");
    await client.query(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_boundaries_geom_gist_idx ON administrative_boundaries USING GIST(geom)"
    );
    log("✅ administrative_boundaries GIST 인덱스 생성 완료");
  } else {
    log("administrative_boundaries GIST 인덱스 이미 존재 → 스킵");
  }

  // NULL인 geom 채우기 (행정경계는 폴리곤이라 배치 작게)
  const abNullCount = await client.query(
    "SELECT COUNT(*)::int AS cnt FROM administrative_boundaries WHERE geom IS NULL AND geometry IS NOT NULL"
  );
  const abTotal = abNullCount.rows[0].cnt;
  log(`administrative_boundaries.geom NULL 건수: ${abTotal.toLocaleString()}건 → 변환 시작`);

  if (abTotal > 0) {
    const batchSize = 200;
    let processed = 0;
    while (processed < abTotal) {
      const result = await client.query(`
        UPDATE administrative_boundaries
        SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
        WHERE id IN (
          SELECT id FROM administrative_boundaries
          WHERE geom IS NULL AND geometry IS NOT NULL
          LIMIT ${batchSize}
        )
      `);
      processed += result.rowCount;
      const pct = Math.min(100, Math.round((processed / abTotal) * 100));
      log(`  administrative_boundaries 변환: ${processed.toLocaleString()} / ${abTotal.toLocaleString()} (${pct}%)`);
    }
    log("✅ administrative_boundaries.geom 변환 완료");
  }

  // ── 3. 검증 ──────────────────────────────────────────────────────────────
  log("── 검증 ──");
  const verifyFeatures = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(geom)::int AS with_geom,
      COUNT(*) - COUNT(geom) AS missing_geom
    FROM features
  `);
  const vf = verifyFeatures.rows[0];
  log(`features: 전체 ${vf.total.toLocaleString()}건 | geom 있음 ${vf.with_geom.toLocaleString()}건 | 누락 ${vf.missing_geom}건`);

  const verifyAb = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(geom)::int AS with_geom,
      COUNT(*) - COUNT(geom) AS missing_geom
    FROM administrative_boundaries
  `);
  const va = verifyAb.rows[0];
  log(`administrative_boundaries: 전체 ${va.total.toLocaleString()}건 | geom 있음 ${va.with_geom.toLocaleString()}건 | 누락 ${va.missing_geom}건`);

  // 공간 쿼리 동작 테스트
  const spatialTest = await client.query(`
    SELECT COUNT(*)::int AS cnt
    FROM features f
    JOIN administrative_boundaries ab ON ST_Within(f.geom, ab.geom)
    WHERE ab.level = '시도'
    LIMIT 1
  `);
  log(`ST_Within 테스트 (features JOIN 시도경계): ${spatialTest.rows[0].cnt.toLocaleString()}건 매칭`);

  log("🎉 PostGIS 마이그레이션 완료!");
  await client.end();
}

run().catch(async (err) => {
  console.error("❌ 마이그레이션 실패:", err.message);
  await client.end().catch(() => {});
  process.exit(1);
});
