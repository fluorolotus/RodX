// json2tcl.js
// Convert model JSON → OpenSees TCL script.

(function (global) {

function convertJsonToTcl(model) {
  const out = [];
  out.push("model BasicBuilder -ndm 2 -ndf 3");
  out.push("set dataDir Data");
  out.push("file mkdir $dataDir");
  out.push("");
  out.push("#--------------------Nodes--------------------");
  for (const n of (model.nodes || [])) {
    const id = n.nodeId;
    const x = Number(n.x).toFixed(3);
    const y = Number(n.y).toFixed(3);
    out.push(`node ${id} ${x} ${y}`);
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
