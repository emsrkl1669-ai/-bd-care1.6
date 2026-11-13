import { generatePatientCode } from './idCard';

/**
 * Ensure document / subcollection ID strictly conforms to Firestore rule:
 * ^[a-zA-Z0-9_\-]+$ (1 to 128 chars)
 */
export function sanitizeFirestoreId(rawId: string | undefined, prefix: string = 'doc'): string {
  const cleaned = (rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  if (cleaned.length >= 1) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Compress an image dataUrl using an offscreen Canvas so it fits safely within
 * Firestore document/media attachment limits (max 850,000 chars; 500,000 for delivery photo).
 */
export async function compressImageDataUrl(
  dataUrl: string,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number; maxDataUrlLength?: number }
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 1200;
  const maxHeight = options?.maxHeight ?? 1200;
  const maxDataUrlLength = options?.maxDataUrlLength ?? 780000;
  let quality = options?.quality ?? 0.78;

  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > maxDataUrlLength && quality > 0.35) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        // If still over limit, scale down resolution once more
        if (result.length > maxDataUrlLength && width > 720) {
          const scale = 720 / width;
          canvas.width = 720;
          canvas.height = Math.max(1, Math.round(height * scale));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.65);
        }

        resolve(result);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export interface ProcessedUploadFile {
  dataUrl: string;
  fileType: string;
  fileSize: number;
  tooLargeForCloud?: boolean;
}

/**
 * Read a user-selected File into a compressed base64 dataUrl.
 * Compresses images automatically; checks PDF size against Firestore 850KB char ceiling.
 */
export async function processFileForUpload(
  file: File,
  maxDataUrlLength: number = 780000
): Promise<ProcessedUploadFile> {
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) || '');
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    reader.readAsDataURL(file);
  });

  if (file.type.startsWith('image/')) {
    const compressed = await compressImageDataUrl(rawDataUrl, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.78,
      maxDataUrlLength,
    });
    return {
      dataUrl: compressed,
      fileType: 'image/jpeg',
      fileSize: Math.round((compressed.length * 3) / 4),
      tooLargeForCloud: compressed.length > 840000,
    };
  }

  return {
    dataUrl: rawDataUrl,
    fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
    fileSize: file.size,
    tooLargeForCloud: rawDataUrl.length > 840000,
  };
}

/**
 * Generate non-colliding patient code: BDC - {YY}-{NNN}
 * Finds the highest existing sequence number for the matching Buddhist Era short year and increments by 1.
 */
export function getNextPatientCode(admissionDateStr: string | undefined, existingCodes: string[]): string {
  const targetPrefixWithCode = generatePatientCode(admissionDateStr, 1); // e.g. "BDC - 68-001"
  const matchPrefix = targetPrefixWithCode.match(/^(BDC\s*-\s*\d{2}-)/);
  const shortYearMatch = targetPrefixWithCode.match(/(\d{2})-\d+$/);
  const yy = shortYearMatch ? shortYearMatch[1] : String((new Date().getFullYear() + 543)).slice(-2);

  let maxSeq = 0;
  const pattern = new RegExp(`^BDC\\s*-\\s*${yy}\\s*-\\s*(\\d+)$`, 'i');
  for (const code of existingCodes) {
    const m = (code || '').trim().match(pattern);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  const prefix = matchPrefix ? matchPrefix[1] : `BDC - ${yy}-`;
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * Generate non-colliding funeral assistance code: ศพ-{YY}-{NNN}
 */
export function getNextFuneralCode(existingCodes: string[]): string {
  const shortYear = String(new Date().getFullYear() + 543).slice(-2);
  let maxSeq = 0;
  const pattern = new RegExp(`^ศพ-${shortYear}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = (code || '').trim().match(pattern);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `ศพ-${shortYear}-${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * Generate non-colliding donation distribution code: บริจาค-{YY}-{NNN}
 */
export function getNextDonationCode(existingCodes: string[]): string {
  const shortYear = String(new Date().getFullYear() + 543).slice(-2);
  let maxSeq = 0;
  const pattern = new RegExp(`^บริจาค-${shortYear}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = (code || '').trim().match(pattern);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `บริจาค-${shortYear}-${String(maxSeq + 1).padStart(3, '0')}`;
}
