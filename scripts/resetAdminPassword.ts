import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma";

async function main() {
  const email = "admin@makazii.test";
  const password = "Admin1234";

  const admin = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!admin) {
    throw new Error(`Admin account not found: ${email}`);
  }

  if (admin.role !== "ADMIN") {
    throw new Error(
      `Account exists but role is ${admin.role}, not ADMIN.`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      password: passwordHash,
      isActive: true,
    },
  });

  console.log("");
  console.log("======================================");
  console.log("MAKAZII ADMIN PASSWORD RESET");
  console.log("======================================");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     ${admin.role}`);
  console.log("Active:   true");
  console.log("======================================");
}

main()
  .catch((error) => {
    console.error("Admin password reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
