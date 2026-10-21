import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma";

async function main() {
  const email = "test.marketer@makazii.test";
  const password = "Marketer1234";

  const user = await prisma.user.findUnique({
    where: { email },
    include: { marketer: true },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  if (user.role !== "MARKETER") {
    throw new Error(`Expected MARKETER, found ${user.role}`);
  }

  if (!user.marketer) {
    throw new Error("User exists but has no marketer record");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      isActive: true,
      accountStatus: "ACTIVE",
    },
  });

  console.log("");
  console.log("======================================");
  console.log("TEST MARKETER PASSWORD RESET");
  console.log("======================================");
  console.log(`Name:     ${user.firstName} ${user.lastName}`);
  console.log(`Email:    ${user.email}`);
  console.log(`Phone:    ${user.phone}`);
  console.log(`Role:     ${user.role}`);
  console.log(`Password: ${password}`);
  console.log(`Marketer: ${user.marketer.id}`);
  console.log("Active:   true");
  console.log("======================================");
}

main()
  .catch((error) => {
    console.error("Marketer password reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
