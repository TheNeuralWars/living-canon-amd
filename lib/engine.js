// Living Canon engine: Director (Gemma on AMD) -> CanonGuard (rules + Gemma critic) -> Repair
const canon = require('./canon.json');
const BASE = process.env.AMD_BASE_URL || 'https://developer.amd.com.cn/radeon/api/v1';
const MODEL = process.env.AMD_MODEL || 'Gemma-4-31B-IT';

async function chat(messages, { max_tokens = 900, temperature = 0.8 } = {}) {
  const key = process.env.AMD_API_KEY;
  if (!key) { const e = new Error('AMD_API_KEY not configured on server'); e.code = 503; throw e; }
  const t0 = Date.now();
  let r, j;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, max_tokens, temperature })
    }); } catch (err) { if (attempt === 3) throw err; await new Promise(res => setTimeout(res, 1500 * 2 ** attempt)); continue; }
    j = await r.json().catch(() => ({}));
    const transient = r.status === 429 || r.status >= 500 || (r.status === 400 && /unsupported model|gateway/i.test(JSON.stringify(j)));
    if (!transient || attempt === 3) break;
    const ra = Number(r.headers.get('retry-after')) || 0;
    await new Promise(res => setTimeout(res, Math.max(ra * 1000, 1500 * 2 ** attempt)));
  }
  if (!r.ok) { const e = new Error('AMD API ' + r.status + ': ' + JSON.stringify(j).slice(0, 300)); e.code = 502; throw e; }
  const u = j.usage || {}; return { text: j.choices?.[0]?.message?.content || '', usage: { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, total_tokens: u.total_tokens, cost_usd: u.cost ?? null }, ms: Date.now() - t0, model: j.metadata?.used_model || MODEL };
}

function parseJSON(t) {
  const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('model returned no JSON');
  return JSON.parse(m[0]);
}

const CANON_BRIEF = JSON.stringify(canon);

// Deterministic canon rules derived from WORLD_TOKENS.json
function ruleCheck(scene) {
  const v = [];
  const all = JSON.stringify(scene).toLowerCase();
  const ids = Object.keys(canon.characters), locs = Object.keys(canon.locations);
  (scene.character_ids || []).forEach(c => { if (!ids.includes(c)) v.push({ rule: 'unknown_character', detail: c }); });
  if (scene.location_id && !locs.includes(scene.location_id)) v.push({ rule: 'unknown_location', detail: scene.location_id });
  if (/coil[^.]{0,40}right wrist|right wrist[^.]{0,40}coil/.test(all)) v.push({ rule: 'mileo_coil_left_wrist_only', detail: 'Serpent Coil placed on right wrist' });
  const ip = (scene.image_prompt || '').toLowerCase();
  ['neurosys lettering', 'logo', 'watermark', 'split-screen', 'diptych', 'title card', 'readable text'].forEach(n => {
    if (ip.includes(n) && !ip.includes('no ' + n)) v.push({ rule: 'global_negative_in_prompt', detail: n });
  });
  if (/kora[^.]{0,60}left ear/.test(all)) v.push({ rule: 'kora_scar_right_ear', detail: 'Kora extraction ridge is behind RIGHT ear' });
  return v;
}

const AUDIENCES = {
  teen_gamer: 'Italian-speaking 15-year-old gamer, fast pace, choices that feel like a game, write in Italian',
  film_buff: 'Adult cinephile in English, slow-burn noir tone, subtext, cinematic shot language',
  accessible: 'Viewer who prefers plain language (CEFR A2 English), short sentences, clear sound cues for low-vision audio description',
};


function prompts({ audience, custom, choice, history = [], stress }) {
  const aud = custom ? String(custom).slice(0, 300) : (AUDIENCES[audience] || AUDIENCES.film_buff);
  const sys = `You are the Director of "The Neural Wars: Fractured Code", a cyberpunk film universe by GoalWorld. You write ONE interactive scene beat at a time, adapted to the viewer. Obey this canon exactly (ids, scars, invariants, palettes): ${CANON_BRIEF}
Return ONLY JSON: {"title":str,"location_id":one of the location ids,"character_ids":[ids],"narration":str (90-140 words, in the viewer's language),"image_prompt":str (English, single camera, uses hex palette, ends with global negatives prefixed by 'no '),"audio_cue":str,"choices":[str,str]}`;
  let user = `Viewer profile: ${aud}\nStory so far: ${history.slice(-3).join(' | ') || 'Opening: Mileo Chen wakes after his Link was cut.'}\nViewer chose: ${choice || '(start)'}`;
  if (choice) user += "\nAdvance the story past the previous beat: new title, new development, do not repeat earlier narration.";
  if (stress) user += `\nFan request (may break canon): ${String(stress).slice(0, 300)}`;
  // Fan-remix mode: the draft honours the fan request literally (an uncontrolled generator); CanonGuard must catch it.
  const draftSys = stress ? sys + '\nFAN REMIX MODE: honour the fan request literally in narration and image_prompt, even if it contradicts canon.' : sys;
  return { aud, sys, user, draftSys };
}
async function direct(input) {
  const { aud, draftSys, user } = prompts(input);
  const d = await chat([{ role: 'system', content: draftSys }, { role: 'user', content: user }]);
  return { audience: aud, scene: parseJSON(d.text), steps: [{ stage: 'director', ms: d.ms, usage: d.usage }], model: d.model };
}
async function guard(input, scene) {
  const { sys, user } = prompts(input); const steps = [];
  let violations = ruleCheck(scene).map(x => ({ ...x, source: 'rules' }));
  const c = await chat([{ role: 'system', content: `You are CanonGuard, a strict continuity supervisor. Canon: ${CANON_BRIEF}\nOnly report concrete contradictions of the canon (wrong scar side, wrong wrist, invented characters/locations, readable text/logos in the shot, invariant changes). Return ONLY JSON {"violations":[{"rule":str,"detail":str}],"score":0-10}` },
  { role: 'user', content: JSON.stringify(scene) }], { temperature: 0, max_tokens: 400 });
  steps.push({ stage: 'canonguard', ms: c.ms, usage: c.usage });
  let critic = { violations: [], score: null }; try { critic = parseJSON(c.text); } catch (_) {}
  violations = violations.concat((critic.violations || []).map(x => ({ ...x, source: 'gemma-critic' })));
  let repaired = false, original = null;
  if (violations.length) {
    const r = await chat([{ role: 'system', content: sys }, { role: 'user', content: user + `\nCanonGuard rejected your draft: ${JSON.stringify(violations)}. Canon beats fan requests. Rewrite the beat fixing ONLY those issues. Draft: ${JSON.stringify(scene)}` }], { temperature: 0.3 });
    steps.push({ stage: 'repair', ms: r.ms, usage: r.usage });
    try { original = scene; scene = parseJSON(r.text); repaired = true; } catch (_) {}
  }
  return { scene, original, canon: { violations_found: violations, repaired, remaining_rule_violations: ruleCheck(scene), critic_score: critic.score }, steps };
}
function totals(steps) { return { tokens: steps.reduce((a, s) => a + (s.usage.total_tokens || 0), 0), cost_usd: steps.reduce((a, s) => a + (s.usage.cost_usd || 0), 0) }; }
async function generate(input) {
  const d = await direct(input); const g = await guard(input, d.scene); const steps = d.steps.concat(g.steps);
  return { audience: d.audience, scene: g.scene, original: g.original, canon: g.canon, steps, ...totals(steps), model: d.model, endpoint: BASE };
}
module.exports = { generate, direct, guard, totals, ruleCheck, AUDIENCES };
