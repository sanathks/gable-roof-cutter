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
  near(get('posts').len, p.H + p.embed, 'post length'); assert.equal(get('posts').qty, 4);
  near(get('plates').len, g.Lt, 'eaves beam length'); near(get('ridge').len, g.Lt, 'ridge beam length');
  near(get('ties').len - 2 * p.b, p.W, 'cross beam spans the clear width plus both posts');
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
    let v = 4 * p.b * p.b * (p.H + p.embed) + 2 * shoelace(pr.plate) * p.b + 2 * shoelace(pr.tie) * p.b
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
