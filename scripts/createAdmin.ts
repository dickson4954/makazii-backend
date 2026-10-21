import "dotenv/config";
import bcrypt from "bcryptjs";

import prisma from "../src/config/prisma";

async function main() {
  const firstName = "Makazii";
  const lastName = "Admin";
  const email = "admin@makazii.test";
  const phone = "0700000000";
  const password = "Admin1234";

  const existingAdmin = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingAdmin) {
    if (existingAdmin.role !== "ADMIN") {
      throw new Error(
        `A user with ${email} already exists but is not an ADMIN.`
      );
    }

    console.log("Admin account already exists.");
    console.log({
      id: existingAdmin.id,
      email: existingAdmin.email,
      role: existingAdmin.role,
      isActive: existingAdmin.isActive,
    });

    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Initial MAKAZII admin created successfully.");
  console.log({
    id: admin.id,
    firstName: admin.firstName,
    lastName: admin.lastName,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    isActive: admin.isActive,
  });

  console.log("");
  console.log("Admin login credentials:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
