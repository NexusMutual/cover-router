const path = require('path');

const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.2',
    servers: [
      {
        url: 'http://127.0.0.1:3000',
        description: 'Local server',
      },
      {
        url: 'https://api.nexusmutual.io/',
        description: 'Production server',
      },
    ],
    info: {
      title: 'Cover Router',
      version: '1.0.0',
    },
  },
  apis: [path.resolve(__dirname, '../routes/*.js')], // files containing annotations as above
};

module.exports = swaggerJSDoc(options);
