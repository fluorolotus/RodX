// json2tcl.js
// Convert model JSON → OpenSees TCL script.

(function (global) {

const conv = {
  length(x, u = "mm") {
    u = String(u).toLowerCase();
    if (u === "mm") return x;
    if (u === "m" || u === "meter" || u === "meters") return x * 1000;
    if (u === "cm") return x * 10;
    if (u === "in" || u === "inch" || u === "inches") return x * 25.4;
    if (u === "ft" || u === "feet") return x * 304.8;
    throw Error("len " + u);
  },
  E(x, u = "MPa") {
    u = String(u).toLowerCase();
    if (u === "pa") return x / 1e6;
    if (u === "mpa") return x;
    if (u === "gpa") return x * 1e3;
    if (u === "psi") return x * 0.00689475729;
    if (u === "ksi") return x * 6.89475729;
    if (u === "msi") return x * 6894.75729;
    throw Error("E " + u);
  },
  area(x, u = "mm^2") {
    u = String(u).toLowerCase();
    const lu = u.replace(/\^?2$/, "").replace(/2$/, "");
    return x * Math.pow(conv.length(1, lu), 2);
  },
  inertia(x, u = "mm^4") {
    u = String(u).toLowerCase();
    const lu = u.replace(/\^?4$/, "").replace(/4$/, "");
    return x * Math.pow(conv.length(1, lu), 4);
  },
  rho(x, u = "kg/m^3") {
    u = String(u).toLowerCase().replace(/\s+/g, "");
    const g = 9.80665; // gravitational acceleration m/s^2
    if (u === "kg/m^3" || u === "kg/m3") return (x * g) / 1e9; // N/mm^3
    if (u === "t/m^3" || u === "t/m3") return (x * 1000 * g) / 1e9;
    if (u === "n/mm^3" || u === "n/mm3") return x;
    if (u === "kn/m^3" || u === "kn/m3") return (x * 1000) / 1e9;
    if (u === "lbf/ft^3" || u === "lbf/ft3")
      return (x * 4.4482216152605) / Math.pow(304.8, 3);
    throw Error("rho " + u);
  },
  force(x, u = "N") {
    u = String(u).toLowerCase();
    if (u === "n") return x;
    if (u === "kn") return x * 1e3;
    if (u === "mn") return x * 1e6;
    if (u === "lbf") return x * 4.4482216153;
    if (u === "kip" || u === "kips") return x * 4.4482216153 * 1e3;
    if (u === "kg" || u === "kgf") return x * 9.80665;
    if (u === "t" || u === "tf" || u === "ton" || u === "tonne" || u === "tons")
      return x * 9.80665 * 1e3;
    throw Error("force " + u);
  },
  mom(x, u = "N*mm") {
    u = String(u).toLowerCase().replace(/\s+/g, "");
    const clean = u.replace(/[\*-]/g, "");
    const lenUnits = ["mm", "cm", "m", "in", "ft"];
    for (const lu of lenUnits) {
      if (clean.endsWith(lu)) {
        const fu = clean.slice(0, clean.length - lu.length);
        if (fu) return conv.force(x, fu) * conv.length(1, lu);
      }
    }
    throw Error("M " + u);
  },
  q(x, u = "N/mm") {
    u = String(u).toLowerCase().replace(/\s+/g, "");
    const parts = u.split("/");
    if (parts.length !== 2) throw Error("q " + u);
    const [fu, lu] = parts;
    return conv.force(x, fu) / conv.length(1, lu);
  },
};

function convertJsonToTcl(model) {
  const units = model.units || {};
  const LEN_U = units.length || "mm";
  const out = [];
  out.push("# -------------------- Units: mm-N-sec-K ------------------------------------------");
  out.push("# -------------------- Remove existing model --------------------------------------");
  out.push("wipe");
  out.push("");
  out.push("# -------------------- Create ModelBuilder (2D and 3 DOF/node) --------------------");
  out.push("model BasicBuilder -ndm 2 -ndf 3");
  out.push("");
  out.push("# -------------------- Сreate folder for results ----------------------------------");
  out.push("set dataDir Data");
  out.push("file mkdir $dataDir");
  out.push("");
  out.push("# -------------------- Nodes | # X Y ----------------------------------------------");
  for (const n of (model.nodes || [])) {
    const id = n.nodeId;
    const x = conv.length(Number(n.x), LEN_U).toFixed(3);
    const y = conv.length(Number(n.y), LEN_U).toFixed(3);
    out.push(`node ${id} ${x} ${y}`);
  }
  out.push("");
  out.push("# -------------------- Supports | fix # dx dy dr ----------------------------------");
  for (const s of (model.supports || [])) {
    const nodeId = Number(s.nodeId);
    const dx = Number(s.dx);
    const dy = Number(s.dy);
    const dr = Number(s.dr);
    out.push(`fix ${nodeId} ${dx} ${dy} ${dr}`);
  }
  out.push("");

  // -------------------- Sections ---------------------------------------------------
  const materialMap = {};
  for (const m of (model.materials || [])) materialMap[m.id] = m;
  const sectionMap = {};
  for (const s of (model.sections || [])) sectionMap[s.id] = s;

  const sectionCombos = [];
  const comboMap = {};
  const elemSectionMap = {};
  for (const e of (model.elements || [])) {
    const mat = materialMap[e.materialId] || {};
    const sec = sectionMap[e.sectionId] || {};
    const em = mat.properties?.elasticModulus || {};
    const E = conv.E(Number(em.value), em.unit || "MPa");
    const ap = sec.properties?.A || {};
    const A = conv.area(Number(ap.value), ap.unit || (LEN_U + "^2"));
    const dp = mat.properties?.density || {};
    const rho = conv.rho(Number(dp.value), dp.unit || "kg/m^3");
    const beta = ((Number(e.betaAngle) % 360) + 360) % 360;
    const ip = beta === 90 || beta === 270 ? sec.properties?.I22 : sec.properties?.I11;
    const I = conv.inertia(Number(ip?.value), ip?.unit || (LEN_U + "^4"));
    if (Number.isNaN(E) || Number.isNaN(A) || Number.isNaN(I) || Number.isNaN(rho)) continue;
    const key = `${E}|${A}|${I}|${rho}`;
    if (!comboMap[key]) {
      comboMap[key] = { id: sectionCombos.length + 1, E, A, I, w: rho * A };
      sectionCombos.push(comboMap[key]);
    }
    const combo = comboMap[key];
    elemSectionMap[e.elemId] = combo.id;
  }

  if (sectionCombos.length) {
    out.push("# -------------------- Sections | section Elastic # E A I -------------------------");
    for (const s of sectionCombos) {
      out.push(`section Elastic ${s.id} ${s.E.toFixed(3)} ${s.A.toFixed(3)} ${s.I.toFixed(3)}`);
    }
    for (const s of sectionCombos) {
      out.push(`set w${s.id} ${s.w.toFixed(5)}; # --- linear weight for section ${s.id}`);
    }
    out.push("");
  }

  out.push("# -------------------- Geometric transformation -----------------------------------");
  out.push("set transfTag 1");
  out.push("geomTransf Linear $transfTag");
  out.push("");

  // -------------------- Loads ------------------------------------------------------
  const loadMap = {};
  for (const l of (model.loads || [])) loadMap[l.id] = l;
  for (const lc of (model.loadCases || [])) {
    const caseId = lc.id;
    const caseName = lc.name || "";
    out.push(`# -------------------- Load Case ${caseName} ---`);
    out.push(`timeSeries Linear ${caseId}`);
    out.push(`pattern Plain ${caseId} ${caseId} {`);

    const nodeLoads = {};
    const elemLoads = {};
    const gravElems = [];
    for (const lid of (lc.loads || [])) {
      const L = loadMap[lid];
      if (!L) continue;
      const scope = String(L.scope || "").toLowerCase();
      if (scope === "node") {
        const node = Number(L.targetId);
        const entry = nodeLoads[node] || { FX: 0, FY: 0, M: 0 };
        const comp = String(L.component || "").toLowerCase();
        if (comp === "x") entry.FX += conv.force(Number(L.value), L.units || "N");
        else if (comp === "y") entry.FY += conv.force(Number(L.value), L.units || "N");
        else if (comp === "r") entry.M += conv.mom(Number(L.value), L.units || "N*mm");
        nodeLoads[node] = entry;
      } else if (scope === "element") {
        const elem = Number(L.targetId);
        const entry = elemLoads[elem] || { wX: 0, wY: 0 };
        const comp = String(L.component || "").toLowerCase();
        if (comp === "x") entry.wX += conv.q(Number(L.value), L.units || "N/mm");
        else if (comp === "y") entry.wY += conv.q(Number(L.value), L.units || "N/mm");
        elemLoads[elem] = entry;
      } else if (scope === "gravity") {
        const elem = Number(L.targetId);
        gravElems.push(elem);
      }
    }

    for (const [node, l] of Object.entries(nodeLoads)) {
      out.push(`    load ${node} ${l.FX.toFixed(5)} ${l.FY.toFixed(5)} ${l.M.toFixed(5)}`);
    }
    for (const [elem, l] of Object.entries(elemLoads)) {
      out.push(`    eleLoad -ele ${elem} -type -beamUniform ${l.wY.toFixed(5)} ${l.wX.toFixed(5)}`);
    }
    for (const elem of gravElems) {
      const sid = elemSectionMap[elem];
      if (sid) out.push(`    eleLoad -ele ${elem} -type -beamUniform -$w${sid}`);
    }

    out.push("}");
    out.push("");
  }

  return out.join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { convertJsonToTcl };
} else {
  global.convertJsonToTcl = convertJsonToTcl;
}

/*
Usage:
import { readFileSync, writeFileSync } from "node:fs";
const data = JSON.parse(readFileSync("model.json", "utf8"));
const tcl  = convertJsonToTcl(data);
writeFileSync("json2tcl.tcl", tcl, "utf8");
*/

})(typeof window !== "undefined" ? window : globalThis);
