node -e "const { evaluateModel } = require('./model.js'); const acc = evaluateModel(); if (acc < 0.95) process.exit(1); console.log('PASS');"
