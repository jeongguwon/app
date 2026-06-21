import bcrypt from "bcryptjs";

const SECRET_ANSWER_SALT_ROUNDS = 10;

export async function hashSecretAnswer(answer: string): Promise<string> {
  const normalized = answer.trim();
  return bcrypt.hash(normalized, SECRET_ANSWER_SALT_ROUNDS);
}

export async function verifySecretAnswer(answer: string, hash: string): Promise<boolean> {
  return bcrypt.compare(answer.trim(), hash);
}
