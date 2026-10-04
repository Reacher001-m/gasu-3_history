// 問い合わせフォームAPI: バリデーション → KV保存 → Resend通知（ベストエフォート）
//
// 学習ポイント:
// - レスポンスは「保存できたか」だけで決める。メール通知の成否では201を返さない
// - レート制限は KV + 1分バケット（非同時整合のため近似値。厳密さが必要ならDurable Objects）
// - シークレット（RESEND_API_KEY等）は wrangler secret put で渡し、コードには書かない
import { json } from "./http.js";
import { validateContact } from "./validate.js";

const RATE_LIMIT_PER_MIN = 5;

export async function handleContactPost(request, env, ctx) {
  // 1) JSONパース（壊れていたら400）
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  // 2) バリデーション
  const { errors, honeypot } = validateContact(body);
  if (errors.length > 0) {
    return json({ error: errors.join("; ") }, 400);
  }

  // ハニーポットに引っかかったbotには成功を装って何もしない
  if (honeypot) {
    console.log("contact: honeypot triggered, dropped");
    return json({ ok: true }, 201);
  }

  // 3) レート制限（IP単位・1分5件まで）
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await isRateLimited(env, ip)) {
    return json({ error: "too many requests, try again later" }, 429);
  }

  // 4) KV へ保存
  const record = {
    name: body.name.trim(),
    email: body.email.trim(),
    message: body.message.trim(),
    ip,
    createdAt: new Date().toISOString(),
  };
  const key = `contact:${record.createdAt}:${crypto.randomUUID().slice(0, 8)}`;
  try {
    await env.APP_KV.put(key, JSON.stringify(record));
  } catch (e) {
    console.error("contact: KV write failed:", e);
    return json({ error: "internal error" }, 500);
  }

  // 5) Resend でメール通知（ベストエフォート）
  //    ctx.waitUntil でレスポンスを待たずに実行。失敗しても201は返す（記録はKVにある）
  if (env.RESEND_API_KEY && env.TO_EMAIL) {
    ctx.waitUntil(sendEmail(env, record));
  } else {
    console.log("contact: RESEND_API_KEY/TO_EMAIL not set, skip email");
  }

  return json({ ok: true }, 201);
}

// 1分バケット方式: bucket = floor(now / 60000)
// read-modify-write は取りこぼしうるが、レート制限としては近似で十分
async function isRateLimited(env, ip) {
  const bucket = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${bucket}`;
  try {
    const used = Number(await env.APP_KV.get(key)) || 0;
    if (used >= RATE_LIMIT_PER_MIN) return true;
    await env.APP_KV.put(key, String(used + 1), { expirationTtl: 120 });
    return false;
  } catch (e) {
    // 制限機構の障害で送信自体を止めない（fail-open）
    console.error("rate limit check failed (fail-open):", e);
    return false;
  }
}

async function sendEmail(env, record) {
  // 秘密情報はプロンプト入力なので前後の空白·改行が紛れ込むことがある → 念のためtrim
  const to = (env.TO_EMAIL || "").trim();
  const from = (env.FROM_EMAIL || env.TO_EMAIL || "").trim();
  if (!to) {
    console.error("resend skipped: TO_EMAIL is empty");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        // from: Resendでverifiedにした送信元。未設定なら宛先と同じアドレスを流用
        from,
        to: [to],
        reply_to: record.email,
        subject: `ポートフォリオ問い合わせ: ${record.name}`,
        text: `名前: ${record.name}\nメール: ${record.email}\n\n${record.message}`,
      }),
    });
    if (!res.ok) {
      console.error("resend error:", res.status, await res.text());
    } else {
      // 成功ログも出す（tail で「メールが届いた/届かなかった」を判定できる）
      const sent = await res.json().catch(() => ({}));
      console.log("resend sent:", sent.id || "(no id)");
    }
  } catch (e) {
    console.error("resend request failed:", e);
  }
}
