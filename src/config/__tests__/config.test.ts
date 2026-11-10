import mongoose from 'mongoose';

import { connectToDatabase } from '../database';
import { getPort } from '../env';

const originalEnv = { PORT: process.env.PORT, MONGODB_URI: process.env.MONGODB_URI };

function restoreEnv(name: keyof typeof originalEnv): void {
  const value = originalEnv[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnv('PORT');
  restoreEnv('MONGODB_URI');
});

describe('getPort', () => {
  it('defaults to 3000 when PORT is unset', () => {
    delete process.env.PORT;

    expect(getPort()).toBe(3000);
  });

  it('reads PORT from the environment', () => {
    process.env.PORT = '8080';

    expect(getPort()).toBe(8080);
  });
});

describe('connectToDatabase', () => {
  it('rejects when MONGODB_URI is unset', async () => {
    delete process.env.MONGODB_URI;

    await expect(connectToDatabase()).rejects.toThrow(
      'MONGODB_URI environment variable is required to connect to the database.',
    );
  });

  it('connects using MONGODB_URI', async () => {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/campushub-test';
    const connectSpy = jest.spyOn(mongoose, 'connect').mockResolvedValueOnce(mongoose);

    try {
      await expect(connectToDatabase()).resolves.toBe(mongoose);
      expect(connectSpy).toHaveBeenCalledWith('mongodb://127.0.0.1:27017/campushub-test');
    } finally {
      connectSpy.mockRestore();
    }
  });
});
