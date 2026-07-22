const JOKE_API = 'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&format=json';
const DEFAULT_TTL = parseInt(process.env.JOKE_CACHE_TTL || '300', 10); // seconds

// Simple in-memory cache. In serverless environments this persists only while the instance is warm.
if (!global.__joke_cache) global.__joke_cache = { data: null, expires: 0 };

export default async function handler(req, res) {
  const now = Date.now();
  const ttl = DEFAULT_TTL * 1000;

  if (global.__joke_cache.data && global.__joke_cache.expires > now) {
    res.setHeader('x-cache', 'HIT');
    res.setHeader('Cache-Control', `public, max-age=${DEFAULT_TTL}`);
    return res.status(200).json(global.__joke_cache.data);
  }

  try {
    const r = await fetch(JOKE_API, { cache: 'no-store' });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'Upstream error', status: r.status, body: text });
    }
    const data = await r.json();

    // store in cache
    global.__joke_cache.data = data;
    global.__joke_cache.expires = Date.now() + ttl;

    res.setHeader('x-cache', 'MISS');
    res.setHeader('Cache-Control', `public, max-age=${DEFAULT_TTL}`);
    return res.status(200).json(data);
  } catch (err) {
    console.error('joke proxy error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
