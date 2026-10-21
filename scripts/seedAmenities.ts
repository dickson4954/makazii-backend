import prisma from "../src/config/prisma";

const amenities = [
  // Security
  "24/7 Security",
  "Security Guard",
  "CCTV",
  "Gated Compound",
  "Electric Fence",

  // Utilities
  "Reliable Water",
  "Borehole",
  "Backup Water Tank",
  "Prepaid Electricity",
  "Generator",
  "Backup Power",

  // Parking & Access
  "Parking",
  "Covered Parking",
  "Visitor Parking",
  "Secure Parking",

  // Interior
  "Fitted Kitchen",
  "Modern Kitchen",
  "Built-in Wardrobes",
  "Balcony",
  "Spacious Rooms",
  "Tiled Floors",
  "High-Speed Internet / Wi-Fi",

  // Laundry
  "Laundry Area",
  "Washing Machine Area",

  // Outdoor & Facilities
  "Garden",
  "Kids Play Area",
  "Rooftop",
  "Swimming Pool",
  "Gym",

  // Convenience
  "Lift / Elevator",
  "DSQ",
  "Pet Friendly",
  "Near Public Transport",
  "Near Schools",
  "Near Shopping Centre",
];

async function main() {
  console.log("MAKAZII AMENITY SEED");
  console.log("====================");

  for (const name of amenities) {
    await prisma.amenity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const total = await prisma.amenity.count();

  console.log(`\nAmenities in database: ${total}`);
}

main()
  .catch((error) => {
    console.error("Amenity seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
