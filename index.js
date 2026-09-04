// Root entry point.
//
// Hosts differ on what they run: some execute `npm start`, some hard-code
// `index.js`, some run the file under an ESM loader. This satisfies all of
// them — dynamic import() is valid in both CommonJS and ESM, whereas
// require() would throw under the latter.
//
// The bot itself lives in dist/index.js.
import('./dist/index.js').catch((error) => {
  console.error('Failed to start THE DESK bot:');
  console.error(error);
  process.exit(1);
});
