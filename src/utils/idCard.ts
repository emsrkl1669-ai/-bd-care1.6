/**
 * Utility functions for Thai National ID, Thai Buddhist calendar, and calculations
 */

export function formatNationalId(val: string): string {
  if (!val) return '';
  const digits = val.replace(/\D/g, '').slice(0, 13);
  if (digits.length === 0) return '';
  
  // Format: x-xxxx-xxxxx-xx-x
  let formatted = digits[0];
  if (digits.length > 1) formatted += '-' + digits.slice(1, 5);
  if (digits.length > 5) formatted += '-' + digits.slice(5, 10);
  if (digits.length > 10) formatted += '-' + digits.slice(10, 12);
  if (digits.length > 12) formatted += '-' + digits.slice(12, 13);
  return formatted;
}

export function cleanNationalId(val: string): string {
  return val.replace(/\D/g, '');
}

export function validateThaiNationalId(id: string): boolean {
  const digits = cleanNationalId(id);
  if (digits.length !== 13) return false;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(digits[12], 10);
}

export function calculateAgeFromBirthDate(birthDateStr: string): number {
  if (!birthDateStr) return 0;
  try {
    const parts = birthDateStr.split('-');
    if (parts.length < 3) return 0;
    
    let year = parseInt(parts[0], 10);
    // If entered in Buddhist Era (e.g. 2497)
    if (year > 2400) {
      year -= 543;
    }
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const today = new Date();
    let age = today.getFullYear() - year;
    const monthDiff = today.getMonth() - month;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
      age--;
    }
    return Math.max(0, age);
  } catch {
    return 0;
  }
}

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export function toBuddhistYear(yearAD: number): number {
  return yearAD < 2400 ? yearAD + 543 : yearAD;
}

export function toChristianYear(yearBE: number): number {
  return yearBE > 2400 ? yearBE - 543 : yearBE;
}

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    let year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) return dateStr;

    if (year < 2400) {
      year += 543; // Convert to Buddhist Era
    }

    const monthName = THAI_MONTHS[monthIndex] || '';
    return `${day} ${monthName} พ.ศ. ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatThaiDateShort(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    let year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) return dateStr;

    if (year < 2400) {
      year += 543;
    }

    const shortMonth = THAI_MONTHS_SHORT[monthIndex] || '';
    return `${day} ${shortMonth} ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatThaiDateNumeric(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    let year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

    if (year < 2400) {
      year += 543;
    }

    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
  } catch {
    return dateStr;
  }
}

export function formatThaiMonthYear(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    let year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;

    if (isNaN(year) || isNaN(monthIndex)) return dateStr;

    if (year < 2400) {
      year += 543;
    }

    const monthName = THAI_MONTHS[monthIndex] || '';
    return `${monthName} พ.ศ. ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatPhone(val: string): string {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  return val;
}

/**
 * Generate patient code in format: BDC - {YY}-{NNN}
 * e.g. BDC - 68-001 (68 is 2-digit Buddhist Era year of admission date, 001 is sequential count)
 */
export function generatePatientCode(admissionDateStr?: string, sequenceNumber: number = 1): string {
  let beYear = new Date().getFullYear() + 543;
  if (admissionDateStr) {
    try {
      const yearPart = parseInt(admissionDateStr.split('-')[0], 10);
      if (!isNaN(yearPart)) {
        beYear = yearPart < 2400 ? yearPart + 543 : yearPart;
      }
    } catch {
      // fallback
    }
  }
  const yy = String(beYear).slice(-2);
  const nnn = String(Math.max(1, sequenceNumber)).padStart(3, '0');
  return `BDC - ${yy}-${nnn}`;
}

