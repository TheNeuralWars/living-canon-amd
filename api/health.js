module.exports = (req, res) => res.json({ ok: true, amd_key_configured: !!process.env.AMD_API_KEY, model: process.env.AMD_MODEL || 'Gemma-4-31B-IT' });
