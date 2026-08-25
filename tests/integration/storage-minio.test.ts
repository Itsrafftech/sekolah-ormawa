import { randomUUID } from "node:crypto";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Phase 9: exercises MinioPrivateStorage against a real, local, ephemeral
// MinIO container (S3-compatible) - not a mock - so put/read/delete and
// presigned URL generation are proven against the actual API surface the
// production adapter will use on Contabo.
const endpoint = process.env.MINIO_TEST_ENDPOINT;
if (!endpoint) throw new Error("MINIO_TEST_ENDPOINT wajib untuk integration test storage MinIO.");

const bucket = `sekolah-storage-test-${randomUUID().slice(0, 8)}`;
const accessKeyId = "testadmin";
const secretAccessKey = "testpassword123";

let MinioPrivateStorage: typeof import("@/server/storage/private-storage").MinioPrivateStorage;
let setupClient: S3Client;

beforeAll(async () => {
  ({ MinioPrivateStorage } = await import("@/server/storage/private-storage"));

  setupClient = new S3Client({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  await setupClient.send(new CreateBucketCommand({ Bucket: bucket }));
  await setupClient.send(new HeadBucketCommand({ Bucket: bucket }));
});

afterAll(async () => {
  const listed = await setupClient.send(new ListObjectsV2Command({ Bucket: bucket }));
  const keys = (listed.Contents ?? []).map((object) => ({ Key: object.Key! }));
  if (keys.length > 0) {
    await setupClient.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
  }
  await setupClient.send(new DeleteBucketCommand({ Bucket: bucket }));
});

function buildStorage() {
  return new MinioPrivateStorage({
    MINIO_ENDPOINT: endpoint,
    MINIO_REGION: "us-east-1",
    MINIO_ACCESS_KEY: accessKeyId,
    MINIO_SECRET_KEY: secretAccessKey,
    STORAGE_BUCKET_CANDIDATES: bucket,
  } as ConstructorParameters<typeof MinioPrivateStorage>[0]);
}

describe("MinioPrivateStorage (S3-compatible, real MinIO)", () => {
  it("put lalu read mengembalikan byte yang identik", async () => {
    const storage = buildStorage();
    const objectKey = `period-fixture/${randomUUID()}.pdf`;
    const original = new TextEncoder().encode("%PDF-1.4 synthetic minio fixture");

    await storage.put(objectKey, original);
    const readBack = await storage.read(objectKey);

    expect(Buffer.from(readBack)).toEqual(Buffer.from(original));
  });

  it("delete membuat object berikutnya tidak terbaca", async () => {
    const storage = buildStorage();
    const objectKey = `period-fixture/${randomUUID()}.png`;
    await storage.put(objectKey, new Uint8Array([1, 2, 3, 4]));

    await storage.delete(objectKey);

    await expect(storage.read(objectKey)).rejects.toThrow();
  });

  it("createSignedDownload menghasilkan URL presigned yang benar-benar bisa diunduh tanpa credential", async () => {
    const storage = buildStorage();
    const objectKey = `period-fixture/${randomUUID()}.pdf`;
    const original = new TextEncoder().encode("%PDF-1.4 synthetic signed download fixture");
    await storage.put(objectKey, original);

    const url = await storage.createSignedDownload(objectKey, 300);
    expect(url).toContain(bucket);
    expect(url).toContain("X-Amz-Signature");

    // Fetch with a plain, unauthenticated HTTP client - proves the signed
    // URL itself carries valid, working authorization (not just that the
    // SDK produced *a* string).
    const response = await fetch(url);
    expect(response.status).toBe(200);
    const downloaded = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(downloaded)).toEqual(Buffer.from(original));
  });

  it("createSignedUpload menghasilkan URL presigned yang bisa dipakai PUT langsung", async () => {
    const storage = buildStorage();
    const objectKey = `period-fixture/${randomUUID()}.png`;
    const payload = new Uint8Array([9, 9, 9, 9, 9]);

    const url = await storage.createSignedUpload(objectKey, 300);
    const response = await fetch(url, { method: "PUT", body: payload });
    expect(response.status).toBe(200);

    const readBack = await storage.read(objectKey);
    expect(Buffer.from(readBack)).toEqual(Buffer.from(payload));
  });

  it("URL presigned yang sudah kedaluwarsa (TTL negatif) ditolak", async () => {
    const storage = buildStorage();
    const objectKey = `period-fixture/${randomUUID()}.pdf`;
    await storage.put(objectKey, new Uint8Array([1]));

    const url = await storage.createSignedDownload(objectKey, -10);
    const response = await fetch(url);
    expect(response.status).not.toBe(200);
  });

  it("melempar error yang jelas jika kredensial MinIO tidak lengkap", async () => {
    expect(() => new MinioPrivateStorage({
      MINIO_ENDPOINT: undefined,
      MINIO_REGION: "us-east-1",
      MINIO_ACCESS_KEY: undefined,
      MINIO_SECRET_KEY: undefined,
      STORAGE_BUCKET_CANDIDATES: bucket,
    } as ConstructorParameters<typeof MinioPrivateStorage>[0])).toThrow(/MINIO_ENDPOINT/);
  });
});
