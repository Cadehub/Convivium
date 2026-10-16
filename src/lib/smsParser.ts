import type { MobileOperator, Order } from '../types';

export interface ParsedSmsResult {
  detectedOperator: MobileOperator | null;
  extractedAmount: number | null;
  extractedReference: string | null;
  extractedDateTime: string | null;
  extractedPhoneNumber: string | null;
  isRecognizedFormat: boolean;
  rawSms: string;
}

export type AmountMatchStatus = 'exact_match' | 'mismatch' | 'not_detected';

export interface SmsVerificationAnalysis {
  parsed: ParsedSmsResult;
  amountStatus: AmountMatchStatus;
  amountDifference: number | null; // extractedAmount - expectedAmount
  operatorConsistent: boolean;
  isDuplicateRef: boolean;
  duplicateOrderRefs: string[];
  warnings: string[];
  isInformationConsistent: boolean;
}

/**
 * Parses raw SMS confirmation from Orange Money Cameroon or MTN MoMo Cameroon.
 * Deterministic, offline, zero external dependencies.
 */
export function parseMobileMoneySms(rawText: string | null | undefined): ParsedSmsResult {
  const emptyResult: ParsedSmsResult = {
    detectedOperator: null,
    extractedAmount: null,
    extractedReference: null,
    extractedDateTime: null,
    extractedPhoneNumber: null,
    isRecognizedFormat: false,
    rawSms: '',
  };

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return emptyResult;
  }

  const clean = rawText.trim();
  const lower = clean.toLowerCase();

  // 1. Detect Network / Operator
  let detectedOperator: MobileOperator | null = null;
  const isOrange =
    lower.includes('orange') ||
    lower.includes('om') ||
    /\b(om|pp)\d{4,}/i.test(clean) ||
    lower.includes('#150#');

  const isMtn =
    lower.includes('mtn') ||
    lower.includes('momo') ||
    lower.includes('mobile money') ||
    /\b(mp|ci)\d{4,}/i.test(clean) ||
    lower.includes('*126#');

  if (isOrange && !isMtn) {
    detectedOperator = 'orange';
  } else if (isMtn && !isOrange) {
    detectedOperator = 'mtn';
  } else if (isOrange && isMtn) {
    // Both present, check reference prefix
    if (/\b(om|pp)\d+/i.test(clean)) detectedOperator = 'orange';
    else if (/\b(mp|ci)\d+/i.test(clean)) detectedOperator = 'mtn';
  }

  // 2. Extract Amount
  let extractedAmount: number | null = null;

  // Patterns for Cameroonian SMS formats
  // e.g. "Paiement de 5000 FCFA", "payé 12 500 F CFA", "Payment of 8,000 XAF", "Transfert de 4500 FCFA"
  const amountPatterns = [
    /(?:paiement\s+(?:marchand\s+)?(?:de\s+)?|pay[eé]\s+(?:de\s+)?|transfert\s+(?:de\s+)?|transf[eé]r[eé]\s+(?:de\s+)?|payment\s+of\s+|sent\s+|montant\s*[:\.]?\s*)([0-9\s,\.]+)\s*(?:fcfa|f\s*cfa|xaf|f\b)/i,
    /(?:montant\s+d[eé]bit[eé]\s*[:\.]?\s*)([0-9\s,\.]+)\s*(?:fcfa|f\s*cfa|xaf|f\b)/i,
    /(?:total\s*[:\.]?\s*)([0-9\s,\.]+)\s*(?:fcfa|f\s*cfa|xaf|f\b)/i,
    /([0-9\s,\.]{2,12})\s*(?:fcfa|f\s*cfa|xaf)\b/i,
  ];

  for (const regex of amountPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      // Clean thousands separators: spaces, non-breaking spaces, commas, or dot (if followed by 3 digits)
      const rawNum = match[1]
        .replace(/\u00A0/g, '')
        .replace(/\s+/g, '')
        .replace(/,/g, '')
        .replace(/\.(?=\d{3})/g, '');

      const parsedNum = parseInt(rawNum, 10);
      if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum < 100000000) {
        extractedAmount = parsedNum;
        break;
      }
    }
  }

  // 3. Extract Reference / Transaction ID
  let extractedReference: string | null = null;

  const refPatterns = [
    // Labeled references: e.g. "ID Transaction: MP261016.1234.A12345", "Ref: 1234567890", "Txn ID: OM261016"
    /(?:id\s*(?:de\s+)?(?:transaction|txn)|txn\s*id|transaction\s*id|r[eé]f\s*(?:de\s+)?(?:transaction)?|r[eé]f[eé]rence|num[eé]ro\s*de\s*transaction)\s*[:\.]?\s*([A-Za-z0-9\._-]{5,35})/i,
    // Specific Cameroon Telecom standard format IDs (Orange OM, MTN MP/CI, PP, TXN)
    /\b((?:MP|OM|CI|PP)\d{6}\.[0-9A-Za-z\._-]+)\b/i,
    /\b(TXN[0-9A-Za-z_-]{6,30})\b/i,
    // Pure numeric reference of 10-14 digits (often used in MTN / Orange)
    /(?:r[eé]f|ref)\s*[:\.]?\s*(\d{8,16})/i,
  ];

  for (const regex of refPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      // Clean trailing punctuation
      const sanitized = match[1].replace(/[\.,;:!\s]+$/, '').trim();
      if (sanitized.length >= 5) {
        extractedReference = sanitized;
        break;
      }
    }
  }

  // 4. Extract Date & Time
  let extractedDateTime: string | null = null;
  const datePatterns = [
    // "16/10/2026 à 14:30:15", "16-10-2026 21:45", "2026-10-16 19:10:00"
    /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}(?:\s*(?:[aà@]\s*)?\d{1,2}[:h]\d{2}(?::\d{2})?)?)\b/i,
    /\b(\d{4}[\/-]\d{1,2}[\/-]\d{1,2}(?:\s*(?:[aà@]\s*)?\d{1,2}[:h]\d{2}(?::\d{2})?)?)\b/i,
    /(?:le|date\s*[:\.]?)\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}(?:\s*(?:[aà@]\s*)?\d{1,2}[:h]\d{2}(?::\d{2})?)?)/i,
  ];

  for (const regex of datePatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      extractedDateTime = match[1].trim();
      break;
    }
  }

  // 5. Extract Phone Number (Cameroon 9-digit starting with 6, e.g. 677123456 or 699123456)
  let extractedPhoneNumber: string | null = null;
  const phoneMatch = clean.match(
    /(?:au|à|a|pour|de|du|from|to|chez)?\s*(?:\+?237)?\s*(6[5-9]\d(?:[\s.-]*\d{2}){3}|6[5-9]\d{7})\b/i
  );
  if (phoneMatch && phoneMatch[1]) {
    const cleanedPhone = phoneMatch[1].replace(/[\s.-]/g, '');
    if (cleanedPhone.length === 9) {
      extractedPhoneNumber = cleanedPhone;
    }
  }

  // A format is considered recognized if we can at least extract an amount OR a reference
  const isRecognizedFormat = extractedAmount !== null || extractedReference !== null;

  return {
    detectedOperator,
    extractedAmount,
    extractedReference,
    extractedDateTime,
    extractedPhoneNumber,
    isRecognizedFormat,
    rawSms: clean,
  };
}

/**
 * Performs complete cross-check of parsed SMS against the server order total and history.
 */
export function analyzePaymentSms(params: {
  rawSms: string | null | undefined;
  expectedAmount: number;
  declaredOperator?: MobileOperator;
  allOrders?: Order[];
  currentOrderId?: string;
  declaredReference?: string | null;
}): SmsVerificationAnalysis {
  const {
    rawSms,
    expectedAmount,
    declaredOperator,
    allOrders = [],
    currentOrderId,
    declaredReference,
  } = params;

  const parsed = parseMobileMoneySms(rawSms);
  const warnings: string[] = [];

  // Check Amount Status
  let amountStatus: AmountMatchStatus = 'not_detected';
  let amountDifference: number | null = null;

  if (parsed.extractedAmount !== null) {
    amountDifference = parsed.extractedAmount - expectedAmount;
    if (parsed.extractedAmount === expectedAmount) {
      amountStatus = 'exact_match';
    } else {
      amountStatus = 'mismatch';
      if (amountDifference > 0) {
        warnings.push(`Montant supérieur au montant attendu : +${amountDifference} XAF.`);
      } else {
        warnings.push(`Montant inférieur au montant attendu : ${amountDifference} XAF (manquant).`);
      }
    }
  } else {
    amountStatus = 'not_detected';
    if (rawSms && rawSms.trim()) {
      warnings.push('Montant non détecté dans le SMS collé.');
    }
  }

  // Check Operator Consistency
  let operatorConsistent = true;
  if (declaredOperator && parsed.detectedOperator) {
    if (declaredOperator !== parsed.detectedOperator) {
      operatorConsistent = false;
      warnings.push(
        `Incohérence d'opérateur : déclaré en ${declaredOperator.toUpperCase()} mais le SMS semble provenir de ${parsed.detectedOperator.toUpperCase()}.`
      );
    }
  }

  // Duplicate Reference Check
  // Effective ref to check: extracted reference first, fallback to declared reference
  const effectiveRef = (parsed.extractedReference || declaredReference || '').trim();
  let isDuplicateRef = false;
  const duplicateOrderRefs: string[] = [];

  if (effectiveRef && effectiveRef.length >= 5 && allOrders.length > 0) {
    const cleanEffective = effectiveRef.toLowerCase();

    for (const ord of allOrders) {
      // Do not compare against the current order itself
      if (currentOrderId && ord.id === currentOrderId) continue;

      // Check in declarations
      const hasInDeclarations = ord.payment_declarations?.some(
        (d) => (d.declared_reference || '').toLowerCase() === cleanEffective
      );

      // Check in verifications
      const hasInVerifications = ord.payment_verifications?.some(
        (v) => (v.verified_reference || '').toLowerCase() === cleanEffective
      );

      if (hasInDeclarations || hasInVerifications) {
        isDuplicateRef = true;
        if (!duplicateOrderRefs.includes(ord.public_reference)) {
          duplicateOrderRefs.push(ord.public_reference);
        }
      }
    }

    if (isDuplicateRef) {
      warnings.push(
        `Alerte doublon critique : La référence « ${effectiveRef} » a déjà été déclarée sur la commande ${duplicateOrderRefs.join(', ')} !`
      );
    }
  }

  // Information is consistent if:
  // - Amount matches exactly
  // - Reference is extracted (or provided)
  // - No duplicate detected
  // - Operator is consistent
  const hasRef = Boolean(effectiveRef);
  const isInformationConsistent =
    amountStatus === 'exact_match' &&
    hasRef &&
    !isDuplicateRef &&
    operatorConsistent;

  return {
    parsed,
    amountStatus,
    amountDifference,
    operatorConsistent,
    isDuplicateRef,
    duplicateOrderRefs,
    warnings,
    isInformationConsistent,
  };
}
