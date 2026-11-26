import {
  LiveCategoryBoard,
  LiveCategoryKind,
  LiveCategoryRecord,
  LiveRecordStatus
} from '../types/platform';

function splitCsvRow(line: string, delimiter: ',' | '\t'): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map((c) => c.trim());
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function normalizeDateIso(raw: string): string {
  const clean = (raw || '').trim();
  if (!clean) return new Date().toISOString().split('T')[0];

  // ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/(20\d{2}|25\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    if (year >= 2400) year -= 543;
    const mm = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const dd = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  // DD/MM/YYYY or D/M/YYYY
  const dmyMatch = clean.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    const dd = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const mm = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += year >= 60 ? 2500 : 2000;
    if (year >= 2400) year -= 543;
    return `${year}-${mm}-${dd}`;
  }

  return new Date().toISOString().split('T')[0];
}

export function normalizeLiveRecordStatus(
  raw: string,
  kind: LiveCategoryKind = 'custom',
  quantityOrMetric?: number
): LiveRecordStatus {
  const text = (raw || '').trim().toLowerCase();
  if (text) {
    if (
      /เสร็จ|เรียบร้อย|ใส่แล้ว|ครบ|ปกติ|พร้อมใช้|เพียงพอ|ส่งแล้ว|done|completed?|ok|normal|sufficient|closed|delivered/.test(
        text
      )
    ) {
      return 'completed';
    }
    if (
      /ติดตาม|โทร|ใกล้หมด|หมด|ขาด|ด่วน|เร่งด่วน|ไม่รับสาย|รอตัดสินใจ|low|out|empty|urgent|alert|follow[- ]?up|recall|reorder/.test(
        text
      )
    ) {
      return 'followup';
    }
    if (
      /กำลัง|ดำเนินการ|พิมพ์ปาก|นัดหมาย|ตรวจ|สั่งซื้อแล้ว|progress|active|scheduled|contacted|ordered/.test(
        text
      )
    ) {
      return 'in_progress';
    }
    if (/รอ|ยังไม่|ค้าง|ใหม่|pending|waiting|new|todo/.test(text)) {
      return 'pending';
    }
  }

  if (kind === 'inventory' && typeof quantityOrMetric === 'number' && !Number.isNaN(quantityOrMetric)) {
    if (quantityOrMetric <= 2) return 'followup';
    if (quantityOrMetric <= 5) return 'pending';
    return 'completed';
  }

  return 'pending';
}

function parseNumericMetric(raw: string): number | null {
  const cleaned = (raw || '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^-?\d+(?:\.\d+)?$/);
  if (match) return Number(match[0]);
  const unitNum = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(?:ชิ้น|กล่อง|ซี่|แพ็ค|ขวด|อัน|คะแนน|pcs?|box|unit)/i);
  if (unitNum) return Number(unitNum[1]);
  return null;
}

interface ColumnMapping {
  titleIdx: number;
  refIdx: number;
  groupIdx: number;
  statusIdx: number;
  qtyIdx: number;
  unitIdx: number;
  dateIdx: number;
  noteIdx: number;
  openingIdx: number;
  receivedIdx: number;
  dispensedIdx: number;
  minIdx: number;
}

function detectHeaderMapping(headers: string[]): ColumnMapping | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const findCol = (regex: RegExp) => lower.findIndex((h) => regex.test(h));

  const titleIdx = findCol(/ชื่อ|รายการ|วัสดุ|สินค้า|คนไข้|เคส|เรื่อง|งาน|title|name|item|patient|product|subject|procedure/);
  const refIdx = findCol(/รหัส|hn|sku|code|ref|เลขอ้างอิง|เลขที่|เบอร์|phone|tel|id/);
  const groupIdx = findCol(/หมวด|กลุ่ม|ประเภท|แผนก|หมอ|ทันตแพทย์|ยี่ห้อ|group|category|type|dentist|brand|dept/);
  const statusIdx = findCol(/สถานะ|ผล|ความคืบหน้า|status|state|result|stage/);
  const qtyIdx = findCol(/คงเหลือ|ยอดคงเหลือ|สุทธิ|จำนวน|ยอด|คะแนน|ปริมาณ|qty|quantity|stock|count|amount|score|metric/);
  const unitIdx = findCol(/หน่วย|unit|uom/);
  const dateIdx = findCol(/วันที่|วันหมดอายุ|ประทับเวลา|กำหนด|นัด|เวลา|date|expiry|timestamp|due|created|extract/);
  const noteIdx = findCol(/หมายเหตุ|รายละเอียด|บันทึก|อาการ|note|notes|comment|detail|remark/);

  const openingIdx = findCol(/ยอดยกมา|ยกมา|opening|initial|beginning/);
  const receivedIdx = findCol(/รับเข้า|รับ\s*\(\+\)|เติม|inflow|receive|received|\(\+\)/);
  const dispensedIdx = findCol(/ตัดจ่าย|เบิกใช้|เบิก\s*\(-\)|เบิก|จ่าย|outflow|dispense|dispensed|withdraw|\(-\)/);
  const minIdx = findCol(/จุดสั่งซื้อ|ขั้นต่ำ|reorder|threshold|min/);

  const matchedCount = [
    titleIdx,
    refIdx,
    groupIdx,
    statusIdx,
    qtyIdx,
    unitIdx,
    dateIdx,
    noteIdx,
    openingIdx,
    receivedIdx,
    dispensedIdx,
    minIdx
  ].filter((idx) => idx !== -1).length;

  if (matchedCount === 0) return null;

  return {
    titleIdx,
    refIdx,
    groupIdx,
    statusIdx,
    qtyIdx,
    unitIdx,
    dateIdx,
    noteIdx,
    openingIdx,
    receivedIdx,
    dispensedIdx,
    minIdx
  };
}

export function parseLiveCategoryPaste(
  rawText: string,
  boardId: string,
  boardKind: LiveCategoryKind,
  source: 'sheet_paste' | 'sheet_pull' = 'sheet_paste'
): { records: LiveCategoryRecord[]; skippedRows: number } {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { records: [], skippedRows: 0 };
  }

  const hasTabs = lines.some((l) => l.includes('\t'));
  const delimiter: '\t' | ',' = hasTabs ? '\t' : ',';
  const rows = lines.map((line) => splitCsvRow(line, delimiter));

  const headerMapping = rows.length >= 2 ? detectHeaderMapping(rows[0]) : detectHeaderMapping(rows[0]);
  const startRowIdx = headerMapping ? 1 : 0;

  const defaultUnit =
    boardKind === 'inventory' ? 'ชิ้น' : boardKind === 'followup_recall' ? 'เคส' : 'รายการ';
  const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const baseMs = Date.now();
  const parsed: LiveCategoryRecord[] = [];
  let skippedRows = 0;

  for (let rIdx = startRowIdx; rIdx < rows.length; rIdx += 1) {
    const cols = rows[rIdx];
    const nonEmpty = cols.map((c) => c.trim()).filter(Boolean);
    if (nonEmpty.length === 0) {
      skippedRows += 1;
      continue;
    }

    let title = '';
    let referenceCode = '';
    let groupLabel = '';
    let rawStatus = '';
    let quantityOrMetric = 1;
    let hasExplicitQty = false;
    let unitLabel = defaultUnit;
    let recordDate = new Date().toISOString().split('T')[0];
    let notes = '';
    let openingVal: number | undefined;
    let receivedVal: number | undefined;
    let dispensedVal: number | undefined;
    let minThresholdVal: number | undefined;

    if (
      cols.length >= 8 &&
      (boardKind === 'inventory' || /รหัสสินค้า|ชื่อเวชภัณฑ์|ยอดยกมา|คงเหลือสุทธิ|sku|item/i.test(cols[0] || ''))
    ) {
      referenceCode = cols[0] || '';
      title = cols[1] || cols[0] || '';
      groupLabel = cols[2] || '';
      unitLabel = cols[3] || defaultUnit;
      const opening = parseNumericMetric(cols[4]) || 0;
      const received = parseNumericMetric(cols[5]) || 0;
      const dispensed = parseNumericMetric(cols[6]) || 0;
      const net = parseNumericMetric(cols[7]);
      const min = parseNumericMetric(cols[8]) ?? 2;
      quantityOrMetric = net !== null ? net : opening + received - dispensed;
      hasExplicitQty = true;
      openingVal = opening;
      receivedVal = received;
      dispensedVal = dispensed;
      minThresholdVal = min;
      const expiryRaw = cols[9] || '';
      if (expiryRaw) recordDate = normalizeDateIso(expiryRaw);
      rawStatus = `${cols[10] || ''} ${cols[11] || ''}`.trim();
      notes = cols[12] || '';
    } else if (headerMapping) {
      const getCol = (idx: number) => (idx >= 0 && idx < cols.length ? (cols[idx] || '').trim() : '');
      title = getCol(headerMapping.titleIdx);
      referenceCode = getCol(headerMapping.refIdx);
      groupLabel = getCol(headerMapping.groupIdx);
      rawStatus = getCol(headerMapping.statusIdx);
      const qtyRaw = getCol(headerMapping.qtyIdx);
      const qtyParsed = parseNumericMetric(qtyRaw);
      if (qtyParsed !== null) {
        quantityOrMetric = qtyParsed;
        hasExplicitQty = true;
      }
      const parsedUnit = getCol(headerMapping.unitIdx);
      if (parsedUnit) unitLabel = parsedUnit;
      const dateRaw = getCol(headerMapping.dateIdx);
      if (dateRaw) recordDate = normalizeDateIso(dateRaw);
      notes = getCol(headerMapping.noteIdx);

      if (headerMapping.openingIdx !== -1) {
        const op = parseNumericMetric(getCol(headerMapping.openingIdx));
        if (op !== null) openingVal = op;
      }
      if (headerMapping.receivedIdx !== -1) {
        const rc = parseNumericMetric(getCol(headerMapping.receivedIdx));
        if (rc !== null) receivedVal = rc;
      }
      if (headerMapping.dispensedIdx !== -1) {
        const dp = parseNumericMetric(getCol(headerMapping.dispensedIdx));
        if (dp !== null) dispensedVal = dp;
      }
      if (headerMapping.minIdx !== -1) {
        const mn = parseNumericMetric(getCol(headerMapping.minIdx));
        if (mn !== null) minThresholdVal = mn;
      }

      if (openingVal !== undefined && receivedVal !== undefined && dispensedVal !== undefined && !hasExplicitQty) {
        quantityOrMetric = openingVal + receivedVal - dispensedVal;
        hasExplicitQty = true;
      }

      // Fallback title if title column wasn't mapped or cell was empty
      if (!title) {
        title =
          nonEmpty.find(
            (val) => val !== referenceCode && val !== rawStatus && val !== dateRaw
          ) || nonEmpty[0];
      }
    } else {
      // Heuristic column extraction for headerless rows pasted from Sheets/Excel/Text
      for (const cell of nonEmpty) {
        if (!recordDate || recordDate === new Date().toISOString().split('T')[0]) {
          if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(cell)) {
            recordDate = normalizeDateIso(cell);
            continue;
          }
        }
        const maybeNum = parseNumericMetric(cell);
        if (maybeNum !== null && !hasExplicitQty && cell.length <= 10) {
          quantityOrMetric = maybeNum;
          hasExplicitQty = true;
          continue;
        }
        if (
          !rawStatus &&
          /^(?:รอ|ยังไม่|กำลัง|ดำเนินการ|เสร็จ|เรียบร้อย|ติดตาม|ใกล้หมด|หมด|ปกติ|done|pending|active|completed|low|followup|ok)/i.test(
            cell
          )
        ) {
          rawStatus = cell;
          continue;
        }
        if (
          !referenceCode &&
          /^(?:hn|sku|pt|ref|id|#)?[-:\s]*[a-z0-9-]{2,14}$/i.test(cell) &&
          cell !== nonEmpty[0]
        ) {
          referenceCode = cell;
          continue;
        }
        if (!title) {
          title = cell;
        } else if (!groupLabel && cell.length <= 28) {
          groupLabel = cell;
        } else {
          notes = notes ? `${notes} | ${cell}` : cell;
        }
      }
      if (!title) title = nonEmpty[0];
    }

    if (!title.trim()) {
      skippedRows += 1;
      continue;
    }

    const status = normalizeLiveRecordStatus(
      rawStatus,
      boardKind,
      hasExplicitQty ? quantityOrMetric : undefined
    );

    parsed.push({
      id: `lrec-${baseMs}-${rIdx}`,
      boardId,
      title: title.trim(),
      referenceCode: referenceCode || `${boardKind === 'inventory' ? 'SKU' : 'REF'}-${String(parsed.length + 1).padStart(3, '0')}`,
      groupLabel: groupLabel || (boardKind === 'inventory' ? 'หมวดทั่วไป' : boardKind === 'followup_recall' ? 'เคสติดตาม' : 'หมวดหลัก'),
      status,
      quantityOrMetric: Number.isFinite(quantityOrMetric) ? quantityOrMetric : 1,
      unitLabel,
      recordDate,
      notes: notes || undefined,
      source,
      updatedAt: nowStamp,
      openingBalance: openingVal,
      receivedQty: receivedVal,
      dispensedQty: dispensedVal,
      minThreshold: minThresholdVal
    });
  }

  return { records: parsed, skippedRows };
}

export async function fetchLiveCategoryFromSheet(
  sheetUrl: string,
  tabName: string,
  boardId: string,
  boardKind: LiveCategoryKind,
  uiLanguage: 'th' | 'en' = 'th'
): Promise<{
  ok: boolean;
  records: LiveCategoryRecord[];
  tabName: string;
  error?: string;
}> {
  const cleanUrl = (sheetUrl || '').trim();
  if (!cleanUrl) {
    return {
      ok: false,
      records: [],
      tabName: tabName || 'Sheet1',
      error:
        uiLanguage === 'en'
          ? 'Please enter a Google Sheet URL before pulling data.'
          : 'กรุณาใส่ลิงก์ Google Sheet ก่อนกดดึงข้อมูล'
    };
  }

  try {
    const response = await fetch('/api/sheets/category-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetUrl: cleanUrl,
        tabName: tabName.trim(),
        uiLanguage
      })
    });

    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      format?: 'csv' | 'rows';
      tabName?: string;
      csvText?: string;
      rows?: unknown[];
      error?: string;
    } | null;

    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        records: [],
        tabName: tabName || 'Sheet1',
        error:
          data?.error ||
          (uiLanguage === 'en'
            ? `Failed to read sheet (HTTP ${response.status}).`
            : `ไม่สามารถอ่านข้อมูลจากชีตได้ (HTTP ${response.status})`)
      };
    }

    if (data.format === 'csv' && typeof data.csvText === 'string') {
      const parsed = parseLiveCategoryPaste(data.csvText, boardId, boardKind, 'sheet_pull');
      return {
        ok: true,
        records: parsed.records,
        tabName: data.tabName || tabName || 'Sheet1'
      };
    }

    if (Array.isArray(data.rows)) {
      const tsv = data.rows
        .map((r) =>
          Array.isArray(r)
            ? r.map((cell) => String(cell ?? '').replace(/\t|\r?\n/g, ' ')).join('\t')
            : ''
        )
        .filter(Boolean)
        .join('\n');
      const parsed = parseLiveCategoryPaste(tsv, boardId, boardKind, 'sheet_pull');
      return {
        ok: true,
        records: parsed.records,
        tabName: data.tabName || tabName || 'Sheet1'
      };
    }

    return {
      ok: true,
      records: [],
      tabName: tabName || 'Sheet1'
    };
  } catch (err) {
    return {
      ok: false,
      records: [],
      tabName: tabName || 'Sheet1',
      error:
        err instanceof Error
          ? err.message
          : uiLanguage === 'en'
          ? 'Could not reach the read-only sheet endpoint.'
          : 'ไม่สามารถเชื่อมต่อระบบอ่านข้อมูลชีตแบบอ่านอย่างเดียวได้'
    };
  }
}

export interface LiveBoardMetrics {
  totalCount: number;
  pendingCount: number;
  inProgressCount: number;
  followupCount: number;
  completedCount: number;
  attentionCount: number;
  completionRate: number;
  totalQuantity: number;
  dailyTrend: Array<{ date: string; label: string; count: number }>;
  groupBreakdown: Array<{ group: string; count: number; totalMetric: number }>;
}

export function computeLiveBoardMetrics(records: LiveCategoryRecord[]): LiveBoardMetrics {
  const totalCount = records.length;
  let pendingCount = 0;
  let inProgressCount = 0;
  let followupCount = 0;
  let completedCount = 0;
  let totalQuantity = 0;

  const dateMap = new Map<string, number>();
  const groupMap = new Map<string, { count: number; totalMetric: number }>();

  for (const r of records) {
    if (r.status === 'pending') pendingCount += 1;
    else if (r.status === 'in_progress') inProgressCount += 1;
    else if (r.status === 'followup') followupCount += 1;
    else if (r.status === 'completed') completedCount += 1;

    const qty = Number.isFinite(r.quantityOrMetric) ? r.quantityOrMetric : 0;
    totalQuantity += qty;

    const dateKey = (r.recordDate || '').slice(0, 10) || new Date().toISOString().split('T')[0];
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);

    const grp = (r.groupLabel || '').trim() || 'ทั่วไป';
    const prev = groupMap.get(grp) || { count: 0, totalMetric: 0 };
    groupMap.set(grp, {
      count: prev.count + 1,
      totalMetric: prev.totalMetric + qty
    });
  }

  const attentionCount = pendingCount + followupCount;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const sortedDates = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7);

  const dailyTrend = sortedDates.map(([date, count]) => {
    const parts = date.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
    return { date, label, count };
  });

  const groupBreakdown = Array.from(groupMap.entries())
    .map(([group, val]) => ({ group, count: val.count, totalMetric: val.totalMetric }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalCount,
    pendingCount,
    inProgressCount,
    followupCount,
    completedCount,
    attentionCount,
    completionRate,
    totalQuantity,
    dailyTrend,
    groupBreakdown
  };
}

export function buildLiveBoardSummaryReport(
  board: LiveCategoryBoard,
  metrics: LiveBoardMetrics,
  language: 'th' | 'en'
): string {
  const stamp = new Date().toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const topGroups = metrics.groupBreakdown
    .slice(0, 4)
    .map((g, i) =>
      language === 'th'
        ? `  ${i + 1}. ${g.group}: ${g.count} รายการ (รวมปริมาณ/ค่า ${g.totalMetric})`
        : `  ${i + 1}. ${g.group}: ${g.count} items (metric sum ${g.totalMetric})`
    )
    .join('\n');

  const urgentItems = board.records
    .filter((r) => r.status === 'followup' || r.status === 'pending')
    .slice(0, 5)
    .map((r) =>
      language === 'th'
        ? `  • [${r.referenceCode}] ${r.title} (${r.quantityOrMetric} ${r.unitLabel})${r.notes ? ` — ${r.notes}` : ''}`
        : `  • [${r.referenceCode}] ${r.title} (${r.quantityOrMetric} ${r.unitLabel})${r.notes ? ` — ${r.notes}` : ''}`
    )
    .join('\n');

  if (language === 'en') {
    return [
      `📊 Live Category Report: ${board.name}`,
      `Date: ${stamp}`,
      `----------------------------------------`,
      `• Total Records: ${metrics.totalCount}`,
      `• Completed: ${metrics.completedCount} (${metrics.completionRate}%)`,
      `• In Progress: ${metrics.inProgressCount}`,
      `• Needs Attention / Follow-up: ${metrics.attentionCount} (Pending ${metrics.pendingCount}, Follow-up/Alert ${metrics.followupCount})`,
      `• Total Metric / Qty: ${metrics.totalQuantity}`,
      topGroups ? `\nTop Subgroups:\n${topGroups}` : '',
      urgentItems ? `\nPriority Items to Review:\n${urgentItems}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `📊 รายงานสรุปหมวดงาน: ${board.name}`,
    `วันที่สรุปผล: ${stamp}`,
    `----------------------------------------`,
    `• รายการทั้งหมด: ${metrics.totalCount} รายการ`,
    `• เสร็จสิ้นแล้ว: ${metrics.completedCount} รายการ (${metrics.completionRate}%)`,
    `• กำลังดำเนินการ: ${metrics.inProgressCount} รายการ`,
    `• รอดำเนินการ / ต้องติดตามเร่งด่วน: ${metrics.attentionCount} รายการ (รอ ${metrics.pendingCount} | ติดตาม/ใกล้หมด ${metrics.followupCount})`,
    `• ผลรวมจำนวน/หน่วยในหมวดนี้: ${metrics.totalQuantity}`,
    topGroups ? `\nสรุปตามกลุ่มย่อย:\n${topGroups}` : '',
    urgentItems ? `\nรายการที่ควรติดตาม/จัดการก่อน:\n${urgentItems}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}
