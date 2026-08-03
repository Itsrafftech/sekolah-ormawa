import { hash, type Options, verify } from "@node-rs/argon2";

export const ARGON2_OPTIONS: Options = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
  // @node-rs/argon2 exposes Algorithm as an ambient const enum, which is
  // incompatible with isolatedModules. The documented Argon2id value is 2.
  algorithm: 2,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword({
  password,
  hash: passwordHash,
}: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return verify(passwordHash, password, ARGON2_OPTIONS);
}
