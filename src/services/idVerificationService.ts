import fs from "node:fs/promises";

import { Profile, Scanner } from "idanalyzer2";

export type IdVerificationStatus =
  | "VERIFIED"
  | "REVIEW"
  | "REJECTED";

export interface VerifyMarketerIdentityInput {
  idType: "NATIONAL_ID" | "PASSPORT";
  idNumber: string;
  firstName: string;
  lastName: string;
  frontPath: string;
  backPath?: string;
}

export interface IdVerificationResult {
  status: IdVerificationStatus;
  decision: string | null;
  message: string | null;
  transactionId: string | null;
  extractedDocumentNumber: string | null;
  extractedFullName: string | null;
  providerResponse?: unknown;
}

/**
 * Normalize values before comparison.
 *
 * Example:
 * "Dickson  Murithi" -> "DICKSON MURITHI"
 * "12 345 678"        -> "12345678"
 */
function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeIdNumber(
  value: string
): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normalizeNameForComparison(
  value: string
): string {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(
  submittedFirstName: string,
  submittedLastName: string,
  extractedFullName: string
): boolean {
  const submitted = normalizeNameForComparison(
    `${submittedFirstName} ${submittedLastName}`
  );

  const extracted =
    normalizeNameForComparison(
      extractedFullName
    );

  if (!submitted || !extracted) {
    return false;
  }

  /**
   * Exact normalized match.
   */
  if (submitted === extracted) {
    return true;
  }

  /**
   * Some identity documents return names in a
   * different order.
   *
   * Compare the individual words rather than assuming
   * first-name/last-name ordering.
   */
  const submittedParts = submitted
    .split(" ")
    .filter(Boolean);

  const extractedParts = extracted
    .split(" ")
    .filter(Boolean);

  if (
    submittedParts.length === 0 ||
    extractedParts.length === 0
  ) {
    return false;
  }

  return submittedParts.every(
    (part) =>
      extractedParts.includes(part)
  );
}

function findFirstString(
  value: unknown,
  keys: string[]
): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const object =
    value as Record<string, unknown>;

  for (const key of keys) {
    const candidate = object[key];

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  for (const child of Object.values(object)) {
    const result = findFirstString(
      child,
      keys
    );

    if (result) {
      return result;
    }
  }

  return null;
}

function findTransactionId(
  value: unknown
): string | null {
  return findFirstString(value, [
    "transactionId",
    "transactionID",
    "transaction_id",
    "scanId",
    "scanID",
    "reference",
    "ref",
  ]);
}

function findDecision(
  value: unknown
): string | null {
  return findFirstString(value, [
    "decision",
    "status",
    "result",
    "verificationStatus",
  ]);
}

function findDocumentNumber(
  value: unknown
): string | null {
  return findFirstString(value, [
    "documentNumber",
    "documentNo",
    "documentID",
    "documentId",
    "idNumber",
    "idNo",
    "passportNumber",
    "passportNo",
    "number",
  ]);
}

function findFullName(
  value: unknown
): string | null {
  const direct = findFirstString(value, [
    "fullName",
    "fullname",
    "name",
    "nameFull",
  ]);

  if (direct) {
    return direct;
  }

  const firstName = findFirstString(
    value,
    [
      "firstName",
      "firstname",
      "givenName",
      "givenNames",
    ]
  );

  const lastName = findFirstString(
    value,
    [
      "lastName",
      "lastname",
      "surname",
      "familyName",
    ]
  );

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  return firstName || lastName;
}

function providerLooksRejected(
  value: unknown
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const object =
    value as Record<string, unknown>;

  const decision = findDecision(value);

  if (
    decision &&
    [
      "REJECTED",
      "REJECT",
      "FAILED",
      "FAIL",
      "INVALID",
      "UNVERIFIED",
      "DECLINED",
    ].includes(
      normalizeText(decision)
    )
  ) {
    return true;
  }

  if (
    object.success === false ||
    object.verified === false ||
    object.valid === false
  ) {
    return true;
  }

  return false;
}

function providerLooksVerified(
  value: unknown
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const object =
    value as Record<string, unknown>;

  const decision = findDecision(value);

  if (
    decision &&
    [
      "VERIFIED",
      "VERIFY",
      "APPROVED",
      "PASS",
      "PASSED",
      "VALID",
      "SUCCESS",
    ].includes(
      normalizeText(decision)
    )
  ) {
    return true;
  }

  if (
    object.success === true &&
    object.verified !== false &&
    object.valid !== false
  ) {
    return true;
  }

  if (
    object.verified === true ||
    object.valid === true
  ) {
    return true;
  }

  return false;
}

/**
 * -------------------------------------------------------------
 * VERIFY MARKETER IDENTITY
 * -------------------------------------------------------------
 *
 * This calls ID Analyzer from the backend.
 *
 * IMPORTANT:
 * The API key is never sent to the mobile application.
 */
export async function verifyMarketerIdentity(
  input: VerifyMarketerIdentityInput
): Promise<IdVerificationResult> {
  const apiKey =
    process.env.IDANALYZER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "IDANALYZER_API_KEY is not configured"
    );
  }

  const scanner =
    new Scanner(apiKey);

  scanner.throwApiException(true);

  /**
   * HIGH security profile.
   */
  const profile =
    new Profile(
      Profile.SECURITY_HIGH
    );

  /**
   * Kenya only.
   */
  profile.restrictDocumentCountry(
    "KE"
  );

  /**
   * I = identity card
   * P = passport
   */
  profile.restrictDocumentType(
    input.idType ===
      "NATIONAL_ID"
      ? "I"
      : "P"
  );

  /**
   * Tell ID Analyzer to verify the supplied
   * document number and applicant name.
   */
  scanner.verifyUserInformation(
    input.idNumber.trim(),
    `${input.firstName.trim()} ${input.lastName.trim()}`
  );

  scanner.setCustomData(
    `MAKAZII-MARKETER-${normalizeIdNumber(
      input.idNumber
    )}`
  );

  scanner.setProfile(profile);

  let providerResponse: unknown;

  try {
    providerResponse =
      await scanner.scan(
        input.frontPath,
        input.backPath || ""
      );
  } catch (error) {
    console.error(
      "ID Analyzer scan failed:",
      error
    );

    throw new Error(
      "Identity document verification failed"
    );
  }

  const transactionId =
    findTransactionId(
      providerResponse
    );

  const decision =
    findDecision(
      providerResponse
    );

  /**
   * Provider explicitly rejected it.
   */
  if (
    providerLooksRejected(
      providerResponse
    )
  ) {
    return {
      status: "REJECTED",
      decision,
      message:
        "The identity document was rejected by the verification provider.",
      transactionId,
      extractedDocumentNumber:
        findDocumentNumber(
          providerResponse
        ),
      extractedFullName:
        findFullName(
          providerResponse
        ),
    };
  }

  const extractedDocumentNumber =
    findDocumentNumber(
      providerResponse
    );

  const extractedFullName =
    findFullName(
      providerResponse
    );

  /**
   * If the provider returned an ID number,
   * compare it against what the applicant entered.
   */
  if (
    extractedDocumentNumber
  ) {
    const submittedId =
      normalizeIdNumber(
        input.idNumber
      );

    const extractedId =
      normalizeIdNumber(
        extractedDocumentNumber
      );

    if (
      submittedId !== extractedId
    ) {
      return {
        status: "REJECTED",
        decision,
        message:
          "The ID number on the uploaded document does not match the submitted ID number.",
        transactionId,
        extractedDocumentNumber,
        extractedFullName,
      };
    }
  }

  /**
   * If a name was extracted, compare it with
   * the submitted first and last names.
   */
  if (extractedFullName) {
    const match =
      namesMatch(
        input.firstName,
        input.lastName,
        extractedFullName
      );

    if (!match) {
      return {
        status: "REJECTED",
        decision,
        message:
          "The name on the uploaded identity document does not match the submitted name.",
        transactionId,
        extractedDocumentNumber,
        extractedFullName,
      };
    }
  }

  /**
   * If the provider explicitly confirms verification
   * and the identity data matches, accept it.
   */
  if (
    providerLooksVerified(
      providerResponse
    )
  ) {
    return {
      status: "VERIFIED",
      decision,
      message:
        "Identity document verified successfully.",
      transactionId,
      extractedDocumentNumber,
      extractedFullName,
    };
  }

  /**
   * We do NOT guess when the provider response is
   * ambiguous.
   *
   * Send it to administrator review instead.
   */
  return {
    status: "REVIEW",
    decision,
    message:
      "The identity document requires additional review.",
    transactionId,
    extractedDocumentNumber,
    extractedFullName,
  };
}

/**
 * -------------------------------------------------------------
 * CLEAN TEMPORARY VERIFICATION FILES
 * -------------------------------------------------------------
 */
export async function cleanupVerificationFiles(
  filePaths: string[]
): Promise<void> {
  await Promise.all(
    filePaths.map(async (filePath) => {
      if (!filePath) {
        return;
      }

      try {
        await fs.unlink(filePath);
      } catch {
        /**
         * Ignore missing files.
         */
      }
    })
  );
}
