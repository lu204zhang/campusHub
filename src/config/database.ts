import mongoose, { type Mongoose } from 'mongoose';

async function connectToDatabase(): Promise<Mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required to connect to the database.');
  }

  return mongoose.connect(uri);
}

export { connectToDatabase };
