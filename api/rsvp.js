import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const EMAIL_RE = /^[^@\s]+@cck\.edu\.kw$/;

let ready;
function ensureTable() {
  ready ??= sql`
    CREATE TABLE IF NOT EXISTS rsvps (
      email     text PRIMARY KEY,
      name      text NOT NULL,
      attending text NOT NULL,
      plusone   text NOT NULL,
      ts        timestamptz NOT NULL DEFAULT now()
    )`;
  return ready;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    await ensureTable();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT email, name, attending, plusone, ts FROM rsvps ORDER BY ts DESC`;
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(
        rows.map(r => ({ ...r, ts: new Date(r.ts).toISOString() }))
      );
    }

    if (req.method === "POST") {
      const { name, email, attending, plusone } = req.body || {};
      if (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
        return res.status(400).json({ error: "Please provide your name." });
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 120)
        return res.status(400).json({ error: "Please use your CCK college email (@cck.edu.kw)." });
      if (attending !== "yes" && attending !== "no")
        return res.status(400).json({ error: "Attendance must be yes or no." });

      const cleanName = name.trim();
      const plus = attending === "yes" && plusone === "yes" ? "yes" : "no";

      await sql`
        INSERT INTO rsvps (email, name, attending, plusone, ts)
        VALUES (${cleanEmail}, ${cleanName}, ${attending}, ${plus}, now())
        ON CONFLICT (email) DO UPDATE
          SET name = EXCLUDED.name,
              attending = EXCLUDED.attending,
              plusone = EXCLUDED.plusone,
              ts = now()`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}
