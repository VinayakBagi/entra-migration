import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create test users
  const users = [
    {
      username: "johndoe",
      email: "john@example.com",
      password: await bcrypt.hash("password123", 10),
      isActive: true,
    },
    {
      username: "janedoe",
      email: "jane@example.com",
      password: await bcrypt.hash("password123", 10),
      isActive: true,
    },
    {
      username: "bobsmith",
      email: "bob@example.com",
      password: await bcrypt.hash("password123", 10),
      isActive: true,
    },
  ];

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
    console.log(`✓ Created user: ${created.email}`);
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
