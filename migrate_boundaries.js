const { Client } = require('pg');
const https = require('https');

const DEV_DB = 'postgresql://postgres:password@helium/heliumdb?sslmode=disable';
const PROD_URL = 'https://gis-solution.replit.app';
const TOKEN = '5ccade24-da86-45e8-bc19-59ddafaf3556';
const CHUNK_SIZE = 20;

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'x-migrate-token': TOKEN,
      },
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch(e) { reject(new Error(`Invalid JSON (${res.statusCode}): ${buf.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const level = process.argv[2];
  if (!level) {
    console.log('사용법: node /tmp/migrate_boundaries.js <레벨>');
    console.log('예: node /tmp/migrate_boundaries.js 시도');
    console.log('    node /tmp/migrate_boundaries.js 시군구');
    console.log('    node /tmp/migrate_boundaries.js 읍면동');
    process.exit(1);
  }

  const client = new Client({ connectionString: DEV_DB });
  await client.connect();
  console.log(`[${level}] 개발 DB에서 데이터 조회 중...`);

  const res = await client.query(
    `SELECT id, name, code, level, parent_code, geometry, properties,
            min_lng, min_lat, max_lng, max_lat, center_lng, center_lat
     FROM administrative_boundaries WHERE level=$1 ORDER BY code`,
    [level]
  );
  await client.end();

  const rows = res.rows;
  console.log(`[${level}] 총 ${rows.length}개 조회됨`);

  if (rows.length === 0) {
    console.log('데이터 없음. 개발 환경에서 먼저 업로드하세요.');
    process.exit(0);
  }

  // 프로덕션에서 기존 데이터 삭제
  console.log(`[${level}] 프로덕션 기존 데이터 삭제...`);
  const delRes = await new Promise((resolve, reject) => {
    const urlObj = new URL(`${PROD_URL}/api/admin-boundaries/${encodeURIComponent(level)}`);
    const opts = {
      hostname: urlObj.hostname, path: urlObj.pathname,
      method: 'DELETE',
      headers: { 'x-migrate-token': TOKEN },
    };
    const req = https.request(opts, (res) => {
      let buf = ''; res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject); req.end();
  });
  console.log(`[${level}] 삭제 완료 (HTTP ${delRes.status})`);

  // 청크 단위 이관
  let total = 0;
  const chunks = Math.ceil(rows.length / CHUNK_SIZE);
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map(r => ({
      id: r.id,
      name: r.name,
      code: r.code,
      level: r.level,
      parentCode: r.parent_code,
      geometry: r.geometry,
      properties: r.properties,
      minLng: r.min_lng != null ? parseFloat(r.min_lng) : null,
      minLat: r.min_lat != null ? parseFloat(r.min_lat) : null,
      maxLng: r.max_lng != null ? parseFloat(r.max_lng) : null,
      maxLat: r.max_lat != null ? parseFloat(r.max_lat) : null,
      centerLng: r.center_lng != null ? parseFloat(r.center_lng) : null,
      centerLat: r.center_lat != null ? parseFloat(r.center_lat) : null,
    }));

    const result = await postJson(`${PROD_URL}/api/admin/import-boundaries`, { rows: chunk });
    if (result.status !== 200) {
      console.error(`오류 (청크 ${Math.floor(i/CHUNK_SIZE)+1}/${chunks}):`, result.body);
      process.exit(1);
    }
    total += chunk.length;
    process.stdout.write(`\r[${level}] ${total}/${rows.length} 이관 완료 (${Math.round(total/rows.length*100)}%)`);
  }
  console.log(`\n[${level}] 이관 완료! 총 ${total}개`);
}

main().catch(e => { console.error('오류:', e.message); process.exit(1); });
