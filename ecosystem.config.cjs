const path = require('node:path');

module.exports = {
  apps: [
    {name: 'q2pro-botstats-server', cwd: __dirname,
      script: 'src/server.js', args: [path.join(__dirname, 'server.production.json')],
      instances: 1, autorestart: true},
    {name: 'q2pro-botstats-importer', cwd: __dirname,
      script: 'src/importer.js', args: [path.join(__dirname, 'importer.production.json'), '--watch'],
      instances: 1, autorestart: true}
  ]
};
