import {
  readConfiguredAuthPassword,
  readConfiguredAuthUsername,
} from '@/lib/auth/config';

function constantTimeEqual(input: string, expected: string): boolean {
  if (input.length !== expected.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < input.length; index += 1) {
    result |= input.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return result === 0;
}

export function validateCredentials(params: {
  username: string;
  password: string;
}): boolean {
  const expectedUsername = readConfiguredAuthUsername();
  if (!expectedUsername) {
    throw new Error('username is required for authentication.');
  }

  const expectedPassword = readConfiguredAuthPassword();
  if (!expectedPassword) {
    throw new Error('password is required for authentication.');
  }

  return (
    constantTimeEqual(params.username, expectedUsername) &&
    constantTimeEqual(params.password, expectedPassword)
  );
}
