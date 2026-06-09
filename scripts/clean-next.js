const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", ".next");
fs.rmSync(dir, { recursive: true, force: true });
console.log("Removed .next cache");
