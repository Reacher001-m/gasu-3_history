// バックエンドエントリ（Cloudflare Worker）
// - ブラウザと同じ標準API（Request / Response / URL）だけで動く
// - Node.jsのexpressなどのフレームワークは使わない
// - Workerは「リクエストを受けてレスポンスを返す」関数の集まり
import { json } from "./http.js";
import { handleCountGet, handleCountPost } from "./counter.js";
import { handleContactPost } from "./contact.js";

// ルーティング表: 存在するパスの一覧（405判定にも使う）
const KNOWN_PATHS = ["/api/health", "/api/count", "/api/contact"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // このWorkerは /api/* だけを受け取る想定
    // （wrangler.jsonc の assets.run_worker_first: ["/api/*"] で制御している）
    if (!url.pathname.startsWith("/api/")) {
      // 万一ここに届いた場合は404を返す。静的ファイルはWorker経由にならない
      return json({ error: "not found" }, 404);
    }

    // ルーティング: "メソッド パス" の文字列でマッチさせる
    // 405（Method Not Allowed）は「パスはあるがメソッドが違う」時に返す約束
    const key = `${request.method} ${url.pathname}`;
    switch (key) {
      case "GET /api/health":
        return json({ ok: true });
      case "GET /api/count":
        return handleCountGet(request, url, env);
      case "POST /api/count":
        return handleCountPost(request, env);
      case "POST /api/contact":
        return handleContactPost(request, env, ctx);
      default:
        if (KNOWN_PATHS.includes(url.pathname)) {
          return json({ error: "method not allowed" }, 405);
        }
        return json({ error: "not found" }, 404);
    }
  },
};
