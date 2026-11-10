import os from 'node:os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async (): Promise<void> => {
  mongoServer = await MongoMemoryServer.create();
  // The driver's default os adapter uses dynamic import(), which Jest's VM sandbox rejects.
  await mongoose.connect(mongoServer.getUri(), { runtimeAdapters: { os } });
}, 120000);

afterEach(async (): Promise<void> => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async (): Promise<void> => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 30000);
