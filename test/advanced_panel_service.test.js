const test = require('node:test');
const assert = require('node:assert');
const { AdvancedPanelService } = require('../src/backends/ollama/advanced-service');

test('AdvancedPanelService tests', async (t) => {
  // Mocking DOM elements since we are in Node.js
  const mockDocument = {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      appendChild: () => {},
      id: ''
    }),
    body: { appendChild: () => {} }
  };
  
  // Mocking utools globally if needed, or by setting a global variable
  global.utools = {
    setExpendHeight: () => {},
    dbStorage: { getItem: () => ({proxy: {enabled: false}}) }
  };
  
  // Mocking document for this test
  global.document = mockDocument;

  await t.test('AdvancedPanelService should initialize with default values', () => {
    const service = new AdvancedPanelService();
    assert.strictEqual(service.isOpen, false);
  });

  await t.test('closePanel should clean up correctly', () => {
    const service = new AdvancedPanelService();
    service.isOpen = true;
    service.closePanel();
    assert.strictEqual(service.isOpen, false);
  });
});
