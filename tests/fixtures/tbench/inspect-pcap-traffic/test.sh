node -e "const fs = require('fs'); if (!fs.existsSync('token.txt') || fs.readFileSync('token.txt', 'utf-8').trim() !== 'SECRET_VI_HARNESS_KEY_99') process.exit(1); console.log('PASS');"
