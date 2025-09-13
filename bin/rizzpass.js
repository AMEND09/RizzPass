#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Parse CLI args for port override
const args = process.argv.slice(2);
let port = process.env.RIZZPASS_PORT || process.env.PORT || '3000';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--port' || a === '-p') {
    const val = args[i + 1];
    if (val) {
      port = val;
      i++;
    }
  } else if (a.startsWith('--port=')) {
    port = a.split('=')[1];
  }
}

// Run next dev from the project root with chosen PORT
const env = Object.assign({}, process.env, { PORT: port });
const nextDev = spawn('npx', ['next', 'dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
  env,
});

nextDev.on('close', (code) => {
  process.exit(code);
});

nextDev.on('error', (err) => {
  console.error('Failed to start RizzPass:', err);
  process.exit(1);
});
