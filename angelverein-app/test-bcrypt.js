const bcrypt = require('bcrypt');

async function test() {
  const pw = 'testpassword';
  const hash = await bcrypt.hash(pw, 12);
  console.log('Hash:', hash);
  const valid = await bcrypt.compare(pw, hash);
  console.log('Valid:', valid);
}

test();