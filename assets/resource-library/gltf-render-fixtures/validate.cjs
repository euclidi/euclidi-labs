const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = __dirname;
const validator = require(process.argv[2] ? path.resolve(process.argv[2]) : "gltf-validator");

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
  let errors = 0;
  let warnings = 0;
  let models = 0;

  for (const [model, fixture] of Object.entries(manifest.fixtures)) {
    const localFiles = new Map();
    for (const [name, expected] of Object.entries(fixture.files)) {
      const contents = await fs.readFile(path.join(root, name));
      const sha256 = createHash("sha256").update(contents).digest("hex");
      if (contents.length !== expected.bytes || sha256 !== expected.sha256) {
        throw new Error("Fixture checksum mismatch: " + name);
      }
      localFiles.set(name, contents);
    }

    const report = await validator.validateBytes(localFiles.get(fixture.entry), {
      uri: fixture.entry,
      externalResourceFunction: async (uri) => {
        const name = path.posix.normalize(path.posix.join(path.posix.dirname(fixture.entry), decodeURIComponent(uri)));
        if (!localFiles.has(name)) throw new Error("Unlisted external resource: " + name);
        return localFiles.get(name);
      },
    });
    const { numErrors, numWarnings, messages } = report.issues;
    for (const { code, message, severity } of messages) {
      if (severity <= 1) console.log(model + " " + code + " " + message);
    }
    errors += numErrors;
    warnings += numWarnings;
    models++;
  }

  console.log("Fixtures " + models + ", errors " + errors + ", warnings " + warnings);
  if (errors) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
