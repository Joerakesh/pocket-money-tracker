import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not configured. Copy .env.example to .env.local.");
}

const options = {
  maxPoolSize: 20,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
};

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __pocketMongo: MongoCache | undefined;
}

const cache = globalThis.__pocketMongo ??= { client: null, promise: null };

export async function getMongoClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;
  if (!cache.promise) {
    const client = new MongoClient(uri, options);
    cache.promise = client.connect().then((connected) => {
      cache.client = connected;
      return connected;
    }).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }
  return cache.promise;
}

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.DB_NAME || "pocket_money_tracker");
}
