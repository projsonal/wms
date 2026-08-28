

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function camelizeKeysDeep<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((item) => camelizeKeysDeep(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[snakeToCamel(key)] = camelizeKeysDeep(value);
    }
    return result as T;
  }
  return input as T;
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function snakeizeKeysDeep<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((item) => snakeizeKeysDeep(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[camelToSnake(key)] = snakeizeKeysDeep(value);
    }
    return result as T;
  }
  return input as T;
}
