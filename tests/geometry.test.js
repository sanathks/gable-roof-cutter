// Checks the app's numbers with independent geometry: distances and angles are measured on the
// shapes the code produces, never re-derived with the app's own formulas.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./load');

const EPS = 1e-6;
const near = (a, b, msg, tol = EPS) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = r => r * 180 / Math.PI;
const setup = (over = {}) => { const p = R.sane(Object.assign({}, R.DEF, over)); return { p, g: R.compute(p) }; };
// point on the line through A and B at a given x
const atX = (A, B, x) => [x, A[1] + (B[1] - A[1]) * (x - A[0]) / (B[0] - A[0])];
// perpendicular distance from point P to the line through A and B
const lineDist = (P, A, B) => Math.abs((B[0] - A[0]) * (A[1] - P[1]) - (A[0] - P[0]) * (B[1] - A[1])) / dist(A, B);
const shoelace = pts => Math.abs(pts.reduce((s, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return s + x * v - u * y; }, 0)) / 2;

function checkRafter(p, g) {
  const P = g.prof;
  const ridgeTop = P[0], tailTop = P[1], tailBot = P[2], heelBot = P[3], heelTop = P[4], seatEnd = P[5];
  const plateInner = p.W / 2, plateOuter = p.W / 2 + p.b, plateTop = p.H + p.bh;

  // roof slope and rafter size
  near(deg(Math.atan2(ridgeTop[1] - tailTop[1], tailTop[0] - ridgeTop[0])), p.pitch, 'top edge slope equals the pitch');
  near(dist(ridgeTop, tailTop), g.rafterLen, 'rafter length is the measured top edge');
  near(lineDist(tailBot, ridgeTop, tailTop), p.rd, 'rafter depth square to the top edge');
  near(deg(Math.atan2(heelBot[1] - tailBot[1], tailBot[0] - heelBot[0])), p.pitch, 'bottom edge parallel to top edge');
  near(ridgeTop[0], 0, 'ridge cut on the centre line');
  near(tailTop[0], tailBot[0], 'tail cut is plumb');
  near(tailTop[0] - plateOuter, p.Oe, 'eaves overhang measured level from the beam');
  near(ridgeTop[1], g.ridgeTop, 'ridge height is the top of the rafter');

  // birdsmouth on the eaves beam
  near(heelBot[0], plateOuter, 'heel on the outside face of the eaves beam');
  near(heelTop[0], plateOuter, 'heel is plumb');
  near(heelTop[1], plateTop, 'seat sits on top of the eaves beam');
  near(heelTop[1] - heelBot[1], p.hb, 'heel depth');
  near(seatEnd[1], heelTop[1], 'seat is level');
  near(heelTop[0] - seatEnd[0], g.seat, 'seat length');
  if (seatEnd[0] < plateInner - EPS)
    assert.ok(R.warnings(g, p).some(([, t]) => t.includes('birdsmouth seat')), 'seat runs past the beam and the app does not warn');
  near(lineDist(seatEnd, tailBot, heelBot), 0, 'seat ends on the bottom edge', 1e-6);
  const markHeel = atX(ridgeTop, tailTop, plateOuter);
  near(dist(ridgeTop, markHeel), g.heel, 'birdsmouth mark along the top edge');
  near(markHeel[1] - heelTop[1], g.hap, 'measure-down on the plumb line');

  // ridge notch on the ridge beam
  if (p.hr > 0) {
    const rBot = P[6], rTop = P[7], rEnd = P[8], rw2 = p.ridgeW / 2;
    near(rBot[0], rw2, 'ridge notch heel on the side of the ridge beam');
    near(rTop[0], rw2, 'ridge notch heel is plumb');
    near(rTop[1] - rBot[1], p.hr, 'ridge notch depth');
    near(rTop[1], g.zR, 'ridge notch seat on top of the ridge beam');
    near(rEnd[1], rTop[1], 'ridge notch seat is level');
    near(rTop[0] - rEnd[0], g.rSeat, 'ridge notch seat length');
    const markR = atX(ridgeTop, tailTop, rw2);
    near(dist(ridgeTop, markR), g.rHeel, 'ridge notch mark along the top edge');
    near(markR[1] - rTop[1], g.rHap, 'ridge notch measure-down');
    near(g.zR - p.ridgeH - plateTop, g.kp, 'ridge post fills the gap from cross beam to ridge beam');
  }
  // the rafter never cuts into a beam: no outline point over a beam lies below that beam's top
  P.forEach(([x, y]) => {
    if (x > plateInner + EPS && x < plateOuter - EPS) assert.ok(y >= plateTop - EPS, `rafter enters the eaves beam at x=${x}`);
    if (x < p.ridgeW / 2 - EPS) assert.ok(y >= g.zR - EPS, `rafter enters the ridge beam at x=${x}`);
  });
  assert.ok(ridgeTop[1] > P[P.length - 1][1], 'the two rafters meet at the ridge');
}

function checkBrace(p, g) {
  const [O1, O2, I2, I1] = R.printProfiles(g, p).brace;     // post long point, beam long point, beam short, post short
  near(O1[0], 0, 'brace long point on the post face'); near(I1[0], 0, 'brace short point on the post face');
  near(O2[1], 0, 'brace long point under the beam'); near(I2[1], 0, 'brace short point under the beam');
  near(-O1[1], p.bDrop, 'brace drop down the post');
  near(deg(Math.atan2(O2[0] - O1[0], O2[1] - O1[1])), p.bAng, 'brace angle from the post');
  near(dist(O1, O2), g.bL, 'brace long edge');
  near(dist(I1, I2), g.bS, 'brace short edge');
  near(lineDist(I1, O1, O2), p.be, 'brace depth'); near(lineDist(I2, O1, O2), p.be, 'brace edges parallel');
  near(O2[0], g.bc, 'brace reach along the beam');
}

function checkLayout(p, g) {
  const zs = g.raf.map(r => r.z);
  zs.forEach(z => assert.ok(zs.some(w => Math.abs(w + z) < EPS), `rafters not symmetric at ${z}`));
  const frames = g.raf.filter(r => r.f).map(r => Math.abs(r.z));
  frames.forEach(z => near(z, p.Lc / 2 + p.b / 2, 'frame rafter over the post centre'));
  for (let i = 1; i < g.raf.length; i++) {
    const a = g.raf[i - 1], b = g.raf[i], wa = a.f ? p.rtf : p.rt, wb = b.f ? p.rtf : p.rt;
    assert.ok(b.z - a.z <= p.maxSp + EPS, `rafters ${(b.z - a.z).toFixed(1)} apart, more than ${p.maxSp}`);
    assert.ok((b.z - wb / 2) - (a.z + wa / 2) > 0, 'rafters overlap');
  }
  const sticksOut = g.raf.some(r => Math.abs(r.z) + (r.f ? p.rtf : p.rt) / 2 > g.Lt / 2 + EPS);
  if (sticksOut) assert.ok(R.warnings(g, p).some(([, t]) => t.includes('stick out past the end')), 'rafter sticks out past the roof end and the app does not warn');
  // eaves beam notches line up with the posts
  const postEdgeFromEnd = g.Lt / 2 - (p.Lc / 2 + p.b);
  near(postEdgeFromEnd, p.Og, 'eaves beam notch starts where the post starts');
  near(g.Lt, p.Lc + 2 * p.b + 2 * p.Og, 'roof length');
}

function checkCutList(p, g) {
  const L = R.parts(g, p), get = id => L.find(r => r.id === id);
  near(get('posts').len, p.H + p.jd + p.embed, 'post length includes the stub'); assert.equal(get('posts').qty, 4);
  near(get('plates').len, g.Lt, 'eaves beam length'); near(get('ridge').len, g.Lt, 'ridge beam length');
  near(get('ties').len - 2 * p.jc, p.W, 'cross beam spans the clear width plus a tongue into each post');
  const rafters = L.filter(r => r.id === 'rafC' || r.id === 'rafF');
  assert.equal(rafters.reduce((s, r) => s + r.qty, 0), 2 * g.raf.length, 'one rafter each side per position');
  rafters.forEach(r => near(r.len, dist(g.prof[0], g.prof[1]), 'rafter cut length'));
  if (g.kp > 0) near(get('king').len, g.kp, 'ridge post length');
}

function closedSolid(tris) {
  const key = v => v.map(n => n.toFixed(5)).join(',');
  const edges = new Map();
  tris.forEach(t => { for (let i = 0; i < 3; i++) { const e = key(t[i]) + '|' + key(t[(i + 1) % 3]); edges.set(e, (edges.get(e) || 0) + 1); } });
  let open = 0;
  edges.forEach((n, e) => { const [a, b] = e.split('|'); if (n !== 1 || edges.get(b + '|' + a) !== 1) open++; });
  return open;
}
const volume = tris => tris.reduce((s, [a, b, c]) => s + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, 0);

test('ridge height matches the original drawing (3801.6 mm) only with the 2080 clear width', () => {
  const { g } = setup({ hr: 0 });
  near(g.ridgeTop, 3801.6, 'ridge height with 2080 clear width', 1);
  const { g: g2 } = setup();
  near(g2.ridgeTop, g.ridgeTop, 'the ridge notch does not change the roof height');
  const { g: g3 } = setup({ W: 2100 });
  assert.ok(Math.abs(g3.ridgeTop - 3801.6) > 5, 'a 2100 clear width would not match the drawing');
  console.log('ridge height: 2080 wide ->', g.ridgeTop.toFixed(2), ' 2100 wide ->', g3.ridgeTop.toFixed(2), ' drawing: 3801.6');
});

test('rafter, birdsmouth and ridge notch geometry (starting sizes)', () => { const { p, g } = setup(); checkRafter(p, g); });
test('brace geometry (starting sizes)', () => { const { p, g } = setup(); checkBrace(p, g); });
test('rafter layout and beam notches (starting sizes)', () => { const { p, g } = setup(); checkLayout(p, g); });
test('cut list (starting sizes)', () => { const { p, g } = setup(); checkCutList(p, g); });

test('values quoted in the chat match the code', () => {
  const { p, g } = setup();
  const quoted = {
    'ridge height': [g.ridgeTop, 3802], 'rafter length': [g.rafterLen, 2102],
    'birdsmouth mark': [g.heel, 1514], 'birdsmouth measure-down': [g.hap, 109], 'birdsmouth seat': [g.seat, 57],
    'ridge notch mark': [g.rHeel, 78], 'ridge notch measure-down': [g.rHap, 107], 'ridge notch seat': [g.rSeat, 60],
    'brace long': [g.bL, 615], 'brace short': [g.bS, 375], 'brace reach': [g.bc, 435],
    'square tongue (x10)': [120 * g.tn, 101], 'rise per 1000': [1000 * g.tn, 839],
    'roof outline width': [2 * g.runX, 3220], 'roof length': [g.Lt, 3140],
  };
  const rows = Object.entries(quoted).map(([k, [v, q]]) => ({ value: k, code: +v.toFixed(2), quoted: q, ok: Math.round(v) === q }));
  console.table(rows);
  rows.forEach(r => assert.ok(r.ok, `${r.value}: code gives ${r.code}, chat said ${r.quoted}`));
  const kit = R.printKit(g, p, 20, 220), model = R.printModel(g, p, 20);
  assert.equal(kit.pieces, 31);
  assert.deepEqual(model.size.map(Math.round), [161, 157, 190]);
});

test('STL kit and model are closed solids with the right volume and size', () => {
  const { p, g } = setup();
  for (const scale of [10, 20, 50]) {
    const kit = R.printKit(g, p, scale, 220), model = R.printModel(g, p, scale);
    assert.equal(closedSolid(kit.tris), 0, `kit 1:${scale} has open edges`);
    // independent volume: each piece's outline area times thickness, from the profiles
    const pr = R.printProfiles(g, p), k3 = Math.pow(1 / scale, 3);
    const nRaf = g.raf.reduce((s, r) => s + 2 * (r.f ? p.rtf : p.rt), 0);
    let v = 4 * shoelace(R.postProfile(p, true)) * p.b + 2 * shoelace(pr.plate) * p.b + 2 * shoelace(pr.tie) * p.b
      + 2 * p.b * p.b * g.kp + g.Lt * p.ridgeH * p.ridgeW + shoelace(g.prof) * nRaf
      + ((p.braceT ? 4 : 0) + (p.braceL ? 4 : 0)) * shoelace(pr.brace) * p.bt;
    near(volume(kit.tris), v * k3, `kit 1:${scale} volume`, v * k3 * 1e-6);
    near(volume(model.tris) - (p.embed * 4 * p.b * p.b) * k3, v * k3 - (p.embed * 4 * p.b * p.b) * k3, `model 1:${scale} volume`, v * k3 * 1e-6);
    near(model.size[0], 2 * g.runX / scale, 'model width', 1e-6);
    near(model.size[1], g.Lt / scale, 'model length', 1e-6);
    near(model.size[2], g.ridgeTop / scale, 'model height', 1e-6);
    kit.tris.forEach(t => t.forEach(([x, y]) => assert.ok(x <= 220 + EPS || kit.size[0] > 220, 'piece past the bed width')));
    const buf = new DataView(R.stlBinary(kit.tris, 'kit'));
    assert.equal(buf.getUint32(80, true), kit.tris.length, 'STL triangle count');
    assert.equal(buf.byteLength, 84 + 50 * kit.tris.length, 'STL file size');
  }
});

test('400 random roofs keep every rule', () => {
  let seed = 12345; const rnd = (a, b) => { seed = (seed * 1103515245 + 12345) % 2147483648; return a + (b - a) * seed / 2147483648; };
  for (let i = 0; i < 400; i++) {
    const b = Math.round(rnd(80, 200)), rd = Math.round(rnd(90, 250)), pitch = rnd(15, 55);
    const over = {
      W: rnd(1500, 5000), Lc: rnd(1500, 5000), H: rnd(2000, 3200), b, bh: Math.round(rnd(100, 240)), embed: rnd(0, 600),
      pitch, Oe: rnd(0, 800), Og: rnd(0, 700), ridgeW: rnd(60, 160), ridgeH: rnd(100, 250),
      rt: rnd(40, 100), rd, rtf: rnd(40, 160), maxSp: rnd(300, 1000), hb: rnd(10, rd / 3), hr: i % 3 ? rnd(0, rd / 3) : 0,
      bAng: rnd(30, 60), bDrop: rnd(300, 900), be: rnd(60, 140), bt: rnd(60, 140), braceT: i % 2 === 0, braceL: i % 4 !== 1,
    };
    const { p, g } = setup(over);
    try {
      checkRafter(p, g); checkLayout(p, g); checkCutList(p, g);
      if (g.bk > 0) checkBrace(p, g);
      if (i % 20 === 0 && g.kp > 0) assert.equal(closedSolid(R.printKit(g, p, 20, 220).tris), 0, 'kit has open edges');
    } catch (e) { e.message = `random roof #${i} ${JSON.stringify(over)}\n${e.message}`; throw e; }
  }
});

// reads the angle labels out of a drawing, in the order they are drawn
const anglesIn = svg => [...svg.matchAll(/class="angt"[^>]*>([\d.]+)°</g)].map(m => +m[1]);
function checkDrawnAngles(p, g) {
  const [full, eaves, ridge] = R.rafterSVGs(g, p, 360);
  const cut = 90 - p.pitch, r1 = v => Math.round(v * 10) / 10;
  assert.deepEqual(anglesIn(full), [r1(cut), r1(cut)], 'ridge and tail cut angles on the whole rafter');
  assert.deepEqual(anglesIn(eaves), [90, r1(cut), r1(p.pitch)], 'birdsmouth corners: square, plumb line, seat');
  if (p.hr > 0) {
    const toRidgeCut = g.prof.length <= 9;      // seat runs all the way to the ridge cut
    assert.deepEqual(anglesIn(ridge), [r1(cut), 90, r1(cut), toRidgeCut ? 90 : r1(p.pitch)], 'ridge notch corners');
  } else assert.equal(ridge, null);
  const brace = R.braceSVG(g, p, 360);
  assert.deepEqual(anglesIn(brace), [r1(p.bAng), r1(90 - p.bAng)], 'brace end angles');
}
test('angles drawn on the blueprints are measured from the shapes and match the cuts', () => {
  const { p, g } = setup();
  checkDrawnAngles(p, g);
  console.log('starting sizes:', 'rafter', anglesIn(R.rafterSVGs(g, p, 360)[0]), 'birdsmouth', anglesIn(R.rafterSVGs(g, p, 360)[1]),
    'ridge notch', anglesIn(R.rafterSVGs(g, p, 360)[2]), 'brace', anglesIn(R.braceSVG(g, p, 360)));
  for (const over of [{ pitch: 25 }, { pitch: 52.5, bAng: 35 }, { hr: 80 }, { hr: 0 }, { pitch: 30, hr: 20, bAng: 60 }])
    { const s = setup(over); checkDrawnAngles(s.p, s.g); }
});

test('mm, cm and inch display read back to the true length', () => {
  // reads a displayed value back into mm: "2,102", "210.2", "82 3/4", "3/8"
  const back = (txt, u) => {
    const t = txt.replace(/,/g, '');
    if (u === 'in') { const m = t.match(/^(-?)(?:(\d+) )?(?:(\d+)\/(\d+))?$|^(-?)(\d+)$/);
      if (!m) throw new Error('bad inch text ' + txt);
      const v = m[6] !== undefined ? +m[6] : (+(m[2] || 0) + (m[3] ? m[3] / m[4] : 0));
      return v * 25.4 * ((m[1] || m[5]) === '-' ? -1 : 1); }
    return +t * (u === 'cm' ? 10 : 1);
  };
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const vals = [0, 1, 12.7, 25.4, 2101.71, 1514.27, 108.65, 3802.004, 615.18].concat(Array.from({ length: 300 }, () => rnd() * 6000));
  for (const u of ['mm', 'cm', 'in']) {
    R.setUnit(u);
    assert.equal(R.UL(), u);
    for (const v of vals) {
      const err = Math.abs(back(R.f0(v), u) - v), tol = { mm: 0.5, cm: 0.5, in: 25.4 / 32 }[u] + 1e-9;
      assert.ok(err <= tol, `${v} mm shown as "${R.f0(v)} ${u}" is off by ${err.toFixed(3)} mm`);
    }
  }
  R.setUnit('in');
  console.log('rafter', R.f0(2101.71), 'in | birdsmouth mark', R.f0(1514.27), 'in | measure-down', R.f0(108.65), 'in');
  R.setUnit('cm');
  console.log('rafter', R.f0(2101.71), 'cm | birdsmouth mark', R.f0(1514.27), 'cm | measure-down', R.f0(108.65), 'cm');
  R.setUnit('mm');
});

test('post-top joint: stub and tongue fill the U-cut exactly, nothing overlaps, beam tops flush', () => {
  const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const over of [{}, { b: 150, bh: 200, jd: 80, jc: 50 }, { Og: 250 }, { W: 4000, Lc: 3000, jd: 40, jc: 90 }]) {
    const { p, g } = setup(over), pr = R.printProfiles(g, p), post = R.postProfile(p, false);
    const fz = g.frameZ, x0 = p.W / 2, H = p.H;
    // the three pieces at the front-right post, as solids in the world (mm)
    const inPost = ([x, y, z]) => Math.abs(z - fz) < p.b / 2 && inPoly([x - x0, y], post);
    const inPlate = ([x, y, z]) => x > x0 && x < x0 + p.b && inPoly([z + g.Lt / 2, y - H], pr.plate);
    const inTie = ([x, y, z]) => Math.abs(z - fz) < p.b / 2 && inPoly([x + pr.T / 2, y - H], pr.tie);
    const n = 28; let overlaps = 0, holes = 0, inside = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      // sample a box around the joint, off the grid lines so points never sit exactly on a face
      const x = x0 - 150 + (p.b + 300) * (i + 0.37) / n, y = H - 100 + (p.bh + 200) * (j + 0.41) / n, z = fz - p.b / 2 - 100 + (p.b + 200) * (k + 0.43) / n;
      const hits = [inPost, inPlate, inTie].filter(f => f([x, y, z])).length;
      if (hits > 1) overlaps++;
      const inUcut = x > x0 && x < x0 + p.b && Math.abs(z - fz) < p.b / 2 && y > H && y < H + p.jd;
      if (inUcut) { inside++; if (hits !== 1) holes++; }
    }
    assert.equal(overlaps, 0, 'no point is inside two pieces');
    assert.ok(inside > 50, 'sampled inside the U-cut'); assert.equal(holes, 0, 'the U-cut is filled by the stub and the tongue, no gaps');
    near(Math.max(...pr.tie.map(q => q[1])), p.bh, 'cross beam top flush with eaves beam top');
    near(pr.T - 2 * p.jc, p.W, 'cross beam full-height part fits between the eaves beams');
    const postFromEnd = g.Lt / 2 - g.frameZ - p.b / 2, notchStart = pr.plate[1][0];
    near(notchStart, postFromEnd, 'U-cut sits over the post');
  }
});

test('switching the ridge notch off: no notch, rafters rest on the ridge beam, roof height unchanged', () => {
  const on = setup(), off = setup({ ridgeNotch: false });
  assert.equal(off.p.hr, 0, 'notch depth is zero when switched off');
  assert.equal(off.g.prof.length, 7, 'rafter outline has no ridge notch corners');
  near(off.g.ridgeTop, on.g.ridgeTop, 'roof height does not change');
  near(off.g.zR, off.g.zU(off.p.ridgeW / 2), 'ridge beam top touches the rafter underside at its edges');
  near(on.g.kp - off.g.kp, on.p.hr, 'ridge posts get shorter by the notch depth');
  checkRafter(off.p, off.g); checkDrawnAngles(off.p, off.g);
  assert.equal(R.rafterSVGs(off.g, off.p, 360)[2], null, 'no ridge notch close-up');
  assert.ok(!R.parts(off.g, off.p).find(r => r.id === 'rafC').note.includes('ridge notch'), 'cut list does not mention a ridge notch');
  assert.equal(R.sane(Object.assign({}, R.DEF, { ridgeNotch: false })).hr, 0);
  assert.equal(R.sane(Object.assign({}, R.DEF, { ridgeNotch: true })).hr, R.DEF.hr, 'depth comes back when switched on');
  const kit = R.printKit(off.g, off.p, 20, 220);
  assert.equal(closedSolid(kit.tris), 0, 'kit without ridge notch is still closed');
});

test('roof triangle: run, rise and rafter line obey Pythagoras and add up to the ridge height', () => {
  for (const over of [{}, { pitch: 25 }, { pitch: 52, Oe: 600 }, { ridgeNotch: false }, { W: 3600, b: 150 }]) {
    const { p, g } = setup(over), t = R.triangleFacts(g, p);
    const top = g.prof[0], tail = g.prof[1];
    const atHeel = atX(top, tail, p.W / 2 + p.b);                       // top edge above the outside of the eaves beam
    near(t.run, top[0] === 0 ? atHeel[0] : NaN, 'run is the level distance from the beam face to the centre line');
    near(t.rise, top[1] - atHeel[1], 'rise is measured on the rafter top edge');
    near(t.line, dist(top, atHeel), 'rafter line is the measured top edge between the two plumb lines');
    near(t.line * t.line, t.run * t.run + t.rise * t.rise, 'Pythagoras', 1e-6 * t.line * t.line);
    near(t.line, g.heel, 'rafter line equals the birdsmouth mark');
    near(t.lineAll, g.rafterLen, 'with the overhang the triangle gives the full rafter length');
    near(t.pitch, p.pitch, 'pitch angle from rise and run');
    near(t.inTwelve, 12 * Math.tan(p.pitch * Math.PI / 180), 'rise in 12');
    near(t.beamTop + t.measureDown + t.rise, g.ridgeTop, 'beam top + measure-down + rise = ridge height');
    assert.deepEqual(anglesIn(R.triangleSVG(g, p, 600)), [Math.round(p.pitch * 10) / 10, 90], 'pitch arc and square corner drawn');
  }
  const { p, g } = setup(), t = R.triangleFacts(g, p);
  console.log('run', t.run.toFixed(1), 'rise', t.rise.toFixed(1), 'line', t.line.toFixed(1), '| with overhang', t.runAll.toFixed(1), t.riseAll.toFixed(1), t.lineAll.toFixed(1),
    '| ridge', t.beamTop.toFixed(1), '+', t.measureDown.toFixed(1), '+', t.rise.toFixed(1), '=', t.ridge.toFixed(1));
});

test('tapping a size highlights a line in the model exactly that long, or an arc of exactly that angle', () => {
  const lengths = ['W', 'Lc', 'H', 'b', 'bh', 'jd', 'jc', 'embed', 'Oe', 'Og', 'ridgeW', 'ridgeH', 'rt', 'rtf', 'rd', 'hb', 'hr', 'bDrop', 'be', 'bt'];
  const len3 = ([A, B]) => Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  for (const over of [{}, { embed: 400, pitch: 30 }, { rtf: 90, bAng: 35, ridgeNotch: false }]) {
    const { p, g } = setup(over);
    lengths.forEach(k => {
      const a = R.annoFor(k, g, p);
      assert.ok(a, `no highlight for ${k}`);
      if (p[k] > 0) near(len3(a.main), p[k], `${k} line length`, 1e-6);
      else assert.equal(a.main, null, `${k} is 0, so no line`);
    });
    const arcDeg = a => Math.abs(a.arc.a1 - a.arc.a0) * 180 / Math.PI;
    near(arcDeg(R.annoFor('pitch', g, p)), p.pitch, 'pitch arc');
    near(arcDeg(R.annoFor('bAng', g, p)), p.bAng, 'brace angle arc');
    const sp = R.annoFor('maxSp', g, p);
    near(len3(sp.main), sp.actual, 'spacing line is the actual spacing');
    assert.ok(sp.actual <= p.maxSp + 1e-9, 'actual spacing within the maximum');
    // the lines sit on the real pieces
    const hb = R.annoFor('hb', g, p).main;
    near(hb[1][1], p.H + p.bh, 'birdsmouth line ends on top of the eaves beam'); near(hb[0][1], g.prof[3][1], 'and starts at the heel');
    const rd = R.annoFor('rd', g, p).main;
    near(lineDist([rd[1][0], rd[1][1]], g.prof[2], g.prof[3]), 0, 'rafter depth line ends on the bottom edge', 1e-6);
    const oe = R.annoFor('Oe', g, p).main;
    near(oe[0][0], p.W / 2 + p.b, 'overhang starts at the eaves beam face'); near(oe[1][0], g.prof[1][0], 'and ends at the tail');
    const og = R.annoFor('Og', g, p).main;
    near(og[0][2], p.Lc / 2 + p.b, 'gable overhang starts at the post face'); near(og[1][2], g.Lt / 2, 'and ends at the roof end');
    const pv = R.annoFor('pitch', g, p).arc.V;
    near(pv[1], g.zT(g.xo), 'pitch arc sits on the rafter top edge above the beam');
  }
});

test('rafter layout marks: edges, gaps and centres match the rafters in the model', () => {
  for (const over of [{}, { maxSp: 500 }, { Og: 0 }, { rtf: 60 }, { Lc: 3600, rt: 75 }]) {
    const { p, g } = setup(over), rows = R.rafterLayout(g, p);
    assert.equal(rows.length, g.raf.length, 'one row per rafter position');
    rows.forEach((r, i) => {
      const raf = g.raf[i], w = raf.f ? p.rtf : p.rt;
      near(r.right - r.left, w, 'edge marks are one rafter width apart');
      near(r.centre, raf.z + g.Lt / 2, 'centre measured from the left end');
      assert.ok(r.left >= -1e-9 && r.right <= g.Lt + 1e-9, 'marks stay on the beam');
      if (r.gap != null) {
        near(r.gap, rows[i + 1].left - r.right, 'gap is the clear space to the next rafter');
        assert.ok(r.gap > 0, 'rafters do not overlap');
        assert.ok(r.toNext <= p.maxSp + 1e-9, 'centres within the max spacing');
      }
      const mirror = rows[rows.length - 1 - i];
      near(r.left, g.Lt - mirror.right, 'layout is the same from either end');
    });
    rows.filter(r => r.over).forEach(r => near(Math.min(Math.abs(r.centre - (g.Lt / 2 - g.frameZ)), Math.abs(r.centre - (g.Lt / 2 + g.frameZ))), 0, 'rafters over the posts are centred on the posts'));
    // the drawing labels the same left-edge marks
    const labels = [...R.layoutSVG(g, p, 700).matchAll(/class="c"[^>]*>([\d,.]+)</g)].map(m => +m[1].replace(/,/g, ''));
    assert.deepEqual(labels, rows.map(r => Math.round(r.left)), 'plan view shows the left-edge marks');
  }
  const { p, g } = setup();
  console.table(R.rafterLayout(g, p).map(r => ({ n: r.n, over: r.over, left: +r.left.toFixed(1), centre: +r.centre.toFixed(1), right: +r.right.toFixed(1), gap: r.gap == null ? null : +r.gap.toFixed(1) })));
});

test('assembly fit: every piece rests exactly on the piece under it (400 random roofs and the starting roof)', () => {
  let seed = 99; const rnd = (a, b) => { seed = (seed * 1103515245 + 12345) % 2147483648; return a + (b - a) * seed / 2147483648; };
  const cases = [{}].concat(Array.from({ length: 400 }, () => {
    const rd = rnd(90, 250);
    return { W: rnd(1500, 5000), Lc: rnd(1500, 5000), H: rnd(2000, 3200), b: rnd(80, 200), bh: rnd(100, 240), pitch: rnd(15, 55),
      Oe: rnd(0, 800), Og: rnd(100, 700), ridgeW: rnd(60, 160), ridgeH: rnd(100, 250), rt: rnd(40, 100), rd, rtf: rnd(40, 160),
      hb: rnd(10, rd / 3), hr: rnd(0, rd / 3), ridgeNotch: rnd(0, 1) > 0.3 };
  }));
  let worst = 0;
  for (const over of cases) {
    const { p, g } = setup(over);
    if (g.kp <= 0) continue;                       // the app warns about this case
    const pr = R.printProfiles(g, p), P = g.prof, rw2 = p.ridgeW / 2;
    const plateTop = p.H + p.bh, tieTop = p.H + Math.max(...pr.tie.map(q => q[1]));
    const gaps = {
      'eaves beam U-cut on post stub': (p.H + p.jd) - Math.max(...R.postProfile(p, false).map(q => q[1])),
      'cross beam tongue on post shoulder': (p.H + Math.min(...pr.tie.map(q => q[1]))) - R.postProfile(p, false)[4][1],
      'eaves beam on post shoulder line': (p.H + Math.min(...pr.plate.map(q => q[1]))) - p.H,
      'cross beam top flush with eaves beam top': tieTop - plateTop,
      'ridge post on cross beam': g.z0 - tieTop,
      'ridge beam on ridge post': (g.zR - p.ridgeH) - (g.z0 + g.kp),
      'rafter seat on eaves beam': P[4][1] - plateTop,
      'rafter seat over the eaves beam': Math.max(0, (p.W / 2) - P[5][0]) > 0 && g.seat <= p.b ? 1 : 0,
      'rafter on ridge beam': (p.hr > 0 ? P[7][1] : g.zU(rw2)) - g.zR,
    };
    Object.entries(gaps).forEach(([k, v]) => { worst = Math.max(worst, Math.abs(v)); assert.ok(Math.abs(v) < 1e-6, `${k}: off by ${v} mm for ${JSON.stringify(over)}`); });
  }
  console.log('largest gap or overlap between resting pieces:', worst.toExponential(2), 'mm');
});

test('corner relief: inside corners are cleared, bearing faces stay where they were, the kit stays printable', () => {
  const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const over of [{}, { pitch: 25 }, { ridgeNotch: false }]) {
    const { p, g } = setup(over), r = 10;                       // 0.5 mm at 1:20
    const raf = R.relieve(g.prof, r), P = g.prof;
    const corners = p.hr > 0 ? [P[4], P[7]] : [P[4]];
    corners.forEach(V => {
      assert.ok(!inside([V[0] - 0.01, V[1] - 0.01], raf) && !inside([V[0] + 1, V[1] + 1], raf), 'the old inside corner is now empty');
    });
    // the seat and heel still bear where they did: points just along them are still on the boundary of the wood
    const has = q => raf.some(v => Math.abs(v[0] - q[0]) < 1e-9 && Math.abs(v[1] - q[1]) < 1e-9);
    assert.ok(has([P[4][0] - r, P[4][1]]) && has([P[4][0], P[4][1] - r]), 'birdsmouth seat and heel keep their lines');
    assert.ok(has(P[3]) && has(P[5]), 'birdsmouth outer corners unchanged');
    const pr = R.printProfiles(g, p), plate = R.relieve(pr.plate, r), tie = R.relieve(pr.tie, r);
    assert.equal(plate.length, pr.plate.length + 4 * 2, 'two inside corners per eaves beam notch relieved');
    assert.equal(tie.length, pr.tie.length + 2 * 2, 'one inside corner per cross beam end relieved');
    const k0 = R.printKit(g, p, 20, 220, 0), k1 = R.printKit(g, p, 20, 220, 0.5);
    assert.equal(closedSolid(k1.tris), 0, 'relieved kit is closed');
    const v0 = volume(k0.tris), v1 = volume(k1.tris);
    assert.ok(v1 < v0 && v0 - v1 < v0 * 0.01, 'relief removes only a tiny amount');
  }
});

test('joint close-up labels the stub, tongue and U-cut sizes', () => {
  for (const over of [{}, { b: 150, jd: 80, jc: 50 }]) {
    const { p, g } = setup(over), svg = R.jointSVG(g, p, 600);
    const nums = [...svg.matchAll(/class="c"[^>]*>(?:U-cut )?([\d,]+)(?: deep)?</g)].map(m => +m[1].replace(/,/g, ''));
    [p.jc, p.b - p.jc, p.jd].forEach(v => assert.ok(nums.includes(Math.round(v)), `close-up shows ${v}`));
  }
});
