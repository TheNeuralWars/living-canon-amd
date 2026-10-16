const { direct, guard } = require('../lib/engine');
// Split into two short calls so each serverless invocation stays well under timeouts:
// POST {stage:'direct', ...input} -> draft scene ; POST {stage:'guard', scene, ...input} -> checked/repaired scene
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    res.status(200).json(b.stage === 'guard' ? await guard(b, b.scene) : await direct(b));
  } catch (e) { res.status(e.code || 500).json({ error: e.message }); }
};
