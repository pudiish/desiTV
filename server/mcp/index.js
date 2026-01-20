/**
 * MCP Agent Index
 * 
 * Main entry point for DesiTV chatbot agent
 * Now with persona support!
 */

const gemini = require('./gemini');
const tools = require('./tools');
const personas = require('./personas');

module.exports = {
  gemini,
  tools,
  personas
};
