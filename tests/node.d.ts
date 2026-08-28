declare module "node:assert/strict" {
  interface Assert {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    match(actual: string, expected: RegExp, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    throws(block: () => unknown, error?: RegExp | ((error: unknown) => boolean), message?: string): void;
  }

  const assert: Assert;
  export default assert;
}

declare module "node:fs/promises" {
  export function readFile(path: URL, encoding: "utf8"): Promise<string>;
}

declare module "node:crypto" {
  interface Hash {
    update(value: string): Hash;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: "sha256"): Hash;
}

declare module "node:test" {
  type TestBody = () => void | Promise<void>;

  function test(name: string, body: TestBody): void;
  export default test;
}
