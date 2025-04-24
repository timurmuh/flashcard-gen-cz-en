import OpenAI from 'openai';
import { createHash } from 'crypto';

export function getEnvVar(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

// created because Google Gemini 2.0 for some reason does not accept `additionalProperties` in the JSON schema
export function removeUnsupportedProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>,
): OpenAI.ResponseFormatJSONSchema {
  if (typeof obj === 'object' && obj !== null) {
    const newObj = { ...obj };

    if (
      'additionalProperties' in newObj &&
      typeof newObj.additionalProperties === 'boolean'
    ) {
      delete newObj.additionalProperties;
    }

    if ('$schema' in newObj) {
      delete newObj.$schema;
    }

    for (const key in newObj) {
      if (key in newObj) {
        if (Array.isArray(newObj[key])) {
          newObj[key] = newObj[key].map(removeUnsupportedProperties);
        } else if (typeof newObj[key] === 'object' && newObj[key] !== null) {
          newObj[key] = removeUnsupportedProperties(newObj[key]);
        }
      }
    }

    return newObj as OpenAI.ResponseFormatJSONSchema;
  }

  return obj as OpenAI.ResponseFormatJSONSchema;
}

export function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}