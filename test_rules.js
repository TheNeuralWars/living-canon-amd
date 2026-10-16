const { ruleCheck } = require('./lib/engine');
const bad = { location_id: 'mars', character_ids: ['mileo_chen', 'batman'], narration: 'The serpent coil glows on his right wrist.', image_prompt: 'split-screen with NeuroSys lettering' };
const good = { location_id: 'tunnel_six', character_ids: ['kora_vega'], narration: 'Kora moves.', image_prompt: 'single camera, #FF8C00 steam, no logo, no readable text' };
const b = ruleCheck(bad), g = ruleCheck(good);
console.log(b); if (b.length < 4 || g.length) { console.error('FAIL', g); process.exit(1); } console.log('rules OK');
