import pg from '../node_modules/pg/lib/index.js';
import proj4 from '../node_modules/proj4/dist/proj4.js';

proj4.defs('EPSG:5181', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');

const LAYER_ID = '987dd2c8-840a-4a7e-8091-2800054f3495';
const CONN = 'postgresql://postgres:0000@localhost:5432/Test';
const CHUNK = 500;

const pool = new pg.Pool({ connectionString: CONN });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM features WHERE layer_id=$1', [LAYER_ID]);
    console.log('기존 데이터 삭제 완료');

    const { rows: [{ count: total }] } = await client.query(`SELECT COUNT(*) FROM "구급출동 현황_2020.csv"`);
    console.log(`총 ${Number(total).toLocaleString()}행 변환 시작...`);

    let offset = 0;
    let inserted = 0;

    while (true) {
      const { rows } = await client.query(
        `SELECT "GIS_X좌표", "GIS_Y좌표", "소방서명", "환자발생유형구분명", "신고연도", "신고월", "신고일",
                "환자시도명", "환자시군구명", "환자읍면동명", "심정지명", "중증외상명", "교통사고명", "긴급구조종결구분명"
         FROM "구급출동 현황_2020.csv" ORDER BY "구급보고서번호" LIMIT $1 OFFSET $2`,
        [CHUNK, offset]
      );
      if (rows.length === 0) break;
      offset += CHUNK;

      const valid = rows.filter(r => r['GIS_X좌표'] && r['GIS_Y좌표'] && r['GIS_X좌표'] !== 'gis_x_axis');
      if (valid.length === 0) continue;

      const params = [];
      const ph = valid.map(r => {
        const [lng, lat] = proj4('EPSG:5181', 'EPSG:4326', [parseFloat(r['GIS_X좌표']), parseFloat(r['GIS_Y좌표'])]);
        const b = params.length;
        params.push(
          LAYER_ID,
          JSON.stringify({ type: 'Point', coordinates: [lng, lat] }),
          JSON.stringify({
            소방서명: r['소방서명'], 발생유형: r['환자발생유형구분명'],
            연도: r['신고연도'], 월: r['신고월'], 일: r['신고일'],
            시도: r['환자시도명'], 시군구: r['환자시군구명'], 읍면동: r['환자읍면동명'],
            심정지: r['심정지명'], 중증외상: r['중증외상명'], 교통사고: r['교통사고명'],
            종결구분: r['긴급구조종결구분명'],
          }),
          lng, lat
        );
        return `(gen_random_uuid()::varchar,$${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+4},$${b+4},$${b+5},$${b+5})`;
      });

      await client.query(
        `INSERT INTO features (id,layer_id,geometry,properties,lng,lat,min_lng,max_lng,min_lat,max_lat) VALUES ${ph.join(',')}`,
        params
      );

      inserted += valid.length;
      if (Math.floor(inserted / 10000) > Math.floor((inserted - valid.length) / 10000)) {
        console.log(`  ${inserted.toLocaleString()} / ${Number(total).toLocaleString()}`);
      }
    }

    await client.query(`UPDATE layers SET feature_count=$1 WHERE id=$2`, [inserted, LAYER_ID]);
    console.log(`\n완료! ${inserted.toLocaleString()}개 삽입, layers 업데이트 완료`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
