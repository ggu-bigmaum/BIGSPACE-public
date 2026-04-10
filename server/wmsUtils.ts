import https from "https";

// Web Mercator 기준: 줌 0 = 559,082,264 스케일
const ZOOM_0_SCALE = 559082264;

function scaleDenominatorToZoom(scale: number): number {
  return Math.ceil(Math.log2(ZOOM_0_SCALE / scale));
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * VWorld WMS GetCapabilities에서 레이어의 MinScaleDenominator를 읽어
 * 줌 레벨로 변환한다. 실패 시 null 반환.
 */
export async function fetchVWorldMinZoom(
  layerName: string,
  apiKey: string
): Promise<number | null> {
  try {
    const url = `https://api.vworld.kr/req/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0&KEY=${apiKey}`;
    const xml = await fetchText(url);

    // <Layer> 블록을 순회하며 layerName과 일치하는 블록 찾기
    const layerBlockRegex = /<Layer[\s\S]*?<\/Layer>/g;
    let match;
    while ((match = layerBlockRegex.exec(xml)) !== null) {
      const block = match[0];
      if (!block.includes(`<Name>${layerName}</Name>`)) continue;

      const scaleMatch = block.match(/<MinScaleDenominator>([\d.]+)<\/MinScaleDenominator>/);
      if (scaleMatch) {
        const scale = parseFloat(scaleMatch[1]);
        const zoom = scaleDenominatorToZoom(scale);
        return Math.max(0, Math.min(20, zoom));
      }
    }
    return null;
  } catch {
    return null;
  }
}
