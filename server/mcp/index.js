/**
 * MCP Agent Index
 * 
 * Main entry point for DesiTV chatbot agent
 */

const gemini = require('./gemini');
const tools = require('./tools');

module.exports = {
  gemini,
  tools
};
