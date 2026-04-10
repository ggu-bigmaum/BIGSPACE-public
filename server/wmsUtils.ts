import https from "https";

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
 * VWorld WMS GetCapabilities에서 레이어의 MaxScaleDenominator를 읽어 반환.
 * MaxScaleDenominator: 이 값보다 큰 축적(더 멀리)에서는 레이어가 안 보임.
 * 현재 축적 > MaxScaleDenominator → 배너 표시 (줌인 필요)
 * 실패 시 null 반환.
 */
export async function fetchVWorldMaxScale(
  layerName: string,
  apiKey: string
): Promise<number | null> {
  try {
    const url = `https://api.vworld.kr/req/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0&KEY=${apiKey}`;
    const xml = await fetchText(url);

    const layerBlockRegex = /<Layer[\s\S]*?<\/Layer>/g;
    let match;
    while ((match = layerBlockRegex.exec(xml)) !== null) {
      const block = match[0];
      if (!block.includes(`<Name>${layerName}</Name>`)) continue;

      const scaleMatch = block.match(/<MaxScaleDenominator>([\d.]+)<\/MaxScaleDenominator>/);
      if (scaleMatch) {
        return parseFloat(scaleMatch[1]);
      }
    }
    return null;
  } catch {
    return null;
  }
}
