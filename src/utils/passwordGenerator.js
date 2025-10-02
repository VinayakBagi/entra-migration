import crypto from "crypto";

export function generateSecurePassword(length = 16) {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  let password = "";
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];

  const allChars = lowercase + uppercase + numbers + symbols;
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export function generatePasswordBatch(count) {
  return Array.from({ length: count }, () => generateSecurePassword());
}
