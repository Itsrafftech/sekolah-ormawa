import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getServerEnvironment } from "@/lib/env";

export interface PrivateStorageAdapter {
  put(objectKey: string, bytes: Uint8Array): Promise<void>;
  read(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

function resolvePrivatePath(root: string, objectKey: string): string {
  const storageBase = path.resolve(process.cwd(), "storage");
  const absoluteRoot = path.resolve(storageBase, root);
  if (absoluteRoot !== storageBase && !absoluteRoot.startsWith(`${storageBase}${path.sep}`)) {
    throw new Error("Private storage root berada di luar folder storage.");
  }
  const target = path.resolve(absoluteRoot, objectKey);
  if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error("Object key berada di luar private storage root.");
  }
  return target;
}

export class DevelopmentPrivateStorage implements PrivateStorageAdapter {
  constructor(private readonly root = getServerEnvironment().STORAGE_PRIVATE_ROOT) {}

  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    const target = resolvePrivatePath(this.root, objectKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  }

  async read(objectKey: string): Promise<Buffer> {
    return readFile(resolvePrivatePath(this.root, objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(resolvePrivatePath(this.root, objectKey), { force: true });
  }
}

export interface SignedPrivateStorageAdapter extends PrivateStorageAdapter {
  createSignedUpload(objectKey: string, expiresInSeconds: number): Promise<string>;
  createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string>;
}

/**
 * Production private storage: self-hosted MinIO (Contabo), spoken to via
 * the S3 API (MinIO is S3-compatible) - see ADR-035, RUNBOOK.md §Private
 * storage. The bucket is private with no public/anonymous access policy;
 * `put`/`read`/`delete` authenticate with the app's own MinIO credentials
 * and are used by every current call site (registration submit/upload,
 * admin file viewer) exactly as `DevelopmentPrivateStorage` is today - the
 * app never hands a storage URL to a browser, so there is no permanent
 * public URL by construction, not just by bucket policy.
 * `createSignedUpload`/`createSignedDownload` additionally expose genuine
 * short-lived (`STORAGE_SIGNED_URL_TTL_SECONDS`, default 300s) presigned
 * S3 URLs for any future call site that wants to let a client
 * upload/download directly against MinIO without proxying bytes through
 * this Node process.
 */
export class MinioPrivateStorage implements SignedPrivateStorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env = getServerEnvironment()) {
    if (!env.MINIO_ENDPOINT || !env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) {
      throw new Error(
        "MINIO_ENDPOINT, MINIO_ACCESS_KEY, dan MINIO_SECRET_KEY wajib untuk MinioPrivateStorage.",
      );
    }
    this.bucket = env.STORAGE_BUCKET_CANDIDATES;
    this.client = new S3Client({
      endpoint: env.MINIO_ENDPOINT,
      region: env.MINIO_REGION,
      credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY,
        secretAccessKey: env.MINIO_SECRET_KEY,
      },
      // MinIO addresses buckets by path (https://host/bucket/key), not by
      // virtual-hosted subdomain (https://bucket.host/key) - self-hosted
      // MinIO has no wildcard DNS/cert for the latter.
      forcePathStyle: true,
    });
  }

  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: bytes,
    }));
  }

  async read(objectKey: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    }));
    if (!result.Body) throw new Error(`Object ${objectKey} tidak memiliki body.`);
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    }));
  }

  async createSignedUpload(objectKey: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }

  async createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }
}

export function getPrivateStorage(): PrivateStorageAdapter {
  if (process.env.NODE_ENV === "production") {
    return new MinioPrivateStorage();
  }
  return new DevelopmentPrivateStorage();
}
