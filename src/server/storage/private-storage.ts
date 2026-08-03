import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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

export interface SupabasePrivateStorageContract extends PrivateStorageAdapter {
  createSignedUpload(objectKey: string, expiresInSeconds: number): Promise<string>;
  createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string>;
}

export function getPrivateStorage(): PrivateStorageAdapter {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Adapter Supabase private storage production belum dikonfigurasi.");
  }
  return new DevelopmentPrivateStorage();
}
