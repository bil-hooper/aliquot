#!/usr/bin/env node
// Synthetic graph generator for renderer testing (Sprint 2, plan section 3.2 / 5).
//
// Produces a skeleton.json-shaped fixture -- id, type, shell, position, label per node,
// plus source/target/type edges -- at the node/edge scale the plan estimates for the
// real catalog once it's fully built out (SS3.2: "8,000-15,000 nodes, 30,000-60,000
// edges"). This is the "Space Track" half of Sprint 2: build and stress-test the
// InstancedMesh + LineSegments renderer against data of the right shape and size
// *before* the real Bandcamp/MusicBrainz/Discogs JSON export exists, so rendering work
// never blocks on the data pipeline (SS5, Sprint 2 scheduling note).
//
// Node/edge/shell taxonomy follows SS2.1 (5 node types), SS2.2 (formal edges, plus the
// ETL's own 8th "performed_by" edge -- see docs/DECISIONS.md, 2026-08-25), and SS2.3
// (shell assignment). `Work` nodes are intentionally never materialized here: SS2.2
// says COVERS (Recording -> Recording) is "derived at build time... by walking
// cover -> Work -> original", and SS2.3's shell table has no row for Work at all --
// the renderer only ever sees the collapsed COVERS edge. This generator does the same
// collapse: it assigns each cover recording a COVERS target directly.
//
// The original-side hierarchy (shells 3/3a/3b, and the covering-side bands on shell 2)
// is *grown*, not sized upfront: each cover recording either covers an already-known
// original recording or introduces a new one (and, recursively, that recording's
// release and artist if they're new too); each recording is performed by either an
// already-known band or a new one. This mirrors how the real data actually comes to
// exist -- an original artist only appears at all because some cover recording pointed
// at them -- and it guarantees every node has at least one edge by construction, so
// there's no separate "now go back and make sure nothing's orphaned" pass. Reuse is
// picked via a Zipf-skewed index over already-created entities (see zipfIndex), which
// is what produces the power-law-ish shape real catalogs have: a few prolific covering
// bands and oft-covered originals, a long tail of one-offs.
//
// Layout implements a single-pass version of the barycenter algorithm in SS3.1: shell 3
// (original artists) is positioned in creation order, standing in for SS3.1 step 1's
// "alphabetical or first-covered date" fixed reference. Shell 2 (covering bands) is
// ranked by the mean shell-3 position of the artists its recordings cover, shell 1
// (members) is ranked by the mean shell-2 position of their band(s), and each rank is
// mapped onto a Fibonacci sphere (golden-angle spiral, SS2.3's "full spherical shells"
// geometry) rather than a flat circle. The plan iterates that barycenter pass 3-5 times
// for ~80%-optimal crossing minimization; this does one pass, which is the same
// heuristic and already gets most of the benefit -- iterating further is a real-data
// refinement, not a stress-test requirement, and is left to the actual C# build-time
// layout (SS3.1: "Do this at build time in C#, bake the 3D positions into the JSON").
//
// Sub-orbit shells with a single clear parent (2a under 2, 3a under 3, 3b under 3a) are
// placed as small angular jitters around their parent's already-computed direction --
// literally "clustered around their band" per SS2.3's own wording for shell 2a. Shells
// with no single natural parent (2b comps, spanning many bands; 4 personnel, reused
// across many releases) get their own independent Fibonacci sphere. COVERS edges then
// legitimately span the full width of the scene, because that cross-shell reach is the
// real structure of the site, not spaghetti to be minimized away.
//
// Usage:
//   node scripts/generate-synthetic-graph.mjs [--nodes 15000] [--seed 42] [--out web/public/data/synthetic-skeleton.json]
//
// Output is deterministic for a given --nodes/--seed pair (mulberry32 PRNG, no Math.random).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { nodes: 15000, seed: 42, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--nodes') args.nodes = parseInt(argv[++i], 10);
    else if (a === '--seed') args.seed = parseInt(argv[++i], 10);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: generate-synthetic-graph.mjs [--nodes 15000] [--seed 42] [--out path.json]');
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) -- reproducible runs, no Math.random.
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zipf-lite index picker: biases toward low indices (index 0 = created first /
// most established). power > 1 sharpens the skew.
function zipfIndex(rng, n, power) {
  return Math.min(n - 1, Math.floor(n * Math.pow(rng(), power)));
}

function uniformIndex(rng, n) {
  return Math.min(n - 1, Math.floor(rng() * n));
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// "Reuse an existing entity, or mint a new one" -- the core of the growth model
// described up top. Always mints on the very first call (nothing to reuse yet).
// Returns the index of the (possibly new) entity in `pool`.
function reuseOrMint(rng, pool, reuseProb, zipfPower, factory) {
  if (pool.length > 0 && rng() < reuseProb) {
    return zipfIndex(rng, pool.length, zipfPower);
  }
  pool.push(factory(pool.length));
  return pool.length - 1;
}

// ---------------------------------------------------------------------------
// Fibonacci sphere: golden-angle spiral distribution across a shell's surface
// (SS2.3, SS3.1 step 6). Index-adjacent points land near each other on the
// surface, which is what makes barycenter-ranked shells read as clustered.
// ---------------------------------------------------------------------------

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function fibonacciSphere(index, count, radius) {
  if (count <= 1) return [radius, 0, 0];
  const offset = 2 / count;
  const y = (index * offset - 1) + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = index * GOLDEN_ANGLE;
  return [Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius];
}

// Cluster a child node near its parent's direction on the sphere: same radius
// family as the child's own shell, angle perturbed by a small random offset so
// several children around one parent fan out instead of overlapping exactly.
function clusterNear(parentPos, radius, rng, jitter) {
  const [px, py, pz] = parentPos;
  const plen = Math.hypot(px, py, pz) || 1;
  let dx = px / plen, dy = py / plen, dz = pz / plen;
  dx += (rng() * 2 - 1) * jitter;
  dy += (rng() * 2 - 1) * jitter;
  dz += (rng() * 2 - 1) * jitter;
  const dlen = Math.hypot(dx, dy, dz) || 1;
  return [(dx / dlen) * radius, (dy / dlen) * radius, (dz / dlen) * radius];
}

// ---------------------------------------------------------------------------
// Fixed target counts: the three quantities that drive the growth model
// (cover recordings, comps, covering members) are scaled directly from the
// plan's SS3.2 estimate to hit --nodes total; everything else (bands,
// original artists/releases/recordings, personnel) is emergent from growth
// and lands in the same ballpark by construction (reuse probabilities tuned
// below). Comps is the one deliberately *not* rescaled from the plan's
// original "~30" -- the real Bandcamp harvest (docs/DECISIONS.md, 2026-08-25)
// already shows the series lands around 150, so that figure is used directly.
// ---------------------------------------------------------------------------

function computeDriverCounts(targetNodes) {
  const REAL_COMPS = 150;
  const weights = { coverRecordings: 1500, coveringMembers: 1150 };
  // Everything else the plan estimates (bands, originals, personnel) will be
  // grown from coverRecordings below, so only account for these three plus
  // core when deciding the scale factor against the full SS3.2 estimate.
  const fullWeightSum = 1500 /* 2a */ + 30 /* 2b, superseded by REAL_COMPS */
    + 600 /* 2 */ + 1150 /* 1 */ + 550 /* 3 */ + 450 /* 3a */ + 1050 /* 3b */ + 3500 /* 4 */;
  const budget = Math.max(1, targetNodes - 1 - REAL_COMPS);
  const scale = budget / (fullWeightSum - 30);
  return {
    comps: REAL_COMPS,
    coverRecordings: Math.max(1, Math.round(weights.coverRecordings * scale)),
    coveringMembers: Math.max(1, Math.round(weights.coveringMembers * scale)),
  };
}

// ---------------------------------------------------------------------------
// ID / label helpers
// ---------------------------------------------------------------------------

function pad(n, width = 6) {
  return String(n).padStart(width, '0');
}

let seqCounter = 0;
function makeNode(type, shell, label) {
  return { id: `${type}/synthetic/${pad(seqCounter++)}`, type, shell, label, position: null };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function generate(targetNodes, seed) {
  seqCounter = 0;
  const rng = mulberry32(seed);
  const driver = computeDriverCounts(targetNodes);

  const nodes = [];
  const edges = [];
  const addEdge = (source, target, type) => edges.push({ source, target, type });

  // --- Core (shell 0): the tribute project itself, unlit, at the origin. ---
  const core = makeNode('core', '0', 'Aliquot Tribute Project');
  core.position = [0, 0, 0];
  nodes.push(core);

  // --- Radii, outward per SS2.3's ordering. Arbitrary units; the renderer's
  // camera framing decides what "close" means, not this generator. ---
  const RADIUS = { 1: 8, 2: 16, '2a': 19, '2b': 21, 3: 30, '3a': 33, '3b': 36, 4: 45 };

  // === Grow the original side (shells 3/3a/3b) and the covering bands
  // (shell 2) together, driven by shell 2a (cover recordings). Each pool
  // entry only exists because something pointed at it -- no orphans. ===
  const originalArtists = []; // { createdIdx }
  const originalReleases = []; // { artistIdx }
  const originalRecordings = []; // { releaseIdx, artistIdx }
  const coveringBands = []; // { }
  const coverRecMeta = []; // { coversRecIdx, bandIdx, compIdx }

  for (let i = 0; i < driver.coverRecordings; i++) {
    const bandIdx = reuseOrMint(rng, coveringBands, 0.6, 1.5, () => ({}));

    const recIdx = reuseOrMint(rng, originalRecordings, 0.35, 1.3, () => {
      const relIdx = reuseOrMint(rng, originalReleases, 0.55, 1.6, () => {
        const artIdx = reuseOrMint(rng, originalArtists, 0.5, 1.6, () => ({}));
        return { artistIdx: artIdx };
      });
      return { releaseIdx: relIdx, artistIdx: originalReleases[relIdx].artistIdx };
    });

    coverRecMeta.push({ coversRecIdx: recIdx, bandIdx, compIdx: uniformIndex(rng, driver.comps) });
  }

  // === Shell 3: original artists, in creation order (stand-in for SS3.1
  // step 1's "alphabetical or first-covered date" fixed reference). ===
  const artistNodes = originalArtists.map((_, i) => {
    const n = makeNode('artist', '3', `Synthetic Original Artist #${pad(i, 4)}`);
    n.position = fibonacciSphere(i, originalArtists.length, RADIUS[3]);
    nodes.push(n);
    return n;
  });

  // === Shell 3a: original releases, clustered around their artist. ===
  const releaseNodes = originalReleases.map((rel, i) => {
    const n = makeNode('release', '3a', `Synthetic Original Release #${pad(i, 4)}`);
    n.position = clusterNear(artistNodes[rel.artistIdx].position, RADIUS['3a'], rng, 0.35);
    nodes.push(n);
    addEdge(artistNodes[rel.artistIdx].id, n.id, 'RELEASED');
    return n;
  });

  // === Shell 3b: original recordings, clustered around their release. ===
  const recordingNodes = originalRecordings.map((rec, i) => {
    const n = makeNode('recording', '3b', `Synthetic Original Recording #${pad(i, 4)}`);
    n.position = clusterNear(releaseNodes[rec.releaseIdx].position, RADIUS['3b'], rng, 0.3);
    nodes.push(n);
    addEdge(releaseNodes[rec.releaseIdx].id, n.id, 'APPEARS_ON');
    return n;
  });

  // === Shell 2b: cover releases / comps. No single parent band -- shared
  // across the whole covering side -- so it gets its own Fibonacci sphere,
  // per SS3.1 (only shells 1/2/3 are barycenter-ranked). ===
  const compNodes = [];
  for (let i = 0; i < driver.comps; i++) {
    const n = makeNode('release', '2b', `Synthetic Comp Vol. ${i + 1}`);
    n.position = fibonacciSphere(i, driver.comps, RADIUS['2b']);
    compNodes.push(n);
    nodes.push(n);
  }

  // === Shell 2: covering bands, ranked by the mean shell-3 position of the
  // artists their recordings cover (SS3.1 steps 2-3, single pass). ===
  const bandRecIdxs = coveringBands.map(() => []);
  coverRecMeta.forEach((meta, i) => bandRecIdxs[meta.bandIdx].push(i));
  const bandMeanRank = coveringBands.map((_, b) => {
    const recIdxs = bandRecIdxs[b];
    if (recIdxs.length === 0) return rng() * artistNodes.length; // unreachable given growth model, kept as a safe fallback
    const sum = recIdxs.reduce((acc, ri) => acc + originalRecordings[coverRecMeta[ri].coversRecIdx].artistIdx, 0);
    return sum / recIdxs.length;
  });
  const bandOrder = coveringBands.map((_, b) => b).sort((a, b) => bandMeanRank[a] - bandMeanRank[b]);
  const bandRankOf = new Array(coveringBands.length);
  bandOrder.forEach((b, rank) => { bandRankOf[b] = rank; });

  const bandNodes = coveringBands.map((_, b) => {
    const n = makeNode('artist', '2', `Synthetic Covering Band #${pad(b, 4)}`);
    n.position = fibonacciSphere(bandRankOf[b], coveringBands.length, RADIUS[2]);
    nodes.push(n);
    return n;
  });

  // === Shell 2a: cover recordings, clustered around their (now-positioned)
  // band, per SS2.3's own wording for this sub-orbit. ===
  coverRecMeta.forEach((meta, i) => {
    const parent = bandNodes[meta.bandIdx];
    const n = makeNode('recording', '2a', `Synthetic Cover Recording #${pad(i, 4)}`);
    n.position = clusterNear(parent.position, RADIUS['2a'], rng, 0.3);
    nodes.push(n);
    addEdge(parent.id, n.id, 'performed_by');
    addEdge(n.id, compNodes[meta.compIdx].id, 'APPEARS_ON');
    addEdge(n.id, recordingNodes[meta.coversRecIdx].id, 'COVERS');
  });

  // === Shell 1: covering-band members. Ranked by the mean shell-2 rank of
  // their band(s) (SS3.1 step 4), same single-pass barycenter approach.
  // ~15% get a second, distinct band -- musicians who play in more than one
  // covering act, and the seed data for a future SHARES_MEMBER derivation. ===
  const memberCount = driver.coveringMembers;
  const memberBandIdxs = [];
  for (let i = 0; i < memberCount; i++) {
    const primary = uniformIndex(rng, coveringBands.length);
    const bands = [primary];
    if (rng() < 0.15) {
      let second = uniformIndex(rng, coveringBands.length);
      if (second === primary) second = (second + 1) % coveringBands.length;
      bands.push(second);
    }
    memberBandIdxs.push(bands);
  }
  const memberMeanRank = memberBandIdxs.map(
    (bands) => bands.reduce((sum, b) => sum + bandRankOf[b], 0) / bands.length
  );
  const memberOrder = memberBandIdxs.map((_, m) => m).sort((a, b) => memberMeanRank[a] - memberMeanRank[b]);
  const memberRankOf = new Array(memberCount);
  memberOrder.forEach((m, rank) => { memberRankOf[m] = rank; });

  for (let m = 0; m < memberCount; m++) {
    const n = makeNode('person', '1', `Synthetic Member #${pad(m, 4)}`);
    n.position = fibonacciSphere(memberRankOf[m], memberCount, RADIUS[1]);
    nodes.push(n);
    for (const bandIdx of memberBandIdxs[m]) {
      addEdge(n.id, bandNodes[bandIdx].id, 'MEMBER_OF');
    }
  }

  // === Shell 4: original-record personnel. Grown the same way as the
  // original side above -- each credit either reuses an existing session
  // player/engineer (Zipf-weighted toward already-established ones) or mints
  // a new one -- so every shell-4 node has at least one edge by construction.
  // No single natural parent (personnel are reused across many releases and
  // recordings), so position is an independent Fibonacci sphere in creation
  // order, matching SS2.3's "faint outer, off by default" treatment (lowest
  // priority for angular-ordering polish). ===
  const personnel = [];
  const personnelEdges = []; // deferred until all personnel nodes are positioned
  for (const release of releaseNodes) {
    const creditCount = randInt(rng, 5, 14);
    for (let c = 0; c < creditCount; c++) {
      const pIdx = reuseOrMint(rng, personnel, 0.7, 1.4, () => ({}));
      personnelEdges.push({ pIdx, targetId: release.id, type: 'CREDITED_ON' });
    }
  }
  for (const recording of recordingNodes) {
    const creditCount = randInt(rng, 4, 11);
    for (let c = 0; c < creditCount; c++) {
      const pIdx = reuseOrMint(rng, personnel, 0.7, 1.4, () => ({}));
      personnelEdges.push({ pIdx, targetId: recording.id, type: 'PERFORMED_ON' });
    }
  }
  const personnelNodes = personnel.map((_, p) => {
    const n = makeNode('person', '4', `Synthetic Session Player #${pad(p, 4)}`);
    n.position = fibonacciSphere(p, personnel.length, RADIUS[4]);
    nodes.push(n);
    return n;
  });
  for (const pe of personnelEdges) addEdge(personnelNodes[pe.pIdx].id, pe.targetId, pe.type);

  const counts = {
    core: 1,
    comps: compNodes.length,
    coverRecordings: coverRecMeta.length,
    coveringBands: coveringBands.length,
    coveringMembers: memberCount,
    originalArtists: artistNodes.length,
    originalReleases: releaseNodes.length,
    originalRecordings: recordingNodes.length,
    originalPersonnel: personnelNodes.length,
  };

  return { nodes, edges, counts };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outPath = resolve(repoRoot, args.out || 'web/public/data/synthetic-skeleton.json');

  console.log(`Generating synthetic graph: target ${args.nodes} nodes, seed ${args.seed} ...`);
  const { nodes, edges, counts } = generate(args.nodes, args.seed);

  const payload = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/generate-synthetic-graph.mjs',
    seed: args.seed,
    targetNodes: args.nodes,
    shellCounts: counts,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };

  const json = JSON.stringify(payload);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json, 'utf8');
  const gzipBytes = gzipSync(Buffer.from(json, 'utf8')).length;

  console.log('');
  console.log('Shell counts:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log('');
  console.log(`Nodes: ${nodes.length}`);
  console.log(`Edges: ${edges.length} (${(edges.length / nodes.length).toFixed(2)} per node)`);
  console.log(`Output: ${outPath}`);
  console.log(`Raw size: ${(json.length / 1024 / 1024).toFixed(2)} MB, gzipped: ${(gzipBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`(Plan SS3.2 budget check: full skeleton at 15k nodes should land 1-3 MB gzipped.)`);
}

main();
