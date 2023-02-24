const app = require('./app');
const config = require('./config');

const port = config.get('port');

const server = app.listen(port);

process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection at: Promise ', p, reason));

server.on('listening', () => console.info('Cover Router started on http://localhost:%d', port));
