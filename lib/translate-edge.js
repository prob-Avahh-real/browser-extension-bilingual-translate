let edgeToken = null;
let edgeTokenAt = 0;

export async function getEdgeToken() {
  if (edgeToken && Date.now() - edgeTokenAt < 8 * 60 * 1000) return edgeToken;
  const res = await fetch('https://edge.microsoft.com/translate/auth', {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`edge auth ${res.status}`);
  edgeToken = await res.text();
  edgeTokenAt = Date.now();
  return edgeToken;
}

export async function translateBatchEdge(texts) {
  if (!texts.length) return [];
  const token = await getEdgeToken();
  const res = await fetch(
    'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=zh-Hans',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(texts.map((t) => ({ Text: String(t).slice(0, 2000) }))),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!res.ok) throw new Error(`edge translate ${res.status}`);
  const data = await res.json();
  return data.map((row) => row?.translations?.[0]?.text || '');
}

export function resetEdgeToken() {
  edgeToken = null;
  edgeTokenAt = 0;
}
