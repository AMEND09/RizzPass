#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.dirname(__dirname);

console.log('Starting RizzPass...');
console.log('Open http://localhost:3000 to access the app.');

const child = spawn('npx', ['next', 'dev'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
