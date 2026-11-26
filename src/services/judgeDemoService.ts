import {
  DentureCase,
  EvidenceItem,
  InboxItem,
  LabOrder,
  PatientFollowUpItem,
  QueueItem,
  SatisfactionResponse,
  TaskItem
} from '../types/dental';
import {
  AuditLogEntry,
  CustomWorkflow,
  DailyGoalItem,
  LiveCategoryBoard,
  PrivateNote,
  TaskTemplate,
  WorkspaceChatState,
  WorkspaceType
} from '../types/platform';
import {
  CLINIC_WORKSPACE_ID,
  createDefaultSatisfactionSettings,
  createDefaultWorkspaceChatState,
  WorkspaceScopedData
} from './workspaceStorage';
import { ChairsideSessionState } from './chairsideCopilotService';
import { FollowUpCallLog } from './followUpCallService';
import { CustomBuilderStoreData } from './customBuilderService';
import { getDefaultDentalStockRecords } from '../data/defaultDentalStockData';

const JUDGE_DEMO_STORAGE_PREFIX = 'dental_platform_judge_demo_v1::';

function isoDaysOffset(daysOffset: number): string {
  const d = new Date(Date.now() + daysOffset * 86_400_000);
  return d.toISOString().split('T')[0];
}

function isoDateTimeDaysOffset(daysOffset: number, timeStr = '09:30'): string {
  return `${isoDaysOffset(daysOffset)} ${timeStr}`;
}

function currentMonthKey(monthDelta = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthDelta, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthDayTimestamp(monthDelta: number, day: number, timeStr: string): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthDelta, Math.min(day, 28));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd} ${timeStr}`;
}

function buildThaiBeDate(daysOffset: number): string {
  const d = new Date(Date.now() + daysOffset * 86_400_000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const beYear = d.getFullYear() + 543;
  return `${dd}-${mm}-${beYear}`;
}

export function buildJudgeDemoWorkspaceData(
  workspaceId: string,
  workspaceType: WorkspaceType
): WorkspaceScopedData {
  const today = isoDaysOffset(0);
  const yesterday = isoDaysOffset(-1);
  const tomorrow = isoDaysOffset(1);
  const nextWeek = isoDaysOffset(5);
  const isPersonal = workspaceType === 'personal';

  const tasks: TaskItem[] = [
    {
      id: 'demo-task-1',
      workspaceId,
      taskKind: 'check',
      title: isPersonal
        ? 'เช็กความพร้อมเครื่อง Autoclave รอบเช้า'
        : 'ตรวจเช็กเครื่องนึ่ง Autoclave & ตัวชี้วัดชีวภาพ (Bowie-Dick)',
      description: 'บันทึกผลอุณหภูมิ 134°C และตรวจสอบเทปเปลี่ยนสีรอบเช้าก่อนเปิดห้องตรวจ 1-2',
      attachedNote: 'ผ่านมาตรฐาน 100% พร้อมใช้งานทุกห้องตรวจ',
      category: 'Sterilization & Prep',
      priority: 'High',
      status: 'In Progress',
      createdDate: today,
      dueDate: today,
      roomName: 'ห้องปลอดเชื้อ (Sterile)',
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [
        {
          id: 'demo-act-1',
          timestamp: isoDateTimeDaysOffset(0, '08:15'),
          action: 'อัปเดตสถานะเป็นกำลังดำเนินการ',
          user: 'ผู้ช่วยทันตแพทย์',
          localized: {
            th: { action: 'อัปเดตสถานะเป็นกำลังดำเนินการ', user: 'ผู้ช่วยทันตแพทย์' },
            en: { action: 'Updated status to In Progress', user: 'Dental Assistant' }
          }
        }
      ],
      localized: {
        th: {
          title: isPersonal
            ? 'เช็กความพร้อมเครื่อง Autoclave รอบเช้า'
            : 'ตรวจเช็กเครื่องนึ่ง Autoclave & ตัวชี้วัดชีวภาพ (Bowie-Dick)',
          description: 'บันทึกผลอุณหภูมิ 134°C และตรวจสอบเทปเปลี่ยนสีรอบเช้าก่อนเปิดห้องตรวจ 1-2'
        },
        en: {
          title: 'Morning Autoclave & Biological Indicator Check',
          description: 'Verify 134°C cycle log and sterile pouch indicators before clinic session.'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-task-2',
      workspaceId,
      taskKind: 'todo',
      title: 'เตรียมถาดผ่าฟันคุด + เย็บแผล สำหรับเคส Q01 ห้อง 1',
      description: 'เตรียม Elevators, Surgical Bur, ไหมเย็บ 3-0 และก๊อซปลอดเชื้อให้ ทพ.ณัฐพล',
      category: 'Dentist Instruction',
      priority: 'Urgent',
      status: 'New',
      createdDate: today,
      dueDate: today,
      roomName: 'ห้อง 1 (Room 1)',
      relatedPatientId: 'HN-670412',
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [
        {
          id: 'demo-act-2',
          timestamp: isoDateTimeDaysOffset(0, '08:40'),
          action: 'สร้างงานจากคำสั่งทันตแพทย์',
          user: 'ทพ.ณัฐพล',
          localized: {
            th: { action: 'สร้างงานจากคำสั่งทันตแพทย์', user: 'ทพ.ณัฐพล' },
            en: { action: 'Created from dentist chairside instruction', user: 'Dr. Nattapol' }
          }
        }
      ],
      localized: {
        th: {
          title: 'เตรียมถาดผ่าฟันคุด + เย็บแผล สำหรับเคส Q01 ห้อง 1',
          description: 'เตรียม Elevators, Surgical Bur, ไหมเย็บ 3-0 และก๊อซปลอดเชื้อให้ ทพ.ณัฐพล'
        },
        en: {
          title: 'Prepare Wisdom Tooth Extraction & Suture Tray (Room 1)',
          description: 'Set up elevators, surgical bur, 3-0 suture, and sterile gauze for Q01.'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-task-3',
      workspaceId,
      taskKind: 'check',
      title: 'ตรวจสต๊อกยาชา Mepivacaine 3% & ถุงมือ Size S ใกล้หมด',
      description: 'นับสต๊อกคงเหลือในตู้ยา และเตรียมใบเบิกส่งหัวหน้าผู้ช่วยอนุมัติสัปดาห์นี้',
      category: 'Inventory & Supplies',
      priority: 'High',
      status: 'Waiting',
      createdDate: yesterday,
      dueDate: tomorrow,
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [],
      localized: {
        th: {
          title: 'ตรวจสต๊อกยาชา Mepivacaine 3% & ถุงมือ Size S ใกล้หมด',
          description: 'นับสต๊อกคงเหลือในตู้ยา และเตรียมใบเบิกส่งหัวหน้าผู้ช่วยอนุมัติสัปดาห์นี้'
        },
        en: {
          title: 'Low-Stock Check: Mepivacaine 3% & Nitrile Gloves S',
          description: 'Count remaining boxes in cabinet and submit weekly restock request.'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-task-4',
      workspaceId,
      taskKind: 'followup',
      title: 'โทรติดตามอาการหลังถอนฟัน PT-6701 (ครบ 24 ชม.)',
      description: 'สอบถามอาการปวด บวม และเลือดซึมหลังกัดก๊อซ พร้อมแนะนำการดูแลแผล',
      category: 'Patient Follow-up',
      priority: 'Medium',
      status: 'Accepted',
      createdDate: yesterday,
      dueDate: today,
      relatedPatientId: 'PT-6701',
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [],
      localized: {
        th: {
          title: 'โทรติดตามอาการหลังถอนฟัน PT-6701 (ครบ 24 ชม.)',
          description: 'สอบถามอาการปวด บวม และเลือดซึมหลังกัดก๊อซ พร้อมแนะนำการดูแลแผล'
        },
        en: {
          title: '24h Post-Extraction Phone Follow-up (PT-6701)',
          description: 'Check bleeding, swelling, pain medication adherence, and post-op care.'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-task-5',
      workspaceId,
      taskKind: 'todo',
      title: 'ยืนยันรับงานแล็บ Zirconia Crown #14 ก่อนคนไข้นัด 14:00 น.',
      description: 'ตรวจเช็กเฉดสี A2 และจุดสัมผัสบนโมเดลก่อนส่งเข้าห้องตรวจ 2',
      category: 'Lab Coordination',
      priority: 'High',
      status: 'Completed',
      createdDate: isoDaysOffset(-2),
      dueDate: yesterday,
      relatedLabId: 'demo-lab-4',
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [],
      localized: {
        th: {
          title: 'ยืนยันรับงานแล็บ Zirconia Crown #14 ก่อนคนไข้นัด 14:00 น.',
          description: 'ตรวจเช็กเฉดสี A2 และจุดสัมผัสบนโมเดลก่อนส่งเข้าห้องตรวจ 2'
        },
        en: {
          title: 'Verify Zirconia Crown #14 Lab Delivery Before 14:00 Appt',
          description: 'Inspect shade A2 and occlusal contacts on cast prior to Room 2 delivery.'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-task-6',
      workspaceId,
      taskKind: 'todo',
      title: 'สรุปยอดประเมินความพึงพอใจ QR ประจำเดือนส่งผู้บริหาร',
      description: 'รวบรวมคอมเมนต์คนไข้และรายการขอให้คลินิกติดต่อกลับจากแท็บผลประเมิน',
      category: 'Record Keeping',
      priority: 'Low',
      status: 'Completed',
      createdDate: isoDaysOffset(-3),
      dueDate: yesterday,
      relatedDocuments: [],
      evidenceIds: [],
      activityHistory: [],
      localized: {
        th: {
          title: 'สรุปยอดประเมินความพึงพอใจ QR ประจำเดือนส่งผู้บริหาร',
          description: 'รวบรวมคอมเมนต์คนไข้และรายการขอให้คลินิกติดต่อกลับจากแท็บผลประเมิน'
        },
        en: {
          title: 'Compile Monthly QR Patient Satisfaction Executive Brief',
          description: 'Export satisfaction scores and triage callback follow-up cases.'
        }
      },
      isDemo: true
    }
  ];

  const queueItems: QueueItem[] = [
    {
      id: 'demo-q-1',
      queueNumber: 'Q01',
      patientName: 'คุณสมชาย ใจดี',
      procedure: 'ถอนฟันกรามล่างซ้าย (#36)',
      roomName: 'ห้อง 1 (Room 1)',
      status: 'called',
      notes: 'เคสต่างชาติ/สื่อสารข้างเก้าอี้พร้อมใช้',
      createdAt: isoDateTimeDaysOffset(0, '08:50'),
      calledAt: isoDateTimeDaysOffset(0, '09:05')
    },
    {
      id: 'demo-q-2',
      queueNumber: 'Q02',
      patientName: 'คุณสุภาวดี รัตนชัย',
      procedure: 'พิมพ์ปากทำฟันปลอมฐานพลาสติกบน',
      roomName: 'ห้อง 2 (Room 2)',
      status: 'called',
      notes: 'ตรวจซ้ำหลังถอนฟันครบ 6 สัปดาห์',
      createdAt: isoDateTimeDaysOffset(0, '09:00'),
      calledAt: isoDateTimeDaysOffset(0, '09:12')
    },
    {
      id: 'demo-q-3',
      queueNumber: 'Q03',
      patientName: 'คุณธนกร พงษ์ไพศาล',
      procedure: 'ขูดหินปูน + เคลือบฟลูออไรด์',
      roomName: 'ห้อง 3 (Room 3)',
      status: 'waiting',
      createdAt: isoDateTimeDaysOffset(0, '09:15')
    },
    {
      id: 'demo-q-4',
      queueNumber: 'Q04',
      patientName: 'คุณมาลี ศรีสุวรรณ',
      procedure: 'ลองฟันปลอมทั้งปาก (Try-in)',
      roomName: 'ห้อง 2 (Room 2)',
      status: 'waiting',
      notes: 'ชิ้นงานแล็บส่งมาถึงแล้ว',
      createdAt: isoDateTimeDaysOffset(0, '09:22')
    },
    {
      id: 'demo-q-5',
      queueNumber: 'Q05',
      patientName: 'คุณอภิสิทธิ์ วรรณพงษ์',
      procedure: 'อุดฟันคอมโพสิตสีเหมือนฟัน (#24)',
      roomName: 'ห้อง 1 (Room 1)',
      status: 'waiting',
      createdAt: isoDateTimeDaysOffset(0, '09:28')
    },
    {
      id: 'demo-q-6',
      queueNumber: 'Q00',
      patientName: 'คุณพิมพ์ชนก อารี',
      procedure: 'ติดเครื่องมือจัดฟัน & เปลี่ยนยาง',
      roomName: 'ห้อง 3 (Room 3)',
      status: 'completed',
      createdAt: isoDateTimeDaysOffset(0, '08:20'),
      calledAt: isoDateTimeDaysOffset(0, '08:30')
    },
    {
      id: 'demo-q-7',
      queueNumber: 'Q99',
      patientName: 'คุณกิตติภพ ชูศรี',
      procedure: 'ตัดไหมหลังผ่าฟันคุด #48',
      roomName: 'ห้อง 1 (Room 1)',
      status: 'completed',
      createdAt: isoDateTimeDaysOffset(0, '08:05'),
      calledAt: isoDateTimeDaysOffset(0, '08:15')
    }
  ];

  const labOrders: LabOrder[] = [
    {
      id: 'demo-lab-1',
      orderReference: 'LAB-2411-081',
      workType: 'Crown',
      laboratoryName: 'สยาม เดนทัล แล็บ (Siam Dental Lab)',
      dentistName: 'ทพ.ณัฐพล',
      patientRefId: 'PT-6704',
      dateSent: isoDaysOffset(-4),
      expectedReturnDate: tomorrow,
      status: 'In Fabrication',
      supportingFiles: [],
      workHistory: [
        {
          id: 'demo-lh-1',
          timestamp: isoDateTimeDaysOffset(-4, '16:00'),
          status: 'Ordered',
          notes: 'ส่งสแกนดิจิทัลครอบฟัน Zirconia #14 เฉด A2'
        },
        {
          id: 'demo-lh-2',
          timestamp: isoDateTimeDaysOffset(-2, '11:20'),
          status: 'In Fabrication',
          notes: 'แล็บกำลังกลึง CAD/CAM และเผาเคลือบสี'
        }
      ],
      isDemo: true
    },
    {
      id: 'demo-lab-2',
      orderReference: 'LAB-2411-084',
      workType: 'Denture',
      laboratoryName: 'เอเพ็กซ์ พรอสโท แล็บ',
      dentistName: 'ทพญ.ปิยะดา',
      patientRefId: 'PT-6719',
      dateSent: isoDaysOffset(-3),
      expectedReturnDate: isoDaysOffset(2),
      status: 'Shipped',
      deliveryTrackingNumber: 'TH-LAB-99812',
      supportingFiles: [],
      workHistory: [
        {
          id: 'demo-lh-3',
          timestamp: isoDateTimeDaysOffset(-1, '14:30'),
          status: 'Shipped',
          notes: 'ส่งชิ้นงานลองฟัน Try-in RPD บน ผ่านแมสเซนเจอร์รอบเช้า'
        }
      ],
      isDemo: true
    },
    {
      id: 'demo-lab-3',
      orderReference: 'LAB-2411-089',
      workType: 'Surgical Guide',
      laboratoryName: 'ดิจิทัล ไกด์ เซ็นเตอร์',
      dentistName: 'ทพ.ณัฐพล',
      patientRefId: 'PT-6725',
      dateSent: isoDaysOffset(-1),
      expectedReturnDate: nextWeek,
      status: 'Ordered',
      supportingFiles: [],
      workHistory: [
        {
          id: 'demo-lh-4',
          timestamp: isoDateTimeDaysOffset(-1, '17:15'),
          status: 'Ordered',
          notes: 'ส่งไฟล์ CBCT + Intraoral Scan วางตำแหน่งรากเทียม #46'
        }
      ],
      isDemo: true
    },
    {
      id: 'demo-lab-4',
      orderReference: 'LAB-2411-072',
      workType: 'Crown',
      laboratoryName: 'สยาม เดนทัล แล็บ (Siam Dental Lab)',
      dentistName: 'ทพญ.ปิยะดา',
      patientRefId: 'PT-6692',
      dateSent: isoDaysOffset(-7),
      expectedReturnDate: yesterday,
      actualReturnDate: yesterday,
      status: 'Quality Checked',
      supportingFiles: [],
      workHistory: [
        {
          id: 'demo-lh-5',
          timestamp: isoDateTimeDaysOffset(-1, '15:00'),
          status: 'Quality Checked',
          notes: 'ตรวจเช็กความแนบขอบครอบฟันและเฉดสีผ่านเกณฑ์แล้ว'
        }
      ],
      isDemo: true
    },
    {
      id: 'demo-lab-5',
      orderReference: 'LAB-2411-068',
      workType: 'Retainer',
      laboratoryName: 'สมายล์ ออร์โธ แล็บ',
      dentistName: 'ทพ.กฤติน',
      patientRefId: 'PT-6685',
      dateSent: isoDaysOffset(-6),
      expectedReturnDate: isoDaysOffset(-2),
      actualReturnDate: isoDaysOffset(-2),
      status: 'Delivered',
      supportingFiles: [],
      workHistory: [
        {
          id: 'demo-lh-6',
          timestamp: isoDateTimeDaysOffset(-2, '10:30'),
          status: 'Delivered',
          notes: 'รับรีเทนเนอร์ใสบน-ล่างเรียบร้อย พร้อมส่งมอบคนไข้'
        }
      ],
      isDemo: true
    }
  ];

  const followUps: PatientFollowUpItem[] = [
    {
      id: 'demo-fu-1',
      patientRefId: 'PT-6701',
      caseCategory: 'หลังถอนฟัน / ผ่าฟันคุด #48',
      followUpReason: 'ติดตามอาการปวดบวม 24 ชม. แรกหลังผ่าตัด',
      nextAction: 'โทรสอบถามอาการ + แนะนำประคบอุ่นวันที่ 3 และนัดตัดไหม 7 วัน',
      dueDate: today,
      status: 'Pending',
      relatedEvidenceIds: [],
      localized: {
        th: {
          caseCategory: 'หลังถอนฟัน / ผ่าฟันคุด #48',
          followUpReason: 'ติดตามอาการปวดบวม 24 ชม. แรกหลังผ่าตัด',
          nextAction: 'โทรสอบถามอาการ + แนะนำประคบอุ่นวันที่ 3 และนัดตัดไหม 7 วัน'
        },
        en: {
          caseCategory: 'Post-Wisdom Tooth Surgery #48',
          followUpReason: '24-hour swelling and bleeding check',
          nextAction: 'Call patient & schedule Day-7 suture removal'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-fu-2',
      patientRefId: 'PT-6708',
      caseCategory: 'รักษารากฟันครั้งที่ 1 (#26)',
      followUpReason: 'คนไข้แจ้งเสียวฟันเล็กน้อยก่อนกลับบ้าน',
      nextAction: 'โทรถามอาการกดเจ็บและยืนยันนัดอุดรากถาวรสัปดาห์หน้า',
      dueDate: tomorrow,
      status: 'Scheduled',
      relatedEvidenceIds: [],
      localized: {
        th: {
          caseCategory: 'รักษารากฟันครั้งที่ 1 (#26)',
          followUpReason: 'คนไข้แจ้งเสียวฟันเล็กน้อยก่อนกลับบ้าน',
          nextAction: 'โทรถามอาการกดเจ็บและยืนยันนัดอุดรากถาวรสัปดาห์หน้า'
        },
        en: {
          caseCategory: 'Root Canal Visit 1 (#26)',
          followUpReason: 'Mild percussion sensitivity noted pre-discharge',
          nextAction: 'Confirm comfort and next-week obturation visit'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-fu-3',
      patientRefId: 'PT-6719',
      caseCategory: 'ติดตามหลังใส่ฟันปลอมบางส่วน',
      followUpReason: 'เช็กจุดกดเจ็บขอบฐานฟันปลอมช่วง 48 ชม.',
      nextAction: 'นัดเข้ามาตรวจปรับฐานให้ใส่เคี้ยวสบายขึ้น',
      dueDate: isoDaysOffset(2),
      status: 'Contacted',
      relatedEvidenceIds: [],
      localized: {
        th: {
          caseCategory: 'ติดตามหลังใส่ฟันปลอมบางส่วน',
          followUpReason: 'เช็กจุดกดเจ็บขอบฐานฟันปลอมช่วง 48 ชม.',
          nextAction: 'นัดเข้ามาตรวจปรับฐานให้ใส่เคี้ยวสบายขึ้น'
        },
        en: {
          caseCategory: 'Partial Denture Post-Delivery',
          followUpReason: '48-hour sore spot & occlusion check',
          nextAction: 'Book brief denture base adjustment slot'
        }
      },
      isDemo: true
    },
    {
      id: 'demo-fu-4',
      patientRefId: 'PT-6695',
      caseCategory: 'อุดฟันคอมโพสิตลึก (#35)',
      followUpReason: 'ติดตามอาการเสียวฟันเมื่อเคี้ยวของเย็น',
      nextAction: 'คนไข้แจ้งอาการดีขึ้นปกติ ปิดเคสติดตามแล้ว',
      dueDate: yesterday,
      status: 'Completed',
      relatedEvidenceIds: [],
      localized: {
        th: {
          caseCategory: 'อุดฟันคอมโพสิตลึก (#35)',
          followUpReason: 'ติดตามอาการเสียวฟันเมื่อเคี้ยวของเย็น',
          nextAction: 'คนไข้แจ้งอาการดีขึ้นปกติ ปิดเคสติดตามแล้ว'
        },
        en: {
          caseCategory: 'Deep Composite Filling (#35)',
          followUpReason: 'Monitor cold sensitivity after restoration',
          nextAction: 'Patient comfortable — follow-up completed'
        }
      },
      isDemo: true
    }
  ];

  const dentureCases: DentureCase[] = [
    {
      sheet: 'พ.ย. 69',
      row: 2,
      no: 1,
      name: 'คุณวิชัย สุขเกษม',
      age: 66,
      phone: '089-412-8831',
      history: 'ถอนฟันกรามบน-ล่างครบ 4 สัปดาห์ รอทำฟันปลอมทั้งปาก',
      group: 'เร่งด่วนมาก (ฟันปลอมทั้งปาก)',
      extractDate: buildThaiBeDate(-28),
      hn: 'HN-690112',
      dentist: 'ทพญ.ปิยะดา',
      status: 'ยังไม่ได้โทร',
      appt: '',
      note: 'คนไข้แจ้งไว้ว่าสะดวกช่วงเช้า'
    },
    {
      sheet: 'พ.ย. 69',
      row: 3,
      no: 2,
      name: 'คุณสมจิต แสงทอง',
      age: 61,
      phone: '081-775-2049',
      history: 'ถอนฟันหน้าบน 3 ซี่ แผลหายดีแล้ว เหมาะใส่ RPD อะคริลิก',
      group: 'ศักยภาพสูง (รอใส่ฟันปลอม)',
      extractDate: buildThaiBeDate(-24),
      hn: 'HN-690118',
      dentist: 'ทพ.ณัฐพล',
      status: 'ยังไม่ได้โทร',
      appt: '',
      note: ''
    },
    {
      sheet: 'พ.ย. 69',
      row: 4,
      no: 3,
      name: 'คุณนิตยา ศิริวัฒน์',
      age: 58,
      phone: '092-338-6410',
      history: 'ถอนฟันกรามซี่ 16, 17 เคี้ยวอาหารลำบาก',
      group: 'ศักยภาพสูง (รอใส่ฟันปลอม)',
      extractDate: buildThaiBeDate(-20),
      hn: 'HN-690125',
      dentist: 'ทพญ.ปิยะดา',
      status: 'สนใจ / นัดหมายตรวจแล้ว',
      appt: `${buildThaiBeDate(3)} (ตรวจฟันปลอม)`,
      note: '[23 พ.ย. 69] โทรนัดเข้ามาตรวจประเมินทำฐานโครงโลหะแล้ว'
    },
    {
      sheet: 'พ.ย. 69',
      row: 5,
      no: 4,
      name: 'คุณประเสริฐ มณีรัตน์',
      age: 70,
      phone: '086-901-3342',
      history: 'ทำฟันปลอมฐานพลาสติกล่าง พิมพ์ปากขั้นสุดท้ายแล้ว',
      group: 'เร่งด่วนมาก (ฟันปลอมทั้งปาก)',
      extractDate: buildThaiBeDate(-35),
      hn: 'HN-690098',
      dentist: 'ทพ.ณัฐพล',
      status: 'พิมพ์ปากแล้ว (รอใส่ชิ้นงาน)',
      appt: `${buildThaiBeDate(2)} (ใส่ฟันปลอม)`,
      note: '[21 พ.ย. 69] ชิ้นงานอยู่ระหว่างแล็บส่งกลับ นัดใส่เรียบร้อย'
    },
    {
      sheet: 'พ.ย. 69',
      row: 6,
      no: 5,
      name: 'คุณละมัย ใจตรง',
      age: 63,
      phone: '084-552-9107',
      history: 'ถอนฟันหลังล่างซ้าย 2 ซี่ รอแผลยุบตัว',
      group: 'ศักยภาพปานกลาง',
      extractDate: buildThaiBeDate(-18),
      hn: 'HN-690134',
      dentist: 'ทพ.กฤติน',
      status: 'ยังไม่ได้โทร',
      appt: '',
      note: ''
    },
    {
      sheet: 'พ.ย. 69',
      row: 7,
      no: 6,
      name: 'คุณบุญมี ชื่นชม',
      age: 68,
      phone: '095-621-4780',
      history: 'ใส่ฟันปลอมทั้งปากบน-ล่างเรียบร้อย นัดเช็กซ้ำ 1 สัปดาห์',
      group: 'เร่งด่วนมาก (ฟันปลอมทั้งปาก)',
      extractDate: buildThaiBeDate(-45),
      hn: 'HN-690077',
      dentist: 'ทพญ.ปิยะดา',
      status: 'ใส่ฟันปลอมเสร็จเรียบร้อย',
      appt: `${buildThaiBeDate(6)} (ตรวจฟันปลอม)`,
      note: '[19 พ.ย. 69] เคี้ยวสบายดี ไม่มีจุดกดเจ็บ'
    }
  ];

  const thisMonth = currentMonthKey(0);
  const prevMonth = currentMonthKey(-1);

  const satisfactionResponses: SatisfactionResponse[] = [
    {
      id: 'demo-sat-1',
      submittedAt: monthDayTimestamp(0, 22, '10:15'),
      monthKey: thisMonth,
      serviceType: 'extraction_wisdom',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 4,
        overallExperience: 5
      },
      wantsCallback: false,
      patientRef: 'PT-6701',
      comment: 'คุณหมอและผู้ช่วยดูแลดีมาก อธิบายชัดเจน ไม่เจ็บเลยค่ะ',
      source: 'qr_scan',
      triageStatus: 'resolved',
      isDemo: true
    },
    {
      id: 'demo-sat-2',
      submittedAt: monthDayTimestamp(0, 21, '14:40'),
      monthKey: thisMonth,
      serviceType: 'denture_crown',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 5,
        overallExperience: 5
      },
      wantsCallback: true,
      callbackTopic: 'ขอเช็กวันนัดรับชิ้นงานฟันปลอมรอบถัดไป',
      patientRef: 'PT-6719',
      comment: 'คลินิกสะอาดมาก ผู้ช่วยแจ้งขั้นตอนละเอียด เข้าใจง่าย',
      source: 'post_op_link',
      triageStatus: 'new',
      isDemo: true
    },
    {
      id: 'demo-sat-3',
      submittedAt: monthDayTimestamp(0, 19, '11:20'),
      monthKey: thisMonth,
      serviceType: 'checkup_scaling',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 5,
        overallExperience: 5
      },
      wantsCallback: false,
      patientRef: 'PT-6698',
      comment: 'มือเบามาก จอคิวดูง่าย ไม่ต้องรอนาน',
      source: 'qr_scan',
      triageStatus: 'resolved',
      isDemo: true
    },
    {
      id: 'demo-sat-4',
      submittedAt: monthDayTimestamp(0, 16, '16:05'),
      monthKey: thisMonth,
      serviceType: 'filling',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 4,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 4,
        overallExperience: 5
      },
      wantsCallback: false,
      patientRef: 'PT-6695',
      comment: 'สีฟันอุดเนียนสวยเหมือนฟันจริงเลยครับ',
      source: 'qr_scan',
      triageStatus: 'resolved',
      isDemo: true
    },
    {
      id: 'demo-sat-5',
      submittedAt: monthDayTimestamp(0, 12, '13:30'),
      monthKey: thisMonth,
      serviceType: 'ortho_wire',
      scores: {
        receptionCare: 4,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 4,
        overallExperience: 4
      },
      wantsCallback: true,
      callbackTopic: 'ยางจัดฟันหลุด 1 ซี่ อยากขอเข้ามาติดเพิ่มพรุ่งนี้',
      patientRef: 'PT-6685',
      comment: 'บริการดีมากครับ รอคิวช่วงเย็นนิดหน่อยแต่อุปกรณ์สะอาด',
      source: 'post_op_link',
      triageStatus: 'new',
      isDemo: true
    },
    {
      id: 'demo-sat-6',
      submittedAt: monthDayTimestamp(0, 8, '10:00'),
      monthKey: thisMonth,
      serviceType: 'extraction_wisdom',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 5,
        overallExperience: 5
      },
      wantsCallback: false,
      patientRef: 'PT-6674',
      comment: 'มีตัวช่วยแปลภาษาข้างเก้าอี้ด้วย สื่อสารเข้าใจดีมาก',
      source: 'qr_scan',
      triageStatus: 'resolved',
      isDemo: true
    },
    {
      id: 'demo-sat-7',
      submittedAt: monthDayTimestamp(-1, 24, '15:15'),
      monthKey: prevMonth,
      serviceType: 'checkup_scaling',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 4,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 4,
        overallExperience: 5
      },
      wantsCallback: false,
      patientRef: 'PT-6640',
      comment: 'ประทับใจการดูแลหลังทำฟันครับ',
      source: 'qr_scan',
      triageStatus: 'resolved',
      isDemo: true
    },
    {
      id: 'demo-sat-8',
      submittedAt: monthDayTimestamp(-1, 18, '11:45'),
      monthKey: prevMonth,
      serviceType: 'denture_crown',
      scores: {
        receptionCare: 5,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 4,
        overallExperience: 4
      },
      wantsCallback: false,
      patientRef: 'PT-6621',
      source: 'qr_scan',
      triageStatus: 'resolved',
      isDemo: true
    },
    {
      id: 'demo-sat-9',
      submittedAt: monthDayTimestamp(-1, 10, '09:50'),
      monthKey: prevMonth,
      serviceType: 'filling',
      scores: {
        receptionCare: 4,
        treatmentExplanation: 5,
        cleanlinessProfessionalism: 5,
        waitingAndDuration: 5,
        overallExperience: 5
      },
      wantsCallback: false,
      patientRef: 'PT-6612',
      source: 'post_op_link',
      triageStatus: 'resolved',
      isDemo: true
    }
  ];

  const inboxItems: InboxItem[] = [
    {
      id: 'demo-inbox-1',
      title: 'คำสั่งแพทย์: นัดติดตามเคสรากเทียม #46 และเตรียม Surgical Guide',
      sourceType: 'pasted_text',
      rawContent: 'พรุ่งนี้บ่ายเช็กกับแล็บว่าไกด์รากเทียมของคุณธวัชชัย (#46) เสร็จทันรอบวันศุกร์ไหม แล้วโทรยืนยันนัดคนไข้ด้วย',
      receivedTimestamp: isoDateTimeDaysOffset(0, '09:10'),
      dentistName: 'ทพ.ณัฐพล',
      extractedData: {
        title: 'ติดตาม Surgical Guide รากเทียม #46 และโทรยืนยันนัดคนไข้',
        category: 'Lab Coordination',
        description: 'ประสานงานแล็บตรวจสอบกำหนดส่ง Surgical Guide และแจ้งคนไข้ยืนยันนัดวันศุกร์',
        relatedLabOrCase: 'LAB-2411-089',
        importantDates: nextWeek,
        dueDate: tomorrow,
        suggestedNextAction: 'แปลงเป็นงาน Lab Coordination และตั้งเตือนโทรยืนยันพรุ่งนี้เช้า'
      },
      status: 'Unprocessed',
      isDemo: true
    },
    {
      id: 'demo-inbox-2',
      title: 'โน้ตตรวจสต๊อก: ถุงมือไนไตร Size S และยาชาใกล้ถึงจุดสั่งซื้อ',
      sourceType: 'pasted_text',
      rawContent: 'เหลือถุงมือ S 2 กล่อง กับยาชา Mepivacaine อีกไม่ถึง 1 กล่อง ฝากลงตารางสั่งซื้อด้วย',
      receivedTimestamp: isoDateTimeDaysOffset(-1, '17:35'),
      dentistName: 'หัวหน้าผู้ช่วย',
      extractedData: {
        title: 'สั่งเติมสต๊อกถุงมือ Size S และยาชา Mepivacaine 3%',
        category: 'Inventory & Supplies',
        description: 'สร้างรายการเบิกวัสดุสิ้นเปลืองและยาชาประจำสัปดาห์',
        importantDates: tomorrow,
        dueDate: tomorrow,
        suggestedNextAction: 'อัปเดตสถานะในบอร์ดงานสต๊อกและออกใบเบิก'
      },
      status: 'Converted to Task',
      isDemo: true
    }
  ];

  const evidenceList: EvidenceItem[] = [
    {
      id: 'demo-ev-1',
      originalFilename: 'autoclave_cycle_morning_log.pdf',
      fileType: 'pdf',
      uploadDateTime: isoDateTimeDaysOffset(0, '08:25'),
      receivedTimestamp: isoDateTimeDaysOffset(0, '08:25'),
      relatedTaskId: 'demo-task-1',
      description: 'ใบบันทึกรอบการนึ่งปลอดเชื้อ Autoclave 134°C ประจำวัน (Demo)',
      fileSize: '184 KB',
      mimeType: 'application/pdf',
      hasStoredFile: false,
      isDemo: true
    },
    {
      id: 'demo-ev-2',
      originalFilename: 'crown_zirconia_a2_lab_slip.jpg',
      fileType: 'image',
      uploadDateTime: isoDateTimeDaysOffset(-1, '15:10'),
      receivedTimestamp: isoDateTimeDaysOffset(-1, '15:10'),
      relatedLabId: 'demo-lab-4',
      relatedPatientId: 'PT-6692',
      description: 'ภาพตรวจเช็กใบส่งแล็บและเฉดสี A2 Zirconia Crown #14 (Demo)',
      fileSize: '412 KB',
      mimeType: 'image/jpeg',
      hasStoredFile: false,
      isDemo: true
    },
    {
      id: 'demo-ev-3',
      originalFilename: 'monthly_stock_audit_sheet.xlsx',
      fileType: 'spreadsheet',
      uploadDateTime: isoDateTimeDaysOffset(-2, '16:45'),
      receivedTimestamp: isoDateTimeDaysOffset(-2, '16:45'),
      relatedTaskId: 'demo-task-3',
      description: 'ตารางนับสต๊อกวัสดุทันตกรรมและจุดสั่งซื้อขั้นต่ำ (Demo)',
      fileSize: '96 KB',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      hasStoredFile: false,
      isDemo: true
    }
  ];

  const privateNotes: PrivateNote[] = [
    {
      id: 'demo-note-1',
      title: 'สูตรเตรียมเซตผ่าฟันคุด ทพ.ณัฐพล',
      content: 'เตรียม Elevator ตรง + งอ, Surgical Bur #702, Saline เย็น 2 ขวด, ไหม 3-0 Silk และก๊อซพับหนา 4 ชิ้น',
      noteType: 'formula',
      updatedAt: isoDateTimeDaysOffset(-1, '10:00'),
      isPinned: true
    },
    {
      id: 'demo-note-2',
      title: 'จุดสังเกตเวลานัดคนไข้ฟันปลอมผู้สูงอายุ',
      content: 'แนะนำลงคิวช่วงเช้า 09:00–11:00 น. และระบุเบอร์ญาติสำรองไว้ในหมายเหตุทุกครั้ง',
      noteType: 'note',
      reminderAt: tomorrow,
      updatedAt: isoDateTimeDaysOffset(0, '08:30')
    }
  ];

  const dailyGoals: DailyGoalItem[] = [
    {
      id: 'demo-goal-1',
      title: 'เคลียร์คิวผู้ป่วยรอบเช้าห้อง 1-3 ตรงเวลา',
      completed: true,
      date: today
    },
    {
      id: 'demo-goal-2',
      title: 'โทรติดตามเคสฟันปลอมค้างโทร 3 รายให้ครบก่อนเที่ยง',
      completed: false,
      date: today
    },
    {
      id: 'demo-goal-3',
      title: 'ตรวจนับสต๊อกยาชาและถุงมือตรวจส่งหัวหน้าผู้ช่วย',
      completed: false,
      date: today
    }
  ];

  const liveBoards: LiveCategoryBoard[] = [
    {
      id: 'board-stock-inventory',
      name: 'งานสต๊อก / วัสดุทันตกรรม',
      description: 'ติดตามจำนวนวัสดุ คงเหลือ ใกล้หมด และรอบสั่งซื้อ (ข้อมูลตัวอย่างสาธิต)',
      kind: 'inventory',
      metricLabel: 'จำนวนคงเหลือ',
      createdAt: today,
      records: getDefaultDentalStockRecords()
    },
    {
      id: 'board-extraction-denture',
      name: 'เคสติดตามถอนฟัน / ฟันปลอม',
      description: 'รวบรวมรายชื่อเคสติดตามอาการ นัดหมาย และสถานะการติดต่อกลับ',
      kind: 'followup_recall',
      metricLabel: 'จำนวนซี่ / คะแนน',
      createdAt: today,
      records: [
        {
          id: 'demo-rec-1',
          boardId: 'board-extraction-denture',
          title: 'คุณวิชัย สุขเกษม (รอทำฟันปลอมทั้งปาก)',
          referenceCode: 'HN-690112',
          groupLabel: 'เร่งด่วนมาก',
          status: 'pending',
          quantityOrMetric: 12,
          unitLabel: 'ซี่',
          recordDate: today,
          notes: 'แผลถอนฟันครบ 4 สัปดาห์แล้ว พร้อมนัดตรวจพิมพ์ปาก',
          source: 'manual_entry',
          updatedAt: isoDateTimeDaysOffset(0, '09:00')
        },
        {
          id: 'demo-rec-2',
          boardId: 'board-extraction-denture',
          title: 'คุณนิตยา ศิริวัฒน์ (RPD โครงโลหะ)',
          referenceCode: 'HN-690125',
          groupLabel: 'ศักยภาพสูง',
          status: 'in_progress',
          quantityOrMetric: 4,
          unitLabel: 'ซี่',
          recordDate: yesterday,
          notes: 'นัดตรวจฟันปลอมเรียบร้อยแล้ว',
          source: 'manual_entry',
          updatedAt: isoDateTimeDaysOffset(-1, '14:20')
        },
        {
          id: 'demo-rec-3',
          boardId: 'board-extraction-denture',
          title: 'คุณประเสริฐ มณีรัตน์ (รอใส่ชิ้นงาน)',
          referenceCode: 'HN-690098',
          groupLabel: 'เร่งด่วนมาก',
          status: 'followup',
          quantityOrMetric: 8,
          unitLabel: 'ซี่',
          recordDate: isoDaysOffset(-2),
          notes: 'พิมพ์ปากขั้นสุดท้ายแล้ว รอใส่ชิ้นงานสัปดาห์นี้',
          source: 'manual_entry',
          updatedAt: isoDateTimeDaysOffset(-2, '11:10')
        },
        {
          id: 'demo-rec-4',
          boardId: 'board-extraction-denture',
          title: 'คุณบุญมี ชื่นชม (ใส่ฟันปลอมครบ)',
          referenceCode: 'HN-690077',
          groupLabel: 'ใส่เสร็จแล้ว',
          status: 'completed',
          quantityOrMetric: 14,
          unitLabel: 'ซี่',
          recordDate: isoDaysOffset(-4),
          notes: 'ใส่ฟันปลอมทั้งปากบน-ล่างเรียบร้อย เคี้ยวสบายดี',
          source: 'manual_entry',
          updatedAt: isoDateTimeDaysOffset(-4, '16:00')
        }
      ]
    }
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'demo-aud-1',
      timestamp: isoDateTimeDaysOffset(0, '09:12'),
      workspaceId,
      actorName: 'ผู้ช่วยห้อง 2',
      actorRole: 'assistant',
      actionType: 'task_update',
      summary: 'เรียกคิว Q02 คุณสุภาวดี เข้าห้อง 2 (พิมพ์ปากทำฟันปลอม)'
    },
    {
      id: 'demo-aud-2',
      timestamp: isoDateTimeDaysOffset(0, '09:05'),
      workspaceId,
      actorName: 'ผู้ช่วยห้อง 1',
      actorRole: 'assistant',
      actionType: 'ai_assist',
      summary: 'เปิดผู้ช่วยสื่อสารภาษาพม่าข้างเก้าอี้สำหรับเคสถอนฟัน Q01'
    },
    {
      id: 'demo-aud-3',
      timestamp: isoDateTimeDaysOffset(0, '08:40'),
      workspaceId,
      actorName: 'หัวหน้าผู้ช่วย',
      actorRole: 'owner',
      actionType: 'task_create',
      summary: 'เพิ่มรายการเตรียมถาดผ่าฟันคุด + เย็บแผล ห้อง 1'
    },
    {
      id: 'demo-aud-4',
      timestamp: isoDateTimeDaysOffset(-1, '15:10'),
      workspaceId,
      actorName: 'ผู้ช่วยประสานแล็บ',
      actorRole: 'assistant',
      actionType: 'task_update',
      summary: 'ตรวจคุณภาพงานแล็บ Zirconia Crown #14 (LAB-2411-072) ผ่านเกณฑ์'
    },
    {
      id: 'demo-aud-5',
      timestamp: isoDateTimeDaysOffset(-1, '14:30'),
      workspaceId,
      actorName: 'ผู้ช่วยติดตามเคส',
      actorRole: 'assistant',
      actionType: 'task_update',
      summary: 'โทรนัดตรวจฟันปลอม คุณนิตยา ศิริวัฒน์ (HN-690125)'
    }
  ];

  const templates: TaskTemplate[] = [
    {
      id: 'demo-tmpl-1',
      name: 'เช็กลิสต์เปิดห้องตรวจทันตกรรมช่วงเช้า',
      description: 'ตรวจสอบระบบลม-ดูดน้ำลาย, น้ำยาฆ่าเชื้อ, และอุปกรณ์ประจำยูนิต',
      category: 'Sterilization & Prep',
      priority: 'High',
      defaultSubtasks: [
        'เปิดวาล์วลมและปั๊มดูดน้ำลาย',
        'รันน้ำล้างท่อ Suction 2 นาที',
        'เช็กชุดเครื่องมือปลอดเชื้อครบตามตารางนัด'
      ],
      createdAt: yesterday
    },
    {
      id: 'demo-tmpl-2',
      name: 'แพ็กเกจติดตามอาการหลังถอนฟัน 24 ชม.',
      description: 'เทมเพลตมาตรฐานสำหรับผู้ช่วยโทรเช็กอาการหลังถอนฟัน/ผ่าฟันคุด',
      category: 'Patient Follow-up',
      priority: 'Medium',
      defaultSubtasks: [
        'สอบถามอาการปวด-บวมและเลือดหยุดไหล',
        'ทวนวิธีกินยาแก้ปวด/ยาฆ่าเชื้อ',
        'ยืนยันวันนัดตัดไหมหรือเช็กแผล'
      ],
      createdAt: yesterday
    }
  ];

  const workflows: CustomWorkflow[] = [
    {
      id: 'demo-wf-1',
      name: 'ขั้นตอนติดตามงานแล็บฟันปลอม & ครอบฟัน',
      stages: ['สั่งแล็บแล้ว', 'แล็บกำลังผลิต', 'ชิ้นงานถึงคลินิก', 'ตรวจเช็กผ่านเกณฑ์', 'นัดคนไข้ใส่ชิ้นงาน'],
      createdAt: yesterday
    }
  ];

  const chatState: WorkspaceChatState = {
    ...createDefaultWorkspaceChatState(),
    channel: 'line_oa',
    tone: 'appointment',
    patientMessage:
      'สวัสดีค่ะ สอบถามคิวทำฟันปลอมฐานพลาสติก 3 ซี่ และคุณหมอว่างตรวจช่วงเช้าวันเสาร์ไหมคะ',
    clinicHint: 'มีคิวว่างวันเสาร์ 10:00 น. กับ ทพญ.ปิยะดา ค่าตรวจประเมิน+X-ray เริ่มต้น 300 บาท',
    replyResult: {
      replyDraft:
        'สวัสดีค่ะ คลินิกทันตกรรมยินดีให้บริการนะคะ สำหรับการทำฟันปลอมฐานพลาสติก 3 ซี่ แนะนำเข้ามาให้คุณหมอปิยะดาตรวจประเมินสภาพเหงือกและกระดูกก่อนได้เลยค่ะ วันเสาร์นี้มีคิวว่างเวลา 10:00 น. (ค่าตรวจประเมินและเอกซเรย์เบื้องต้น 300 บาท) หากสะดวกจองคิวแจ้งชื่อและเบอร์โทรกลับไว้ได้เลยนะคะ',
      shortReply:
        'วันเสาร์นี้เวลา 10:00 น. มีคิวว่างกับ ทพญ.ปิยะดา ค่ะ สนใจจองคิวประเมินฟันปลอมแจ้งชื่อและเบอร์โทรได้เลยนะคะ',
      suggestedTaskTitle: 'คอนเฟิร์มนัดคนไข้ LINE OA ประเมินฟันปลอมวันเสาร์ 10:00 น.',
      suggestedTaskKind: 'followup',
      suggestedCategory: 'Patient Follow-up',
      suggestedPriority: 'Medium',
      suggestedFollowUpNote: 'คนไข้สนใจฟันปลอมฐานพลาสติก 3 ซี่ รอยืนยันชื่อและเบอร์โทร',
      model: 'judge-demo-preset'
    },
    draftText:
      'สวัสดีค่ะ คลินิกทันตกรรมยินดีให้บริการนะคะ สำหรับการทำฟันปลอมฐานพลาสติก 3 ซี่ แนะนำเข้ามาให้คุณหมอปิยะดาตรวจประเมินสภาพเหงือกและกระดูกก่อนได้เลยค่ะ วันเสาร์นี้มีคิวว่างเวลา 10:00 น. (ค่าตรวจประเมินและเอกซเรย์เบื้องต้น 300 บาท) หากสะดวกจองคิวแจ้งชื่อและเบอร์โทรกลับไว้ได้เลยนะคะ',
    history: [
      {
        id: 'demo-chat-h1',
        createdAt: isoDateTimeDaysOffset(0, '09:08'),
        channel: 'line_oa',
        tone: 'appointment',
        patientMessage: 'สอบถามคิวทำฟันปลอมฐานพลาสติก 3 ซี่ วันเสาร์เช้าว่างไหมคะ',
        clinicHint: 'ว่าง 10:00 น. ทพญ.ปิยะดา',
        replyDraft:
          'วันเสาร์นี้เวลา 10:00 น. มีคิวว่างกับ ทพญ.ปิยะดา ค่ะ สนใจจองคิวแจ้งชื่อและเบอร์โทรได้เลยนะคะ',
        shortReply: 'วันเสาร์ 10:00 น. ว่างค่ะ แจ้งชื่อจองคิวได้เลยนะคะ'
      },
      {
        id: 'demo-chat-h2',
        createdAt: isoDateTimeDaysOffset(-1, '16:20'),
        channel: 'facebook',
        tone: 'post_op',
        patientMessage: 'ถอนฟันไปเมื่อเช้า ตอนนี้ยังปวดตึงๆ ทานยาพาราซ้ำได้ตอนกี่โมงคะ',
        clinicHint: 'ทานห่าง 4-6 ชม. ประคบเย็น 24 ชม. แรก',
        replyDraft:
          'สวัสดีค่ะ หลังถอนฟันสามารถทานยาแก้ปวดห่างจากมื้อแรก 4-6 ชั่วโมงได้เลยนะคะ แนะนำประคบเย็นข้างแก้มเบาๆ ครั้งละ 15 นาที และงดบ้วนน้ำแรงๆ ใน 24 ชั่วโมงแรกค่ะ หากมีเลือดซึมไม่หยุดแจ้งทางแชตได้ทันทีเลยนะคะ',
        shortReply:
          'ทานยาแก้ปวดซ้ำได้ทุก 4-6 ชม. และประคบเย็นข้างแก้ม 24 ชม. แรกนะคะ'
      }
    ]
  };

  return {
    tasks,
    queueItems,
    labOrders,
    followUps,
    evidenceList,
    inboxItems,
    sheetConfig: {
      webAppUrl: '',
      inventorySheetUrl: '',
      satisfactionSheetUrl: '',
      satisfactionFormUrl: '',
      satisfactionRawTabName: 'การตอบแบบฟอร์ม 1',
      token: '',
      operatorName: isPersonal ? 'ผู้ช่วยส่วนตัว (Demo)' : 'ผู้ช่วยทันตแพทย์ (Demo)'
    },
    dentureCases,
    satisfactionResponses,
    satisfactionSettings: {
      ...createDefaultSatisfactionSettings(),
      monthlyGoal: 12
    },
    templates,
    workflows,
    customCategories: ['งานเตรียมห้องผ่าตัด', 'ติดตามคนไข้ต่างชาติ'],
    privateNotes,
    dailyGoals,
    liveBoards,
    auditLogs,
    chatState
  };
}

export function buildJudgeDemoChairsideSession(): ChairsideSessionState {
  const t1 = isoDateTimeDaysOffset(0, '09:02');
  const t2 = isoDateTimeDaysOffset(0, '09:03');
  const t3 = isoDateTimeDaysOffset(0, '09:04');
  const t4 = isoDateTimeDaysOffset(0, '09:05');

  return {
    selectedPresetId: 'my',
    customLanguageName: '',
    casePresetId: 'extraction',
    customCaseText: '',
    caseStarted: true,
    currentStage: 'consent_decision',
    confirmedExtraction: false,
    clinicalSummaryThai:
      'คนไข้แจ้งปวดฟันกรามล่างซ้ายมา 3 วัน ไม่มีโรคประจำตัวและไม่แพ้ยา กำลังอธิบายขั้นตอนฉีดยาชา-ถอนฟันและขอความยินยอมก่อนเริ่มหัตถการ',
    messages: [
      {
        id: 'demo-cs-1',
        role: 'assistant',
        timestamp: t1,
        stage: 'history_symptom',
        textThai: 'สวัสดีค่ะ วันนี้ปวดฟันซี่ไหนคะ ปวดมากี่วันแล้ว และมีอาการบวมร่วมด้วยไหมคะ',
        textTargetLang:
          'မင်္ဂလာပါရှင်၊ ဒီနေ့ ဘယ်သွားနာနေပါသလဲရှင်။ နာနေတာ ဘယ်နှစ်ရက်ရှိပြီလဲ၊ ဖောရောင်တာရော ရှိပါသလား။',
        pronunciationHint:
          'มิง-กะ-ลา-บา ชิน, ดี-เน่ แบ-ตวา นา-เน-บา-ดะ-แล ชิน (วันนี้ปวดฟันซี่ไหน ปวดกี่วันแล้ว)'
      },
      {
        id: 'demo-cs-2',
        role: 'patient',
        timestamp: t2,
        stage: 'history_symptom',
        textThai: 'ปวดฟันกรามด้านล่างซ้ายมา 3 วันแล้วครับ เคี้ยวข้าวไม่ได้เลย',
        textTargetLang: 'အောက်ဘယ်ဘက် အံသွားနာနေတာ ၃ ရက်ရှိပါပြီ၊ ထမင်းဝါးလို့မရပါဘူး။'
      },
      {
        id: 'demo-cs-3',
        role: 'assistant',
        timestamp: t3,
        stage: 'medical_screening',
        textThai: 'รับทราบค่ะ ก่อนตรวจและฉีดยาชา คนไข้มีโรคประจำตัว เช่น ความดัน เบาหวาน หรือแพ้ยาอะไรไหมคะ',
        textTargetLang:
          'ဟုတ်ကဲ့ပါရှင်၊ မစစ်ဆေးခင်နှင့် ထုံဆေးမထိုးခင် သွေးတိုး၊ ဆီးချို သို့မဟုတ် ဆေးမတည့်တာမျိုး ရှိပါသလားရှင်။',
        pronunciationHint:
          'โฮะ-แกะ-บา ชิน, ตเว-โต ซี-โช ตะ-มะ-แดะ-ตา เชะ-บา-ดะ-ลา (มีโรคความดัน เบาหวาน หรือแพ้ยาไหม)'
      },
      {
        id: 'demo-cs-4',
        role: 'patient',
        timestamp: t4,
        stage: 'consent_decision',
        textThai: 'ไม่มีโรคประจำตัว และไม่เคยแพ้ยาครับ พร้อมให้คุณหมอตรวจและถอนฟันครับ',
        textTargetLang: 'ရောဂါအခံမရှိပါဘူး၊ ဆေးမတည့်တာလည်း မရှိပါဘူး။ ဆရာဝန်စစ်ပြီး သွားနှုတ်ဖို့ အဆင်သင့်ပါ။'
      }
    ],
    recommendedReply: {
      textThai:
        'คุณหมอตรวจแล้วฟันซี่นี้ผุลึกเกินอุด แนะนำถอนออกโดยฉีดยาชาเฉพาะที่ จะรู้สึกตึงๆ เล็กน้อยแต่ไม่เจ็บ ตกลงให้คุณหมอถอนฟันวันนี้เลยนะคะ',
      textTargetLang:
        'ဆရာဝန်စစ်ဆေးပြီးပါပြီ၊ ဒီသွားက အပေါက်နက်လို့ ထုံဆေးထိုးပြီး နှုတ်ဖို့အကြံပြုပါတယ်။ မနာပါဘူးရှင်၊ ဒီနေ့ သွားနှုတ်ဖို့ သဘောတူပါသလားရှင်။',
      pronunciationHint:
        'สะ-ยา-วุน ซิด-เซ-บี-บา-บี, ดี-เน่ ตวา-โน๊ะ-โบะ ตะ-บอ-ตู-บา-ดะ-ลา (คุณหมอตรวจแล้ว ตกลงถอนฟันวันนี้เลยนะคะ)'
    },
    nextQuestionOptions: [
      {
        labelThai: 'ขอคำยืนยันตกลงถอนฟัน',
        textThai: 'ตกลงให้คุณหมอฉีดยาชาและถอนฟันซี่นี้เลยนะคะ',
        textTargetLang: 'ထုံဆေးထိုးပြီး ဒီသွားကို နှုတ်ဖို့ သဘောတူပါသလားရှင်။',
        pronunciationHint: 'โทน-เซ-โท-บี ดี-ตวา-โก โนะ-โบะ ตะ-บอ-ตู-บา-ดะ-ลา',
        stageHint: 'consent_decision'
      },
      {
        labelThai: 'แจ้งคำแนะนำหลังถอนฟัน',
        textThai: 'หลังถอนฟันให้กัดผ้าก๊อซแน่นๆ 1 ชั่วโมง ห้ามบ้วนน้ำแรงนะคะ',
        textTargetLang: 'သွားနှုတ်ပြီးရင် ဂွမ်းစကို ၁ နာရီ တင်းတင်းကိုက်ထားပါ၊ ရေပြင်းပြင်းမပလုတ်ကျင်းပါနဲ့။',
        pronunciationHint: 'ตวา-โน๊ะ-บี-ยิน กุน-ซะ-โก ตะ-นา-ยี ไก๊-ทา-บา',
        stageHint: 'confirmed_extraction'
      }
    ],
    patientQuickAnswerHints: [
      {
        textTargetLang: 'ဟုတ်ကဲ့၊ ဒီနေ့ သွားနှုတ်ဖို့ သဘောတူပါတယ်။',
        thaiMeaning: 'ครับ/ค่ะ ตกลงถอนฟันวันนี้เลยครับ',
        agreesToExtract: true
      },
      {
        textTargetLang: 'ခဏနားပြီး မေးခွန်းမေးချင်ပါသေးတယ်။',
        thaiMeaning: 'ขอสอบถามเพิ่มเติมก่อนตัดสินใจครับ',
        agreesToExtract: false
      }
    ]
  };
}

export function buildJudgeDemoFollowUpCalls(): FollowUpCallLog[] {
  return [
    {
      id: 'demo-fcall-1',
      createdAt: isoDateTimeDaysOffset(0, '09:10'),
      patientRefId: 'PT-6701',
      caseCategory: 'หลังถอนฟัน / ผ่าฟันคุด #48',
      scriptType: 'extraction',
      outcome: 'normal_recovery',
      patientNotes: 'เลือดหยุดไหลดี ไม่มีไข้ ทานยาแก้ปวดตรงเวลา นัดตัดไหมวันพุธหน้า',
      usedExternalSip: false
    },
    {
      id: 'demo-fcall-2',
      createdAt: isoDateTimeDaysOffset(-1, '15:25'),
      patientRefId: 'PT-6719',
      caseCategory: 'ติดตามหลังใส่ฟันปลอมบางส่วน',
      scriptType: 'denture',
      outcome: 'appointment_booked',
      patientNotes: 'มีจุดเสียดสีด้านในเล็กน้อย นัดเข้าปรับฐานฟันปลอมวันพรุ่งนี้ 10:30 น.',
      usedExternalSip: false
    },
    {
      id: 'demo-fcall-3',
      createdAt: isoDateTimeDaysOffset(-2, '11:40'),
      patientRefId: 'PT-6708',
      caseCategory: 'รักษารากฟันครั้งที่ 1 (#26)',
      scriptType: 'general_dental',
      outcome: 'needs_recheck',
      patientNotes: 'ยังรู้สึกค้ำเวลาเคี้ยวเล็กน้อย แจ้งแพทย์แล้วรอเข้ากรอปรับสบ',
      usedExternalSip: false
    }
  ];
}

export function buildJudgeDemoCustomBuilder(): CustomBuilderStoreData {
  const now = isoDateTimeDaysOffset(0, '08:30');
  return {
    categories: [
      'เช็กลิสต์เปิด-ปิดห้องตรวจ',
      'สคริปต์แนะนำคนไข้หน้างาน',
      'งานเตรียมอุปกรณ์พิเศษ'
    ],
    items: [
      {
        id: 'demo-cb-1',
        type: 'checklist',
        categoryName: 'เช็กลิสต์เปิด-ปิดห้องตรวจ',
        title: 'เช็กลิสต์เปิดห้องตรวจทันตกรรมรอบเช้า (Demo)',
        description: 'ตรวจสอบก่อนรับเคสแรกเวลา 09:00 น.',
        scriptText: '',
        checklist: [
          { id: 'c1', text: 'เช็กแรงดันลมและระบบดูด Suction', done: true },
          { id: 'c2', text: 'ตรวจซองอุปกรณ์ Autoclave แถบสีเปลี่ยนครบ', done: true },
          { id: 'c3', text: 'เตรียมยาชาและหัวเข็มสำรองประจำยูนิต', done: false }
        ],
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'demo-cb-2',
        type: 'script',
        categoryName: 'สคริปต์แนะนำคนไข้หน้างาน',
        title: 'สคริปต์แนะนำหลังถอนฟันฉบับกระชับ (Demo)',
        description: 'อ่านให้คนไข้ฟังหรือกดอ่านออกเสียงข้างเก้าอี้',
        scriptText:
          'กัดผ้าก๊อซให้แน่น 1 ชั่วโมงนะคะ ห้ามบ้วนน้ำลายแรง ห้ามดูดหลอด และงดอาหารร้อนจัดใน 24 ชั่วโมงแรกค่ะ',
        checklist: [],
        status: 'active',
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

export function saveJudgeDemoAuxState(keySuffix: string, value: unknown): void {
  try {
    sessionStorage.setItem(`${JUDGE_DEMO_STORAGE_PREFIX}${keySuffix}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadJudgeDemoAuxState<T>(keySuffix: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`${JUDGE_DEMO_STORAGE_PREFIX}${keySuffix}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function clearJudgeDemoAuxStorage(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(JUDGE_DEMO_STORAGE_PREFIX)) {
        keys.push(k);
      }
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export { CLINIC_WORKSPACE_ID };
