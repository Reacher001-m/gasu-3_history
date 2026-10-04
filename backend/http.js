// JSONレスポンスを作る共通ヘルパー
// - Content-Type を明示しないとブラウザがJSONとして解釈できない
// - no-store: カウンター等はキャッシュに残ると数え間違いの原因になる
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
