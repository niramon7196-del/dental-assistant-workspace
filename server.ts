import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_INLINE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf'
]);

const VALID_CATEGORIES = [
  'Lab Coordination',
  'Patient Follow-up',
  'Sterilization & Prep',
  'Dentist Instruction',
  'Inventory & Supplies',
  'Record Keeping',
  'Other'
] as const;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 25_000;

function getServerApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return '';
  }
  return key;
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = getServerApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      // Fail fast on slow network / quota stalls so the UI can show a clear fallback state
      timeout: GEMINI_REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function extractUpstreamErrorInfo(
  err: unknown,
  uiLang: 'th' | 'en'
): { httpStatus: number; code: string; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  const anyErr = err as { status?: unknown; code?: unknown } | null;
  const rawStatus =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.code === 'number'
      ? anyErr.code
      : undefined;

  const lower = rawMessage.toLowerCase();
  const isUnavailable =
    rawStatus === 503 ||
    rawStatus === 502 ||
    rawStatus === 504 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    (err instanceof Error && err.name === 'AbortError') ||
    lower.includes('fetch failed');

  if (isUnavailable) {
    return {
      httpStatus: 503,
      code: 'AI_UNAVAILABLE',
      message:
        uiLang === 'en'
          ? 'AI provider model is temporarily unavailable (503 UNAVAILABLE). You can save directly to your task list without waiting for AI.'
          : 'โมเดลฝั่งผู้ให้บริการไม่พร้อมใช้งานชั่วคราว (503 UNAVAILABLE) คุณสามารถบันทึกลงรายการงานทันทีได้โดยไม่ต้องรอ AI'
    };
  }

  const isRateLimited =
    rawStatus === 429 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota');

  if (isRateLimited) {
    return {
      httpStatus: 429,
      code: 'AI_RATE_LIMITED',
      message:
        uiLang === 'en'
          ? 'AI request limit reached temporarily (429). Please retry shortly or save your task directly without AI.'
          : 'คำขอ AI เกินขีดจำกัดชั่วคราว (429) กรุณารอสักครู่หรือกดบันทึกลงรายการงานทันทีโดยไม่ต้องรอ AI'
    };
  }

  const httpStatus =
    typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  return {
    httpStatus,
    code: 'AI_ERROR',
    message:
      rawMessage.trim() ||
      (uiLang === 'en' ? 'Error calling AI provider.' : 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ AI')
  };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const aiConfigured = Boolean(getServerApiKey());
    res.json({
      ok: true,
      aiConfigured,
      model: GEMINI_MODEL
    });
  });

  // --- Queue relay: lets the iPad publish the queue and a counter PC (TV mode) read it ---
  // In-memory only (resets on restart), keyed by a private pairing code. Items hold queue no./name/room/status only.
  const queueRelay = new Map<string, { items: unknown[]; ts: number }>();
  const QUEUE_CODE_RE = /^[A-Za-z0-9_-]{4,40}$/;

  app.post('/api/queue/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '');
    if (!QUEUE_CODE_RE.test(code)) return res.status(400).json({ error: 'invalid code' });
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 200) : null;
    if (!items) return res.status(400).json({ error: 'items required' });
    if (queueRelay.size > 500 && !queueRelay.has(code)) {
      const oldest = [...queueRelay.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) queueRelay.delete(oldest[0]);
    }
    queueRelay.set(code, { items, ts: Date.now() });
    res.json({ ok: true, ts: Date.now() });
  });

  app.get('/api/queue/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '');
    if (!QUEUE_CODE_RE.test(code)) return res.status(400).json({ error: 'invalid code' });
    res.set('Cache-Control', 'no-store');
    const entry = queueRelay.get(code);
    res.json({ items: entry?.items ?? null, ts: entry?.ts ?? 0 });
  });

  app.post('/api/extract', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        const uiLangMissing =
          (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
        res.status(503).json({
          ok: false,
          code: 'AI_UNAVAILABLE',
          error:
            uiLangMissing === 'en'
              ? 'AI service is temporarily unavailable (API key not configured on server). You can save tasks directly without AI.'
              : 'โมเดล AI ยังไม่พร้อมใช้งานบนเซิร์ฟเวอร์ชั่วคราว (ยังไม่ได้ตั้งค่า GEMINI_API_KEY) คุณสามารถบันทึกลงรายการงานทันทีได้'
        });
        return;
      }

      const body = req.body as {
        text?: unknown;
        sourceType?: unknown;
        fileName?: unknown;
        uiLanguage?: unknown;
        file?: {
          base64Data?: unknown;
          mimeType?: unknown;
          fileName?: unknown;
        };
      };

      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      const sourceType = typeof body?.sourceType === 'string' ? body.sourceType : 'pasted_text';
      const fileName = typeof body?.fileName === 'string' ? body.fileName : undefined;
      const uiLanguage: 'th' | 'en' = body?.uiLanguage === 'en' ? 'en' : 'th';

      if (text.length > 200_000) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Text exceeds the maximum limit (200,000 characters).'
              : 'ข้อความยาวเกินขีดจำกัด (สูงสุด 200,000 ตัวอักษร)'
        });
        return;
      }

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (body?.file && typeof body.file === 'object') {
        const { base64Data, mimeType } = body.file;
        if (typeof base64Data !== 'string' || typeof mimeType !== 'string') {
          res.status(400).json({
            ok: false,
            error:
              uiLanguage === 'en' ? 'Invalid attachment payload.' : 'ข้อมูลไฟล์แนบไม่ถูกต้อง'
          });
          return;
        }

        const normalizedMime = mimeType.toLowerCase().trim();
        if (!ALLOWED_INLINE_MIME_TYPES.has(normalizedMime)) {
          res.status(400).json({
            ok: false,
            error:
              uiLanguage === 'en'
                ? `Unsupported file MIME type for multimodal analysis: ${mimeType}`
                : `ไม่รองรับชนิดไฟล์สำหรับวิเคราะห์แบบมัลติโมดัล: ${mimeType}`
          });
          return;
        }

        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
        const estimatedBytes = Math.floor((cleanBase64.length * 3) / 4);
        if (estimatedBytes > MAX_FILE_BYTES) {
          res.status(413).json({
            ok: false,
            error:
              uiLanguage === 'en'
                ? 'File exceeds 10 MB limit.'
                : 'ไฟล์มีขนาดเกิน 10 MB กรุณาอัปโหลดไฟล์ที่มีขนาดไม่เกิน 10 MB'
          });
          return;
        }

        parts.push({
          inlineData: {
            mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
            data: cleanBase64
          }
        });
      }

      if (!text && parts.length === 0) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Please provide instruction text or attach a file.'
              : 'กรุณาใส่ข้อความคำสั่งหรือแนบไฟล์ก่อนประมวลผล'
        });
        return;
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const promptHeader = [
        `Today's date (for relative date resolution ONLY if explicitly stated like "พรุ่งนี้" or "tomorrow"): ${todayIso}`,
        `Active UI Language: ${uiLanguage === 'en' ? 'English (en)' : 'Thai (th)'}`,
        `Source type: ${sourceType}`,
        fileName ? `Attached file name: ${fileName}` : '',
        text
          ? `Masked/Extracted text content:\n"""\n${text}\n"""`
          : 'Analyze the attached image or PDF document directly.'
      ]
        .filter(Boolean)
        .join('\n\n');

      parts.push({ text: promptHeader });

      const uiLangLabel = uiLanguage === 'en' ? 'English' : 'Thai';

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts },
        config: {
          systemInstruction: `You are a meticulous AI dental assistant task extractor.
Analyze the provided dental clinic instructions, notes, lab slips, spreadsheets, PDFs, or clinical images (which may be in Thai, English, or mixed Thai+English).
Rules:
1. Extract ONLY facts directly observable in the input. NEVER guess or fabricate missing due dates, patient IDs, lab order numbers, tooth numbers, shades, or dentist names.
2. Notice that patient phone numbers, Thai 13-digit IDs, and HN numbers may appear redacted as [REDACTED_PHONE], [REDACTED_THAI_ID], [REDACTED_HN]. Preserve those redaction tokens and never attempt to reconstruct redacted PII.
3. For "dueDate": return "YYYY-MM-DD" ONLY if a concrete date or clear relative date (like "tomorrow" / "พรุ่งนี้") appears in the source; otherwise return null and include the missing due date in "missingFields".
4. For "relatedLabOrCase": extract lab order ref, anonymized PT-xxx, or case ref if stated; otherwise return null and include in "missingFields" if critical.
5. For "missingFields": list every important clinical/coordination detail that is missing or illegible (e.g., tooth number, shade, lab name, due date, dentist signature/name). Write "missingFields" in ${uiLangLabel}. Return [] only if nothing critical is missing.
6. For "confidence": assign honest scores from 0.0 to 1.0 for each field (title, category, description, relatedLabOrCase, dueDate). Use < 0.7 whenever a field is uncertain, ambiguous, partially legible, or null/missing.
7. For "sourceQuote": provide an exact verbatim quote, table row, or visual text transcription from the source in its original language.
8. Language rules:
   - Write "title", "description", "missingFields", and "suggestedNextAction" strictly in the selected UI language (${uiLangLabel}) — summarize and draft the extracted task naturally in ${uiLangLabel} even if the source is in Thai, English, or mixed Thai+English (preserving exact clinical codes, shade names, tooth numbers, and redaction tokens).
   - Keep "sourceQuote" verbatim in the original source language.
   - Keep "category" strictly one of the exact English enum values.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Clear concise actionable task title.'
              },
              category: {
                type: Type.STRING,
                enum: [...VALID_CATEGORIES],
                description: 'Task category from the allowed list.'
              },
              description: {
                type: Type.STRING,
                description: 'Detailed factual description of the required dental assistant action.'
              },
              relatedLabOrCase: {
                type: Type.STRING,
                nullable: true,
                description: 'Related lab order or case/patient reference if explicitly stated, otherwise null.'
              },
              dueDate: {
                type: Type.STRING,
                nullable: true,
                description: 'YYYY-MM-DD format ONLY if explicitly specified; null if unspecified.'
              },
              missingFields: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of missing or unclear information needed before executing.'
              },
              confidence: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.NUMBER },
                  category: { type: Type.NUMBER },
                  description: { type: Type.NUMBER },
                  relatedLabOrCase: { type: Type.NUMBER },
                  dueDate: { type: Type.NUMBER }
                },
                required: ['title', 'category', 'description', 'relatedLabOrCase', 'dueDate']
              },
              sourceQuote: {
                type: Type.STRING,
                description: 'Exact quote or excerpt from the source text/document/image.'
              },
              suggestedNextAction: {
                type: Type.STRING,
                description: 'Recommended verification or next step for the assistant.'
              }
            },
            required: [
              'title',
              'category',
              'description',
              'relatedLabOrCase',
              'dueDate',
              'missingFields',
              'confidence',
              'sourceQuote',
              'suggestedNextAction'
            ]
          }
        }
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Gemini returned an empty response. Please try again.'
              : 'Gemini ไม่ได้ส่งข้อมูลผลลัพธ์กลับมา กรุณาลองใหม่อีกครั้ง'
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: GEMINI_MODEL,
        data: parsed
      });
    } catch (err) {
      const uiLang: 'th' | 'en' =
        (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
      const info = extractUpstreamErrorInfo(err, uiLang);
      console.error('[/api/extract] Error:', err);
      res.status(info.httpStatus).json({
        ok: false,
        code: info.code,
        error: info.message
      });
    }
  });

  app.post('/api/ai/assist', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        const uiLangMissing =
          (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
        res.status(503).json({
          ok: false,
          code: 'AI_UNAVAILABLE',
          error:
            uiLangMissing === 'en'
              ? 'AI service is temporarily unavailable (API key not configured on server). You can save tasks directly without AI.'
              : 'โมเดล AI ยังไม่พร้อมใช้งานบนเซิร์ฟเวอร์ชั่วคราว (ยังไม่ได้ตั้งค่า GEMINI_API_KEY) คุณสามารถบันทึกลงรายการงานทันทีได้'
        });
        return;
      }

      const body = req.body as {
        mode?: unknown;
        prompt?: unknown;
        uiLanguage?: unknown;
        workspaceContext?: {
          workspaceId?: unknown;
          workspaceName?: unknown;
          workspaceType?: unknown;
          userRole?: unknown;
          allowedModules?: unknown;
          tasksSummary?: unknown;
          overdueTasks?: unknown;
          labsSummary?: unknown;
          followUpsSummary?: unknown;
          templatesSummary?: unknown;
        };
      };

      const uiLanguage: 'th' | 'en' = body?.uiLanguage === 'en' ? 'en' : 'th';
      const mode =
        body?.mode === 'briefing' || body?.mode === 'suggest_workflow' ? body.mode : 'chat';
      const userPrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

      if (userPrompt.length > 20_000) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Prompt exceeds maximum limit (20,000 characters).'
              : 'คำสั่งยาวเกินขีดจำกัด (สูงสุด 20,000 ตัวอักษร)'
        });
        return;
      }

      if (mode === 'chat' && !userPrompt) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Please enter a question or instruction for the AI assistant.'
              : 'กรุณาพิมพ์คำถามหรือคำสั่งให้ AI ผู้ช่วย'
        });
        return;
      }

      const ctx = body?.workspaceContext;
      if (!ctx || typeof ctx !== 'object') {
        res.status(400).json({
          ok: false,
          error: uiLanguage === 'en' ? 'Missing workspace context.' : 'ไม่พบข้อมูลขอบเขตพื้นที่ทำงาน'
        });
        return;
      }

      const workspaceType = ctx.workspaceType === 'clinic' ? 'clinic' : 'personal';
      const workspaceName =
        typeof ctx.workspaceName === 'string' ? ctx.workspaceName.slice(0, 120) : 'Workspace';
      const userRole = typeof ctx.userRole === 'string' ? ctx.userRole.slice(0, 40) : 'owner';
      const allowedModules = Array.isArray(ctx.allowedModules)
        ? ctx.allowedModules.filter((m): m is string => typeof m === 'string').slice(0, 20)
        : [];

      const safeContextPayload = {
        workspaceId: typeof ctx.workspaceId === 'string' ? ctx.workspaceId.slice(0, 80) : 'ws',
        workspaceName,
        workspaceType,
        userRole,
        allowedModules,
        tasks: Array.isArray(ctx.tasksSummary) ? ctx.tasksSummary.slice(0, 30) : [],
        overdueTasks: Array.isArray(ctx.overdueTasks) ? ctx.overdueTasks.slice(0, 20) : [],
        labs:
          workspaceType === 'clinic' && allowedModules.includes('labs') && Array.isArray(ctx.labsSummary)
            ? ctx.labsSummary.slice(0, 20)
            : [],
        followUps:
          workspaceType === 'clinic' &&
          allowedModules.includes('followups') &&
          Array.isArray(ctx.followUpsSummary)
            ? ctx.followUpsSummary.slice(0, 20)
            : [],
        templates: Array.isArray(ctx.templatesSummary) ? ctx.templatesSummary.slice(0, 15) : []
      };

      const todayIso = new Date().toISOString().split('T')[0];
      const uiLangLabel = uiLanguage === 'en' ? 'English' : 'Thai';

      const promptBody = [
        `Today's date: ${todayIso}`,
        `Mode: ${mode}`,
        `Active UI Language: ${uiLangLabel}`,
        `Authorized Workspace Context (STRICT BOUNDARY - NEVER reference external workspaces):\n${JSON.stringify(safeContextPayload, null, 2)}`,
        userPrompt ? `User Instruction / Question:\n"""\n${userPrompt}\n"""` : 'Provide a proactive daily work briefing, detect overdue tasks, recommend next actions, and suggest helpful reminders based ONLY on the authorized workspace context above.'
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptBody,
        config: {
          systemInstruction: `You are an authorized Dental Assistant Platform AI Engine operating strictly inside a single isolated workspace.
Security & Boundary Rules:
1. STRICT TENANT & MODULE ISOLATION: Use ONLY facts present in the provided Authorized Workspace Context. Never invent clinic patients when in Personal mode, and never fabricate tasks, labs, or follow-ups not in the JSON context.
2. Preserve redaction tokens ([REDACTED_PHONE], [REDACTED_THAI_ID], [REDACTED_HN]) and never guess redacted PII.
3. For "proposedTaskDraft": If the user asks to create/plan a task, checklist, or workflow (or mode is "suggest_workflow"), draft a concrete task with actionable "subtasks" so the user can review and confirm before saving. Otherwise set "proposedTaskDraft" to null.
4. Keep "moduleTarget" restricted to modules in allowedModules (or "tasks").
5. Write all human-readable text ("answer", "urgencyNote", "reason", "title", "description", "subtasks") strictly in ${uiLangLabel}.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: 'Clear summary or answer grounded strictly in authorized workspace data.'
              },
              overdueAlerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    urgencyNote: { type: Type.STRING }
                  },
                  required: ['taskId', 'title', 'dueDate', 'urgencyNote']
                }
              },
              recommendedActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    moduleTarget: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Urgent'] },
                    reason: { type: Type.STRING }
                  },
                  required: ['title', 'moduleTarget', 'priority', 'reason']
                }
              },
              suggestedReminders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    suggestedDueDate: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ['title', 'suggestedDueDate', 'reason']
                }
              },
              proposedTaskDraft: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING, enum: [...VALID_CATEGORIES] },
                  priority: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Urgent'] },
                  dueDate: { type: Type.STRING, nullable: true },
                  description: { type: Type.STRING },
                  subtasks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ['title', 'category', 'priority', 'dueDate', 'description', 'subtasks']
              }
            },
            required: [
              'answer',
              'overdueAlerts',
              'recommendedActions',
              'suggestedReminders',
              'proposedTaskDraft'
            ]
          }
        }
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Gemini returned an empty response. Please try again.'
              : 'Gemini ไม่ได้ส่งข้อมูลผลลัพธ์กลับมา กรุณาลองใหม่อีกครั้ง'
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: GEMINI_MODEL,
        scopedModules: allowedModules,
        data: parsed
      });
    } catch (err) {
      const uiLang: 'th' | 'en' =
        (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
      const info = extractUpstreamErrorInfo(err, uiLang);
      console.error('[/api/ai/assist] Error:', err);
      res.status(info.httpStatus).json({
        ok: false,
        code: info.code,
        error: info.message
      });
    }
  });

  app.post('/api/ai/chat-reply', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        const uiLangMissing =
          (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
        res.status(503).json({
          ok: false,
          code: 'AI_UNAVAILABLE',
          error:
            uiLangMissing === 'en'
              ? 'AI service is temporarily unavailable (API key not configured on server). You can save tasks directly without AI.'
              : 'โมเดล AI ยังไม่พร้อมใช้งานบนเซิร์ฟเวอร์ชั่วคราว (ยังไม่ได้ตั้งค่า GEMINI_API_KEY) คุณสามารถบันทึกลงรายการงานทันทีได้'
        });
        return;
      }

      const body = req.body as {
        patientMessage?: unknown;
        channel?: unknown;
        toneCategory?: unknown;
        clinicNote?: unknown;
        uiLanguage?: unknown;
      };

      const uiLanguage: 'th' | 'en' = body?.uiLanguage === 'en' ? 'en' : 'th';
      const patientMessage =
        typeof body?.patientMessage === 'string' ? body.patientMessage.trim() : '';
      const channel = body?.channel === 'facebook' ? 'Facebook Page' : 'LINE OA';
      const toneCategory =
        body?.toneCategory === 'pricing_promo' ||
        body?.toneCategory === 'appointment' ||
        body?.toneCategory === 'post_op'
          ? body.toneCategory
          : 'general';
      const clinicNote =
        typeof body?.clinicNote === 'string' ? body.clinicNote.trim().slice(0, 1000) : '';

      if (!patientMessage) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Please paste a patient chat message first.'
              : 'กรุณาวางข้อความแชตจากคนไข้ก่อนให้ AI ร่างคำตอบ'
        });
        return;
      }

      if (patientMessage.length > 10_000) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Patient message is too long (max 10,000 chars).'
              : 'ข้อความยาวเกินไป (สูงสุด 10,000 ตัวอักษร)'
        });
        return;
      }

      const toneGuideMap: Record<string, string> = {
        general: 'General friendly inquiry — warm, reassuring, clear dental clinic assistant tone.',
        pricing_promo:
          'Pricing & promotion explanation — transparent, polite, invite consultation/assessment without inventing unstated prices unless provided in clinicNote.',
        appointment:
          'Appointment booking / rescheduling — helpful, polite, request preferred date/time and confirm dentist availability check.',
        post_op:
          'Post-procedure dental care guidance — empathetic, gentle, clear safety instructions and warning signs to contact the clinic.'
      };

      const promptBody = [
        `Channel: ${channel}`,
        `Tone/Scenario: ${toneGuideMap[toneCategory]}`,
        `Reply Language Preference: Match the patient message language (or Thai if Thai/mixed, English if English). Suggested task title/note in ${uiLanguage === 'en' ? 'English' : 'Thai'}.`,
        clinicNote ? `Assistant / Clinic Context Note:\n${clinicNote}` : '',
        `Patient Chat Message:\n"""\n${patientMessage}\n"""`
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptBody,
        config: {
          systemInstruction: `You are a helpful Thai Dental Assistant Copilot drafting polite, natural, clinic-ready replies for Facebook Page & LINE OA messages.
Rules:
1. Write "replyDraft" in a polite, warm, natural tone suitable for pasting directly to a patient on ${channel}. Use polite Thai endings ("ค่ะ/นะคะ" or neutral polite) unless the patient message is in English.
2. Never fabricate specific prices, promotions, doctor names, or clinic addresses unless explicitly given in the clinic context note; if missing, use clear brackets like [ระบุช่วงราคา/โปรโมชัน] or invite the patient for an evaluation.
3. Preserve any PII redaction tokens like [REDACTED_PHONE] or [REDACTED_HN].
4. Also provide "shortReply" (a concise 1-2 line version) and extract a follow-up task suggestion ("suggestedTaskTitle", "suggestedTaskKind", "suggestedCategory", "suggestedPriority", "suggestedFollowUpNote") so the dental assistant can convert the chat into a follow-up task in 1 click.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              replyDraft: {
                type: Type.STRING,
                description: 'Full ready-to-send polite reply for Facebook Page or LINE OA.'
              },
              shortReply: {
                type: Type.STRING,
                description: 'Concise quick-reply version.'
              },
              suggestedTaskTitle: {
                type: Type.STRING,
                description: 'Actionable follow-up task title for the dental assistant.'
              },
              suggestedTaskKind: {
                type: Type.STRING,
                enum: ['todo', 'followup', 'check']
              },
              suggestedCategory: {
                type: Type.STRING,
                enum: [...VALID_CATEGORIES]
              },
              suggestedPriority: {
                type: Type.STRING,
                enum: ['Low', 'Medium', 'High', 'Urgent']
              },
              suggestedFollowUpNote: {
                type: Type.STRING,
                description: 'Short summary note of what needs follow-up from this chat.'
              }
            },
            required: [
              'replyDraft',
              'shortReply',
              'suggestedTaskTitle',
              'suggestedTaskKind',
              'suggestedCategory',
              'suggestedPriority',
              'suggestedFollowUpNote'
            ]
          }
        }
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Gemini returned an empty response. Please try again.'
              : 'Gemini ไม่ได้ส่งข้อความตอบกลับ กรุณาลองใหม่อีกครั้ง'
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: GEMINI_MODEL,
        data: parsed
      });
    } catch (err) {
      const uiLang: 'th' | 'en' =
        (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
      const info = extractUpstreamErrorInfo(err, uiLang);
      console.error('[/api/ai/chat-reply] Error:', err);
      res.status(info.httpStatus).json({
        ok: false,
        code: info.code,
        error: info.message
      });
    }
  });

  app.post('/api/ai/copilot', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        const uiLangMissing =
          (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
        res.status(503).json({
          ok: false,
          code: 'AI_UNAVAILABLE',
          error:
            uiLangMissing === 'en'
              ? 'AI service is temporarily unavailable (API key not configured on server). You can save tasks directly without AI.'
              : 'โมเดล AI ยังไม่พร้อมใช้งานบนเซิร์ฟเวอร์ชั่วคราว (ยังไม่ได้ตั้งค่า GEMINI_API_KEY) คุณสามารถบันทึกลงรายการงานทันทีได้'
        });
        return;
      }

      const body = req.body as {
        mode?: unknown;
        text?: unknown;
        outreachType?: unknown;
        uiLanguage?: unknown;
        workspaceContext?: unknown;
        file?: { base64Data?: unknown; mimeType?: unknown; fileName?: unknown };
      };

      const uiLanguage: 'th' | 'en' = body?.uiLanguage === 'en' ? 'en' : 'th';
      const uiLangLabel = uiLanguage === 'en' ? 'English' : 'Thai';
      const mode =
        body?.mode === 'intake' || body?.mode === 'outreach' ? body.mode : 'prioritize';
      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 12_000) : '';
      const outreachType =
        body?.outreachType === 'call_script' || body?.outreachType === 'team_handoff'
          ? body.outreachType
          : 'chat_reply';

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (
        body?.file &&
        typeof body.file.base64Data === 'string' &&
        typeof body.file.mimeType === 'string'
      ) {
        const mime = body.file.mimeType.toLowerCase().trim();
        if (!ALLOWED_INLINE_MIME_TYPES.has(mime)) {
          res.status(400).json({
            ok: false,
            error:
              uiLanguage === 'en'
                ? `Unsupported file type: ${mime}`
                : `ไม่รองรับชนิดไฟล์: ${mime}`
          });
          return;
        }
        const cleanBase64 = body.file.base64Data.replace(/^data:[^;]+;base64,/, '').trim();
        const estimatedBytes = Math.floor((cleanBase64.length * 3) / 4);
        if (estimatedBytes > MAX_FILE_BYTES) {
          res.status(413).json({
            ok: false,
            error:
              uiLanguage === 'en'
                ? 'Attached image exceeds 10 MB limit.'
                : 'รูปภาพที่แนบมีขนาดเกิน 10 MB'
          });
          return;
        }
        parts.push({
          inlineData: {
            mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
            data: cleanBase64
          }
        });
      }

      if (mode !== 'prioritize' && !text && parts.length === 0) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Please enter text or attach an image first.'
              : 'กรุณาพิมพ์ข้อความหรือแนบรูปภาพก่อนส่งให้ AI'
        });
        return;
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const safeContext = JSON.stringify(body?.workspaceContext || {}).slice(0, 14_000);
      parts.push({
        text: [
          `Today's date: ${todayIso}`,
          `UI Language: ${uiLangLabel}`,
          `Mode: ${mode}`,
          mode === 'outreach' ? `Outreach format: ${outreachType}` : '',
          `Workspace summary JSON: ${safeContext}`,
          text ? `User input:\n"""\n${text}\n"""` : ''
        ]
          .filter(Boolean)
          .join('\n\n')
      });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts },
        config: {
          systemInstruction: `You are the AI Dental Assistant Copilot embedded in a Thai/English Dental Assistant Dashboard.
Preserve any [REDACTED_PHONE], [REDACTED_THAI_ID], [REDACTED_HN] tokens. Never fabricate missing facts.
Write "summaryReply" and "draftMessage" naturally in ${uiLangLabel}.
- If Mode is "prioritize": examine Workspace summary JSON and give a crisp ordered action plan for today in "summaryReply" plus 3-5 "actionSteps". Set "intakeDraft" to null.
- If Mode is "intake": inspect text and/or attached photo/slip, classify the request into targetZone ("queue", "lab", "followup", "evidence", or "task"), and return "intakeDraft" with factual fields ready to save into that zone.
- If Mode is "outreach": write a warm, ready-to-send message in "draftMessage" tailored to outreachType ("chat_reply" for FB/LINE patient chat, "call_script" for post-op/recall phone call, or "team_handoff" for dental assistant shift handoff). Set "intakeDraft" to null.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryReply: { type: Type.STRING },
              actionSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              draftMessage: { type: Type.STRING, nullable: true },
              intakeDraft: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  targetZone: {
                    type: Type.STRING,
                    enum: ['queue', 'lab', 'followup', 'evidence', 'task']
                  },
                  taskKind: {
                    type: Type.STRING,
                    enum: ['todo', 'followup', 'check']
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  patientOrRef: { type: Type.STRING, nullable: true },
                  category: {
                    type: Type.STRING,
                    enum: [...VALID_CATEGORIES]
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ['Low', 'Medium', 'High', 'Urgent']
                  },
                  dueDate: { type: Type.STRING }
                },
                required: ['targetZone', 'taskKind', 'title', 'description', 'category', 'priority', 'dueDate']
              }
            },
            required: ['summaryReply', 'actionSteps', 'draftMessage', 'intakeDraft']
          }
        }
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error: uiLanguage === 'en' ? 'Empty AI response' : 'AI ไม่ได้ส่งข้อความตอบกลับ'
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: GEMINI_MODEL,
        data: parsed
      });
    } catch (err) {
      const uiLang: 'th' | 'en' =
        (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
      const info = extractUpstreamErrorInfo(err, uiLang);
      console.error('[/api/ai/copilot] Error:', err);
      res.status(info.httpStatus).json({ ok: false, code: info.code, error: info.message });
    }
  });

  app.post('/api/ai/satisfaction-analyze', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        const uiLangMissing =
          (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
        res.status(503).json({
          ok: false,
          code: 'AI_UNAVAILABLE',
          error:
            uiLangMissing === 'en'
              ? 'AI service is temporarily unavailable (API key not configured on server). Deterministic charts, callback screening, and executive brief are still ready to use.'
              : 'โมเดล AI ยังไม่พร้อมใช้งานบนเซิร์ฟเวอร์ชั่วคราว (503) — คุณยังดูกราฟ คัดกรองเคสติดต่อกลับ และสร้างรายงานสรุปผู้บริหารได้ทันที'
        });
        return;
      }

      const body = req.body as {
        uiLanguage?: unknown;
        metricsSummary?: unknown;
        comments?: unknown;
        callbackCases?: unknown;
      };

      const uiLanguage: 'th' | 'en' = body?.uiLanguage === 'en' ? 'en' : 'th';
      const uiLangLabel = uiLanguage === 'en' ? 'English' : 'Thai';

      if (!body?.metricsSummary || typeof body.metricsSummary !== 'object') {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Missing satisfaction metrics summary.'
              : 'ไม่พบข้อมูลสถิติความพึงพอใจสำหรับให้ AI วิเคราะห์'
        });
        return;
      }

      const comments = Array.isArray(body.comments) ? body.comments.slice(0, 60) : [];
      const callbackCases = Array.isArray(body.callbackCases) ? body.callbackCases.slice(0, 30) : [];

      const promptBody = [
        `Active UI Language: ${uiLangLabel}`,
        `Computed Monthly Scan & 5-Aspect Metrics JSON:\n${JSON.stringify(body.metricsSummary, null, 2)}`,
        `Patient Comments (PII already redacted):\n${JSON.stringify(comments, null, 2)}`,
        `Cases Explicitly Requesting Clinic Callback:\n${JSON.stringify(callbackCases, null, 2)}`
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptBody,
        config: {
          systemInstruction: `You are a dental clinic quality & patient experience analyst supporting a Thai dental assistant team.
Analyze ONLY the provided metrics, redacted comments, and callback cases. Never fabricate scores, counts, or patient identities.
Write ALL human-readable fields strictly in ${uiLangLabel}:
1. "summaryOverview": concise 2-3 sentence status overview (mentioning monthly scan momentum vs goal/previous month and overall 5-aspect score).
2. "strengths": 2-4 crisp bullet points ("สิ่งที่ทำได้ดี") grounded directly in the top-scoring aspects or positive comments.
3. "improvements": 2-4 actionable bullet points ("สิ่งที่ควรปรับปรุง") grounded in lower-scoring aspects, feedback comments, or low/stagnant scan momentum.
4. "callbackRecommendations": for EVERY entry in callbackCases, generate a structured follow-up task recommendation with matching "responseId", "patientRef", "serviceType", "suggestedTitle", "suggestedAction", and "priority".
5. "executiveReportText": a well-structured, concise executive summary report ready to copy for clinic leadership covering monthly scan numbers, 5-aspect scores, strengths, improvements, and callback follow-up plan.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryOverview: { type: Type.STRING },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              improvements: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              callbackRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    responseId: { type: Type.STRING },
                    patientRef: { type: Type.STRING },
                    serviceType: { type: Type.STRING },
                    suggestedTitle: { type: Type.STRING },
                    suggestedAction: { type: Type.STRING },
                    priority: {
                      type: Type.STRING,
                      enum: ['Low', 'Medium', 'High', 'Urgent']
                    }
                  },
                  required: [
                    'responseId',
                    'patientRef',
                    'serviceType',
                    'suggestedTitle',
                    'suggestedAction',
                    'priority'
                  ]
                }
              },
              executiveReportText: { type: Type.STRING }
            },
            required: [
              'summaryOverview',
              'strengths',
              'improvements',
              'callbackRecommendations',
              'executiveReportText'
            ]
          }
        }
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error: uiLanguage === 'en' ? 'Gemini returned an empty response.' : 'AI ไม่ได้ส่งข้อความตอบกลับ'
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: GEMINI_MODEL,
        data: parsed
      });
    } catch (err) {
      const uiLang: 'th' | 'en' =
        (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
      const info = extractUpstreamErrorInfo(err, uiLang);
      console.error('[/api/ai/satisfaction-analyze] Error:', err);
      res.status(info.httpStatus).json({ ok: false, code: info.code, error: info.message });
    }
  });

  app.post('/api/ai/chairside-copilot', async (req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        const uiLangMissing =
          (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
        res.status(503).json({
          ok: false,
          code: 'AI_UNAVAILABLE',
          error:
            uiLangMissing === 'en'
              ? 'AI service is temporarily unavailable (API key not configured on server).'
              : 'โมเดล AI ยังไม่พร้อมใช้งานบนเซิร์ฟเวอร์ชั่วคราว (ยังไม่ได้ตั้งค่า GEMINI_API_KEY)'
        });
        return;
      }

      const body = (req.body || {}) as {
        action?: unknown;
        caseType?: unknown;
        targetLanguage?: unknown;
        currentStage?: unknown;
        patientReplyText?: unknown;
        assistantThaiText?: unknown;
        conversationHistory?: unknown;
        uiLanguage?: unknown;
      };

      const uiLanguage: 'th' | 'en' = body.uiLanguage === 'en' ? 'en' : 'th';
      const action =
        body.action === 'patient_turn' || body.action === 'assistant_translate'
          ? body.action
          : 'start_case';
      const caseType =
        typeof body.caseType === 'string' && body.caseType.trim()
          ? body.caseType.trim().slice(0, 160)
          : 'เคสถอนฟัน (Tooth Extraction)';
      const targetLanguage =
        typeof body.targetLanguage === 'string' && body.targetLanguage.trim()
          ? body.targetLanguage.trim().slice(0, 120)
          : 'พม่า (Burmese)';
      const validStages = [
        'history_symptom',
        'medical_screening',
        'exam_explanation',
        'consent_decision',
        'confirmed_extraction'
      ] as const;
      const currentStage = validStages.includes(body.currentStage as (typeof validStages)[number])
        ? (body.currentStage as (typeof validStages)[number])
        : 'history_symptom';

      const patientReplyText =
        typeof body.patientReplyText === 'string' ? body.patientReplyText.trim().slice(0, 4000) : '';
      const assistantThaiText =
        typeof body.assistantThaiText === 'string' ? body.assistantThaiText.trim().slice(0, 4000) : '';

      if (action === 'patient_turn' && !patientReplyText) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Please enter or speak the patient reply first.'
              : 'กรุณาพิมพ์ พูด หรือแตะคำตอบของคนไข้ก่อนให้ AI แปลและโต้ตอบ'
        });
        return;
      }

      if (action === 'assistant_translate' && !assistantThaiText) {
        res.status(400).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Please enter or speak the Thai message to translate.'
              : 'กรุณาพิมพ์หรือพูดข้อความภาษาไทยที่ต้องการแปลให้คนไข้'
        });
        return;
      }

      const rawHistory = Array.isArray(body.conversationHistory)
        ? body.conversationHistory.slice(-16)
        : [];
      const historyFormatted = rawHistory
        .map((item) => {
          const entry = item as {
            role?: unknown;
            textThai?: unknown;
            textTargetLang?: unknown;
            stage?: unknown;
          };
          const roleLabel = entry.role === 'patient' ? 'PATIENT' : 'ASSISTANT';
          const th = typeof entry.textThai === 'string' ? entry.textThai.slice(0, 500) : '';
          const tg =
            typeof entry.textTargetLang === 'string' ? entry.textTargetLang.slice(0, 500) : '';
          return `[${roleLabel}] Thai: "${th}" | ${targetLanguage}: "${tg}"`;
        })
        .join('\n');

      const promptParts = [
        `Action: ${action}`,
        `Case Type: ${caseType}`,
        `Patient Target Language: ${targetLanguage}`,
        `Current Clinical Stage: ${currentStage}`,
        historyFormatted
          ? `Conversation History So Far:\n${historyFormatted}`
          : 'Conversation History So Far: (New Case - No prior turns)',
        action === 'patient_turn'
          ? `Latest Patient Reply (may be in ${targetLanguage}, Thai, English, or mixed):\n"""\n${patientReplyText}\n"""`
          : action === 'assistant_translate'
          ? `Assistant Thai Message to Translate & Deliver:\n"""\n${assistantThaiText}\n"""`
          : 'Task: Start the case proactively by opening with clear dental history-taking questions (1. อาการหลักที่มาวันนี้, 2. ฟันบนหรือฟันล่าง / ซ้ายหรือขวา, 3. ลักษณะอาการปวด เช่น ปวดตุบๆ ปวดเวลาเคี้ยว เสียว หรือโยก).'
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptParts,
        config: {
          systemInstruction: `You are a Chairside Multilingual Dental Assistant Copilot helping a Thai dental assistant communicate clearly with a patient at the dental chair.
Target patient language requested: "${targetLanguage}". You MUST translate and write patient-facing text accurately and naturally in "${targetLanguage}" (native script of ${targetLanguage}).

Clinical Progression Flow (from start to extraction consent):
1. "history_symptom": Open proactively with chief complaint, upper/lower & left/right tooth location, and pain characteristics (ปวดตุบๆ, ปวดเวลาเคี้ยว, บวม, โยก).
2. "medical_screening": Ask about chronic diseases (ความดัน, เบาหวาน, หัวใจ), drug allergies (แพ้ยา), blood thinners / regular meds, or pregnancy if applicable.
3. "exam_explanation": Explain exam/treatment plan gently (need for anesthesia, procedure steps, or tooth extraction rationale).
4. "consent_decision": Clearly ask for patient understanding and agreement/consent to proceed with extraction ("ตกลงถอนฟันไหมคะ/ครับ").
5. "confirmed_extraction": Patient has agreed to tooth extraction ("ตกลงถอนฟัน").

Rules by Action:
- If action == "start_case":
  * Set "patientReplyThaiTranslation" to "".
  * Set "nextStage" to "history_symptom".
  * Write "assistantThai" as a warm, concise opening history-taking greeting & question covering: อาการหลักที่มาวันนี้, ตำแหน่งฟันบน/ล่าง ซ้าย/ขวา, และลักษณะอาการปวด.
  * Translate "assistantThai" naturally into "${targetLanguage}" in "assistantTargetLang".
  * Provide 3-4 sequential "nextQuestionOptions" for the assistant's upcoming steps (e.g., ask duration/swelling, screen medical history/allergies, explain anesthesia/extraction, ask consent "ตกลงถอนฟัน").
  * Provide 3-4 realistic "patientQuickAnswerHints" in "${targetLanguage}" with "thaiMeaning" (e.g., ปวดฟันกรามล่างขวา, ปวดตุบๆ มา 3 วัน, เคี้ยวไม่ได้และเหงือกบวม, ฟันโยกอยากถอน).
  * Set "patientAgreedToExtract" to false.
- If action == "patient_turn":
  * Translate the patient's latest reply accurately into natural Thai in "patientReplyThaiTranslation". NEVER leave it empty.
  * Update "clinicalSummaryThai" in Thai accumulating all observed clinical facts so far (do not invent unstated facts).
  * Advance "nextStage" logically based on conversation history and latest patient reply.
  * Generate the best next polite assistant reply/question in "assistantThai" + "assistantTargetLang" guiding smoothly toward the next clinical step until "ตกลงถอนฟัน".
  * Provide 3-4 helpful "nextQuestionOptions" ordered sequentially toward consent ("ตกลงถอนฟัน") so the assistant can tap to speak/ask immediately.
  * Provide 3-4 relevant "patientQuickAnswerHints" in "${targetLanguage}" + "thaiMeaning" matching the next assistant question.
  * Set "patientAgreedToExtract" to true ONLY if the patient clearly agreed/consented to tooth extraction.
- If action == "assistant_translate":
  * Set "patientReplyThaiTranslation" to "".
  * Set "assistantThai" to the assistant's Thai message (cleanly formatted) and translate accurately into "${targetLanguage}" in "assistantTargetLang".
  * Keep/update "clinicalSummaryThai", provide 3-4 sequential "nextQuestionOptions", and 3-4 matching "patientQuickAnswerHints".

Always provide "pronunciationHint" as a short easy Thai-phonetic or Latin phonetic reading guide for "assistantTargetLang" if ${targetLanguage} uses a non-Thai script (or "" if English/easy). Never fabricate medical facts not stated in the conversation.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              patientReplyThaiTranslation: { type: Type.STRING },
              clinicalSummaryThai: { type: Type.STRING },
              nextStage: {
                type: Type.STRING,
                enum: [
                  'history_symptom',
                  'medical_screening',
                  'exam_explanation',
                  'consent_decision',
                  'confirmed_extraction'
                ]
              },
              assistantThai: { type: Type.STRING },
              assistantTargetLang: { type: Type.STRING },
              pronunciationHint: { type: Type.STRING },
              nextQuestionOptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    labelThai: { type: Type.STRING },
                    textThai: { type: Type.STRING },
                    textTargetLang: { type: Type.STRING },
                    pronunciationHint: { type: Type.STRING },
                    stageHint: {
                      type: Type.STRING,
                      enum: [
                        'history_symptom',
                        'medical_screening',
                        'exam_explanation',
                        'consent_decision',
                        'confirmed_extraction'
                      ]
                    }
                  },
                  required: [
                    'labelThai',
                    'textThai',
                    'textTargetLang',
                    'pronunciationHint',
                    'stageHint'
                  ]
                }
              },
              patientQuickAnswerHints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    textTargetLang: { type: Type.STRING },
                    thaiMeaning: { type: Type.STRING },
                    agreesToExtract: { type: Type.BOOLEAN }
                  },
                  required: ['textTargetLang', 'thaiMeaning', 'agreesToExtract']
                }
              },
              patientAgreedToExtract: { type: Type.BOOLEAN }
            },
            required: [
              'patientReplyThaiTranslation',
              'clinicalSummaryThai',
              'nextStage',
              'assistantThai',
              'assistantTargetLang',
              'pronunciationHint',
              'nextQuestionOptions',
              'patientQuickAnswerHints',
              'patientAgreedToExtract'
            ]
          }
        }
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error:
            uiLanguage === 'en'
              ? 'Gemini returned an empty response. Please try again.'
              : 'AI ไม่ได้ส่งข้อมูลตอบกลับ กรุณาลองใหม่อีกครั้ง'
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: GEMINI_MODEL,
        data: parsed
      });
    } catch (err) {
      const uiLang: 'th' | 'en' =
        (req.body as { uiLanguage?: unknown } | undefined)?.uiLanguage === 'en' ? 'en' : 'th';
      const info = extractUpstreamErrorInfo(err, uiLang);
      console.error('[/api/ai/chairside-copilot] Error:', err);
      res.status(info.httpStatus).json({ ok: false, code: info.code, error: info.message });
    }
  });

  app.post('/api/sheets/satisfaction-read', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      sheetUrl?: unknown;
      tabName?: unknown;
      token?: unknown;
      uiLanguage?: unknown;
    };
    const uiLanguage: 'th' | 'en' = body.uiLanguage === 'en' ? 'en' : 'th';
    const rawUrl = typeof body.sheetUrl === 'string' ? body.sheetUrl.trim() : '';
    const tabName =
      typeof body.tabName === 'string' && body.tabName.trim()
        ? body.tabName.trim().slice(0, 120)
        : 'การตอบแบบฟอร์ม 1';
    const token = typeof body.token === 'string' ? body.token.trim().slice(0, 200) : '';

    if (!rawUrl) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_URL',
        error:
          uiLanguage === 'en'
            ? 'No satisfaction Google Sheet URL configured.'
            : 'ยังไม่ได้ตั้งค่าลิงก์ชีตแบบประเมินความพึงพอใจ'
      });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({
        ok: false,
        code: 'INVALID_URL',
        error:
          uiLanguage === 'en'
            ? 'The configured satisfaction sheet URL is invalid.'
            : 'รูปแบบลิงก์ Google Sheet ไม่ถูกต้อง'
      });
      return;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const isGoogleSheets =
      host === 'docs.google.com' && parsedUrl.pathname.startsWith('/spreadsheets/');
    const isAppsScript =
      host === 'script.google.com' || host === 'script.googleusercontent.com';

    if (parsedUrl.protocol !== 'https:' || (!isGoogleSheets && !isAppsScript)) {
      res.status(400).json({
        ok: false,
        code: 'UNSUPPORTED_HOST',
        error:
          uiLanguage === 'en'
            ? 'Only HTTPS Google Sheets (docs.google.com/spreadsheets) or Google Apps Script URLs are supported for read-only sync.'
            : 'รองรับเฉพาะลิงก์ HTTPS ของ Google Sheets (docs.google.com/spreadsheets) หรือ Google Apps Script สำหรับการอ่านข้อมูลอย่างเดียว'
      });
      return;
    }

    const accessDeniedMsg =
      uiLanguage === 'en'
        ? `Cannot read directly from this Google Sheet link because its sharing permission is restricted (not "Anyone with the link can view"). You can copy rows from the "${tabName}" tab and click "Paste from Sheet / Form" to import immediately without changing your sheet.`
        : `ไม่สามารถดึงข้อมูลตรงจากลิงก์ได้ เนื่องจากไฟล์ชีตตั้งค่าสิทธิ์แบบจำกัด (ยังไม่ได้เปิดแชร์ "ทุกคนที่มีลิงก์ดูได้ / Viewer") — สามารถก๊อปปี้แถวจากแท็บ "${tabName}" แล้วกดปุ่ม "วางข้อมูลจากชีต / ฟอร์ม" เพื่อนำเข้าแสดงผลได้ทันที โดยไม่กระทบไฟล์ชีตต้นฉบับ`;

    try {
      if (isGoogleSheets) {
        const isPublishedCsv =
          (parsedUrl.pathname.includes('/pub') &&
            parsedUrl.searchParams.get('output') === 'csv') ||
          (parsedUrl.pathname.includes('/export') &&
            parsedUrl.searchParams.get('format') === 'csv');

        const candidateTargets: string[] = [];
        let gidMatch: RegExpMatchArray | null = null;
        if (isPublishedCsv) {
          candidateTargets.push(parsedUrl.toString());
        } else {
          const idMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          if (!idMatch) {
            res.status(400).json({
              ok: false,
              code: 'INVALID_SHEET_ID',
              error:
                uiLanguage === 'en'
                  ? 'Could not find a valid Google Spreadsheet ID in the URL.'
                  : 'ไม่พบรหัส Spreadsheet ID ในลิงก์ที่บันทึกไว้'
            });
            return;
          }
          const spreadsheetId = idMatch[1];
          gidMatch = `${parsedUrl.search}${parsedUrl.hash}`.match(/gid=(\d+)/i);

          const tabCandidates = [tabName];
          if (/การตอบแบบฟอร์ม\s*1/i.test(tabName)) {
            if (tabName !== 'การตอบแบบฟอร์ม 1') tabCandidates.push('การตอบแบบฟอร์ม 1');
            tabCandidates.push('การตอบแบบฟอร์ม1', 'Form Responses 1');
          }

          for (const candidateTab of tabCandidates) {
            const qp = new URLSearchParams({ tqx: 'out:csv', sheet: candidateTab });
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${qp.toString()}`
            );
          }

          if (gidMatch) {
            const gidQp = new URLSearchParams({ tqx: 'out:csv', gid: gidMatch[1] });
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${gidQp.toString()}`
            );
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gidMatch[1]}`
            );
          }
        }

        let lastStatus = 404;
        let hitAccessDenied = false;

        for (const fetchTargetUrl of candidateTargets) {
          // Strictly GET (Read-Only) — never mutates the source spreadsheet
          const upstream = await fetch(fetchTargetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
              Accept: 'text/csv,text/plain,*/*',
              'User-Agent': 'aistudio-build'
            },
            signal: AbortSignal.timeout(12_000)
          });

          lastStatus = upstream.status;
          const finalUrl = (upstream.url || '').toLowerCase();
          const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
          const rawBody = await upstream.text();
          const bodyLower = rawBody.slice(0, 600).toLowerCase();

          const hitLoginOrPermission =
            upstream.status === 401 ||
            upstream.status === 403 ||
            finalUrl.includes('accounts.google.com') ||
            finalUrl.includes('servicelogin') ||
            contentType.includes('text/html') ||
            bodyLower.includes('<!doctype html') ||
            bodyLower.includes('<html') ||
            bodyLower.includes('accounts.google.com');

          if (hitLoginOrPermission) {
            hitAccessDenied = true;
            break;
          }

          const hasGvizError =
            !upstream.ok || bodyLower.includes('/*o_o*/') || bodyLower.includes('"status":"error"');
          if (hasGvizError) {
            continue;
          }

          const csvText = rawBody.replace(/^\uFEFF/, '');
          if (!csvText.trim()) {
            continue;
          }

          res.json({
            ok: true,
            readOnly: true,
            format: 'csv',
            tabName,
            csvText
          });
          return;
        }

        if (hitAccessDenied) {
          res.status(403).json({
            ok: false,
            code: 'SHEET_ACCESS_DENIED',
            error: accessDeniedMsg
          });
          return;
        }

        res.status(404).json({
          ok: false,
          code: 'SHEET_TAB_NOT_FOUND',
          error:
            uiLanguage === 'en'
              ? `Could not read tab "${tabName}" from the spreadsheet (HTTP ${lastStatus}). Check that the tab name matches exactly, or use "Paste from Sheet / Form".`
              : `ไม่สามารถอ่านแท็บ "${tabName}" จากไฟล์ชีตได้ (HTTP ${lastStatus}) กรุณาตรวจสอบว่าชื่อแท็บตรงกับในชีต หรือใช้ปุ่ม "วางข้อมูลจากชีต / ฟอร์ม" แทนได้ทันที`
        });
        return;
      }

      // Google Apps Script Web App Read-Only GET
      const gasUrl = new URL(parsedUrl.toString());
      gasUrl.searchParams.set('action', 'satisfaction_list');
      gasUrl.searchParams.set('rawTab', tabName);
      gasUrl.searchParams.set('readOnly', '1');
      if (token) {
        gasUrl.searchParams.set('token', token);
      }

      const upstream = await fetch(gasUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: 'application/json,text/plain,*/*',
          'User-Agent': 'aistudio-build'
        },
        signal: AbortSignal.timeout(12_000)
      });

      const finalUrl = (upstream.url || '').toLowerCase();
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      const textBody = await upstream.text();
      const lowerPreview = textBody.slice(0, 600).toLowerCase();

      if (
        upstream.status === 401 ||
        upstream.status === 403 ||
        finalUrl.includes('accounts.google.com') ||
        contentType.includes('text/html') ||
        lowerPreview.includes('<!doctype html') ||
        lowerPreview.includes('<html')
      ) {
        res.status(403).json({
          ok: false,
          code: 'SHEET_ACCESS_DENIED',
          error: accessDeniedMsg
        });
        return;
      }

      if (!upstream.ok) {
        res.status(upstream.status).json({
          ok: false,
          code: 'SHEET_FETCH_ERROR',
          error:
            uiLanguage === 'en'
              ? `Sheet endpoint returned HTTP ${upstream.status}.`
              : `ปลายทางชีตตอบกลับผิดพลาด (HTTP ${upstream.status})`
        });
        return;
      }

      let jsonData: { ok?: boolean; tab?: string; rows?: unknown[]; error?: string } | null = null;
      try {
        jsonData = JSON.parse(textBody) as {
          ok?: boolean;
          tab?: string;
          rows?: unknown[];
          error?: string;
        };
      } catch {
        // Fallback if endpoint directly returned CSV
        res.json({
          ok: true,
          readOnly: true,
          format: 'csv',
          tabName,
          csvText: textBody.replace(/^\uFEFF/, '')
        });
        return;
      }

      if (!jsonData?.ok || !Array.isArray(jsonData.rows)) {
        res.status(400).json({
          ok: false,
          code: 'SHEET_INVALID_PAYLOAD',
          error:
            jsonData?.error ||
            (uiLanguage === 'en'
              ? 'Invalid response format from sheet endpoint.'
              : 'รูปแบบข้อมูลที่อ่านได้จากชีตไม่ถูกต้อง')
        });
        return;
      }

      res.json({
        ok: true,
        readOnly: true,
        format: 'rows',
        tabName: jsonData.tab || tabName,
        rows: jsonData.rows
      });
    } catch (err) {
      console.error('[/api/sheets/satisfaction-read] Error:', err);
      res.status(502).json({
        ok: false,
        code: 'SHEET_NETWORK_ERROR',
        error:
          uiLanguage === 'en'
            ? 'Could not reach the Google Sheet URL right now. You can paste rows via "Paste from Sheet / Form" anytime.'
            : 'ไม่สามารถเชื่อมต่อลิงก์ชีตได้ในขณะนี้ สามารถก๊อปปี้แถวข้อมูลมาวางผ่านปุ่ม "วางข้อมูลจากชีต / ฟอร์ม" ได้ทันที'
      });
    }
  });

  app.post('/api/sheets/category-read', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      sheetUrl?: unknown;
      tabName?: unknown;
      token?: unknown;
      uiLanguage?: unknown;
    };
    const uiLanguage: 'th' | 'en' = body.uiLanguage === 'en' ? 'en' : 'th';
    const rawUrl = typeof body.sheetUrl === 'string' ? body.sheetUrl.trim() : '';
    const tabName =
      typeof body.tabName === 'string' && body.tabName.trim()
        ? body.tabName.trim().slice(0, 120)
        : '';
    const token = typeof body.token === 'string' ? body.token.trim().slice(0, 200) : '';

    if (!rawUrl) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_URL',
        error:
          uiLanguage === 'en'
            ? 'Please enter a Google Sheet URL first.'
            : 'กรุณาระบุลิงก์ Google Sheet ก่อนดึงข้อมูล'
      });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({
        ok: false,
        code: 'INVALID_URL',
        error:
          uiLanguage === 'en'
            ? 'The provided Google Sheet URL is invalid.'
            : 'รูปแบบลิงก์ Google Sheet ไม่ถูกต้อง'
      });
      return;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const isGoogleSheets =
      host === 'docs.google.com' && parsedUrl.pathname.startsWith('/spreadsheets/');
    const isAppsScript =
      host === 'script.google.com' || host === 'script.googleusercontent.com';

    if (parsedUrl.protocol !== 'https:' || (!isGoogleSheets && !isAppsScript)) {
      res.status(400).json({
        ok: false,
        code: 'UNSUPPORTED_HOST',
        error:
          uiLanguage === 'en'
            ? 'Only HTTPS Google Sheets or Google Apps Script URLs are supported (Read-Only).'
            : 'รองรับเฉพาะลิงก์ HTTPS ของ Google Sheets หรือ Google Apps Script สำหรับโหมดอ่านอย่างเดียว'
      });
      return;
    }

    const accessDeniedMsg =
      uiLanguage === 'en'
        ? 'Cannot read directly from this Google Sheet link because its sharing permission is restricted. Copy rows from your sheet and use "Paste from Sheet / Form" instead.'
        : 'ไม่สามารถดึงข้อมูลตรงจากลิงก์ได้ เนื่องจากไฟล์ชีตยังไม่ได้เปิดแชร์แบบ "ทุกคนที่มีลิงก์ดูได้ (Viewer)" — สามารถก๊อปปี้แถวจากชีตแล้วกด "วางข้อมูลจากชีต / ฟอร์ม" เพื่อแสดงผลทันทีโดยไม่แก้ไฟล์ต้นฉบับ';

    try {
      if (isGoogleSheets) {
        const isPublishedCsv =
          (parsedUrl.pathname.includes('/pub') &&
            parsedUrl.searchParams.get('output') === 'csv') ||
          (parsedUrl.pathname.includes('/export') &&
            parsedUrl.searchParams.get('format') === 'csv');

        const candidateTargets: string[] = [];
        if (isPublishedCsv) {
          candidateTargets.push(parsedUrl.toString());
        } else {
          const idMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          if (!idMatch) {
            res.status(400).json({
              ok: false,
              code: 'INVALID_SHEET_ID',
              error:
                uiLanguage === 'en'
                  ? 'Could not find a valid Google Spreadsheet ID in the URL.'
                  : 'ไม่พบรหัส Spreadsheet ID ในลิงก์ที่ระบุ'
            });
            return;
          }
          const spreadsheetId = idMatch[1];
          const gidMatch = `${parsedUrl.search}${parsedUrl.hash}`.match(/gid=(\d+)/i);

          if (tabName) {
            const qp = new URLSearchParams({ tqx: 'out:csv', sheet: tabName });
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${qp.toString()}`
            );
          }

          if (gidMatch) {
            const gidQp = new URLSearchParams({ tqx: 'out:csv', gid: gidMatch[1] });
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${gidQp.toString()}`
            );
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gidMatch[1]}`
            );
          }

          if (candidateTargets.length === 0) {
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`
            );
            candidateTargets.push(
              `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`
            );
          }
        }

        let lastStatus = 404;
        let hitAccessDenied = false;

        for (const fetchTargetUrl of candidateTargets) {
          const upstream = await fetch(fetchTargetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
              Accept: 'text/csv,text/plain,*/*',
              'User-Agent': 'aistudio-build'
            },
            signal: AbortSignal.timeout(12_000)
          });

          lastStatus = upstream.status;
          const finalUrl = (upstream.url || '').toLowerCase();
          const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
          const rawBody = await upstream.text();
          const bodyLower = rawBody.slice(0, 600).toLowerCase();

          const hitLoginOrPermission =
            upstream.status === 401 ||
            upstream.status === 403 ||
            finalUrl.includes('accounts.google.com') ||
            finalUrl.includes('servicelogin') ||
            contentType.includes('text/html') ||
            bodyLower.includes('<!doctype html') ||
            bodyLower.includes('<html') ||
            bodyLower.includes('accounts.google.com');

          if (hitLoginOrPermission) {
            hitAccessDenied = true;
            break;
          }

          const hasGvizError =
            !upstream.ok || bodyLower.includes('/*o_o*/') || bodyLower.includes('"status":"error"');
          if (hasGvizError) {
            continue;
          }

          const csvText = rawBody.replace(/^\uFEFF/, '');
          if (!csvText.trim()) {
            continue;
          }

          res.json({
            ok: true,
            readOnly: true,
            format: 'csv',
            tabName: tabName || 'Sheet1',
            csvText
          });
          return;
        }

        if (hitAccessDenied) {
          res.status(403).json({
            ok: false,
            code: 'SHEET_ACCESS_DENIED',
            error: accessDeniedMsg
          });
          return;
        }

        res.status(404).json({
          ok: false,
          code: 'SHEET_TAB_NOT_FOUND',
          error:
            uiLanguage === 'en'
              ? `Could not read the sheet (HTTP ${lastStatus}). Check the tab name or use "Paste from Sheet / Form".`
              : `ไม่สามารถอ่านข้อมูลจากชีตได้ (HTTP ${lastStatus}) กรุณาตรวจสอบชื่อแท็บ หรือใช้ปุ่ม "วางข้อมูลจากชีต / ฟอร์ม" แทนได้ทันที`
        });
        return;
      }

      // Google Apps Script Web App Read-Only GET
      const gasUrl = new URL(parsedUrl.toString());
      gasUrl.searchParams.set('action', 'list');
      if (tabName) gasUrl.searchParams.set('sheet', tabName);
      gasUrl.searchParams.set('readOnly', '1');
      if (token) gasUrl.searchParams.set('token', token);

      const upstream = await fetch(gasUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: 'application/json,text/csv,text/plain,*/*',
          'User-Agent': 'aistudio-build'
        },
        signal: AbortSignal.timeout(12_000)
      });

      const finalUrl = (upstream.url || '').toLowerCase();
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      const textBody = await upstream.text();
      const lowerPreview = textBody.slice(0, 600).toLowerCase();

      if (
        upstream.status === 401 ||
        upstream.status === 403 ||
        finalUrl.includes('accounts.google.com') ||
        contentType.includes('text/html') ||
        lowerPreview.includes('<!doctype html') ||
        lowerPreview.includes('<html')
      ) {
        res.status(403).json({
          ok: false,
          code: 'SHEET_ACCESS_DENIED',
          error: accessDeniedMsg
        });
        return;
      }

      if (!upstream.ok) {
        res.status(upstream.status).json({
          ok: false,
          code: 'SHEET_FETCH_ERROR',
          error:
            uiLanguage === 'en'
              ? `Sheet endpoint returned HTTP ${upstream.status}.`
              : `ปลายทางชีตตอบกลับผิดพลาด (HTTP ${upstream.status})`
        });
        return;
      }

      try {
        const jsonData = JSON.parse(textBody) as {
          ok?: boolean;
          tab?: string;
          rows?: unknown[];
          error?: string;
        };
        if (jsonData?.ok && Array.isArray(jsonData.rows)) {
          res.json({
            ok: true,
            readOnly: true,
            format: 'rows',
            tabName: jsonData.tab || tabName || 'Sheet1',
            rows: jsonData.rows
          });
          return;
        }
      } catch {
        // Fallback as CSV/TSV text
      }

      res.json({
        ok: true,
        readOnly: true,
        format: 'csv',
        tabName: tabName || 'Sheet1',
        csvText: textBody.replace(/^\uFEFF/, '')
      });
    } catch (err) {
      console.error('[/api/sheets/category-read] Error:', err);
      res.status(502).json({
        ok: false,
        code: 'SHEET_NETWORK_ERROR',
        error:
          uiLanguage === 'en'
            ? 'Could not reach the Google Sheet URL right now. You can paste rows via "Paste from Sheet / Form" anytime.'
            : 'ไม่สามารถเชื่อมต่อลิงก์ชีตได้ในขณะนี้ สามารถก๊อปปี้แถวข้อมูลมาวางผ่านปุ่ม "วางข้อมูลจากชีต / ฟอร์ม" ได้ทันที'
      });
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (isDev || !fs.existsSync(path.join(distDir, 'index.html'))) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Dental Assistant Workspace server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
