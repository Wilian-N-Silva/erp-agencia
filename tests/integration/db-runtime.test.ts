import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const settingName = "app.sec_001_transaction_id";
const databaseTestUrl = process.env.DATABASE_TEST_URL;

if (!databaseTestUrl) {
  throw new Error(
    "DATABASE_TEST_URL is required for the DB integration suite. Use an isolated test database.",
  );
}

let database: Database;

beforeAll(() => {
  database = createDatabase(databaseTestUrl, {
    allowExitOnIdle: true,
    max: 2,
  });
});

afterAll(async () => {
  await database.$client.end();
});

describe("transaction-local database context", () => {
  it("keeps concurrent transaction settings isolated and clears them after commit", async () => {
    const firstReady = deferred<void>();
    const secondReady = deferred<void>();
    const releaseTransactions = deferred<void>();

    const firstTransaction = database.transaction(async (transaction) => {
      await setLocalValue(transaction, "transaction-a");
      firstReady.resolve();
      await releaseTransactions.promise;

      return readLocalValue(transaction);
    });
    const secondTransaction = database.transaction(async (transaction) => {
      await setLocalValue(transaction, "transaction-b");
      secondReady.resolve();
      await releaseTransactions.promise;

      return readLocalValue(transaction);
    });

    await Promise.all([firstReady.promise, secondReady.promise]);
    releaseTransactions.resolve();

    await expect(Promise.all([firstTransaction, secondTransaction])).resolves.toEqual([
      "transaction-a",
      "transaction-b",
    ]);

    const valuesAfterCommit = await readFromConcurrentTransactions();

    expect(valuesAfterCommit.every(isUnset)).toBe(true);
  });

  it("clears transaction-local settings after rollback", async () => {
    const rollbackError = new Error("force rollback");

    await expect(
      database.transaction(async (transaction) => {
        await setLocalValue(transaction, "rolled-back-transaction");
        expect(await readLocalValue(transaction)).toBe("rolled-back-transaction");

        throw rollbackError;
      }),
    ).rejects.toBe(rollbackError);

    const valueAfterRollback = await database.transaction(readLocalValue);

    expect(isUnset(valueAfterRollback)).toBe(true);
  });
});

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function setLocalValue(transaction: Transaction, value: string) {
  await transaction.execute(sql`select set_config(${settingName}, ${value}, true)`);
}

async function readLocalValue(transaction: Transaction) {
  const result = await transaction.execute(
    sql<{ value: string | null }>`select current_setting(${settingName}, true) as value`,
  );
  const value: unknown = result.rows[0]?.value;

  return typeof value === "string" ? value : null;
}

async function readFromConcurrentTransactions() {
  const firstRead = deferred<void>();
  const secondRead = deferred<void>();
  const releaseReads = deferred<void>();

  const read = (ready: ReturnType<typeof deferred<void>>) =>
    database.transaction(async (transaction) => {
      ready.resolve();
      await releaseReads.promise;

      return readLocalValue(transaction);
    });

  const values = Promise.all([read(firstRead), read(secondRead)]);

  await Promise.all([firstRead.promise, secondRead.promise]);
  releaseReads.resolve();

  return values;
}

function isUnset(value: string | null) {
  return value === null || value === "";
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
