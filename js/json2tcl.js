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
  out.push("# -------------------- Nodes ------------------------------------------------------");
  for (const n of (model.nodes || [])) {
    const id = n.nodeId;
    const x = conv.length(Number(n.x), LEN_U).toFixed(3);
    const y = conv.length(Number(n.y), LEN_U).toFixed(3);
    out.push(`node ${id} ${x} ${y}`);
  }
  out.push("");
  out.push("# -------------------- Supports ---------------------------------------------------");
  for (const s of (model.supports || [])) {
    const nodeId = Number(s.nodeId);
    const dx = Number(s.dx);
    const dy = Number(s.dy);
    const dr = Number(s.dr);
    out.push(`fix ${nodeId} ${dx} ${dy} ${dr}`);
  }
  out.push("");
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
