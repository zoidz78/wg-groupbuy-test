// Pure-function tests for admin/index.html, run against the REAL
// product-catalog.json, product-emoji-map.json and manifest.json in this
// folder — not synthetic fixtures.
//
// Self-updating: extracts the named functions straight out of
// admin/index.html by source, so it always tests the file as it currently
// stands rather than a frozen copy. If a function is renamed or removed,
// this fails loudly rather than silently testing stale code.
//
// Run from this folder:  node test/run-tests.js

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_HTML = path.join(ROOT, "admin", "index.html");
const CART_HTML = path.join(ROOT, "index.html");

const EMOJI_MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "product-emoji-map.json"), "utf8"));
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, "product-catalog.json"), "utf8")).products;
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

// ---- extract named functions straight out of admin/index.html ----------
function extractScript(html) {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("could not find <script type=\"module\"> in admin/index.html");
  return m[1];
}
function extractFunction(name, src) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) throw new Error(`function not found in admin/index.html: ${name}`);
  const start = m.index;
  let i = src.indexOf("{", m.index + m[0].length);
  let depth = 0, j = i;
  while (true) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) break; }
    j++;
  }
  return src.slice(start, j + 1);
}

const ADMIN_SRC = extractScript(fs.readFileSync(ADMIN_HTML, "utf8"));
const FN_NAMES = ["productEmoji", "emojiLabel", "memberKeyOf", "groupOrdersByMember", "buildExport", "buildManifest",
                   "formatQty", "qtyTail", "buildFullJielongRecap"];
// buildFullJielongRecap closes over module-level `openRound`/`currentOrders`
// rather than taking them as params — declare them here so the extracted
// function body resolves against these instead of throwing ReferenceError.
let openRound = null;
let currentOrders = [];
eval(FN_NAMES.map(n => extractFunction(n, ADMIN_SRC)).join("\n\n"));

// Linked-gift mechanism lives in the CART (index.html), not admin — both
// are pure functions taking plain data, no module-state closures needed.
const CART_SRC = extractScript(fs.readFileSync(CART_HTML, "utf8"));
eval(["computeLinkedGiftTotals", "giftTargetKeys", "gramsPerUnitFor", "roundGramsDown",
      "unitOptionsFor", "computeCustomQty"].map(n => extractFunction(n, CART_SRC)).join("\n\n"));

// ---- tiny runner ----------------------------------------------------------
let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}

console.log(`--- productEmoji / emojiLabel — against all ${Object.keys(CATALOG).length} real labels (D18) ---`);
check("productEmoji returns a non-empty string for every catalog label", () => {
  for (const [key, p] of Object.entries(CATALOG)) {
    const e = productEmoji(p.label);
    assert.ok(typeof e === "string" && e.length > 0, `${key}: "${p.label}"`);
  }
});
check("categories array order preserved — dumpling (🥟) matches before pork (🐷)", () => {
  assert.strictEqual(productEmoji("白菜猪肉水饺(1kg/包)"), "🥟");
});
check("unmatched label falls back to defaultEmoji", () => {
  assert.strictEqual(productEmoji("完全不存在的商品名称XYZ123"), EMOJI_MAP.defaultEmoji);
});

console.log("\n--- memberKeyOf — normalization (D15) ---");
check('"Alex 妈妈" and "alex  妈妈" resolve to one member', () => {
  assert.strictEqual(memberKeyOf("Alex 妈妈"), memberKeyOf("alex  妈妈"));
});
check("trims leading/trailing whitespace", () => {
  assert.strictEqual(memberKeyOf("  Starry  "), "starry");
});

console.log("\n--- groupOrdersByMember — latest-wins, never summed (D75) ---");
check("resubmission: latest wins, quantities NOT summed", () => {
  const orders = [
    { id: "o1", name: "Starry", memberKey: "starry", items: { beef: 1 }, submittedAt: "2026-09-13T10:00:00.000Z" },
    { id: "o2", name: "Starry", memberKey: "starry", items: { beef: 2 }, submittedAt: "2026-09-13T10:05:00.000Z" },
  ];
  const groups = groupOrdersByMember(orders);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].latest.items.beef, 2, "expected 2, not summed to 3");
  assert.strictEqual(groups[0].superseded.length, 1);
});
check("sorted by each member's EARLIEST submittedAt, not their latest", () => {
  const orders = [
    { id: "a1", name: "Amy", memberKey: "amy", items: {}, submittedAt: "2026-09-13T09:00:00.000Z" },
    { id: "b1", name: "Bob", memberKey: "bob", items: {}, submittedAt: "2026-09-13T08:00:00.000Z" },
    { id: "a2", name: "Amy", memberKey: "amy", items: {}, submittedAt: "2026-09-13T10:00:00.000Z" },
  ];
  const groups = groupOrdersByMember(orders);
  assert.strictEqual(groups[0].memberKey, "bob", "Bob's only submission (08:00) predates Amy's earliest (09:00)");
  assert.strictEqual(groups[1].latest.id, "a2", "Amy's card must reflect her LATEST submission");
});

console.log("\n--- buildExport — schema, D6-D12 ---");
function fakeRound(productsOverride) {
  return {
    date: "2026-09-13", label: "9/13", itemsLabel: "测试到货", status: "closed",
    products: productsOverride || {
      beef_jinqian_jian: { label: "小条金钱腱", price: 18, unit: "kg", category: "Meats", weighMode: "weight", gramsPerUnit: 1000 },
      box_item:          { label: "普通盒装商品", price: 5, unit: "盒", category: "Frozen" },
      half_portion_item: { label: "半份商品", price: 3, unit: "份", category: "Produce" },
    },
  };
}
check("top level is exactly groupName, itemsLabel?, products, orders — no meta, no emoji", () => {
  const out = buildExport(fakeRound(), []);
  assert.deepStrictEqual(Object.keys(out).sort(), ["groupName", "itemsLabel", "orders", "products"]);
  assert.strictEqual(out.groupName, "WG团购群");
  for (const p of Object.values(out.products)) assert.ok(!("emoji" in p));
});
check("盒 unit omitted; kg/份 units kept", () => {
  const out = buildExport(fakeRound(), []);
  assert.ok(!("unit" in out.products.box_item));
  assert.strictEqual(out.products.beef_jinqian_jian.unit, "kg");
  assert.strictEqual(out.products.half_portion_item.unit, "份");
});
check("weighMode stays a string; gramsPerUnit passes through", () => {
  const out = buildExport(fakeRound(), []);
  assert.strictEqual(out.products.beef_jinqian_jian.weighMode, "weight");
  assert.strictEqual(out.products.beef_jinqian_jian.gramsPerUnit, 1000);
});
check("orders: latest-wins per member, sorted by 接龙 order, fractional qty exact", () => {
  const orders = [
    { id: "1", name: "Amy", memberKey: "amy", items: { half_portion_item: 0.5 }, submittedAt: "2026-09-13T09:00:00.000Z" },
    { id: "2", name: "Bob", memberKey: "bob", items: { box_item: 1 },            submittedAt: "2026-09-13T09:30:00.000Z" },
    { id: "3", name: "Amy", memberKey: "amy", items: { half_portion_item: 1.5 }, submittedAt: "2026-09-13T09:45:00.000Z" },
  ];
  const out = buildExport(fakeRound(), orders);
  assert.strictEqual(out.orders.length, 2, "Amy's two submissions collapse to one");
  assert.strictEqual(out.orders[0].name, "Amy");
  assert.strictEqual(out.orders[0].items.half_portion_item, 1.5, "must be latest qty, exact fraction");
  assert.strictEqual(out.orders[1].name, "Bob");
});
check("note/aka/category never leak into export", () => {
  const round = fakeRound({ x: { label: "带备注商品", price: 1, unit: "盒", category: "Pantry", note: "内部备注不应导出", aka: ["别名"] } });
  const json = JSON.stringify(buildExport(round, []));
  assert.ok(!json.includes("内部备注") && !json.includes("别名") && !json.includes("Pantry"));
});
check("empty itemsLabel omitted entirely, not emitted as ''", () => {
  const round = fakeRound(); round.itemsLabel = "";
  assert.ok(!("itemsLabel" in buildExport(round, [])));
});

console.log("\n--- buildManifest — the destructive-mistake surface (§1.6/D37-D43) ---");
check("REAL manifest.json: every pre-existing entry survives a merge", () => {
  const before = MANIFEST.groupBuys.length;
  const next = buildManifest(MANIFEST, "2026-09-20", "9/20", "data-2026-09-20.json");
  assert.strictEqual(next.groupBuys.length, before + 1);
  for (const entry of MANIFEST.groupBuys) {
    assert.ok(next.groupBuys.some(e => e.date === entry.date && e.file === entry.file), `lost ${entry.date}`);
  }
});
check("test-round entries survive untouched", () => {
  const next = buildManifest(MANIFEST, "2026-09-20", "9/20", "data-2026-09-20.json");
  const t = next.groupBuys.find(e => e.date === "2026-09-13-v2");
  assert.ok(t && t.label === "9/13测试(v2)");
});
check("new entry lands at index 0 (prepend)", () => {
  const next = buildManifest(MANIFEST, "2026-09-20", "9/20", "data-2026-09-20.json");
  assert.strictEqual(next.groupBuys[0].date, "2026-09-20");
});
check("re-exporting the SAME round replaces in place — length does not grow", () => {
  const before = MANIFEST.groupBuys.length;
  const next = buildManifest(MANIFEST, "2026-09-14", "9/14 (更新)", "data-2026-09-14.json");
  assert.strictEqual(next.groupBuys.length, before);
  assert.strictEqual(next.groupBuys.find(e => e.date === "2026-09-14").label, "9/14 (更新)");
});
check("version increments by exactly 1; missing version treated as 0", () => {
  const v1 = buildManifest(MANIFEST, "2026-09-20", "9/20", "f.json");
  assert.strictEqual(v1.version, (Number(MANIFEST.version) || 0) + 1);
  const v2 = buildManifest({ groupBuys: MANIFEST.groupBuys }, "2026-09-20", "9/20", "f.json");
  assert.strictEqual(v2.version, 1);
});
check("shape is {version, updatedAt, groupBuys} — NOT a bare array", () => {
  const next = buildManifest(MANIFEST, "2026-09-20", "9/20", "f.json");
  assert.ok(!Array.isArray(next));
  assert.deepStrictEqual(Object.keys(next).sort(), ["groupBuys", "updatedAt", "version"]);
});

console.log("\n--- buildFullJielongRecap — 💬 复制完整接龙（核对用） ---");
function fakeRoundForRecap() {
  return {
    date: "2026-09-19",
    products: {
      beef_jinqian_jian: { label: "小条金钱腱", price: 18, unit: "kg", weighMode: "weight" },
      box_item:          { label: "普通盒装商品", price: 5, unit: "盒" },
    },
  };
}
check("compiles every member into one numbered, blank-line-separated block", () => {
  openRound = fakeRoundForRecap();
  currentOrders = [
    { id: "1", name: "Amy", memberKey: "amy", items: { box_item: 2 }, submittedAt: "2026-09-19T09:00:00.000Z" },
    { id: "2", name: "Bob", memberKey: "bob", items: { beef_jinqian_jian: 1 }, submittedAt: "2026-09-19T09:05:00.000Z" },
  ];
  const text = buildFullJielongRecap();
  assert.ok(text.startsWith("1. Amy"), `expected Amy first (earliest submission), got:\n${text}`);
  assert.ok(text.includes("2. Bob"), `expected Bob numbered 2nd, got:\n${text}`);
  assert.ok(text.includes("\n\n"), "members must be separated by a blank line");
});
check("a member's SUPERSEDED resubmission appears only ONCE, using latest items", () => {
  openRound = fakeRoundForRecap();
  currentOrders = [
    { id: "1", name: "Amy", memberKey: "amy", items: { box_item: 1 }, submittedAt: "2026-09-19T09:00:00.000Z" },
    { id: "2", name: "Amy", memberKey: "amy", items: { box_item: 3 }, submittedAt: "2026-09-19T09:05:00.000Z" },
  ];
  const text = buildFullJielongRecap();
  assert.strictEqual((text.match(/Amy/g) || []).length, 1, `Amy must appear exactly once, got:\n${text}`);
  assert.ok(text.includes("x3"), `expected latest qty (3), got:\n${text}`);
});
check("matches the cart's own tail format: kg items get bare qty+kg, others get x{qty}", () => {
  openRound = fakeRoundForRecap();
  currentOrders = [{ id: "1", name: "Amy", memberKey: "amy", items: { beef_jinqian_jian: 1.5, box_item: 1 }, submittedAt: "2026-09-19T09:00:00.000Z" }];
  const text = buildFullJielongRecap();
  assert.ok(text.includes("1.5kg"), `expected kg-unit tail without 'x', got:\n${text}`);
  assert.ok(text.includes("x1"), `expected count-item tail with 'x', got:\n${text}`);
  assert.ok(!text.includes("称重"), `称重 must never appear client-facing (house decision), got:\n${text}`);
});
check("no orders yet returns empty string rather than throwing", () => {
  openRound = fakeRoundForRecap();
  currentOrders = [];
  assert.strictEqual(buildFullJielongRecap(), "");
});
check("no open round returns empty string rather than throwing", () => {
  openRound = null;
  currentOrders = [];
  assert.strictEqual(buildFullJielongRecap(), "");
});

console.log("\n--- computeLinkedGiftTotals / giftTargetKeys — generic gift-linking (not hardcoded) ---");
check("REAL catalog: mooncake_maoshanwang links to gift_insulated_bag at ratio 1", () => {
  assert.strictEqual(CATALOG.mooncake_maoshanwang.linkedGift.key, "gift_insulated_bag");
  assert.strictEqual(CATALOG.mooncake_maoshanwang.linkedGift.ratio, 1);
});
function fakeLinkedProducts() {
  return {
    mooncake_maoshanwang: { label: "月饼", price: 30, unit: "盒", linkedGift: { key: "gift_insulated_bag", ratio: 1 } },
    gift_insulated_bag:   { label: "保温袋", price: 0, unit: "个" },
    unrelated_item:       { label: "无关商品", price: 5, unit: "份" },
  };
}
check("ordering the parent earns the gift at the declared ratio", () => {
  const totals = computeLinkedGiftTotals({ mooncake_maoshanwang: 3 }, fakeLinkedProducts());
  assert.deepStrictEqual(totals, { gift_insulated_bag: 3 });
});
check("an item with no linkedGift contributes nothing", () => {
  const totals = computeLinkedGiftTotals({ unrelated_item: 5 }, fakeLinkedProducts());
  assert.deepStrictEqual(totals, {});
});
check("TWO different parents linking to the SAME gift key sum, not overwrite", () => {
  const products = {
    ...fakeLinkedProducts(),
    other_mooncake: { label: "另一款月饼", price: 25, unit: "盒", linkedGift: { key: "gift_insulated_bag", ratio: 1 } },
  };
  const totals = computeLinkedGiftTotals({ mooncake_maoshanwang: 2, other_mooncake: 1 }, products);
  assert.strictEqual(totals.gift_insulated_bag, 3, "expected 2+1=3, one link must not overwrite the other");
});
check("a non-default ratio scales correctly (e.g. 1 gift per 2 units)", () => {
  const products = { x: { label: "X", price: 1, unit: "份", linkedGift: { key: "gift_y", ratio: 0.5 } } };
  const totals = computeLinkedGiftTotals({ x: 4 }, products);
  assert.strictEqual(totals.gift_y, 2, "4 units at ratio 0.5 should earn 2 gifts");
});
check("giftTargetKeys correctly identifies the gift so it can be hidden from the browsable grid", () => {
  const targets = giftTargetKeys(fakeLinkedProducts());
  assert.ok(targets.has("gift_insulated_bag"));
  assert.ok(!targets.has("mooncake_maoshanwang"), "the PARENT must stay browsable, only the gift is hidden");
  assert.ok(!targets.has("unrelated_item"));
});
check("removing linkedGift from the catalog (retiring the promo) needs no code change — totals become empty", () => {
  const productsNoLink = { mooncake_maoshanwang: { label: "月饼", price: 30, unit: "盒" } }; // linkedGift removed
  const totals = computeLinkedGiftTotals({ mooncake_maoshanwang: 3 }, productsNoLink);
  assert.deepStrictEqual(totals, {}, "no linkedGift field means no gift earned — purely data-driven");
});

console.log("\n--- gramsPerUnitFor — same 3-tier convention as dashboard.html's gramsPerUnit() ---");
check("REAL catalog: explicit gramsPerUnit field wins (asparagus, 500g/份)", () => {
  assert.strictEqual(gramsPerUnitFor(CATALOG.asparagus), 500);
});
check("REAL catalog: unit===\"kg\" convention (beansprout_green, no explicit field)", () => {
  assert.strictEqual(CATALOG.beansprout_green.gramsPerUnit, undefined);
  assert.strictEqual(gramsPerUnitFor(CATALOG.beansprout_green), 1000);
});
check("REAL catalog: parsed off the label's own (Ng/unit) parenthetical (chicken_feet_lemon, 170g/袋)", () => {
  assert.strictEqual(CATALOG.chicken_feet_lemon.gramsPerUnit, undefined);
  assert.strictEqual(CATALOG.chicken_feet_lemon.unit, "袋");
  assert.strictEqual(gramsPerUnitFor(CATALOG.chicken_feet_lemon), 170);
});
check("no weight signal anywhere returns null, not a wrong guess", () => {
  assert.strictEqual(gramsPerUnitFor({ label: "赠品", unit: "个" }), null);
});

console.log("\n--- roundGramsDown — buyer-favor rounding, same rule as dashboard.html ---");
check("floors to the nearest 10g, always in the buyer's favor", () => {
  assert.strictEqual(roundGramsDown(704), 700);
  assert.strictEqual(roundGramsDown(709), 700);
  assert.strictEqual(roundGramsDown(710), 710);
});

console.log("\n--- computeCustomQty — this is what actually gets billed ---");
const weightProduct = { label: "小条金钱腱", unit: "kg", price: 18, weighMode: "weight" };
const pieceProduct = { label: "Envy苹果(5粒/份)", unit: "份", price: 10.5, piecesPerUnit: 5 };
const proportionalProduct = { label: "辽宁巨峰", unit: "份", price: 20, weighMode: "proportional" };
const plainProduct = { label: "普通盒装商品", unit: "盒", price: 5 };

check("700g on a kg-priced item converts to 0.7 (the user's own example)", () => {
  const r = computeCustomQty(weightProduct, 700, "grams");
  assert.strictEqual(r.qty, 0.7);
});
check("grams entry rounds DOWN to nearest 10g before converting — buyer never pays for rounding up", () => {
  const r = computeCustomQty(weightProduct, 704, "grams"); // dashboard's own house example
  assert.strictEqual(r.qty, 0.7, "704g must floor to 700g, i.e. 0.7kg, not 0.704");
});
check("piece-count: 2 of 5 pieces yields 0.4, matches dashboard's no-scale fallback math", () => {
  const r = computeCustomQty(pieceProduct, 2, "pieces");
  assert.strictEqual(r.qty, 0.4);
});
check("piece-count cannot exceed piecesPerUnit — rejected with an error, not silently clamped", () => {
  const r = computeCustomQty(pieceProduct, 6, "pieces");
  assert.ok(r.error, "6 pieces from a 5-piece pack must be rejected");
  assert.strictEqual(r.qty, undefined);
});
check("proportional native entry above 1 (more than one whole box) is rejected", () => {
  const r = computeCustomQty(proportionalProduct, 1.5, "native");
  assert.ok(r.error, "can't order 1.5 boxes as a single 分箱 line");
});
check("proportional native entry at or under 1 is accepted (half a shared box)", () => {
  const r = computeCustomQty(proportionalProduct, 0.5, "native");
  assert.strictEqual(r.qty, 0.5);
});
check("plain item native entry: half a bag/pack — the original ask this all started from", () => {
  const r = computeCustomQty(plainProduct, 0.5, "native");
  assert.strictEqual(r.qty, 0.5);
});
check("zero or negative input is rejected, not silently accepted as an empty order", () => {
  assert.ok(computeCustomQty(plainProduct, 0, "native").error);
  assert.ok(computeCustomQty(plainProduct, -1, "native").error);
});
check("grams entry on a product with no resolvable weight is rejected, not NaN", () => {
  const r = computeCustomQty({ label: "赠品", unit: "个" }, 100, "grams");
  assert.ok(r.error);
  assert.ok(!Number.isNaN(r.qty));
});

console.log("\n--- unitOptionsFor — the per-product unit list the member actually sees ---");
check("plain item offers only its native unit", () => {
  const opts = unitOptionsFor("x", plainProduct);
  assert.deepStrictEqual(opts.map(o => o.value), ["native"]);
});
check("weight item additionally offers grams", () => {
  const opts = unitOptionsFor("x", weightProduct);
  assert.deepStrictEqual(opts.map(o => o.value), ["native", "grams"]);
});
check("a product with piecesPerUnit additionally offers pieces", () => {
  const opts = unitOptionsFor("x", pieceProduct);
  assert.deepStrictEqual(opts.map(o => o.value), ["native", "pieces"]);
});
check("REAL catalog: asparagus (weight, explicit gramsPerUnit) offers native + grams", () => {
  const opts = unitOptionsFor("asparagus", CATALOG.asparagus);
  assert.deepStrictEqual(opts.map(o => o.value), ["native", "grams"]);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
