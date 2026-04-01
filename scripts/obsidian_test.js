#!/usr/bin/env node
/**
 * Quick test: verify Obsidian Local REST API plugin is running
 * Usage: node obsidian_test.js
 * Or with custom port: OBSIDIAN_PORT=27124 node obsidian_test.js
 */

const http = require("http");

const HOST = process.env.OBSIDIAN_HOST || "localhost";
const PORT = parseInt(process.env.OBSIDIAN_PORT || "27123", 10);
const API_KEY = process.env.OBSIDIAN_API_KEY || "";

function request(path, method = "GET") {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log(`\nTesting Obsidian Local REST API at http://${HOST}:${PORT}...\n`);

  try {
    // 1. Status / vault info
    const status = await request("/");
    if (status.status === 200) {
      const vault = status.body?.vault?.name || "unknown";
      console.log(`✓ Connected! Vault: "${vault}"`);
    } else {
      console.log(`✗ Unexpected status: ${status.status}`);
      return;
    }

    // 2. List root files
    const files = await request("/vault/");
    const fileList = files.body?.files || [];
    console.log(`✓ Vault root has ${fileList.length} items`);
    if (fileList.length > 0) {
      console.log(`  First 5: ${fileList.slice(0, 5).join(", ")}`);
    }

    // 3. List commands
    const commands = await request("/commands/");
    const cmdList = commands.body?.commands || [];
    console.log(`✓ ${cmdList.length} Obsidian commands available`);

    console.log("\nObsidian integration is ready.\n");
    console.log("Set these env vars in your shell profile:");
    console.log(`  export OBSIDIAN_HOST="http://localhost:${PORT}"`);
    console.log(`  export OBSIDIAN_API_KEY="<your-api-key-from-plugin-settings>"`);
    console.log(`  export OBSIDIAN_ENABLED="true"`);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      console.error(`✗ Cannot connect to Obsidian on port ${PORT}`);
      console.error("\nFix:");
      console.error("  1. Open Obsidian");
      console.error("  2. Settings → Community plugins → Local REST API → Enable");
      console.error("  3. Note the port number (default: 27123)");
      console.error("  4. Run this test again");
    } else {
      console.error(`✗ Error: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
