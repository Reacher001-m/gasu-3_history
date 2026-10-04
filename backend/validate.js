// 入力バリデーション（サーバーサイドが最後の砦）
// フロント側の検証はUXのためのもの。必ずここでも再検証する
// （ブラウザの検証は開発者ツールで簡単に無効化できる）

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 50, email: 100, message: 2000 };

// body を検証して { errors: string[], honeypot: boolean } を返す
export function validateContact(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { errors: ["invalid body"], honeypot: false };
  }

  const errors = [];

  // ハニーポット: 人間には見えない入力欄。bot が値を入れてきたらスパムとみなす
  // （ハンドラ側で「成功したことにする」→ bot は学習できない）
  const honeypot =
    typeof body.website === "string" && body.website.trim() !== "";

  const { name, email, message } = body;

  if (typeof name !== "string" || name.trim() === "") {
    errors.push("name is required");
  } else if (name.length > LIMITS.name) {
    errors.push(`name must be <= ${LIMITS.name} characters`);
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    errors.push("email is invalid");
  } else if (email.length > LIMITS.email) {
    errors.push(`email must be <= ${LIMITS.email} characters`);
  }

  if (typeof message !== "string" || message.trim() === "") {
    errors.push("message is required");
  } else if (message.length > LIMITS.message) {
    errors.push(`message must be <= ${LIMITS.message} characters`);
  }

  return { errors, honeypot };
}
