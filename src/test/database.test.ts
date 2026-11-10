import mongoose from 'mongoose';

describe('in-memory database setup', () => {
  it('connects mongoose to the in-memory MongoDB instance', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});
