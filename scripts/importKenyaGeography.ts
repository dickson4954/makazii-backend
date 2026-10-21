import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import prisma from "../src/config/prisma";

type CountyRecord = {
  id: string;
  name_en: string;
  name_local: string;
  slug: string;
  lat?: number;
  lon?: number;
};

type ConstituencyRecord = {
  id: string;
  name_en: string;
  name_local: string;
  parent_id: string;
  parent_name_en: string;
  parent_name_local: string;
  slug: string;
  lat?: number;
  lon?: number;
};

type WardRecord = {
  id: string;
  name_en: string;
  name_local: string;
  parent_id: string;
  parent_name_en: string;
  parent_name_local: string;
  slug: string;
  lat?: number;
  lon?: number;
};

type GeographyData = {
  meta: unknown;
  data: {
    county: CountyRecord[];
    subcounty: ConstituencyRecord[];
    ward: WardRecord[];
  };
};

const DATA_FILE = path.resolve(
  process.cwd(),
  "prisma/data/kenya-geography.json",
);

async function main() {
  console.log("========================================");
  console.log(" MAKAZII KENYA GEOGRAPHY IMPORT");
  console.log("========================================");
  console.log();

  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Geography file not found: ${DATA_FILE}`);
  }

  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const json = JSON.parse(raw) as GeographyData;

  const counties = json.data.county;
  const constituencies = json.data.subcounty;
  const wards = json.data.ward;

  console.log(`Source counties:        ${counties.length}`);
  console.log(`Source constituencies:  ${constituencies.length}`);
  console.log(`Source wards:           ${wards.length}`);
  console.log();

  if (counties.length !== 47) {
    throw new Error(
      `Expected 47 counties but found ${counties.length}. Aborting.`,
    );
  }

  if (constituencies.length !== 290) {
    throw new Error(
      `Expected 290 constituencies but found ${constituencies.length}. Aborting.`,
    );
  }

  if (wards.length !== 1450) {
    throw new Error(
      `Expected 1450 wards but found ${wards.length}. Aborting.`,
    );
  }

  /*
   * -------------------------------------------------------
   * STEP 1: IMPORT COUNTIES
   * -------------------------------------------------------
   *
   * We intentionally preserve existing internal IDs.
   *
   * Existing county records are matched by name.
   * New counties receive their dataset ID as their internal
   * Prisma ID as well as sourceId.
   *
   * For Meru specifically:
   *
   * existing id:
   * cmuqog1fz0000g9se6qrpw0ob
   *
   * sourceId becomes:
   * KE012
   */
  console.log("Importing counties...");

  const countyIdBySourceId = new Map<string, string>();

  for (const county of counties) {
    const existing = await prisma.county.findFirst({
      where: {
        OR: [
          { sourceId: county.id },
          { name: county.name_en },
          { name: county.name_local },
        ],
      },
      select: {
        id: true,
        name: true,
        sourceId: true,
      },
    });

    if (existing) {
      const updated = await prisma.county.update({
        where: {
          id: existing.id,
        },
        data: {
          sourceId: county.id,
          name: county.name_en,
        },
        select: {
          id: true,
          name: true,
          sourceId: true,
        },
      });

      countyIdBySourceId.set(county.id, updated.id);

      console.log(
        `  Updated county: ${updated.name} (${updated.sourceId}) [${updated.id}]`,
      );
    } else {
      const created = await prisma.county.create({
        data: {
          id: county.id,
          sourceId: county.id,
          name: county.name_en,
        },
        select: {
          id: true,
          name: true,
          sourceId: true,
        },
      });

      countyIdBySourceId.set(county.id, created.id);

      console.log(
        `  Created county: ${created.name} (${created.sourceId}) [${created.id}]`,
      );
    }
  }

  console.log();
  console.log(`County mapping created: ${countyIdBySourceId.size}`);
  console.log();

  /*
   * -------------------------------------------------------
   * STEP 2: IMPORT CONSTITUENCIES
   * -------------------------------------------------------
   *
   * Dataset calls these "subcounty".
   *
   * Each record contains:
   *
   * id        -> constituency source ID
   * parent_id -> county source ID
   */
  console.log("Importing constituencies...");

  const constituencyIdBySourceId = new Map<string, string>();

  for (const constituency of constituencies) {
    const countyId = countyIdBySourceId.get(constituency.parent_id);

    if (!countyId) {
      throw new Error(
        `County not found for constituency ${constituency.id}: ${constituency.parent_id}`,
      );
    }

    const existing = await prisma.constituency.findFirst({
      where: {
        OR: [
          { sourceId: constituency.id },
          {
            countyId,
            name: constituency.name_en,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        sourceId: true,
      },
    });

    if (existing) {
      const updated = await prisma.constituency.update({
        where: {
          id: existing.id,
        },
        data: {
          sourceId: constituency.id,
          name: constituency.name_en,
          countyId,
        },
        select: {
          id: true,
          name: true,
          sourceId: true,
        },
      });

      constituencyIdBySourceId.set(constituency.id, updated.id);
    } else {
      const created = await prisma.constituency.create({
        data: {
          id: constituency.id,
          sourceId: constituency.id,
          name: constituency.name_en,
          countyId,
        },
        select: {
          id: true,
          name: true,
          sourceId: true,
        },
      });

      constituencyIdBySourceId.set(constituency.id, created.id);
    }
  }

  console.log(
    `Constituency mapping created: ${constituencyIdBySourceId.size}`,
  );
  console.log();

  /*
   * -------------------------------------------------------
   * STEP 3: IMPORT WARDS
   * -------------------------------------------------------
   *
   * Each ward contains:
   *
   * parent_id -> constituency source ID
   */
  console.log("Importing wards...");

  let wardCount = 0;

  for (const ward of wards) {
    const constituencyId = constituencyIdBySourceId.get(ward.parent_id);

    if (!constituencyId) {
      throw new Error(
        `Constituency not found for ward ${ward.id}: ${ward.parent_id}`,
      );
    }

    const existing = await prisma.ward.findFirst({
      where: {
        OR: [
          { sourceId: ward.id },
          {
            constituencyId,
            name: ward.name_en,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        sourceId: true,
      },
    });

    if (existing) {
      await prisma.ward.update({
        where: {
          id: existing.id,
        },
        data: {
          sourceId: ward.id,
          name: ward.name_en,
          constituencyId,
        },
      });
    } else {
      await prisma.ward.create({
        data: {
          id: ward.id,
          sourceId: ward.id,
          name: ward.name_en,
          constituencyId,
        },
      });
    }

    wardCount++;

    if (wardCount % 100 === 0) {
      console.log(`  Processed ${wardCount}/${wards.length} wards...`);
    }
  }

  console.log(`Ward records processed: ${wardCount}`);
  console.log();

  /*
   * -------------------------------------------------------
   * STEP 4: FINAL VERIFICATION
   * -------------------------------------------------------
   */
  const finalCountyCount = await prisma.county.count();
  const finalConstituencyCount = await prisma.constituency.count();
  const finalWardCount = await prisma.ward.count();

  const meru = await prisma.county.findUnique({
    where: {
      name: "Meru",
    },
    select: {
      id: true,
      sourceId: true,
      name: true,
      places: {
        select: {
          id: true,
          name: true,
          countyId: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  console.log("========================================");
  console.log(" IMPORT COMPLETE");
  console.log("========================================");
  console.log();
  console.log(`Counties:        ${finalCountyCount}`);
  console.log(`Constituencies:  ${finalConstituencyCount}`);
  console.log(`Wards:           ${finalWardCount}`);
  console.log();

  console.log("MERU:");
  console.dir(meru, { depth: null });
  console.log();

  if (finalCountyCount !== 47) {
    throw new Error(
      `Verification failed: expected 47 counties, found ${finalCountyCount}`,
    );
  }

  if (finalConstituencyCount !== 290) {
    throw new Error(
      `Verification failed: expected 290 constituencies, found ${finalConstituencyCount}`,
    );
  }

  if (finalWardCount !== 1450) {
    throw new Error(
      `Verification failed: expected 1450 wards, found ${finalWardCount}`,
    );
  }

  if (!meru) {
    throw new Error("Verification failed: Meru county not found.");
  }

  if (meru.sourceId !== "KE012") {
    throw new Error(
      `Verification failed: Meru sourceId should be KE012 but is ${meru.sourceId}`,
    );
  }

  console.log("✓ 47 counties verified");
  console.log("✓ 290 constituencies verified");
  console.log("✓ 1,450 wards verified");
  console.log("✓ Meru mapped to KE012");
  console.log(`✓ ${meru.places.length} existing Meru Places preserved`);
  console.log();
  console.log("Geography import successful.");
}

main()
  .catch((error) => {
    console.error();
    console.error("GEOGRAPHY IMPORT FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
