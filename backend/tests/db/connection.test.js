const mongoose = require('mongoose');

const { connectToDatabase, disconnectFromDatabase } = require('../setup');

describe('Database Connection', () => {
  beforeAll(connectToDatabase);
  afterAll(disconnectFromDatabase);
  test('should connect to MongoDB successfully', () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  test('should have access to the test database', () => {
    const db = mongoose.connection.db;
    expect(db).toBeDefined();
    expect(db.databaseName).toBeDefined();
  });

  test('should have collections after setup', async () => {
    const collections = Object.keys(mongoose.connection.collections);
    expect(collections).toBeDefined();
  });

  test('should be able to read/write documents', async () => {
    const TestSchema = new mongoose.Schema({ name: String });
    const TestRW = mongoose.models.__TestRW || mongoose.model('__TestRW', TestSchema);
    const doc = await TestRW.create({ name: 'test' });
    expect(doc.name).toBe('test');
    const found = await TestRW.findById(doc._id);
    expect(found.name).toBe('test');
    await TestRW.deleteMany({});
  });
});
