// カウンターAPI: ページ閲覧数の取得・増加（保存先は Cloudflare KV = env.APP_KV）
//
// 学習ポイント:
// - KVは「キー → 文字列」の単純な保存庫。数値は文字列として保存し、読む時に数値へ戻す
// - 読む→1増やす→書く（read-modify-write）は、同時アクセスだと取りこぼけることがある
//   （KVは非同時整合）。今は「最終一致」で許容。厳密な同時実行が必要になったら
//   D1のトランザクションやDurable Objectsに進む
import { json } from "./http.js";

// どんなキーでも作られるのを防ぐ: "view:" + 短いスラッグのみ許可
const KEY_PATTERN = /^view:[a-z0-9][a-z0-9-]{0,63}$/;

function validateKey(key) {
  if (typeof key !== "string" || key.length === 0) return "key is required";
  if (!KEY_PATTERN.test(key)) return "key must match view:<slug>";
  return null;
}

function toCount(raw) {
  if (raw === null || raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// GET /api/count?key=view:index → 現在値を返すだけ（増やさない）
export async function handleCountGet(request, url, env) {
  const key = url.searchParams.get("key");
  const error = validateKey(key);
  if (error) return json({ error }, 400);

  try {
    const raw = await env.APP_KV.get(key);
    return json({ key, count: toCount(raw) });
  } catch (e) {
    console.error("KV get failed:", e);
    return json({ error: "internal error" }, 500);
  }
}

// POST /api/count {"key":"view:index"} → 1増やして増加後の値を返す
export async function handleCountPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const key = body?.key;
  const error = validateKey(key);
  if (error) return json({ error }, 400);

  try {
    const raw = await env.APP_KV.get(key);
    const next = toCount(raw) + 1;
    await env.APP_KV.put(key, String(next));
    return json({ key, count: next }, 201);
  } catch (e) {
    console.error("KV write failed:", e);
    return json({ error: "internal error" }, 500);
  }
}
