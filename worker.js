// Reviews API + static assets. Reviews live in one KV key ("list", newest first).
// ponytail: single KV key is read-modify-write, so simultaneous posts can drop one; move to D1 if volume grows.
const MAX = 200;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // not configured: skip
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  return (await res.json()).success === true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/reviews")) return env.ASSETS.fetch(request);

    const list = async () => JSON.parse((await env.REVIEWS.get("list")) || "[]");

    if (request.method === "GET" && url.pathname === "/api/reviews") return json(await list());

    if (request.method === "POST" && url.pathname === "/api/reviews") {
      let b;
      try { b = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
      if (b.website) return json({ ok: true }); // honeypot: pretend success
      const name = clean(b.name, 60), text = clean(b.text, 800), rating = Math.round(Number(b.rating));
      if (!name || text.length < 10 || !(rating >= 1 && rating <= 5))
        return json({ error: "Please add your name, a star rating and a review of at least 10 characters." }, 400);
      if (/https?:\/\/|www\./i.test(text + " " + name)) return json({ error: "Links aren't allowed in reviews." }, 400);

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await verifyTurnstile(env, b.turnstile, ip))) return json({ error: "Spam check failed. Please try again." }, 400);

      const rlKey = "rl:" + ip;
      const used = parseInt((await env.REVIEWS.get(rlKey)) || "0");
      if (used >= 3) return json({ error: "Too many reviews from this connection. Please try again later." }, 429);
      await env.REVIEWS.put(rlKey, String(used + 1), { expirationTtl: 3600 });

      const review = { id: crypto.randomUUID(), name, rating, text, date: new Date().toISOString().slice(0, 10) };
      await env.REVIEWS.put("list", JSON.stringify([review, ...(await list())].slice(0, MAX)));
      return json(review, 201);
    }

    // Remove a review: DELETE /api/reviews/<id> with "Authorization: Bearer <ADMIN_TOKEN>"
    if (request.method === "DELETE" && env.ADMIN_TOKEN && request.headers.get("Authorization") === "Bearer " + env.ADMIN_TOKEN) {
      const id = url.pathname.split("/")[3];
      await env.REVIEWS.put("list", JSON.stringify((await list()).filter((r) => r.id !== id)));
      return json({ ok: true });
    }

    return json({ error: "Not found." }, 404);
  },
};
