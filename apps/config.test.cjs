const assert=require('node:assert/strict'),{validate}=require('./configure.cjs');
assert.equal(validate('https://game.example.org/'),'https://game.example.org/');
for(const value of ['', 'http://game.example.org/', 'file:///secret', 'https://user:pass@game.example.org', 'https://localhost/', 'https://game.example.org/?token=x'])assert.throws(()=>validate(value));
console.log('PASS shell URL policy. Native runtimes/installers were not built by this test.');
