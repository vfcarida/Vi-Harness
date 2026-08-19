node -e "const mod = require('./regression.js'); if (mod.compute() !== 42) process.exit(1); console.log('PASS');"
