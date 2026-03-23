// Vercel serverless function entry point
// Imports the compiled Express app from dist/
const app = require('../dist/index.js').default;

module.exports = app;
