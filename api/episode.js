const { generate } = require('../lib/engine');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    res.status(200).json(await generate(body));
  } catch (e) { res.status(e.code || 500).json({ error: e.message }); }
};
