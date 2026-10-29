// Corrections batch 1 (IRS_CORRECTION_ADS_BATCH_1.pdf): targeted edits on the approved Pro/Story ads
// via fal nano-banana-pro/edit. Writes <name>_<ver>_<ts>.png + .json next to the originals.
// Usage: FAL_KEY=... node corrections_batch1.js [key ...]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const H = { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' };
const KEEP = 'Edit this advertisement image. Keep EVERYTHING else identical: same photo, people, scene, composition, colors, lighting, logos, fonts, disclaimer line and all other text exactly as it is now. Only make this change:';
const SPELL = 'All Spanish text must be spelled exactly as written here, with correct accents and punctuation. Do not add any other text.';

const EDITS = {
  pro07: { src: 'irs-protect-plus_pro07_resuelto_1757602360.png', out: 'irs-protect-plus_pro07_resuelto_v2',
    note: 'Caso cerrado resaltado en recuadro azul con letras blancas en bold',
    edit: 'Replace the thin headline "Casocerrado." with "Caso cerrado." (two words with a normal space) set in bold white letters inside a solid deep navy-blue (#10193F) rounded rectangle box, centered in the same position. The two lines below it stay exactly the same.' },
  pro08: { src: 'irs-protect-plus_pro08_dos-cafes_1757602420.png', out: 'irs-protect-plus_pro08_dos-cafes_v2',
    note: 'Jerarquía: texto 1 igual, texto 2 más pequeño, texto 3 resalta $19.99',
    edit: 'Fix the text hierarchy. Line 1 "Menos que dos cafés al mes." stays exactly the same. Line 2 "Hasta $10,000 en representación ante el IRS." becomes noticeably smaller (about half its current size), still bold navy, on two lines. Line 3 becomes a highlighted price: "$19.99 al mes" in large bold navy-blue type, clearly the most eye-catching number, followed below by small grey text "Cancela cuando quieras."' },
  pro10: { src: 'irs-protect-plus_pro10_hero-equipo_1757602540.png', out: 'irs-protect-plus_pro10_hero-equipo_v2',
    note: 'Eliminar el reflejo del logo',
    edit: 'Remove the mirrored reflection that appears directly below the IRS Protect Plus logo (the faint upside-down "PLUS" reflection). Replace it with the plain dark navy background so the logo has no reflection at all.' },
  pro11: { src: 'irs-protect-plus_pro11_equipo-split_1757602600.png', out: 'irs-protect-plus_pro11_equipo-split_v2',
    note: 'Separar párrafos y hacer el segundo más pequeño',
    edit: 'Fix the text hierarchy on the left. Keep the headline "Detrás de cada membresía hay un equipo que da la cara por ti." as it is. Add clearly more vertical space between the headline and the second paragraph, and make the second paragraph "Revisión de avisos, respuestas al IRS y representación autorizada." noticeably smaller (about 65% of its current size), in grey.' },
  story02: { src: 'irs-protect-plus_story02_3am_v2_1757626500.png', out: 'irs-protect-plus_story02_3am_v3',
    note: 'Nuevo hook: la próxima carta, no la actual (la cobertura no es retroactiva)',
    edit: 'Replace the whole headline block at the top (the three headline lines and the blue line under them) with this new copy, same style and position: first line in light weight white "¿Otra noche en vela?", then a bold white headline on two lines "Que la próxima carta del IRS no te quite el sueño.", then one line in light blue "Protégete hoy y duerme tranquilo." Keep the grey price line "Desde $19.99 al mes · Hasta $10,000 en representación" below it unchanged.' },
  story05: { src: 'irs-protect-plus_story05_enviarnosla_1757625240.png', out: 'irs-protect-plus_story05_enviarnosla_v2',
    note: 'Párrafo azul reordenado, en recuadro y más pequeño',
    edit: 'Replace the large blue two-line paragraph "Foto, envío, y nuestro equipo se encarga del resto." with a smaller single callout: a rounded pill box filled with royal blue (#2648B5) containing white bold text "Envía una foto y nuestro equipo se encarga del resto." centered in the same area, about half the previous text size. The headline above and the grey price line below stay the same.' },
  story06: { src: 'irs-protect-plus_story06_le-respondemos_1757625300.png', out: 'irs-protect-plus_story06_le-respondemos_v2',
    note: 'Logo horizontal centrado arriba; precio al footer como botón',
    edit: 'Two changes. (1) Remove the stacked logo in the top-right corner and instead place a horizontal logo lockup centered at the top: the IRS Protect Plus shield logo on the left, a thin vertical divider, and the Best Vision Accounting logo (emblem plus script name) on the right, side by side, reproduced exactly from the existing logos. (2) Remove the grey line "Desde $19.99 al mes · Hasta $10,000 en representación" from under the headline and place it at the bottom of the image, just above the small disclaimer line, as an eye-catching button: a deep navy-blue (#10193F) rounded pill with white bold text "Desde $19.99 al mes · Hasta $10,000 en representación".' },
  story08: { src: 'irs-protect-plus_story08_no-paso-nada_1757625420.png', out: 'irs-protect-plus_story08_no-paso-nada_v2',
    note: 'Bajar el tamaño de los textos',
    edit: 'Reduce the size of all the text at the top by about 30%: "La carta llegó." , "Y no pasó nada." , "Porque esta vez no estabas solo." and the grey price line, keeping the same wording, fonts, colors, alignment and order, with more breathing room around them.' },
  story10: { src: 'irs-protect-plus_story10_en-espera_1757690060.png', out: 'irs-protect-plus_story10_en-espera_v2',
    note: 'Quitar "47 minutos" (cifra sin fuente)',
    edit: 'Replace the first headline line "Llevas 47 minutos" with "Llevas una eternidad" in the same light navy style, so the headline reads "Llevas una eternidad / en espera con el IRS." Everything else stays the same.' },
  story11: { src: 'irs-protect-plus_story11_cajon_1757690120.png', out: 'irs-protect-plus_story11_cajon_v2',
    note: 'Texto azul pequeño en blanco y bold',
    edit: 'Change the color of the line "Responderla bien, sí. Y eso lo hacemos nosotros." from light blue to pure white bold, same size and position.' },
  story12: { src: 'irs-protect-plus_story12_no-lo-cuentas_v2_1757694000.png', out: 'irs-protect-plus_story12_no-lo-cuentas_v3',
    note: 'Menos texto',
    edit: 'Reduce the amount of text. Keep only the headline "Todavía no se lo cuentas a nadie." with "Cuéntanoslo a nosotros." below it in bold (single normal space between words), and the small grey line "Desde $19.99 al mes · Hasta $10,000 en representación". Completely remove the two blue lines "Para eso estamos. Revisamos tu aviso con total confidencialidad." and fill that area with the background wall.' },
  story14: { src: 'irs-protect-plus_story14_experto_1757690300.png', out: 'irs-protect-plus_story14_experto_v2',
    note: 'Palabras de arriba lado a lado en recuadros redondeados',
    edit: 'Replace the three stacked words at the top "MULTAS. INTERESES. PLAZOS." with the same three words placed side by side on one single centered row, each inside its own rounded pill box with deep navy (#10193F) fill and white bold uppercase letters: "MULTAS" "INTERESES" "PLAZOS".' },
  story06b: { src: 'irs-protect-plus_story06_le-respondemos_v2_1793287130.png', out: 'irs-protect-plus_story06_le-respondemos_v3',
    note: 'Precio como botón en el footer (debajo del equipo)',
    edit: 'Move the navy pill button "Desde $19.99 al mes · Hasta $10,000 en representación" from its current position above the team down to the footer at the very bottom of the image: place it centered below the team photo, directly above the small disclaimer line. To make room, scale the team photo slightly smaller and move it up a little, closing the gap left by the button. Keep the team people identical.' },
  story08b: { src: 'irs-protect-plus_story08_no-paso-nada_1757625420.png', out: 'irs-protect-plus_story08_no-paso-nada_v3',
    note: 'Textos más pequeños',
    edit: 'Make all the text at the top clearly smaller: scale the whole top text block ("La carta llegó.", "Y no pasó nada.", "Porque esta vez no estabas solo." and the grey price line) down to about 60% of its current size, keeping it left-aligned at the top-left with the same fonts, colors, wording and order, leaving much more empty sky around it.' },
  story12b: { src: 'irs-protect-plus_story12_no-lo-cuentas_v3_1793287131.png', out: 'irs-protect-plus_story12_no-lo-cuentas_v4',
    note: 'Corregir espacio doble en "Cuéntanoslo a nosotros"',
    edit: 'Fix the spacing in the bold line so it reads "Cuéntanoslo a nosotros." with exactly one normal word space between "Cuéntanoslo" and "a", centered as before.' },
};

async function run(key) {
  const e = EDITS[key];
  const ts = Math.floor(Date.now() / 1000);
  const jpg = path.join(DIR, `.tmp_${key}.jpg`);
  execFileSync('python3', ['-c', `from PIL import Image;Image.open(${JSON.stringify(path.join(DIR, e.src))}).convert('RGB').save(${JSON.stringify(jpg)},quality=95)`]);
  const uri = 'data:image/jpeg;base64,' + fs.readFileSync(jpg).toString('base64');
  fs.unlinkSync(jpg);
  const prompt = `${KEEP} ${e.edit} ${SPELL}`;
  const r = await fetch('https://queue.fal.run/fal-ai/nano-banana-pro/edit', { method: 'POST', headers: H,
    body: JSON.stringify({ prompt, image_urls: [uri], num_images: 1, aspect_ratio: '4:5', resolution: '2K', output_format: 'png' }) });
  if (!r.ok) return `${key} submit ${r.status} ${await r.text()}`;
  const j = await r.json();
  for (let i = 0; i < 200; i++) {
    const s = await (await fetch(j.status_url, { headers: H })).json();
    if (s.status === 'COMPLETED') break;
    await new Promise(res => setTimeout(res, 4000));
  }
  const res = await (await fetch(j.response_url, { headers: H })).json();
  if (!res.images) return `${key} fail ${JSON.stringify(res).slice(0, 300)}`;
  const base = `${e.out}_${ts}`;
  fs.writeFileSync(path.join(DIR, `${base}.png`), Buffer.from(await (await fetch(res.images[0].url)).arrayBuffer()));
  fs.writeFileSync(path.join(DIR, `${base}.json`), JSON.stringify({
    model: 'fal-ai/nano-banana-pro/edit', provider: 'fal', concept: `Corrección batch 1 — ${e.note}`,
    source: e.src, prompt, params: { aspect_ratio: '4:5', resolution: '2K' }, project: 'irs-protect-plus',
    created: new Date(ts * 1000).toISOString() }, null, 2) + '\n');
  return `${key} ok ${base}.png`;
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(EDITS);
Promise.all(keys.map(k => run(k).catch(err => `${k} error ${err.message}`))).then(r => console.log(r.join('\n')));
