import React, { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { THAI_MONTHS, toBuddhistYear, toChristianYear } from '../utils/idCard';

interface ThaiDateInputProps {
  value: string; // ISO string 'YYYY-MM-DD'
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  minYearBE?: number;
  maxYearBE?: number;
  className?: string;
  id?: string;
  showTodayButton?: boolean;
  variant?: 'default' | 'compact';
}

export const ThaiDateInput: React.FC<ThaiDateInputProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  minYearBE = 2470,
  maxYearBE = new Date().getFullYear() + 543 + 10,
  className = '',
  id,
  showTodayButton = true,
  variant = 'default',
}) => {
  // Parse current value
  const parsed = useMemo(() => {
    if (!value) {
      return { day: '', month: '', yearBE: '' };
    }
    try {
      const parts = value.split('-');
      if (parts.length < 3) return { day: '', month: '', yearBE: '' };
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);

      if (isNaN(y) || isNaN(m) || isNaN(d)) return { day: '', month: '', yearBE: '' };

      const yearBE = toBuddhistYear(y);
      return {
        day: d.toString(),
        month: m.toString(),
        yearBE: yearBE.toString(),
      };
    } catch {
      return { day: '', month: '', yearBE: '' };
    }
  }, [value]);

  // Compute number of days in selected month/year
  const daysInMonth = useMemo(() => {
    const m = parseInt(parsed.month, 10);
    const yBE = parseInt(parsed.yearBE, 10);
    if (!m) return 31;
    const yAD = yBE ? toChristianYear(yBE) : new Date().getFullYear();
    return new Date(yAD, m, 0).getDate();
  }, [parsed.month, parsed.yearBE]);

  // Generate Year range (descending for convenience)
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYearBE; y >= minYearBE; y--) {
      arr.push(y);
    }
    return arr;
  }, [minYearBE, maxYearBE]);

  // Handle updates
  const updateDate = (newDay: string, newMonth: string, newYearBE: string) => {
    if (!newDay || !newMonth || !newYearBE) {
      // If any is missing, construct what we can or clear
      if (!newDay && !newMonth && !newYearBE) {
        onChange('');
        return;
      }
    }

    const d = parseInt(newDay, 10) || 1;
    const m = parseInt(newMonth, 10) || 1;
    const yBE = parseInt(newYearBE, 10) || (new Date().getFullYear() + 543);
    const yAD = toChristianYear(yBE);

    const maxDays = new Date(yAD, m, 0).getDate();
    const validDay = Math.min(d, maxDays);

    const isoStr = `${yAD.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${validDay.toString().padStart(2, '0')}`;
    onChange(isoStr);
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDate(e.target.value, parsed.month || '1', parsed.yearBE || (new Date().getFullYear() + 543).toString());
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDate(parsed.day || '1', e.target.value, parsed.yearBE || (new Date().getFullYear() + 543).toString());
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDate(parsed.day || '1', parsed.month || '1', e.target.value);
  };

  // Set to today
  const handleSetToday = () => {
    const now = new Date();
    const iso = `${now.getFullYear().toString().padStart(4, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    onChange(iso);
  };

  // Handle native date picker input
  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  // Display Thai formatted string
  const displayThaiString = useMemo(() => {
    if (!parsed.day || !parsed.month || !parsed.yearBE) {
      return '';
    }
    const mIndex = parseInt(parsed.month, 10) - 1;
    const mName = THAI_MONTHS[mIndex] || '';
    return `${parsed.day} ${mName} พ.ศ. ${parsed.yearBE}`;
  }, [parsed]);

  return (
    <div className={`space-y-1 ${className}`}>
      {/* 3-Part Selects for Day, Month, Buddhist Era Year */}
      <div className="flex items-center gap-1 min-w-0">
        {/* Day */}
        <div className="w-14 shrink-0">
          <select
            id={id ? `${id}-day` : undefined}
            value={parsed.day}
            onChange={handleDayChange}
            required={required}
            disabled={disabled}
            className="w-full text-xs px-1 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium cursor-pointer text-center"
          >
            <option value="">วัน</option>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d.toString()}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div className="flex-1 min-w-0">
          <select
            id={id ? `${id}-month` : undefined}
            value={parsed.month}
            onChange={handleMonthChange}
            required={required}
            disabled={disabled}
            className="w-full text-xs px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium cursor-pointer truncate"
          >
            <option value="">เดือน</option>
            {THAI_MONTHS.map((mName, idx) => (
              <option key={idx + 1} value={(idx + 1).toString()}>
                {idx + 1}. {mName}
              </option>
            ))}
          </select>
        </div>

        {/* Year in Buddhist Era (พ.ศ.) */}
        <div className="w-20 shrink-0">
          <select
            id={id ? `${id}-year` : undefined}
            value={parsed.yearBE}
            onChange={handleYearChange}
            required={required}
            disabled={disabled}
            className="w-full text-xs px-1 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-blue-900 cursor-pointer text-center"
          >
            <option value="">ปี พ.ศ.</option>
            {years.map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Calendar Picker Sync Icon (opens browser picker for quick pick) */}
        <div className="relative shrink-0" title="เลือกจากปฏิทิน">
          <label className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg border border-slate-300 flex items-center justify-center cursor-pointer transition">
            <Calendar className="w-3.5 h-3.5" />
            <input
              type="date"
              tabIndex={-1}
              value={value || ''}
              onChange={handleNativePickerChange}
              disabled={disabled}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer pointer-events-auto"
            />
          </label>
        </div>
      </div>

      {/* Sub-row: Preview Badge & Today Quick Action */}
      <div className="flex items-center justify-between gap-1 text-[10px] min-w-0">
        {displayThaiString ? (
          <div className="flex items-center gap-1 text-blue-800 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded text-[10.5px] font-medium truncate">
            <span className="truncate">วันที่ {displayThaiString}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic text-[10px] truncate">
            * ระบุ วัน / เดือน / พ.ศ.
          </span>
        )}

        {showTodayButton && (
          <button
            type="button"
            onClick={handleSetToday}
            disabled={disabled}
            className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-semibold rounded border border-slate-200 shrink-0 transition cursor-pointer"
            title="ตั้งเป็นวันที่ปัจจุบัน (วันนี้)"
          >
            วันนี้
          </button>
        )}
      </div>
    </div>
  );
};
