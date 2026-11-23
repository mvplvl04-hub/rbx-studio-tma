import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const safeStorageGet = (key, fallback = '') => {
  try {
    const val = window.localStorage?.getItem(key);
    return val !== null && val !== undefined ? val : fallback;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    window.localStorage?.setItem(key, String(value));
  } catch {
  }
};

const formatNumber = (num) => {
  const n = Math.max(0, Math.round(Number(num) || 0));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const sliderToBudget = (sliderVal) => {
  const s = Math.max(0, Math.min(100, Number(sliderVal) || 0));
  if (s === 0) return 0;
  if (s >= 100) return 999999;
  if (s <= 50) {
    return Math.round(Math.pow(s / 50, 1.6) * 1000);
  }
  return Math.round(1000 + Math.pow((s - 50) / 50, 2.2) * 998999);
};

const budgetToSlider = (budgetVal) => {
  const b = Math.max(0, Math.min(999999, Number(budgetVal) || 0));
  if (b === 0) return 0;
  if (b >= 999999) return 100;
  if (b <= 1000) {
    return 50 * Math.pow(b / 1000, 1 / 1.6);
  }
  return 50 + 50 * Math.pow((b - 1000) / 998999, 1 / 2.2);
};

const getRobloxCatalogUrl = (item) => {
  if (!item?.assetId) return 'https://www.roblox.com/catalog';
  return item.isBundle
    ? `https://www.roblox.com/bundles/${item.assetId}`
    : `https://www.roblox.com/catalog/${item.assetId}`;
};

const getTelegramWebApp = () => {
  try {
    return window.Telegram?.WebApp || null;
  } catch {
    return null;
  }
};

const getTelegramInitData = () => {
  const tg = getTelegramWebApp();
  return typeof tg?.initData === 'string' ? tg.initData : '';
};

const getTgAuthHeaders = (extra = {}) => ({
  'X-Telegram-Init-Data': getTelegramInitData(),
  ...extra
});

const extractAssetIdFromContent = (rawContent) => {
  if (!rawContent) return '';
  const str = String(rawContent).trim();
  const match = str.match(/(?:rbxassetid:\/\/|[?&]id=|\/asset\/|\/library\/|\/catalog\/)(\d+)/i) || str.match(/^(\d+)$/);
  return match ? match[1] : '';
};

const SLOT_ORDER = ['hat', 'hair', 'face', 'accessory'];

const SLOT_LABELS = {
  hat: 'Шапка',
  hair: 'Волосы',
  face: 'Лицо / Очки',
  accessory: 'Аксессуар'
};

const MAX_DAILY_LIMIT = 10;
const MAX_BUDGET = 999999;

const SKIN_TONES = [
  { id: 'light', name: 'Светлый', hex: '#F3D2C1' },
  { id: 'ivory', name: 'Тёплый', hex: '#E8B89A' },
  { id: 'tan', name: 'Загар', hex: '#C6865A' },
  { id: 'olive', name: 'Оливковый', hex: '#B58A63' },
  { id: 'brown', name: 'Смуглый', hex: '#8D5524' },
  { id: 'dark', name: 'Тёмный', hex: '#5C3818' },
  { id: 'grey', name: 'Серый', hex: '#CDCDC8' }
];

const R15_BODY_PARTS = [
  { name: 'LowerTorso', parent: null, offset: [0, 0, 0] },
  { name: 'UpperTorso', parent: 'LowerTorso', offset: [0, 0.9, 0] },
  { name: 'Head', parent: 'UpperTorso', offset: [0, 1.35, 0] },
  { name: 'LeftUpperArm', parent: 'UpperTorso', offset: [-1.5, 0.4, 0] },
  { name: 'LeftLowerArm', parent: 'LeftUpperArm', offset: [0, -0.75, 0] },
  { name: 'LeftHand', parent: 'LeftLowerArm', offset: [0, -0.65, 0] },
  { name: 'RightUpperArm', parent: 'UpperTorso', offset: [1.5, 0.4, 0] },
  { name: 'RightLowerArm', parent: 'RightUpperArm', offset: [0, -0.75, 0] },
  { name: 'RightHand', parent: 'RightLowerArm', offset: [0, -0.65, 0] },
  { name: 'LeftUpperLeg', parent: 'LowerTorso', offset: [-0.5, -0.6, 0] },
  { name: 'LeftLowerLeg', parent: 'LeftUpperLeg', offset: [0, -0.75, 0] },
  { name: 'LeftFoot', parent: 'LeftLowerLeg', offset: [0, -0.65, 0] },
  { name: 'RightUpperLeg', parent: 'LowerTorso', offset: [0.5, -0.6, 0] },
  { name: 'RightLowerLeg', parent: 'RightUpperLeg', offset: [0, -0.75, 0] },
  { name: 'RightFoot', parent: 'RightLowerLeg', offset: [0, -0.65, 0] }
];

const R15_ATTACHMENTS = {
  HatAttachment: { part: 'Head', pos: [0, 0.6, 0] },
  HairAttachment: { part: 'Head', pos: [0, 0.6, 0] },
  FaceFrontAttachment: { part: 'Head', pos: [0, 0, -0.6] },
  FaceCenterAttachment: { part: 'Head', pos: [0, 0, 0] },
  NeckAttachment: { part: 'UpperTorso', pos: [0, 0.85, 0] },
  BodyFrontAttachment: { part: 'UpperTorso', pos: [0, 0, -0.5] },
  BodyBackAttachment: { part: 'UpperTorso', pos: [0, 0, 0.5] },
  LeftCollarAttachment: { part: 'UpperTorso', pos: [-1.0, 0.85, 0] },
  RightCollarAttachment: { part: 'UpperTorso', pos: [1.0, 0.85, 0] },
  LeftShoulderAttachment: { part: 'LeftUpperArm', pos: [0, 0.45, 0] },
  RightShoulderAttachment: { part: 'RightUpperArm', pos: [0, 0.45, 0] },
  LeftGripAttachment: { part: 'LeftHand', pos: [0, -0.2, 0] },
  RightGripAttachment: { part: 'RightHand', pos: [0, -0.2, 0] },
  WaistFrontAttachment: { part: 'LowerTorso', pos: [0, -0.2, -0.5] },
  WaistCenterAttachment: { part: 'LowerTorso', pos: [0, -0.2, 0] },
  WaistBackAttachment: { part: 'LowerTorso', pos: [0, -0.2, 0.5] },
  LeftFootAttachment: { part: 'LeftFoot', pos: [0, -0.15, 0] },
  RightFootAttachment: { part: 'RightFoot', pos: [0, -0.15, 0] }
};

const R15_MAN_BUNDLE_SOURCES = [
  {
    key: 'head',
    label: 'Голова (Head)',
    assetId: '86498048',
    parts: ['Head'],
    sourceUrl: 'https://www.roblox.com/catalog/86498048/Man-Head'
  },
  {
    key: 'torso',
    label: 'Торс (UpperTorso + LowerTorso)',
    assetId: '86500008',
    parts: ['UpperTorso', 'LowerTorso'],
    sourceUrl: 'https://www.roblox.com/catalog/86500008/Man-Torso'
  },
  {
    key: 'rightArm',
    label: 'Правая рука (3 части)',
    assetId: '86500036',
    parts: ['RightUpperArm', 'RightLowerArm', 'RightHand'],
    sourceUrl: 'https://www.roblox.com/catalog/86500036/Man-Right-Arm'
  },
  {
    key: 'leftArm',
    label: 'Левая рука (3 части)',
    assetId: '86500054',
    parts: ['LeftUpperArm', 'LeftLowerArm', 'LeftHand'],
    sourceUrl: 'https://www.roblox.com/catalog/86500054/Man-Left-Arm'
  },
  {
    key: 'leftLeg',
    label: 'Левая нога (3 части)',
    assetId: '86500064',
    parts: ['LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot'],
    sourceUrl: 'https://www.roblox.com/catalog/86500064'
  },
  {
    key: 'rightLeg',
    label: 'Правая нога (3 части)',
    assetId: '86500078',
    parts: ['RightUpperLeg', 'RightLowerLeg', 'RightFoot'],
    sourceUrl: 'https://www.roblox.com/catalog/86500078'
  }
];

const R15_JOINT_LINKS = [
  { child: 'UpperTorso', parent: 'LowerTorso', att: 'WaistRigAttachment' },
  { child: 'Head', parent: 'UpperTorso', att: 'NeckRigAttachment' },
  { child: 'LeftUpperArm', parent: 'UpperTorso', att: 'LeftShoulderRigAttachment' },
  { child: 'LeftLowerArm', parent: 'LeftUpperArm', att: 'LeftElbowRigAttachment' },
  { child: 'LeftHand', parent: 'LeftLowerArm', att: 'LeftWristRigAttachment' },
  { child: 'RightUpperArm', parent: 'UpperTorso', att: 'RightShoulderRigAttachment' },
  { child: 'RightLowerArm', parent: 'RightUpperArm', att: 'RightElbowRigAttachment' },
  { child: 'RightHand', parent: 'RightLowerArm', att: 'RightWristRigAttachment' },
  { child: 'LeftUpperLeg', parent: 'LowerTorso', att: 'LeftHipRigAttachment' },
  { child: 'LeftLowerLeg', parent: 'LeftUpperLeg', att: 'LeftKneeRigAttachment' },
  { child: 'LeftFoot', parent: 'LeftLowerLeg', att: 'LeftAnkleRigAttachment' },
  { child: 'RightUpperLeg', parent: 'LowerTorso', att: 'RightHipRigAttachment' },
  { child: 'RightLowerLeg', parent: 'RightUpperLeg', att: 'RightKneeRigAttachment' },
  { child: 'RightFoot', parent: 'RightLowerLeg', att: 'RightAnkleRigAttachment' }
];

const ROBLOX_SLOT_QUERIES = {
  hat: { category: 11, subcategory: 9 },
  hair: { category: 4, subcategory: 20 },
  face: { category: 11, subcategory: 21 },
  accessory: { category: 11, subcategory: 19 }
};

const RU_TO_EN_KEYWORDS = {
  волосы: 'hair',
  кудрявые: 'curly',
  фиолетовые: 'purple',
  синие: 'blue',
  черные: 'black',
  чёрные: 'black',
  белые: 'white',
  шляпа: 'hat',
  кепка: 'cap',
  шапка: 'beanie',
  наушники: 'headphones',
  очки: 'glasses',
  крылья: 'wings',
  катана: 'katana',
  рюкзак: 'backpack',
  доминус: 'dominus',
  валькирия: 'valkyrie'
};

const INITIAL_CATALOG = {
  hat: [
    { id: 'hat_1', assetId: '1028606', name: 'Red Baseball Cap', price: 0 },
    { id: 'hat_2', assetId: '1365767', name: 'Valkyrie Helm', price: 55000 },
    { id: 'hat_3', assetId: '21070012', name: 'Dominus Empyreus', price: 450000 },
    { id: 'hat_4', assetId: '151789690', name: 'Black Headphones', price: 120 },
    { id: 'hat_5', assetId: '1285307', name: 'Sparkle Time Fedora', price: 95000 },
    { id: 'hat_6', assetId: '494291269', name: 'Black Beanie', price: 65 }
  ],
  hair: [
    { id: 'hair_1', assetId: '63690008', name: 'Pal Hair', price: 0 },
    { id: 'hair_2', assetId: '451221329', name: 'True Blue Hair', price: 0 },
    { id: 'hair_3', assetId: '376524487', name: 'Blonde Spiky Hair', price: 0 },
    { id: 'hair_4', assetId: '16630147', name: 'Beautiful Hair for Beautiful People', price: 95 },
    { id: 'hair_5', assetId: '102760492308590', name: 'Violet Curly Hair', price: 65 },
    { id: 'hair_6', assetId: '20573078', name: 'Shaggy', price: 140 },
    { id: 'hair_7', assetId: '62234425', name: 'Brown Charmer Hair', price: 0 }
  ],
  face: [
    { id: 'face_1', assetId: '19398258', name: 'Blackframed Glasses', price: 50 },
    { id: 'face_2', assetId: '1309911', name: 'Clockwork Shades', price: 45000 },
    { id: 'face_3', assetId: '119916949', name: 'Neon Cyber Visor', price: 110 },
    { id: 'face_4', assetId: '14815761', name: 'Silverthorn Antlers', price: 320 }
  ],
  accessory: [
    { id: 'acc_1', assetId: '192557913', name: 'Sparkling Angel Wings', price: 350 },
    { id: 'acc_2', assetId: '215718515', name: 'Crimson Katana Pack', price: 180 },
    { id: 'acc_3', assetId: '4315489767', name: 'Black Tactical Backpack', price: 85 },
    { id: 'acc_4', assetId: '439945661', name: 'Ice Valkyrie', price: 75000 }
  ]
};

const INITIAL_TASKS = [
  { id: 't1', title: 'Подписаться на RBX STUDIO', handle: '@rbxstudio_news', reward: 5, visited: false, completed: false },
  { id: 't2', title: 'Вступить в чат игроков', handle: '@rbxstudio_chat', reward: 5, visited: false, completed: false },
  { id: 't3', title: 'Канал спонсора раздач', handle: '@rbx_drops', reward: 10, visited: false, completed: false }
];

const INITIAL_OP_CHANNELS = [
  { id: 'op1', title: 'RBX NEWS', handle: '@rbxstudio_news', subscribed: false },
  { id: 'op2', title: 'RBX DROPS', handle: '@rbx_drops', subscribed: false }
];

const RobuxIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 inline-block`} fill="none">
    <path
      d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
      fill="#FACC15"
      stroke="#CA8A04"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M12 5.2L17.9 8.6V15.4L12 18.8L6.1 15.4V8.6L12 5.2Z"
      stroke="#FEF08A"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="0.8" fill="#CA8A04" />
  </svg>
);

const RobuxPrice = ({ amount, className = 'text-xs font-extrabold text-slate-900', iconClass = 'w-3.5 h-3.5' }) => (
  <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
    <RobuxIcon className={iconClass} />
    <span>{Number(amount) === 0 ? '0' : formatNumber(amount)}</span>
  </span>
);

const Icons = {
  Settings: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.42 1.11H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Cube: () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Bookmark: ({ filled }) => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Share: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Filter: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Alert: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  External: () => (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Unlock: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Gift: () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  Briefcase: () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
};

function parseRobloxMesh(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 16) {
    throw new Error('Файл меша слишком короткий или повреждён');
  }

  let headerLine = '';
  let dataStart = 0;
  for (let i = 0; i < Math.min(32, bytes.length); i += 1) {
    if (bytes[i] === 10) {
      headerLine = new TextDecoder('ascii').decode(bytes.subarray(0, i)).trim();
      dataStart = i + 1;
      break;
    }
  }

  if (!headerLine.startsWith('version ')) {
    throw new Error(`Неизвестный заголовок меша Roblox: "${headerLine || 'binary'}"`);
  }

  const versionStr = headerLine.slice(8).trim();
  const majorVersion = parseInt(versionStr.split('.')[0], 10);

  if (majorVersion === 1) {
    const text = new TextDecoder('utf-8').decode(bytes.subarray(dataStart));
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const numFaces = parseInt(lines[0], 10);
    if (!Number.isFinite(numFaces) || numFaces <= 0) {
      throw new Error('Некорректное число полигонов в меше v1.00');
    }
    const rawData = lines.slice(1).join('');
    const tupleRegex = /\[([^\]]+)\]/g;
    const tuples = [];
    let m = tupleRegex.exec(rawData);
    while (m) {
      const parts = m[1].split(',').map(Number);
      tuples.push([parts[0] || 0, parts[1] || 0, parts[2] || 0]);
      m = tupleRegex.exec(rawData);
    }
    const posScale = versionStr === '1.00' ? 0.5 : 1.0;
    const vertCount = numFaces * 3;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);

    for (let v = 0; v < vertCount; v += 1) {
      const p = tuples[v * 3] || [0, 0, 0];
      const n = tuples[v * 3 + 1] || [0, 1, 0];
      const t = tuples[v * 3 + 2] || [0, 0, 0];
      positions[v * 3] = p[0] * posScale;
      positions[v * 3 + 1] = p[1] * posScale;
      positions[v * 3 + 2] = p[2] * posScale;
      normals[v * 3] = n[0];
      normals[v * 3 + 1] = n[1];
      normals[v * 3 + 2] = n[2];
      uvs[v * 2] = t[0];
      uvs[v * 2 + 1] = 1.0 - t[1];
    }

    return {
      version: versionStr,
      positions,
      normals,
      uvs,
      indices: null
    };
  }

  const view = new DataView(arrayBuffer, dataStart);
  let offset = 0;

  if (majorVersion === 2) {
    const sizeofHeader = view.getUint16(offset, true);
    const sizeofVertex = view.getUint8(offset + 2);
    const sizeofFace = view.getUint8(offset + 3);
    const numVerts = view.getUint32(offset + 4, true);
    const numFaces = view.getUint32(offset + 8, true);
    offset += sizeofHeader;

    const positions = new Float32Array(numVerts * 3);
    const normals = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);
    const colors = sizeofVertex >= 40 ? new Float32Array(numVerts * 3) : null;

    for (let i = 0; i < numVerts; i += 1) {
      const vOff = offset + i * sizeofVertex;
      positions[i * 3] = view.getFloat32(vOff, true);
      positions[i * 3 + 1] = view.getFloat32(vOff + 4, true);
      positions[i * 3 + 2] = view.getFloat32(vOff + 8, true);

      normals[i * 3] = view.getFloat32(vOff + 12, true);
      normals[i * 3 + 1] = view.getFloat32(vOff + 16, true);
      normals[i * 3 + 2] = view.getFloat32(vOff + 20, true);

      uvs[i * 2] = view.getFloat32(vOff + 24, true);
      uvs[i * 2 + 1] = 1.0 - view.getFloat32(vOff + 28, true);

      if (colors) {
        colors[i * 3] = view.getUint8(vOff + 36) / 255;
        colors[i * 3 + 1] = view.getUint8(vOff + 37) / 255;
        colors[i * 3 + 2] = view.getUint8(vOff + 38) / 255;
      }
    }
    offset += numVerts * sizeofVertex;

    const indices = new Uint32Array(numFaces * 3);
    for (let f = 0; f < numFaces; f += 1) {
      const fOff = offset + f * sizeofFace;
      indices[f * 3] = view.getUint32(fOff, true);
      indices[f * 3 + 1] = view.getUint32(fOff + 4, true);
      indices[f * 3 + 2] = view.getUint32(fOff + 8, true);
    }

    return { version: versionStr, positions, normals, uvs, colors, indices };
  }

  if (majorVersion === 3) {
    const sizeofHeader = view.getUint16(offset, true);
    const sizeofVertex = view.getUint8(offset + 2);
    const sizeofFace = view.getUint8(offset + 3);
    const sizeofLodOffset = view.getUint16(offset + 4, true) || 4;
    const numLodOffsets = view.getUint16(offset + 6, true);
    const numVerts = view.getUint32(offset + 8, true);
    const numFaces = view.getUint32(offset + 12, true);
    offset += sizeofHeader;

    const positions = new Float32Array(numVerts * 3);
    const normals = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);
    const colors = sizeofVertex >= 40 ? new Float32Array(numVerts * 3) : null;

    for (let i = 0; i < numVerts; i += 1) {
      const vOff = offset + i * sizeofVertex;
      positions[i * 3] = view.getFloat32(vOff, true);
      positions[i * 3 + 1] = view.getFloat32(vOff + 4, true);
      positions[i * 3 + 2] = view.getFloat32(vOff + 8, true);

      normals[i * 3] = view.getFloat32(vOff + 12, true);
      normals[i * 3 + 1] = view.getFloat32(vOff + 16, true);
      normals[i * 3 + 2] = view.getFloat32(vOff + 20, true);

      uvs[i * 2] = view.getFloat32(vOff + 24, true);
      uvs[i * 2 + 1] = 1.0 - view.getFloat32(vOff + 28, true);

      if (colors) {
        colors[i * 3] = view.getUint8(vOff + 36) / 255;
        colors[i * 3 + 1] = view.getUint8(vOff + 37) / 255;
        colors[i * 3 + 2] = view.getUint8(vOff + 38) / 255;
      }
    }
    offset += numVerts * sizeofVertex;

    const facesStartOffset = offset;
    offset += numFaces * sizeofFace;

    const lodOffsets = [];
    for (let l = 0; l < numLodOffsets; l += 1) {
      if (offset + l * sizeofLodOffset + 4 <= view.byteLength) {
        lodOffsets.push(view.getUint32(offset + l * sizeofLodOffset, true));
      }
    }

    const faceBegin = lodOffsets.length >= 2 ? lodOffsets[0] : 0;
    const faceEnd =
      lodOffsets.length >= 2 && lodOffsets[1] > faceBegin && lodOffsets[1] <= numFaces
        ? lodOffsets[1]
        : numFaces;
    const activeFaceCount = Math.max(0, faceEnd - faceBegin);

    const indices = new Uint32Array(activeFaceCount * 3);
    for (let f = 0; f < activeFaceCount; f += 1) {
      const fOff = facesStartOffset + (faceBegin + f) * sizeofFace;
      indices[f * 3] = view.getUint32(fOff, true);
      indices[f * 3 + 1] = view.getUint32(fOff + 4, true);
      indices[f * 3 + 2] = view.getUint32(fOff + 8, true);
    }

    return { version: versionStr, positions, normals, uvs, colors, indices };
  }

  if (majorVersion >= 4) {
    const sizeofHeader = view.getUint16(offset, true);
    const numVerts = view.getUint32(offset + 4, true);
    const numFaces = view.getUint32(offset + 8, true);
    const numLodOffsets = view.getUint16(offset + 12, true);
    const numBones = view.getUint16(offset + 14, true);
    offset += sizeofHeader;

    const sizeofVertex = 40;
    const sizeofFace = 12;

    const positions = new Float32Array(numVerts * 3);
    const normals = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);
    const colors = new Float32Array(numVerts * 3);

    for (let i = 0; i < numVerts; i += 1) {
      const vOff = offset + i * sizeofVertex;
      positions[i * 3] = view.getFloat32(vOff, true);
      positions[i * 3 + 1] = view.getFloat32(vOff + 4, true);
      positions[i * 3 + 2] = view.getFloat32(vOff + 8, true);

      normals[i * 3] = view.getFloat32(vOff + 12, true);
      normals[i * 3 + 1] = view.getFloat32(vOff + 16, true);
      normals[i * 3 + 2] = view.getFloat32(vOff + 20, true);

      uvs[i * 2] = view.getFloat32(vOff + 24, true);
      uvs[i * 2 + 1] = 1.0 - view.getFloat32(vOff + 28, true);

      colors[i * 3] = view.getUint8(vOff + 36) / 255;
      colors[i * 3 + 1] = view.getUint8(vOff + 37) / 255;
      colors[i * 3 + 2] = view.getUint8(vOff + 38) / 255;
    }
    offset += numVerts * sizeofVertex;

    if (numBones > 0) {
      offset += numVerts * 8;
    }

    const facesStartOffset = offset;
    offset += numFaces * sizeofFace;

    const lodOffsets = [];
    for (let l = 0; l < numLodOffsets; l += 1) {
      if (offset + l * 4 + 4 <= view.byteLength) {
        lodOffsets.push(view.getUint32(offset + l * 4, true));
      }
    }

    const faceBegin = lodOffsets.length >= 2 ? lodOffsets[0] : 0;
    const faceEnd =
      lodOffsets.length >= 2 && lodOffsets[1] > faceBegin && lodOffsets[1] <= numFaces
        ? lodOffsets[1]
        : numFaces;
    const activeFaceCount = Math.max(0, faceEnd - faceBegin);

    const indices = new Uint32Array(activeFaceCount * 3);
    for (let f = 0; f < activeFaceCount; f += 1) {
      const fOff = facesStartOffset + (faceBegin + f) * sizeofFace;
      indices[f * 3] = view.getUint32(fOff, true);
      indices[f * 3 + 1] = view.getUint32(fOff + 4, true);
      indices[f * 3 + 2] = view.getUint32(fOff + 8, true);
    }

    return { version: versionStr, positions, normals, uvs, colors, indices };
  }

  throw new Error(`Неподдерживаемая версия меша Roblox: ${versionStr}`);
}

let fzstdPromise = null;
const ensureZstdLoaded = () => {
  if (window.fzstd) return Promise.resolve(window.fzstd);
  if (fzstdPromise) return fzstdPromise;

  fzstdPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js';
    script.async = true;
    script.onload = () => {
      if (window.fzstd) resolve(window.fzstd);
      else reject(new Error('Не удалось инициализировать декодер Zstandard (fzstd)'));
    };
    script.onerror = () => {
      fzstdPromise = null;
      reject(new Error('Не удалось загрузить декодер Zstandard (fzstd)'));
    };
    document.head.appendChild(script);
  });

  return fzstdPromise;
};

function decompressLz4Block(src, uncompressedSize) {
  const dst = new Uint8Array(uncompressedSize);
  let sIdx = 0;
  let dIdx = 0;

  while (sIdx < src.length && dIdx < uncompressedSize) {
    const token = src[sIdx++];
    let literalLen = token >> 4;
    if (literalLen === 15) {
      let b = 255;
      while (sIdx < src.length && b === 255) {
        b = src[sIdx++];
        literalLen += b;
      }
    }
    for (let i = 0; i < literalLen && sIdx < src.length && dIdx < uncompressedSize; i += 1) {
      dst[dIdx++] = src[sIdx++];
    }
    if (sIdx >= src.length || dIdx >= uncompressedSize) break;

    const matchOffset = src[sIdx] | (src[sIdx + 1] << 8);
    sIdx += 2;
    if (matchOffset === 0) break;

    let matchLen = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let b = 255;
      while (sIdx < src.length && b === 255) {
        b = src[sIdx++];
        matchLen += b;
      }
    }
    let copyPos = dIdx - matchOffset;
    for (let i = 0; i < matchLen && dIdx < uncompressedSize; i += 1) {
      dst[dIdx++] = dst[copyPos++];
    }
  }
  return dst;
}

function readInterleavedInt32(buf, offset, count) {
  const out = new Int32Array(count);
  for (let i = 0; i < count; i += 1) {
    const u =
      ((buf[offset + i] << 24) |
        (buf[offset + count + i] << 16) |
        (buf[offset + count * 2 + i] << 8) |
        buf[offset + count * 3 + i]) >>>
      0;
    out[i] = (u >>> 1) ^ -(u & 1);
  }
  return out;
}

function readInterleavedUint32(buf, offset, count) {
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] =
      ((buf[offset + i] << 24) |
        (buf[offset + count + i] << 16) |
        (buf[offset + count * 2 + i] << 8) |
        buf[offset + count * 3 + i]) >>>
      0;
  }
  return out;
}

function readInterleavedFloat32(buf, offset, count) {
  const out = new Float32Array(count);
  const tmpBuf = new ArrayBuffer(4);
  const tmpView = new DataView(tmpBuf);
  for (let i = 0; i < count; i += 1) {
    const u =
      ((buf[offset + i] << 24) |
        (buf[offset + count + i] << 16) |
        (buf[offset + count * 2 + i] << 8) |
        buf[offset + count * 3 + i]) >>>
      0;
    const ieee = ((u >>> 1) | (u << 31)) >>> 0;
    tmpView.setUint32(0, ieee, false);
    out[i] = tmpView.getFloat32(0, false);
  }
  return out;
}

function readReferentArray(buf, offset, count) {
  const deltas = readInterleavedInt32(buf, offset, count);
  const refs = new Int32Array(count);
  let acc = 0;
  for (let i = 0; i < count; i += 1) {
    acc += deltas[i];
    refs[i] = acc;
  }
  return refs;
}

function getCFrameRotationFromOrientId(id) {
  const normals = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1]
  ];
  const idx = id - 1;
  const r0Idx = Math.floor(idx / 6);
  const r1Idx = idx % 6;
  const r0 = normals[r0Idx] || [1, 0, 0];
  const r1 = normals[r1Idx] || [0, 1, 0];
  const r2 = [
    r0[1] * r1[2] - r0[2] * r1[1],
    r0[2] * r1[0] - r0[0] * r1[2],
    r0[0] * r1[1] - r0[1] * r1[0]
  ];
  return [r0[0], r1[0], r2[0], r0[1], r1[1], r2[1], r0[2], r1[2], r2[2]];
}

async function parseRobloxBinaryModel(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const magic = new TextDecoder('ascii').decode(bytes.subarray(0, 8));
  if (magic !== '<roblox!') {
    throw new Error('Некорректный заголовок бинарного .rbxm');
  }

  let offset = 32;
  const classes = new Map();
  const instances = new Map();

  while (offset + 16 <= bytes.length) {
    const chunkName = new TextDecoder('ascii').decode(bytes.subarray(offset, offset + 4));
    const compressedLen = view.getUint32(offset + 4, true);
    const uncompressedLen = view.getUint32(offset + 8, true);
    offset += 16;

    if (chunkName === 'END\0') break;

    let chunkBytes;
    if (compressedLen === 0) {
      chunkBytes = bytes.subarray(offset, offset + uncompressedLen);
      offset += uncompressedLen;
    } else {
      const compSlice = bytes.subarray(offset, offset + compressedLen);
      offset += compressedLen;
      if (
        compSlice.length >= 4 &&
        compSlice[0] === 0x28 &&
        compSlice[1] === 0xb5 &&
        compSlice[2] === 0x2f &&
        compSlice[3] === 0xfd
      ) {
        const zstdLib = await ensureZstdLoaded();
        chunkBytes = zstdLib.decompress(compSlice);
      } else {
        chunkBytes = decompressLz4Block(compSlice, uncompressedLen);
      }
    }

    const cView = new DataView(chunkBytes.buffer, chunkBytes.byteOffset, chunkBytes.byteLength);
    let cOff = 0;

    if (chunkName === 'INST') {
      const classId = cView.getUint32(cOff, true);
      cOff += 4;
      const nameLen = cView.getUint32(cOff, true);
      cOff += 4;
      const className = new TextDecoder('utf-8').decode(chunkBytes.subarray(cOff, cOff + nameLen));
      cOff += nameLen;
      const objectFormat = chunkBytes[cOff++];
      const instCount = cView.getUint32(cOff, true);
      cOff += 4;
      const referents = readReferentArray(chunkBytes, cOff, instCount);
      cOff += instCount * 4;
      if (objectFormat === 1) cOff += instCount;

      classes.set(classId, { className, referents });
      for (let i = 0; i < instCount; i += 1) {
        instances.set(referents[i], {
          referent: referents[i],
          className,
          props: {},
          children: [],
          parent: null
        });
      }
    } else if (chunkName === 'PROP') {
      const classId = cView.getUint32(cOff, true);
      cOff += 4;
      const propNameLen = cView.getUint32(cOff, true);
      cOff += 4;
      const propName = new TextDecoder('utf-8').decode(chunkBytes.subarray(cOff, cOff + propNameLen));
      cOff += propNameLen;
      const typeId = chunkBytes[cOff++];

      const cls = classes.get(classId);
      if (!cls) continue;
      const refs = cls.referents;
      const n = refs.length;

      if (typeId === 0x01) {
        for (let i = 0; i < n; i += 1) {
          const sLen = cView.getUint32(cOff, true);
          cOff += 4;
          const str = new TextDecoder('utf-8').decode(chunkBytes.subarray(cOff, cOff + sLen));
          cOff += sLen;
          instances.get(refs[i]).props[propName] = str;
        }
      } else if (typeId === 0x02) {
        for (let i = 0; i < n; i += 1) {
          instances.get(refs[i]).props[propName] = chunkBytes[cOff++] !== 0;
        }
      } else if (typeId === 0x03) {
        const vals = readInterleavedInt32(chunkBytes, cOff, n);
        for (let i = 0; i < n; i += 1) instances.get(refs[i]).props[propName] = vals[i];
      } else if (typeId === 0x04) {
        const vals = readInterleavedFloat32(chunkBytes, cOff, n);
        for (let i = 0; i < n; i += 1) instances.get(refs[i]).props[propName] = vals[i];
      } else if (typeId === 0x05) {
        for (let i = 0; i < n; i += 1) {
          instances.get(refs[i]).props[propName] = cView.getFloat64(cOff, true);
          cOff += 8;
        }
      } else if (typeId === 0x0b || typeId === 0x12) {
        const vals = readInterleavedUint32(chunkBytes, cOff, n);
        for (let i = 0; i < n; i += 1) instances.get(refs[i]).props[propName] = vals[i];
      } else if (typeId === 0x0c) {
        const rs = readInterleavedFloat32(chunkBytes, cOff, n);
        const gs = readInterleavedFloat32(chunkBytes, cOff + n * 4, n);
        const bs = readInterleavedFloat32(chunkBytes, cOff + n * 8, n);
        for (let i = 0; i < n; i += 1) {
          instances.get(refs[i]).props[propName] = [rs[i], gs[i], bs[i]];
        }
      } else if (typeId === 0x0e) {
        const xs = readInterleavedFloat32(chunkBytes, cOff, n);
        const ys = readInterleavedFloat32(chunkBytes, cOff + n * 4, n);
        const zs = readInterleavedFloat32(chunkBytes, cOff + n * 8, n);
        for (let i = 0; i < n; i += 1) {
          instances.get(refs[i]).props[propName] = [xs[i], ys[i], zs[i]];
        }
      } else if (typeId === 0x10) {
        const rots = [];
        for (let i = 0; i < n; i += 1) {
          const orientId = chunkBytes[cOff++];
          if (orientId > 0) {
            rots.push(getCFrameRotationFromOrientId(orientId));
          } else {
            const m = [];
            for (let k = 0; k < 9; k += 1) {
              m.push(cView.getFloat32(cOff, true));
              cOff += 4;
            }
            rots.push(m);
          }
        }
        const xs = readInterleavedFloat32(chunkBytes, cOff, n);
        const ys = readInterleavedFloat32(chunkBytes, cOff + n * 4, n);
        const zs = readInterleavedFloat32(chunkBytes, cOff + n * 8, n);
        for (let i = 0; i < n; i += 1) {
          instances.get(refs[i]).props[propName] = {
            pos: [xs[i], ys[i], zs[i]],
            rot: rots[i]
          };
        }
      } else if (typeId === 0x13) {
        const vals = readReferentArray(chunkBytes, cOff, n);
        for (let i = 0; i < n; i += 1) instances.get(refs[i]).props[propName] = vals[i];
      } else if (typeId === 0x1d) {
        const sourceTypes = readInterleavedInt32(chunkBytes, cOff, n);
        cOff += n * 4;
        const uriCount = cView.getUint32(cOff, true);
        cOff += 4;
        const uris = [];
        for (let u = 0; u < uriCount; u += 1) {
          const uLen = cView.getUint32(cOff, true);
          cOff += 4;
          uris.push(new TextDecoder('utf-8').decode(chunkBytes.subarray(cOff, cOff + uLen)));
          cOff += uLen;
        }
        let uIdx = 0;
        for (let i = 0; i < n; i += 1) {
          if (sourceTypes[i] === 1) {
            instances.get(refs[i]).props[propName] = uris[uIdx++] || '';
          }
        }
      }
    } else if (chunkName === 'PRNT') {
      cOff += 1;
      const count = cView.getUint32(cOff, true);
      cOff += 4;
      const children = readReferentArray(chunkBytes, cOff, count);
      const parents = readReferentArray(chunkBytes, cOff + count * 4, count);
      for (let i = 0; i < count; i += 1) {
        const ch = instances.get(children[i]);
        const pa = instances.get(parents[i]);
        if (ch && pa) {
          ch.parent = pa;
          pa.children.push(ch);
        }
      }
    }
  }

  return Array.from(instances.values());
}

function parseRobloxXmlModel(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Ошибка чтения XML-модели Roblox (.rbxmx)');
  }

  const allNodes = [];
  const walk = (el, parentObj = null) => {
    if (el.tagName === 'Item') {
      const obj = {
        className: el.getAttribute('class') || '',
        props: {},
        children: [],
        parent: parentObj
      };
      if (parentObj) parentObj.children.push(obj);
      allNodes.push(obj);

      const propsEl = Array.from(el.children).find((c) => c.tagName === 'Properties');
      if (propsEl) {
        Array.from(propsEl.children).forEach((p) => {
          const name = p.getAttribute('name');
          if (!name) return;
          if (p.tagName === 'string' || p.tagName === 'Content') {
            const urlNode = p.querySelector('url');
            obj.props[name] = urlNode ? urlNode.textContent || '' : p.textContent || '';
          } else if (p.tagName === 'Vector3') {
            const getF = (tag) => parseFloat(p.querySelector(tag)?.textContent || '0') || 0;
            obj.props[name] = [getF('X'), getF('Y'), getF('Z')];
          } else if (p.tagName === 'CoordinateFrame') {
            const getF = (tag, def = 0) => {
              const v = parseFloat(p.querySelector(tag)?.textContent || '');
              return Number.isFinite(v) ? v : def;
            };
            obj.props[name] = {
              pos: [getF('X', 0), getF('Y', 0), getF('Z', 0)],
              rot: [
                getF('R00', 1),
                getF('R01', 0),
                getF('R02', 0),
                getF('R10', 0),
                getF('R11', 1),
                getF('R12', 0),
                getF('R20', 0),
                getF('R21', 0),
                getF('R22', 1)
              ]
            };
          }
        });
      }

      Array.from(el.children)
        .filter((c) => c.tagName === 'Item')
        .forEach((childEl) => walk(childEl, obj));
    } else {
      Array.from(el.children).forEach((childEl) => walk(childEl, parentObj));
    }
  };

  walk(doc.documentElement, null);
  return allNodes;
}

async function extractRobloxAssetMetadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const headAscii = new TextDecoder('ascii').decode(bytes.subarray(0, 16));
  const nodes = headAscii.startsWith('<roblox!')
    ? await parseRobloxBinaryModel(arrayBuffer)
    : parseRobloxXmlModel(new TextDecoder('utf-8').decode(bytes));

  const handle =
    nodes.find(
      (n) =>
        (n.className === 'Part' || n.className === 'MeshPart') &&
        (n.props.Name === 'Handle' || n.parent?.className === 'Accessory')
    ) || nodes.find((n) => n.className === 'MeshPart' || n.className === 'Part');

  if (!handle) {
    throw new Error('В файле Roblox не найден объект Handle / MeshPart');
  }

  const specialMesh = handle.children.find((c) => c.className === 'SpecialMesh');
  const attachment = handle.children.find((c) => c.className === 'Attachment');

  const rawMeshUri =
    specialMesh?.props.MeshId ||
    handle.props.MeshId ||
    handle.props.MeshContent ||
    '';
  const rawTexUri =
    specialMesh?.props.TextureId ||
    handle.props.TextureID ||
    handle.props.TextureId ||
    handle.props.TextureContent ||
    '';

  const meshAssetId = extractAssetIdFromContent(rawMeshUri);
  const textureAssetId = extractAssetIdFromContent(rawTexUri);

  if (!meshAssetId) {
    throw new Error('В файле аксессуара не указан MeshId');
  }

  const partSize = Array.isArray(handle.props.Size) ? handle.props.Size : [1, 1, 1];
  const meshScale = Array.isArray(specialMesh?.props.Scale) ? specialMesh.props.Scale : null;
  const meshOffset = Array.isArray(specialMesh?.props.Offset) ? specialMesh.props.Offset : [0, 0, 0];
  const vertexColor = Array.isArray(specialMesh?.props.VertexColor)
    ? specialMesh.props.VertexColor
    : [1, 1, 1];

  const attachmentName = attachment?.props.Name || 'HatAttachment';
  const attachmentCFrame = attachment?.props.CFrame || {
    pos: [0, 0, 0],
    rot: [1, 0, 0, 0, 1, 0, 0, 0, 1]
  };

  return {
    partClass: handle.className,
    partName: handle.props.Name || 'Handle',
    partSize,
    meshAssetId,
    textureAssetId,
    meshScale,
    meshOffset,
    vertexColor,
    attachmentName,
    attachmentCFrame
  };
}

async function extractR15BundlePartsFromModel(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const headAscii = new TextDecoder('ascii').decode(bytes.subarray(0, 16));
  const nodes = headAscii.startsWith('<roblox!')
    ? await parseRobloxBinaryModel(arrayBuffer)
    : parseRobloxXmlModel(new TextDecoder('utf-8').decode(bytes));

  const validPartNames = new Set(R15_BODY_PARTS.map((p) => p.name));

  const r15Folder = nodes.find(
    (n) => n.className === 'Folder' && n.props.Name === 'R15ArtistIntent'
  );
  const candidatePool = r15Folder ? r15Folder.children : nodes;

  const extracted = [];

  candidatePool.forEach((node) => {
    if (
      (node.className === 'MeshPart' || node.className === 'Part') &&
      validPartNames.has(node.props.Name)
    ) {
      const specialMesh = node.children.find((c) => c.className === 'SpecialMesh');
      const rawMeshUri =
        specialMesh?.props.MeshId ||
        node.props.MeshId ||
        node.props.MeshContent ||
        '';
      const meshAssetId = extractAssetIdFromContent(rawMeshUri);
      if (!meshAssetId) return;

      const attachments = {};
      node.children
        .filter((c) => c.className === 'Attachment' && c.props.Name)
        .forEach((att) => {
          attachments[att.props.Name] = att.props.CFrame || {
            pos: [0, 0, 0],
            rot: [1, 0, 0, 0, 1, 0, 0, 0, 1]
          };
        });

      extracted.push({
        partName: node.props.Name,
        partClass: node.className,
        meshAssetId,
        partSize: Array.isArray(node.props.Size) ? node.props.Size : [1, 1, 1],
        meshScale: Array.isArray(specialMesh?.props.Scale) ? specialMesh.props.Scale : null,
        attachments
      });
    }
  });

  if (extracted.length === 0) {
    const headMeshNode = nodes.find(
      (n) =>
        (n.className === 'SpecialMesh' || n.className === 'MeshPart') &&
        extractAssetIdFromContent(n.props.MeshId || n.props.MeshContent || '')
    );
    if (headMeshNode) {
      const meshAssetId = extractAssetIdFromContent(
        headMeshNode.props.MeshId || headMeshNode.props.MeshContent || ''
      );
      const parentPart =
        headMeshNode.parent?.className === 'Part' ? headMeshNode.parent : headMeshNode;
      const attachments = {};
      (parentPart.children || [])
        .filter((c) => c.className === 'Attachment' && c.props.Name)
        .forEach((att) => {
          attachments[att.props.Name] = att.props.CFrame || {
            pos: [0, 0, 0],
            rot: [1, 0, 0, 0, 1, 0, 0, 0, 1]
          };
        });

      extracted.push({
        partName: 'Head',
        partClass: headMeshNode.className,
        meshAssetId,
        partSize: Array.isArray(parentPart.props.Size) ? parentPart.props.Size : [2, 1, 1],
        meshScale: Array.isArray(headMeshNode.props.Scale) ? headMeshNode.props.Scale : null,
        attachments
      });
    }
  }

  if (extracted.length === 0) {
    throw new Error('В файле не найдены части тела R15 (MeshPart / R15ArtistIntent)');
  }

  return extracted;
}

let threePromise = null;
const ensureThreeLoaded = () => {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (threePromise) return threePromise;

  threePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => {
      if (window.THREE) resolve(window.THREE);
      else reject(new Error('Three.js не инициализирован'));
    };
    script.onerror = () => {
      threePromise = null;
      reject(new Error('Не удалось загрузить библиотеку Three.js'));
    };
    document.head.appendChild(script);
  });

  return threePromise;
};

const MESH_GEOMETRY_CACHE = new Map();
const TEXTURE_CACHE = new Map();
const ACCESSORY_META_CACHE = new Map();

function buildThreeBufferGeometry(parsedMesh, THREE) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(parsedMesh.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(parsedMesh.normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(parsedMesh.uvs, 2));
  if (parsedMesh.colors) {
    geo.setAttribute('color', new THREE.BufferAttribute(parsedMesh.colors, 3));
  }
  if (parsedMesh.indices) {
    geo.setIndex(new THREE.BufferAttribute(parsedMesh.indices, 1));
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function loadThreeTextureFromBuffer(arrayBuffer, THREE) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([arrayBuffer], { type: 'image/png' });
    const objectUrl = URL.createObjectURL(blob);
    const loader = new THREE.TextureLoader();
    loader.load(
      objectUrl,
      (tex) => {
        URL.revokeObjectURL(objectUrl);
        if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Не удалось декодировать текстуру Roblox (.png)'));
      }
    );
  });
}

async function fetchSameOriginAssetBuffer(assetId, signal) {
  const cleanId = String(assetId || '').trim();
  if (!/^\d{1,20}$/.test(cleanId)) {
    throw new Error(`Некорректный числовой assetId: "${cleanId}"`);
  }
  const url = `/asset?id=${encodeURIComponent(cleanId)}`;
  const res = await fetch(url, {
    signal,
    headers: getTgAuthHeaders()
  });
  if (!res.ok) {
    let detail = res.statusText || 'Ошибка загрузки ассета с сервера';
    try {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        if (j?.error) detail = j.error;
      } catch {
        if (text.trim()) detail = text.trim();
      }
    } catch {
    }
    const err = new Error(`HTTP ${res.status} — ${detail}`);
    err.httpStatus = res.status;
    throw err;
  }
  return await res.arrayBuffer();
}

function applyRobloxAttachmentTransform(targetGroup, attachmentCFrame, bodyAttachmentPos, THREE) {
  const mHandleAtt = new THREE.Matrix4();
  const r = attachmentCFrame.rot || [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const p = attachmentCFrame.pos || [0, 0, 0];

  mHandleAtt.set(
    r[0], r[1], r[2], p[0],
    r[3], r[4], r[5], p[1],
    r[6], r[7], r[8], p[2],
    0,    0,    0,    1
  );

  const mBodyAtt = new THREE.Matrix4().makeTranslation(
    bodyAttachmentPos[0],
    bodyAttachmentPos[1],
    bodyAttachmentPos[2]
  );

  const mInvHandleAtt = mHandleAtt.clone().invert();
  const mResult = new THREE.Matrix4().multiplyMatrices(mBodyAtt, mInvHandleAtt);

  targetGroup.matrixAutoUpdate = false;
  targetGroup.matrix.copy(mResult);
  targetGroup.matrixWorldNeedsUpdate = true;
}

const RobloxThreeStageViewport = ({
  outfit,
  skinHex,
  tmaReady,
  r15BodyPartsData,
  r15LoadError,
  localAccessoryBuffers,
  onSlotLoadStatusChange,
  onOpenBodyLoader,
  historyCount,
  historyIndex,
  onHistoryPrev,
  onHistoryNext
}) => {
  const containerRef = useRef(null);
  const sceneObjectsRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    pivot: null,
    rigNodes: {},
    bodyGroup: null,
    accessoryGroup: null,
    skinMaterial: null
  });
  const cameraControlRef = useRef({
    rotY: 0,
    rotX: 0.08,
    distance: 6.4
  });

  const [cameraPreset, setCameraPreset] = useState('front');
  const [threeInitError, setThreeInitError] = useState('');
  const [slotStatuses, setSlotStatuses] = useState({});
  const [dynamicAttachments, setDynamicAttachments] = useState({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    let frameId = null;
    let resizeObserver = null;
    let cleanupDomEvents = null;

    const setup = async () => {
      try {
        const THREE = await ensureThreeLoaded();
        if (disposed || !container) return;

        const width = Math.max(container.clientWidth || 340, 220);
        const height = Math.max(container.clientHeight || 390, 220);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#E8EEF5');

        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = false;
        if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
          renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.52);
        dirLight.position.set(3, 6, 5);
        dirLight.castShadow = false;
        scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xe2e8f0, 0.25);
        backLight.position.set(-3, 4, -5);
        scene.add(backLight);

        const pivot = new THREE.Group();
        scene.add(pivot);

        const skinMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(skinHex),
          roughness: 0.62,
          metalness: 0.0
        });

        const rigNodes = {};
        R15_BODY_PARTS.forEach((part) => {
          const node = new THREE.Group();
          node.name = part.name;
          node.position.set(part.offset[0], part.offset[1], part.offset[2]);
          rigNodes[part.name] = node;
        });

        R15_BODY_PARTS.forEach((part) => {
          if (part.parent && rigNodes[part.parent]) {
            rigNodes[part.parent].add(rigNodes[part.name]);
          } else {
            pivot.add(rigNodes[part.name]);
          }
        });

        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'R15BodyMeshes';
        pivot.add(bodyGroup);

        const accessoryGroup = new THREE.Group();
        accessoryGroup.name = 'R15Accessories';
        pivot.add(accessoryGroup);

        sceneObjectsRef.current = {
          scene,
          camera,
          renderer,
          pivot,
          rigNodes,
          bodyGroup,
          accessoryGroup,
          skinMaterial
        };

        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        const onDown = (e) => {
          dragging = true;
          const pt = e.touches ? e.touches[0] : e;
          lastX = pt.clientX;
          lastY = pt.clientY;
        };

        const onMove = (e) => {
          if (!dragging) return;
          const pt = e.touches ? e.touches[0] : e;
          const dx = pt.clientX - lastX;
          const dy = pt.clientY - lastY;
          lastX = pt.clientX;
          lastY = pt.clientY;
          cameraControlRef.current.rotY += dx * 0.011;
          cameraControlRef.current.rotX = Math.max(
            -0.5,
            Math.min(0.7, cameraControlRef.current.rotX + dy * 0.008)
          );
        };

        const onUp = () => {
          dragging = false;
        };

        const onWheel = (e) => {
          e.preventDefault();
          cameraControlRef.current.distance = Math.max(
            3.2,
            Math.min(11, cameraControlRef.current.distance + e.deltaY * 0.004)
          );
        };

        const dom = renderer.domElement;
        dom.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        dom.addEventListener('touchstart', onDown, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp);
        dom.addEventListener('wheel', onWheel, { passive: false });

        cleanupDomEvents = () => {
          dom.removeEventListener('mousedown', onDown);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          dom.removeEventListener('touchstart', onDown);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onUp);
          dom.removeEventListener('wheel', onWheel);
        };

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (!container || !renderer) return;
            const w = Math.max(container.clientWidth || 340, 220);
            const h = Math.max(container.clientHeight || 390, 220);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          });
          resizeObserver.observe(container);
        }

        const animate = () => {
          if (disposed) return;
          frameId = requestAnimationFrame(animate);
          const { rotY, rotX, distance } = cameraControlRef.current;
          const targetY = 0.25;
          camera.position.x = Math.sin(rotY) * Math.cos(rotX) * distance;
          camera.position.y = targetY + Math.sin(rotX) * distance;
          camera.position.z = Math.cos(rotY) * Math.cos(rotX) * distance;
          camera.lookAt(0, targetY, 0);
          renderer.render(scene, camera);
        };
        animate();
      } catch (err) {
        if (!disposed) {
          setThreeInitError(String(err?.message || err));
        }
      }
    };

    setup();

    return () => {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      if (cleanupDomEvents) cleanupDomEvents();
      const { renderer } = sceneObjectsRef.current;
      if (renderer) renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const mat = sceneObjectsRef.current.skinMaterial;
    if (mat && skinHex) {
      mat.color.set(skinHex);
      mat.needsUpdate = true;
    }
  }, [skinHex]);

  const applyCameraPreset = (presetId) => {
    setCameraPreset(presetId);
    if (presetId === 'front') {
      cameraControlRef.current.rotY = 0;
      cameraControlRef.current.rotX = 0.08;
    } else if (presetId === 'threeQuarter') {
      cameraControlRef.current.rotY = 0.58;
      cameraControlRef.current.rotX = 0.1;
    } else if (presetId === 'back') {
      cameraControlRef.current.rotY = Math.PI;
      cameraControlRef.current.rotX = 0.08;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const mountR15Body = async () => {
      const THREE = await ensureThreeLoaded();
      const { rigNodes, skinMaterial } = sceneObjectsRef.current;
      if (cancelled || !rigNodes || !skinMaterial) return;

      R15_BODY_PARTS.forEach((p) => {
        const node = rigNodes[p.name];
        if (!node) return;
        node.position.set(p.offset[0], p.offset[1], p.offset[2]);
        const oldMeshes = node.children.filter((c) => c.userData?.isR15BodyMesh);
        oldMeshes.forEach((m) => node.remove(m));
      });

      const entries = Object.entries(r15BodyPartsData || {});
      if (entries.length === 0) {
        setDynamicAttachments({});
        return;
      }

      const partAttachmentsMap = {};
      const nextAccAttachments = {};

      for (const [partName, entry] of entries) {
        if (!entry?.meshBuffer || !rigNodes[partName]) continue;
        try {
          const cacheKey = `r15_body_${partName}_${entry.meshBuffer.byteLength}`;
          let geo = MESH_GEOMETRY_CACHE.get(cacheKey);
          if (!geo) {
            const parsed = parseRobloxMesh(entry.meshBuffer);
            geo = buildThreeBufferGeometry(parsed, THREE);
            MESH_GEOMETRY_CACHE.set(cacheKey, geo);
          }

          const mesh = new THREE.Mesh(geo, skinMaterial);
          mesh.userData.isR15BodyMesh = true;

          if (entry.meshScale) {
            mesh.scale.set(entry.meshScale[0], entry.meshScale[1], entry.meshScale[2]);
          } else if (entry.partSize && geo.boundingBox) {
            const bbSize = new THREE.Vector3();
            geo.boundingBox.getSize(bbSize);
            if (bbSize.x > 0.001 && bbSize.y > 0.001 && bbSize.z > 0.001) {
              mesh.scale.set(
                entry.partSize[0] / bbSize.x,
                entry.partSize[1] / bbSize.y,
                entry.partSize[2] / bbSize.z
              );
            }
          }

          rigNodes[partName].add(mesh);

          if (entry.attachments) {
            partAttachmentsMap[partName] = entry.attachments;
            Object.entries(entry.attachments).forEach(([attName, cf]) => {
              if (R15_ATTACHMENTS[attName] && Array.isArray(cf?.pos)) {
                nextAccAttachments[attName] = { part: partName, pos: cf.pos };
              }
            });
          }
        } catch {
        }
      }

      R15_JOINT_LINKS.forEach(({ child, parent, att }) => {
        const pAtt = partAttachmentsMap[parent]?.[att];
        const cAtt = partAttachmentsMap[child]?.[att];
        if (pAtt?.pos && cAtt?.pos && rigNodes[child]) {
          rigNodes[child].position.set(
            pAtt.pos[0] - cAtt.pos[0],
            pAtt.pos[1] - cAtt.pos[1],
            pAtt.pos[2] - cAtt.pos[2]
          );
        }
      });

      if (!cancelled) {
        setDynamicAttachments(nextAccAttachments);
      }
    };

    mountR15Body();
    return () => {
      cancelled = true;
    };
  }, [r15BodyPartsData]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const mountAccessories = async () => {
      const THREE = await ensureThreeLoaded();
      const { rigNodes } = sceneObjectsRef.current;
      if (cancelled || !rigNodes) return;

      Object.values(rigNodes).forEach((node) => {
        const oldAccs = node.children.filter((c) => c.userData?.isR15Accessory);
        oldAccs.forEach((a) => node.remove(a));
      });

      const nextStatuses = {};

      for (const sk of SLOT_ORDER) {
        const item = outfit[sk];
        if (!item) {
          nextStatuses[sk] = { state: 'empty', error: '' };
          continue;
        }

        nextStatuses[sk] = { state: 'loading', error: '' };
        setSlotStatuses({ ...nextStatuses });
        if (onSlotLoadStatusChange) onSlotLoadStatusChange({ ...nextStatuses });

        try {
          const idStr = String(item.assetId || '');
          const localEntry = localAccessoryBuffers?.[idStr];

          let meta = null;
          let meshGeo = null;
          let textureObj = null;

          if (localEntry?.meshBuffer) {
            const mKey = `local_mesh_${idStr}_${localEntry.meshBuffer.byteLength}`;
            meshGeo = MESH_GEOMETRY_CACHE.get(mKey);
            if (!meshGeo) {
              const parsed = parseRobloxMesh(localEntry.meshBuffer);
              meshGeo = buildThreeBufferGeometry(parsed, THREE);
              MESH_GEOMETRY_CACHE.set(mKey, meshGeo);
            }
            if (localEntry.textureBuffer) {
              const tKey = `local_tex_${idStr}_${localEntry.textureBuffer.byteLength}`;
              textureObj = TEXTURE_CACHE.get(tKey);
              if (!textureObj) {
                textureObj = await loadThreeTextureFromBuffer(localEntry.textureBuffer, THREE);
                TEXTURE_CACHE.set(tKey, textureObj);
              }
            }
            meta = localEntry.meta || {
              partClass: 'Part',
              partSize: [1, 1, 1],
              meshScale: [1, 1, 1],
              meshOffset: [0, 0, 0],
              vertexColor: [1, 1, 1],
              attachmentName:
                sk === 'hair'
                  ? 'HairAttachment'
                  : sk === 'face'
                  ? 'FaceFrontAttachment'
                  : sk === 'accessory'
                  ? 'BodyBackAttachment'
                  : 'HatAttachment',
              attachmentCFrame: { pos: [0, 0, 0], rot: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
            };
          } else {
            meta = ACCESSORY_META_CACHE.get(idStr);
            if (!meta) {
              const modelBuf = await fetchSameOriginAssetBuffer(idStr, controller.signal);
              meta = await extractRobloxAssetMetadata(modelBuf);
              ACCESSORY_META_CACHE.set(idStr, meta);
            }

            meshGeo = MESH_GEOMETRY_CACHE.get(meta.meshAssetId);
            if (!meshGeo) {
              const meshBuf = await fetchSameOriginAssetBuffer(
                meta.meshAssetId,
                controller.signal
              );
              const parsedMesh = parseRobloxMesh(meshBuf);
              meshGeo = buildThreeBufferGeometry(parsedMesh, THREE);
              MESH_GEOMETRY_CACHE.set(meta.meshAssetId, meshGeo);
            }

            if (meta.textureAssetId) {
              textureObj = TEXTURE_CACHE.get(meta.textureAssetId);
              if (!textureObj) {
                const texBuf = await fetchSameOriginAssetBuffer(
                  meta.textureAssetId,
                  controller.signal
                );
                textureObj = await loadThreeTextureFromBuffer(texBuf, THREE);
                TEXTURE_CACHE.set(meta.textureAssetId, textureObj);
              }
            }
          }

          if (cancelled) return;

          const attTarget =
            dynamicAttachments[meta.attachmentName] ||
            R15_ATTACHMENTS[meta.attachmentName] ||
            R15_ATTACHMENTS.HatAttachment;
          const targetRigNode = rigNodes[attTarget.part] || rigNodes.Head;

          const holderGroup = new THREE.Group();
          holderGroup.userData.isR15Accessory = true;
          applyRobloxAttachmentTransform(
            holderGroup,
            meta.attachmentCFrame,
            attTarget.pos,
            THREE
          );

          const [vcR, vcG, vcB] = meta.vertexColor || [1, 1, 1];
          const mat = new THREE.MeshStandardMaterial({
            map: textureObj || null,
            color: new THREE.Color(vcR, vcG, vcB),
            vertexColors: Boolean(meshGeo.getAttribute('color')),
            roughness: 0.55,
            metalness: 0.05,
            side: THREE.DoubleSide
          });

          const meshInstance = new THREE.Mesh(meshGeo, mat);

          if (meta.meshScale) {
            meshInstance.scale.set(meta.meshScale[0], meta.meshScale[1], meta.meshScale[2]);
          } else if (meta.partClass === 'MeshPart' && meshGeo.boundingBox) {
            const bbSize = new THREE.Vector3();
            meshGeo.boundingBox.getSize(bbSize);
            if (bbSize.x > 0.001 && bbSize.y > 0.001 && bbSize.z > 0.001) {
              meshInstance.scale.set(
                meta.partSize[0] / bbSize.x,
                meta.partSize[1] / bbSize.y,
                meta.partSize[2] / bbSize.z
              );
            }
          }

          if (meta.meshOffset) {
            meshInstance.position.set(
              meta.meshOffset[0],
              meta.meshOffset[1],
              meta.meshOffset[2]
            );
          }

          holderGroup.add(meshInstance);
          targetRigNode.add(holderGroup);

          nextStatuses[sk] = { state: 'ok', error: '' };
        } catch (err) {
          if (cancelled || err?.name === 'AbortError') return;
          nextStatuses[sk] = { state: 'error', error: String(err?.message || err) };
        }

        if (!cancelled) {
          setSlotStatuses({ ...nextStatuses });
          if (onSlotLoadStatusChange) onSlotLoadStatusChange({ ...nextStatuses });
        }
      }
    };

    mountAccessories();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [outfit, localAccessoryBuffers, dynamicAttachments, onSlotLoadStatusChange]);

  const errorEntries = useMemo(
    () =>
      SLOT_ORDER.filter((sk) => outfit[sk] && slotStatuses[sk]?.state === 'error').map((sk) => ({
        slotKey: sk,
        item: outfit[sk],
        error: slotStatuses[sk].error
      })),
    [outfit, slotStatuses]
  );

  const loadedBodyCount = useMemo(
    () => R15_BODY_PARTS.filter((p) => Boolean(r15BodyPartsData?.[p.name]?.meshBuffer)).length,
    [r15BodyPartsData]
  );

  return (
    <div className="relative w-full h-[400px] rounded-2xl overflow-hidden bg-[#E8EEF5] border border-slate-200 select-none">
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-20">
        <div className="inline-flex bg-white/95 p-1 rounded-xl shadow-xs border border-slate-200">
          {[
            { id: 'front', label: 'Спереди' },
            { id: 'threeQuarter', label: '3/4' },
            { id: 'back', label: 'Со спины' }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => applyCameraPreset(btn.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                cameraPreset === btn.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenBodyLoader}
          className="px-2.5 py-1.5 rounded-xl bg-white/95 hover:bg-blue-50 border border-slate-200 shadow-xs text-[10px] font-extrabold text-slate-800 shrink-0 transition-colors"
        >
          Тело R15: {loadedBodyCount} из 15 частей
        </button>
      </div>

      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {(threeInitError || loadedBodyCount === 0 || r15LoadError || errorEntries.length > 0) && (
        <div className="absolute inset-x-3 top-14 z-10 pointer-events-none flex flex-col gap-2">
          {threeInitError && (
            <div className="pointer-events-auto rounded-2xl bg-white/95 border border-red-200 p-3 text-xs text-red-700 shadow-xs">
              <p className="font-extrabold">Ошибка WebGL / Three.js</p>
              <p className="text-[11px] mt-0.5">{threeInitError}</p>
            </div>
          )}

          {(loadedBodyCount === 0 || r15LoadError) && (
            <div className="pointer-events-auto rounded-2xl bg-white/95 border border-slate-200 p-3.5 text-center space-y-2 shadow-xs">
              <p className="text-xs font-extrabold text-slate-900 break-words">
                Тело не загружено:{' '}
                <span className="font-semibold text-red-600">
                  {r15LoadError || 'настоящие файлы мешей R15 ещё не загружены'}
                </span>
              </p>
              <div className="flex justify-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onOpenBodyLoader}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold"
                >
                  Загрузить части тела
                </button>
              </div>
            </div>
          )}

          {errorEntries.length > 0 && (
            <div className="pointer-events-auto rounded-2xl bg-white/95 border border-red-200 p-3 space-y-1.5 shadow-xs max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-red-700 inline-flex items-center gap-1">
                  <Icons.Alert />
                  <span>Ошибка загрузки 3D ассетов ({errorEntries.length})</span>
                </span>
              </div>
              {errorEntries.map((e) => (
                <div key={e.slotKey} className="text-[10px] text-slate-700 border-t border-red-100 pt-1">
                  <span className="font-bold text-slate-900">
                    {SLOT_LABELS[e.slotKey]} — {e.item.name}:
                  </span>{' '}
                  <span className="text-red-600">{e.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 z-20">
        <div className="inline-flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-xl shadow-xs border border-slate-200 text-[10px] font-bold text-slate-700 max-w-[215px] truncate">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              tmaReady ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
          />
          <span className="truncate">
            {tmaReady ? 'Telegram Mini App · /asset' : 'Вне Telegram (initData нет)'}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 bg-white/95 p-1 rounded-xl shadow-xs border border-slate-200">
          <button
            type="button"
            disabled={historyIndex <= 0}
            onClick={onHistoryPrev}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
            aria-label="Предыдущий образ"
          >
            <Icons.ChevronLeft />
          </button>
          <span className="text-[11px] font-bold text-slate-700 tabular-nums px-1.5 min-w-[38px] text-center">
            {historyCount > 0 ? `${historyIndex + 1}/${historyCount}` : '0/0'}
          </span>
          <button
            type="button"
            disabled={historyIndex < 0 || historyIndex >= historyCount - 1}
            onClick={onHistoryNext}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35"
            aria-label="Следующий образ"
          >
            <Icons.ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
};

const OfficialRobloxThumbnail = ({ item, thumbnailUrl, loading, error }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [thumbnailUrl, item?.assetId]);

  if (!item) {
    return (
      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">
        —
      </div>
    );
  }

  const finalUrl = thumbnailUrl || item.thumbnailUrl;

  return (
    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
      {finalUrl && !imgFailed ? (
        <img
          src={finalUrl}
          alt={item.name}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : loading ? (
        <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      ) : (
        <span
          className="text-red-500 flex items-center justify-center"
          title={error || 'Миниатюра Roblox не загружена'}
        >
          <Icons.Alert />
        </span>
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [tgUser, setTgUser] = useState(null);
  const [tmaHasInitData, setTmaHasInitData] = useState(false);
  const [tgTheme, setTgTheme] = useState({
    isDark: false,
    bgColor: '#F4F7FB',
    secondaryBgColor: '#FFFFFF',
    textColor: '#0F172A',
    accentColor: '#2563EB'
  });

  const [skinHex, setSkinHex] = useState(() => safeStorageGet('rbx_skin_hex', '#F3D2C1'));
  const [r15BodyPartsData, setR15BodyPartsData] = useState({});
  const [r15BundleInputIds, setR15BundleInputIds] = useState(() =>
    R15_MAN_BUNDLE_SOURCES.reduce((acc, row) => ({ ...acc, [row.key]: row.assetId }), {})
  );
  const [r15LoadError, setR15LoadError] = useState('');
  const [showBodyLoaderModal, setShowBodyLoaderModal] = useState(false);
  const [loadingR15FromProxy, setLoadingR15FromProxy] = useState(false);

  const [localAccessoryBuffers, setLocalAccessoryBuffers] = useState({});
  const [thumbnailMap, setThumbnailMap] = useState({});
  const [thumbnailErrors, setThumbnailErrors] = useState({});
  const [loadingThumbs, setLoadingThumbs] = useState(false);

  const [catalogPool, setCatalogPool] = useState(INITIAL_CATALOG);
  const [equippedOutfit, setEquippedOutfit] = useState({
    hat: null,
    hair: null,
    face: null,
    accessory: null
  });
  const [slotLoadStatuses, setSlotLoadStatuses] = useState({});
  const [currentOutfitId, setCurrentOutfitId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [remainingGens, setRemainingGens] = useState(MAX_DAILY_LIMIT);

  const [totalBudget, setTotalBudget] = useState(350);
  const [hiddenSlots, setHiddenSlots] = useState({});
  const [lockedSlots, setLockedSlots] = useState({});
  const [expandedSlot, setExpandedSlot] = useState(null);
  const [slotBudgets, setSlotBudgets] = useState({});

  const recentSlotItemsRef = useRef({
    hat: [],
    hair: [],
    face: [],
    accessory: []
  });

  const [savedOutfits, setSavedOutfits] = useState([]);
  const [balance, setBalance] = useState(15);
  const [frozenBalance, setFrozenBalance] = useState(0);
  const [referralCount, setReferralCount] = useState(1);
  const [lastCaseClaim, setLastCaseClaim] = useState(0);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [checkingTasks, setCheckingTasks] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [redeemedCodes, setRedeemedCodes] = useState([]);
  const [notifications, setNotifications] = useState({
    dailyCase: true,
    referrals: true,
    withdrawals: true
  });

  const [opChannels, setOpChannels] = useState(INITIAL_OP_CHANNELS);
  const [opModalOpen, setOpModalOpen] = useState(false);
  const [pendingOpAction, setPendingOpAction] = useState(null);
  const [checkingOp, setCheckingOp] = useState(false);
  const [opErrorMsg, setOpErrorMsg] = useState('');

  const [linkedRobloxUser, setLinkedRobloxUser] = useState('');
  const [robloxUserInput, setRobloxUserInput] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryFilterSlot, setInventoryFilterSlot] = useState('all');
  const [syncingInventory, setSyncingInventory] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterOpen, setSearchFilterOpen] = useState(false);
  const [searchSlot, setSearchSlot] = useState('all');
  const [searchMinPrice, setSearchMinPrice] = useState('');
  const [searchMaxPrice, setSearchMaxPrice] = useState('');
  const [searchSort, setSearchSort] = useState('popular');
  const [liveSearchResults, setLiveSearchResults] = useState([]);
  const [liveSearchError, setLiveSearchError] = useState('');
  const [liveSearching, setLiveSearching] = useState(false);

  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [roulettePhase, setRoulettePhase] = useState('ready');
  const [rouletteStrip, setRouletteStrip] = useState([]);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [wonPrize, setWonPrize] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const rouletteViewportRef = useRef(null);
  const rouletteTimerRef = useRef(null);

  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(30);
  const [withdrawGamepass, setWithdrawGamepass] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!lastCaseClaim) return undefined;
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [lastCaseClaim]);

  const copyTextSafe = useCallback(
    (text, successMsg = 'Скопировано') => {
      const fallbackCopy = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast(successMsg, 'success');
        } catch {
          showToast('Не удалось скопировать текст', 'error');
        }
      };

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(
          () => showToast(successMsg, 'success'),
          () => fallbackCopy()
        );
      } else {
        fallbackCopy();
      }
    },
    [showToast]
  );

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return undefined;

    try {
      tg.ready();
      tg.expand();
    } catch {
    }

    const syncTheme = () => {
      const tp = tg.themeParams || {};
      const isDark = tg.colorScheme === 'dark';
      setTgTheme({
        isDark,
        bgColor: tp.secondary_bg_color || tp.bg_color || (isDark ? '#0F172A' : '#F4F7FB'),
        secondaryBgColor: tp.bg_color || (isDark ? '#1E293B' : '#FFFFFF'),
        textColor: tp.text_color || (isDark ? '#F8FAFC' : '#0F172A'),
        accentColor: tp.button_color || '#2563EB'
      });
    };

    syncTheme();
    if (tg.initDataUnsafe?.user) {
      setTgUser(tg.initDataUnsafe.user);
    }
    setTmaHasInitData(Boolean(tg.initData));

    if (typeof tg.onEvent === 'function') {
      tg.onEvent('themeChanged', syncTheme);
      return () => {
        if (typeof tg.offEvent === 'function') tg.offEvent('themeChanged', syncTheme);
      };
    }
    return undefined;
  }, []);

  const persistUserStateToServer = useCallback(async (patch) => {
    if (!getTelegramInitData()) return;
    try {
      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: getTgAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(patch)
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.savedOutfits)) setSavedOutfits(data.savedOutfits);
      if (typeof data?.remainingGens === 'number') setRemainingGens(data.remainingGens);
    } catch {
    }
  }, []);

  const fetchOfficialThumbnailsBatch = useCallback(async (itemsList) => {
    const ids = Array.from(
      new Set(
        (itemsList || [])
          .map((it) => String(it?.assetId || '').trim())
          .filter((id) => /^\d+$/.test(id))
      )
    );
    if (ids.length === 0) return;

    setLoadingThumbs(true);
    try {
      const endpoint = `/api/thumbnails?assetIds=${encodeURIComponent(ids.join(','))}`;
      const res = await fetch(endpoint, { headers: getTgAuthHeaders() });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) detail = j.error;
        } catch {
        }
        throw new Error(detail);
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('Требуется запущенный server.mjs');
      }
      const json = await res.json();
      const nextMap = {};
      const nextErrs = {};
      (json?.data || []).forEach((entry) => {
        const targetId = String(entry.targetId);
        if (entry.state === 'Completed' && entry.imageUrl) {
          nextMap[targetId] = entry.imageUrl;
        } else {
          nextErrs[targetId] = `Roblox Thumbnail: ${entry.state || 'Unavailable'}`;
        }
      });
      setThumbnailMap((prev) => ({ ...prev, ...nextMap }));
      setThumbnailErrors((prev) => ({ ...prev, ...nextErrs }));
    } catch (err) {
      const msg = String(err?.message || err);
      setThumbnailErrors((prev) => {
        const copy = { ...prev };
        ids.forEach((id) => {
          if (!copy[id]) copy[id] = msg;
        });
        return copy;
      });
    } finally {
      setLoadingThumbs(false);
    }
  }, []);

  useEffect(() => {
    const starterItems = SLOT_ORDER.flatMap((sk) => INITIAL_CATALOG[sk] || []);
    fetchOfficialThumbnailsBatch(starterItems);

    if (getTelegramInitData()) {
      fetch('/api/user', { headers: getTgAuthHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          if (Array.isArray(data.savedOutfits)) setSavedOutfits(data.savedOutfits);
          if (typeof data.remainingGens === 'number') setRemainingGens(data.remainingGens);
          if (data.linkedRobloxUser) setLinkedRobloxUser(data.linkedRobloxUser);
        })
        .catch(() => {});
    }
  }, [fetchOfficialThumbnailsBatch]);

  const handleLoadR15BundleByAssetIds = async (overrideIdsMap = null) => {
    const activeIds = overrideIdsMap || r15BundleInputIds;
    const entries = R15_MAN_BUNDLE_SOURCES.map((src) => ({
      ...src,
      targetId: String(activeIds[src.key] || '').trim()
    })).filter((row) => /^\d+$/.test(row.targetId));

    if (entries.length === 0) {
      setR15LoadError('Укажите хотя бы один числовой assetId части тела из бандла Roblox');
      return;
    }

    setLoadingR15FromProxy(true);
    setR15LoadError('');
    try {
      const nextPartsData = { ...r15BodyPartsData };
      let totalLimbsLoaded = 0;

      for (const row of entries) {
        const modelBuf = await fetchSameOriginAssetBuffer(row.targetId);
        const headAscii = new TextDecoder('ascii').decode(new Uint8Array(modelBuf).subarray(0, 12));

        if (headAscii.startsWith('version ')) {
          const singlePartName = row.parts[0];
          nextPartsData[singlePartName] = {
            meshBuffer: modelBuf,
            partSize: null,
            meshScale: null,
            attachments: {}
          };
          totalLimbsLoaded += 1;
          continue;
        }

        const extractedParts = await extractR15BundlePartsFromModel(modelBuf);
        for (const p of extractedParts) {
          const meshBuf = await fetchSameOriginAssetBuffer(p.meshAssetId);
          nextPartsData[p.partName] = {
            meshBuffer: meshBuf,
            partSize: p.partSize,
            meshScale: p.meshScale,
            attachments: p.attachments
          };
          totalLimbsLoaded += 1;
        }
      }

      setR15BodyPartsData(nextPartsData);
      setShowBodyLoaderModal(false);
      showToast(`Загружено мешей R15: ${totalLimbsLoaded}/15`, 'success');
    } catch (err) {
      const msg = String(err?.message || err);
      setR15LoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoadingR15FromProxy(false);
    }
  };

  const handleLocalR15FilesSelected = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const nextPartsData = { ...r15BodyPartsData };
    let matchedCount = 0;
    setR15LoadError('');

    try {
      for (const file of files) {
        const rawBuf = await file.arrayBuffer();
        const headAscii = new TextDecoder('ascii').decode(new Uint8Array(rawBuf).subarray(0, 12));

        if (headAscii.startsWith('<roblox')) {
          const extractedParts = await extractR15BundlePartsFromModel(rawBuf);
          for (const p of extractedParts) {
            const meshBuf = await fetchSameOriginAssetBuffer(p.meshAssetId);
            nextPartsData[p.partName] = {
              meshBuffer: meshBuf,
              partSize: p.partSize,
              meshScale: p.meshScale,
              attachments: p.attachments
            };
            matchedCount += 1;
          }
        } else {
          const lower = file.name.toLowerCase();
          const matchedPart = R15_BODY_PARTS.find((p) => lower.includes(p.name.toLowerCase()));
          if (matchedPart) {
            nextPartsData[matchedPart.name] = {
              meshBuffer: rawBuf,
              partSize: null,
              meshScale: null,
              attachments: {}
            };
            matchedCount += 1;
          }
        }
      }

      if (matchedCount === 0) {
        const errMsg =
          'Назовите файлы по частям R15 (Head.mesh, UpperTorso.mesh, LowerTorso.mesh, LeftUpperArm.mesh и т.д.)';
        setR15LoadError(errMsg);
        showToast(errMsg, 'error');
        return;
      }

      setR15BodyPartsData(nextPartsData);
      setShowBodyLoaderModal(false);
      showToast(`Загружено статических мешей R15: ${matchedCount}`, 'success');
    } catch (err) {
      const msg = String(err?.message || err);
      setR15LoadError(msg);
      showToast(msg, 'error');
    }
  };

  const handleLocalAccessoryUpload = async (slotKey, fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const modelOrMeshFile = files.find((f) => /\.(mesh|rbxm|rbxmx)$/i.test(f.name));
    const pngFile = files.find((f) => /\.png$/i.test(f.name));

    if (!modelOrMeshFile) {
      showToast('Выберите файл .mesh, .rbxm или .rbxmx (и опционально .png текстуру)', 'error');
      return;
    }

    try {
      const rawBuf = await modelOrMeshFile.arrayBuffer();
      const texBuf = pngFile ? await pngFile.arrayBuffer() : null;
      const headAscii = new TextDecoder('ascii').decode(new Uint8Array(rawBuf).subarray(0, 12));

      let meshBuf = rawBuf;
      let parsedMeta = null;

      if (headAscii.startsWith('<roblox')) {
        parsedMeta = await extractRobloxAssetMetadata(rawBuf);
        meshBuf = await fetchSameOriginAssetBuffer(parsedMeta.meshAssetId);
      }

      const localId = `999${Date.now().toString().slice(-6)}`;
      setLocalAccessoryBuffers((prev) => ({
        ...prev,
        [localId]: {
          meshBuffer: meshBuf,
          textureBuffer: texBuf,
          meta: parsedMeta
        }
      }));

      const newItem = {
        id: `local_${localId}`,
        assetId: localId,
        name: modelOrMeshFile.name.replace(/\.(mesh|rbxm|rbxmx)$/i, ''),
        price: 0
      };

      setHiddenSlots((prev) => ({ ...prev, [slotKey]: false }));
      setEquippedOutfit((prev) => ({ ...prev, [slotKey]: newItem }));
      setCurrentOutfitId(`local_${Date.now()}`);
      showToast(`Локальный меш «${newItem.name}» прикреплён к R15`, 'success');
    } catch (err) {
      showToast(String(err?.message || err), 'error');
    }
  };

  const visibleOutfit = useMemo(() => {
    const out = {};
    SLOT_ORDER.forEach((sk) => {
      out[sk] = hiddenSlots[sk] ? null : equippedOutfit[sk];
    });
    return out;
  }, [equippedOutfit, hiddenSlots]);

  const currentTotalCost = useMemo(
    () => SLOT_ORDER.reduce((sum, sk) => sum + (visibleOutfit[sk]?.price || 0), 0),
    [visibleOutfit]
  );

  const budgetConflict = useMemo(() => {
    let allocated = 0;
    const conflictingSlots = [];
    SLOT_ORDER.forEach((sk) => {
      if (hiddenSlots[sk]) return;
      const lockedPrice = lockedSlots[sk] && equippedOutfit[sk] ? equippedOutfit[sk].price : 0;
      const customCap =
        slotBudgets[sk] !== undefined && slotBudgets[sk] !== null ? Number(slotBudgets[sk]) : null;

      if (lockedSlots[sk] && equippedOutfit[sk]) {
        allocated += lockedPrice;
        conflictingSlots.push(sk);
      } else if (customCap !== null) {
        allocated += customCap;
        conflictingSlots.push(sk);
      }
    });

    if (allocated > totalBudget) {
      return {
        exceeded: true,
        allocated,
        overflow: allocated - totalBudget,
        slots: conflictingSlots
      };
    }
    return { exceeded: false, allocated, overflow: 0, slots: [] };
  }, [hiddenSlots, lockedSlots, equippedOutfit, slotBudgets, totalBudget]);

  const allOpSubscribed = useMemo(() => opChannels.every((c) => c.subscribed), [opChannels]);

  const requireOpThen = (actionFn) => {
    if (allOpSubscribed) {
      actionFn();
      return;
    }
    setPendingOpAction(() => actionFn);
    setOpErrorMsg('');
    setOpModalOpen(true);
  };

  const handleVerifyOp = () => {
    setCheckingOp(true);
    setOpErrorMsg('');
    setTimeout(() => {
      setCheckingOp(false);
      if (!opChannels.every((c) => c.subscribed)) {
        setOpErrorMsg('Подпишитесь на все каналы спонсоров выше, чтобы продолжить.');
        return;
      }
      setOpModalOpen(false);
      const nextFn = pendingOpAction;
      setPendingOpAction(null);
      if (typeof nextFn === 'function') nextFn();
    }, 450);
  };

  const isCurrentSaved = useMemo(
    () => Boolean(currentOutfitId && savedOutfits.some((s) => s.id === currentOutfitId)),
    [currentOutfitId, savedOutfits]
  );

  const handleToggleSave = () => {
    const hasAnyItem = SLOT_ORDER.some((sk) => Boolean(visibleOutfit[sk]));
    if (!hasAnyItem) {
      showToast('Сначала сгенерируйте или наденьте хотя бы один аксессуар', 'error');
      return;
    }

    if (isCurrentSaved) {
      const updated = savedOutfits.filter((s) => s.id !== currentOutfitId);
      setSavedOutfits(updated);
      persistUserStateToServer({ savedOutfits: updated });
      showToast('Образ удалён из архива');
      return;
    }

    const saveId = currentOutfitId || `outfit_${Date.now()}`;
    setCurrentOutfitId(saveId);
    const snapshot = {};
    SLOT_ORDER.forEach((sk) => {
      snapshot[sk] = visibleOutfit[sk] || null;
    });

    const updated = [
      {
        id: saveId,
        items: snapshot,
        totalCost: currentTotalCost,
        savedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      },
      ...savedOutfits.filter((s) => s.id !== saveId)
    ];
    setSavedOutfits(updated);
    persistUserStateToServer({ savedOutfits: updated });
    showToast('Образ сохранён в архив', 'success');
  };

  const handleDeleteSavedOutfit = (outfitId) => {
    const updated = savedOutfits.filter((s) => s.id !== outfitId);
    setSavedOutfits(updated);
    persistUserStateToServer({ savedOutfits: updated });
    showToast('Образ удалён из архива');
  };

  const handleShareOutfit = () => {
    const activeNames = SLOT_ORDER.filter((sk) => visibleOutfit[sk]).map(
      (sk) => `${SLOT_LABELS[sk]}: ${visibleOutfit[sk].name} (${visibleOutfit[sk].price} R$)`
    );
    if (activeNames.length === 0) {
      showToast('Сначала соберите образ, чтобы поделиться', 'error');
      return;
    }
    const text = `Мой образ в RBX STUDIO (${formatNumber(currentTotalCost)} R$):\n${activeNames.join('\n')}`;
    const tg = getTelegramWebApp();
    if (tg && typeof tg.openTelegramLink === 'function') {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
        window.location.origin
      )}&text=${encodeURIComponent(text)}`;
      tg.openTelegramLink(shareUrl);
      return;
    }
    copyTextSafe(text, 'Состав образа скопирован в буфер обмена');
  };

  const handleHistoryMove = (targetIdx) => {
    if (targetIdx < 0 || targetIdx >= history.length) return;
    const entry = history[targetIdx];
    setHistoryIndex(targetIdx);
    setHiddenSlots({});
    setEquippedOutfit(entry.items);
    setCurrentOutfitId(entry.id);
  };

  const executeGenerateOutfit = () => {
    if (remainingGens <= 0) {
      showToast('Лимит образов исчерпан (0/10)', 'error');
      return;
    }

    const activeSlots = SLOT_ORDER.filter((sk) => !hiddenSlots[sk]);
    if (activeSlots.length === 0) {
      showToast('Включите хотя бы один слот для генерации', 'error');
      return;
    }

    let remainingBudget = totalBudget;
    const nextOutfit = { hat: null, hair: null, face: null, accessory: null };

    activeSlots.forEach((sk) => {
      if (lockedSlots[sk] && equippedOutfit[sk]) {
        nextOutfit[sk] = equippedOutfit[sk];
        remainingBudget = Math.max(0, remainingBudget - (equippedOutfit[sk].price || 0));
      }
    });

    const unlockedSlots = activeSlots.filter((sk) => !(lockedSlots[sk] && equippedOutfit[sk]));
    const shuffledSlots = [...unlockedSlots].sort(() => Math.random() - 0.5);

    shuffledSlots.forEach((sk, idx) => {
      const slotsLeft = shuffledSlots.length - idx;
      const customCap =
        slotBudgets[sk] !== undefined && slotBudgets[sk] !== null ? Number(slotBudgets[sk]) : null;
      const maxForSlot =
        customCap !== null
          ? Math.min(customCap, remainingBudget)
          : Math.floor(remainingBudget / Math.max(1, slotsLeft * 0.75));

      const pool = catalogPool[sk] || [];
      const affordable = pool.filter((item) => (item.price || 0) <= maxForSlot);
      const candidates =
        affordable.length > 0 ? affordable : pool.filter((item) => (item.price || 0) === 0);

      if (candidates.length > 0) {
        const recentIds = recentSlotItemsRef.current[sk] || [];
        const fresh = candidates.filter((c) => !recentIds.includes(c.assetId));
        const pickFrom = fresh.length > 0 ? fresh : candidates;
        const chosen = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        nextOutfit[sk] = chosen;
        remainingBudget = Math.max(0, remainingBudget - (chosen.price || 0));
        recentSlotItemsRef.current[sk] = [chosen.assetId, ...recentIds].slice(0, 4);
      }
    });

    const newId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextHistory = [...history, { id: newId, items: nextOutfit }];
    const nextRemaining = Math.max(0, remainingGens - 1);

    setEquippedOutfit(nextOutfit);
    setCurrentOutfitId(newId);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setRemainingGens(nextRemaining);
    persistUserStateToServer({ remainingGens: nextRemaining });
  };

  const handleGenerateClick = () => {
    requireOpThen(executeGenerateOutfit);
  };

  const openSearchForSlot = (slotKey = 'all') => {
    setSearchSlot(slotKey);
    setLiveSearchError('');
    setSearchOpen(true);
    const initialItems =
      slotKey === 'all'
        ? SLOT_ORDER.flatMap((sk) => (catalogPool[sk] || []).slice(0, 3))
        : catalogPool[slotKey] || [];
    fetchOfficialThumbnailsBatch(initialItems);
  };

  const runLiveRobloxSearch = async () => {
    const qRaw = searchQuery.trim();

    const idMatch = qRaw.match(/(?:catalog|bundles|library)\/(\d+)|^(\d{5,15})$/i);
    if (idMatch) {
      const extractedId = idMatch[1] || idMatch[2];
      const targetSlot = searchSlot === 'all' ? 'hat' : searchSlot;
      const directItem = {
        id: `direct_${extractedId}`,
        assetId: extractedId,
        name: `Roblox Asset #${extractedId}`,
        price: 0,
        slotKey: targetSlot
      };
      setLiveSearchResults([directItem]);
      setLiveSearchError('');
      fetchOfficialThumbnailsBatch([directItem]);
      return;
    }

    setLiveSearching(true);
    setLiveSearchError('');
    try {
      let translated = qRaw.toLowerCase();
      Object.entries(RU_TO_EN_KEYWORDS).forEach(([ru, en]) => {
        if (translated.includes(ru)) translated = translated.replace(ru, en);
      });

      const slotsToQuery = searchSlot === 'all' ? ['hat', 'hair', 'accessory'] : [searchSlot];
      const collected = [];

      for (const sk of slotsToQuery) {
        const cfg = ROBLOX_SLOT_QUERIES[sk];
        const params = new URLSearchParams({
          Category: String(cfg.category),
          Subcategory: String(cfg.subcategory),
          Limit: '20',
          SortType: '1',
          SalesTypeFilter: '1'
        });
        if (translated) params.set('Keyword', translated);
        if (searchMinPrice !== '') params.set('MinPrice', String(searchMinPrice));
        if (searchMaxPrice !== '') params.set('MaxPrice', String(searchMaxPrice));

        const endpoint = `/api/catalog?${params.toString()}`;

        const res = await fetch(endpoint, { headers: getTgAuthHeaders() });
        if (!res.ok) {
          let detail = `Roblox Catalog HTTP ${res.status}`;
          try {
            const j = await res.json();
            if (j?.error) detail = j.error;
          } catch {
          }
          throw new Error(detail);
        }
        const data = await res.json();
        const rawItems = (data.data || []).filter(
          (x) => x.itemType === 'Asset' && x.priceStatus !== 'OffSale'
        );

        rawItems.forEach((x) => {
          collected.push({
            id: `api_${x.id}`,
            assetId: String(x.id),
            name: x.name,
            price: x.priceStatus === 'Free' ? 0 : Number(x.lowestPrice ?? x.price ?? 0),
            slotKey: sk
          });
        });
      }

      setLiveSearchResults(collected);
      if (collected.length > 0) {
        fetchOfficialThumbnailsBatch(collected);
        setCatalogPool((prev) => {
          const next = { ...prev };
          collected.forEach((it) => {
            const list = next[it.slotKey] || [];
            if (!list.some((x) => x.assetId === it.assetId)) {
              next[it.slotKey] = [...list, it];
            }
          });
          return next;
        });
      }
    } catch (err) {
      setLiveSearchError(String(err?.message || err));
      setLiveSearchResults([]);
    } finally {
      setLiveSearching(false);
    }
  };

  const filteredSearchItems = useMemo(() => {
    const baseList = [];
    const seen = new Set();

    const pushItem = (item, sk) => {
      const key = `${sk}_${item.assetId}`;
      if (seen.has(key)) return;
      seen.add(key);
      baseList.push({ ...item, slotKey: sk });
    };

    liveSearchResults.forEach((item) => pushItem(item, item.slotKey || 'hat'));
    SLOT_ORDER.forEach((sk) => {
      if (searchSlot !== 'all' && searchSlot !== sk) return;
      (catalogPool[sk] || []).forEach((item) => pushItem(item, sk));
    });

    const qLower = searchQuery.trim().toLowerCase();
    let translated = qLower;
    Object.entries(RU_TO_EN_KEYWORDS).forEach(([ru, en]) => {
      if (translated.includes(ru)) translated = translated.replace(ru, en);
    });

    const minP = searchMinPrice === '' ? 0 : Math.max(0, Number(searchMinPrice) || 0);
    const maxP =
      searchMaxPrice === '' ? MAX_BUDGET : Math.min(MAX_BUDGET, Number(searchMaxPrice) || MAX_BUDGET);

    const filtered = baseList.filter((item) => {
      if (searchSlot !== 'all' && item.slotKey !== searchSlot) return false;
      if (item.price < minP || item.price > maxP) return false;
      if (!qLower) return true;
      const hay = `${item.name} ${item.assetId} ${SLOT_LABELS[item.slotKey]}`.toLowerCase();
      return hay.includes(qLower) || hay.includes(translated);
    });

    if (searchSort === 'price_asc') filtered.sort((a, b) => a.price - b.price);
    else if (searchSort === 'price_desc') filtered.sort((a, b) => b.price - a.price);
    else if (searchSort === 'alpha') filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [catalogPool, liveSearchResults, searchSlot, searchQuery, searchMinPrice, searchMaxPrice, searchSort]);

  const activeSearchFilterCount = useMemo(() => {
    let count = 0;
    if (searchSlot !== 'all') count += 1;
    if (searchMinPrice !== '') count += 1;
    if (searchMaxPrice !== '') count += 1;
    if (searchSort !== 'popular') count += 1;
    return count;
  }, [searchSlot, searchMinPrice, searchMaxPrice, searchSort]);

  const handleEquipFromSearch = (item) => {
    const sk = item.slotKey || 'hat';
    setHiddenSlots((prev) => ({ ...prev, [sk]: false }));
    setEquippedOutfit((prev) => ({ ...prev, [sk]: item }));
    setCurrentOutfitId(`manual_${Date.now()}`);
    setSearchOpen(false);
    showToast(`Надето: ${item.name}`, 'success');
  };

  const mapAssetTypeToSlot = (assetTypeId) => {
    const id = Number(assetTypeId);
    if (id === 8) return 'hat';
    if (id === 41) return 'hair';
    if (id === 42) return 'face';
    return 'accessory';
  };

  const handleSyncInventory = async () => {
    const cleanUser = robloxUserInput.trim();
    if (!cleanUser) {
      showToast('Введите никнейм Roblox', 'error');
      return;
    }

    setSyncingInventory(true);
    setInventoryError('');
    try {
      const invRes = await fetch(`/api/inventory?username=${encodeURIComponent(cleanUser)}`, {
        headers: getTgAuthHeaders()
      });
      if (!invRes.ok) {
        let detail = `HTTP ${invRes.status}`;
        try {
          const j = await invRes.json();
          if (j?.error) detail = j.error;
        } catch {
        }
        throw new Error(detail);
      }
      const invJson = await invRes.json();
      const found = invJson?.user;
      if (!found?.id) {
        throw new Error(`Игрок "${cleanUser}" не найден в Roblox`);
      }
      const assets = Array.isArray(invJson.assets) ? invJson.assets : [];

      const accessoryTypeIds = new Set([8, 41, 42, 43, 44, 45, 46, 47]);
      const mapped = assets
        .filter((a) => accessoryTypeIds.has(Number(a.assetType?.id)))
        .map((a) => ({
          id: `inv_${a.id}`,
          assetId: String(a.id),
          name: a.name || `Asset #${a.id}`,
          price: 0,
          slotKey: mapAssetTypeToSlot(a.assetType?.id)
        }));

      if (mapped.length > 0) {
        fetchOfficialThumbnailsBatch(mapped);
      }

      setLinkedRobloxUser(found.name || cleanUser);
      setInventoryItems(mapped);
      persistUserStateToServer({ linkedRobloxUser: found.name || cleanUser });
      showToast(`Загружены аксессуары игрока ${found.name} (${mapped.length} шт.)`, 'success');
    } catch (err) {
      setInventoryError(String(err?.message || err));
      setInventoryItems([]);
    } finally {
      setSyncingInventory(false);
    }
  };

  const handleToggleInventoryItem = (item) => {
    const sk = item.slotKey;
    const isEquipped = equippedOutfit[sk]?.assetId === item.assetId && !hiddenSlots[sk];
    if (isEquipped) {
      setEquippedOutfit((prev) => ({ ...prev, [sk]: null }));
      showToast(`Снято: ${item.name}`);
    } else {
      setHiddenSlots((prev) => ({ ...prev, [sk]: false }));
      setEquippedOutfit((prev) => ({ ...prev, [sk]: item }));
      setCurrentOutfitId(`inv_${Date.now()}`);
      showToast(`Надето из инвентаря: ${item.name}`, 'success');
    }
  };

  const handleRandomFromInventory = () => {
    if (inventoryItems.length === 0) return;
    const next = { hat: null, hair: null, face: null, accessory: null };
    SLOT_ORDER.forEach((sk) => {
      const slotItems = inventoryItems.filter((i) => i.slotKey === sk);
      if (slotItems.length > 0) {
        next[sk] = slotItems[Math.floor(Math.random() * slotItems.length)];
      }
    });
    setHiddenSlots({});
    setEquippedOutfit(next);
    setCurrentOutfitId(`inv_mix_${Date.now()}`);
    setActiveTab('studio');
    showToast('Собран набор аксессуаров из вашего инвентаря', 'success');
  };

  const CASE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const caseRemainingMs =
    lastCaseClaim > 0 ? Math.max(0, CASE_COOLDOWN_MS - (nowTick - lastCaseClaim)) : 0;
  const isCaseOnCooldown = caseRemainingMs > 0;

  const formatCooldown = (ms) => {
    const totalMins = Math.max(1, Math.ceil(ms / 60000));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}ч ${mins}м`;
  };

  const buildCaseStrip = () => {
    const tiers = [
      { amount: 2, label: 'Базовый', color: '#64748B', bg: '#F8FAFC' },
      { amount: 3, label: 'Базовый', color: '#64748B', bg: '#F8FAFC' },
      { amount: 5, label: 'Редкий', color: '#2563EB', bg: '#EFF6FF' },
      { amount: 8, label: 'Редкий', color: '#2563EB', bg: '#EFF6FF' },
      { amount: 15, label: 'Эпик', color: '#7C3AED', bg: '#F5F3FF' },
      { amount: 30, label: 'Легенда', color: '#D97706', bg: '#FFFBEB' },
      { amount: 50, label: 'Джекпот', color: '#DC2626', bg: '#FEF2F2' }
    ];
    return Array.from({ length: 32 }, (_, idx) => {
      const pick = tiers[Math.floor(Math.random() * tiers.length)];
      return { ...pick, id: `card_${idx}_${Math.random().toString(36).slice(2, 6)}` };
    });
  };

  const openCaseModal = () => {
    if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current);
    setRouletteStrip(buildCaseStrip());
    setRouletteOffset(0);
    setRoulettePhase('ready');
    setWonPrize(null);
    setCaseModalOpen(true);
  };

  const startRouletteSpin = () => {
    if (roulettePhase === 'spinning' || isCaseOnCooldown) return;
    const strip = rouletteStrip.length > 0 ? rouletteStrip : buildCaseStrip();
    if (rouletteStrip.length === 0) setRouletteStrip(strip);

    const winIndex = 24;
    const prize = strip[winIndex];
    const cardStep = 100;
    const viewportW = rouletteViewportRef.current?.clientWidth || 340;
    const targetOffset = Math.max(0, winIndex * cardStep + 46 - viewportW / 2);

    setRoulettePhase('spinning');
    requestAnimationFrame(() => {
      setRouletteOffset(targetOffset);
    });

    if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current);
    rouletteTimerRef.current = setTimeout(() => {
      setRoulettePhase('won');
      setWonPrize(prize);
      setBalance((b) => b + prize.amount);
      setLastCaseClaim(Date.now());
      showToast(`Выигрыш +${prize.amount} Robux зачислен!`, 'success');
    }, 4600);
  };

  const handleCheckTasks = () => {
    setCheckingTasks(true);
    setTimeout(() => {
      setCheckingTasks(false);
      let gained = 0;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.visited && !t.completed) {
            gained += t.reward;
            return { ...t, completed: true };
          }
          return t;
        })
      );
      if (gained > 0) {
        setBalance((b) => b + gained);
        showToast(`Начислено +${gained} Robux за задания`, 'success');
      } else {
        showToast('Сначала перейдите по каналам заданий', 'error');
      }
    }, 600);
  };

  const handleWithdrawSubmit = () => {
    if (withdrawAmount < 30 || withdrawAmount > balance) {
      showToast('Недостаточно средств для вывода', 'error');
      return;
    }
    if (!withdrawGamepass.trim().includes('roblox.com')) {
      showToast('Укажите корректную ссылку на Gamepass Roblox', 'error');
      return;
    }
    setBalance((b) => b - withdrawAmount);
    setFrozenBalance((f) => f + withdrawAmount);
    setWithdrawals((prev) => [
      {
        id: `wd_${Date.now()}`,
        amount: withdrawAmount,
        gamepass: withdrawGamepass.trim(),
        status: 'pending',
        date: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        reason: ''
      },
      ...prev
    ]);
    setWithdrawGamepass('');
    setShowWithdrawModal(false);
    showToast(`Заявка на вывод ${withdrawAmount} Robux создана`, 'success');
  };

  const handleRedeemPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    if (redeemedCodes.includes(code)) {
      showToast('Промокод уже был активирован', 'error');
      return;
    }
    const map = { START10: 10, RBX30: 30, ROBLOX20: 20 };
    if (map[code]) {
      setBalance((b) => b + map[code]);
      setRedeemedCodes((prev) => [...prev, code]);
      setPromoCodeInput('');
      setShowPromoModal(false);
      showToast(`Промокод активирован: +${map[code]} Robux`, 'success');
    } else {
      showToast('Промокод не найден', 'error');
    }
  };

  return (
    <div
      className="min-h-screen w-full flex justify-center antialiased transition-colors"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: tgTheme.isDark
          ? '#020617'
          : 'radial-gradient(circle at top, #dbeafe 0%, #eff6ff 45%, #e2e8f0 100%)'
      }}
    >
      <div
        style={{ backgroundColor: tgTheme.bgColor }}
        className="w-full max-w-[430px] min-h-screen flex flex-col relative shadow-2xl border-x border-slate-200/90 pb-24 text-slate-900"
      >
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs tracking-tight flex items-center justify-center shadow-sm shrink-0">
              RBX
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-slate-900 leading-none truncate">
                RBX STUDIO
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              title="Панель тестирования и настроек"
            >
              <Icons.Settings />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rewards')}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/90 flex items-center gap-1.5 transition-colors"
            >
              <RobuxIcon className="w-4 h-4" />
              <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                {formatNumber(balance)}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-4">
          {activeTab === 'studio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Собрать образ
                </h1>
                <div className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs tabular-nums">
                  Собрано: {history.length}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-3 border border-slate-200/90 shadow-sm space-y-3">
                <RobloxThreeStageViewport
                  outfit={visibleOutfit}
                  skinHex={skinHex}
                  tmaReady={tmaHasInitData}
                  r15BodyPartsData={r15BodyPartsData}
                  r15LoadError={r15LoadError}
                  localAccessoryBuffers={localAccessoryBuffers}
                  onSlotLoadStatusChange={setSlotLoadStatuses}
                  onOpenBodyLoader={() => setShowBodyLoaderModal(true)}
                  historyCount={history.length}
                  historyIndex={historyIndex}
                  onHistoryPrev={() => handleHistoryMove(historyIndex - 1)}
                  onHistoryNext={() => handleHistoryMove(historyIndex + 1)}
                />

                <div className="flex items-center justify-between gap-2 px-1 py-1 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 pl-2">Цвет кожи:</span>
                  <div className="flex items-center gap-1.5 pr-1.5">
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => {
                          setSkinHex(tone.hex);
                          safeStorageSet('rbx_skin_hex', tone.hex);
                        }}
                        style={{ backgroundColor: tone.hex }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          skinHex === tone.hex
                            ? 'border-blue-600 scale-110 shadow-xs'
                            : 'border-white hover:scale-105'
                        }`}
                        title={tone.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Стоимость аксессуаров
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <RobuxPrice
                        amount={currentTotalCost}
                        className="text-base font-extrabold text-slate-900"
                        iconClass="w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-400">
                        / {formatNumber(totalBudget)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleSave}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-colors ${
                        isCurrentSaved
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icons.Bookmark filled={isCurrentSaved} />
                      <span>{isCurrentSaved ? 'Сохранено' : 'Сохранить'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareOutfit}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                      title="Поделиться образом"
                    >
                      <Icons.Share />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Бюджет образа
                  </span>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                    <RobuxIcon className="w-3.5 h-3.5" />
                    <input
                      type="number"
                      min={0}
                      max={MAX_BUDGET}
                      value={totalBudget}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(MAX_BUDGET, Number(e.target.value) || 0));
                        setTotalBudget(v);
                      }}
                      className="w-20 bg-transparent text-right text-xs font-extrabold text-slate-900 tabular-nums focus:outline-none"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={budgetToSlider(totalBudget)}
                  onChange={(e) => setTotalBudget(sliderToBudget(e.target.value))}
                  className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />

                <div className="grid grid-cols-5 gap-1.5">
                  {[100, 350, 1000, 15000, 999999].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTotalBudget(preset)}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border tabular-nums transition-colors ${
                        totalBudget === preset
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {preset === 999999 ? '999k' : preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={budgetConflict.exceeded || remainingGens <= 0}
                  onClick={handleGenerateClick}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:translate-y-0.5 text-white font-extrabold text-sm tracking-wide border-b-4 border-blue-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Сгенерировать аксессуары
                </button>

                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-slate-500 font-semibold">
                    Лимит образов:{' '}
                    <strong className={remainingGens === 0 ? 'text-red-600' : 'text-slate-900'}>
                      {remainingGens} / {MAX_DAILY_LIMIT}
                    </strong>
                  </span>
                  {remainingGens < MAX_DAILY_LIMIT && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemainingGens(MAX_DAILY_LIMIT);
                        showToast('Лимит образов сброшен до 10/10', 'success');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1"
                    >
                      <Icons.Refresh />
                      <span>Сбросить лимит</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openSearchForSlot('all')}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-blue-50/60 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-between transition-colors shadow-2xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Icons.Search />
                  <span>Поиск аксессуаров в каталоге Roblox</span>
                </span>
                <Icons.ChevronRight />
              </button>

              {budgetConflict.exceeded && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5 shrink-0">
                      <Icons.Alert />
                    </span>
                    <div className="text-xs">
                      <p className="font-extrabold text-red-700">Превышение бюджета</p>
                      <p className="text-red-600 mt-0.5 leading-snug">
                        Сумма выбранных слотов ({formatNumber(budgetConflict.allocated)}) превышает общий бюджет ({formatNumber(totalBudget)}) на {formatNumber(budgetConflict.overflow)}.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTotalBudget(Math.min(MAX_BUDGET, budgetConflict.allocated))}
                      className="py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold"
                    >
                      Поднять бюджет
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSlotBudgets({});
                        setLockedSlots({});
                      }}
                      className="py-2 rounded-xl bg-white border border-red-200 text-red-700 text-[11px] font-bold"
                    >
                      Сбросить лимиты
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {SLOT_ORDER.map((sk) => {
                  const item = equippedOutfit[sk];
                  const isHidden = Boolean(hiddenSlots[sk]);
                  const isLocked = Boolean(lockedSlots[sk]);
                  const isExpanded = expandedSlot === sk;
                  const slotCap = slotBudgets[sk];
                  const hasSlotCap = slotCap !== undefined && slotCap !== null;
                  const isConflicting = budgetConflict.exceeded && budgetConflict.slots.includes(sk);
                  const activeItem = isHidden ? null : item;
                  const assetKey = activeItem ? String(activeItem.assetId) : '';
                  const meshStatus = slotLoadStatuses[sk];

                  return (
                    <div
                      key={sk}
                      className={`rounded-2xl bg-white border transition-all ${
                        meshStatus?.state === 'error'
                          ? 'border-red-300'
                          : isConflicting
                          ? 'border-red-400 ring-2 ring-red-100'
                          : isHidden
                          ? 'border-slate-200/70 opacity-50'
                          : isLocked
                          ? 'border-blue-400 shadow-xs'
                          : 'border-slate-200/90'
                      }`}
                    >
                      <div className="p-3 flex items-center gap-2.5">
                        <OfficialRobloxThumbnail
                          item={activeItem}
                          thumbnailUrl={assetKey ? thumbnailMap[assetKey] : ''}
                          loading={loadingThumbs}
                          error={assetKey ? thumbnailErrors[assetKey] : ''}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              {SLOT_LABELS[sk]}
                            </span>
                            {meshStatus?.state === 'ok' && !isHidden && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-extrabold">
                                3D меш
                              </span>
                            )}
                            {meshStatus?.state === 'loading' && !isHidden && (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-extrabold">
                                Загрузка 3D...
                              </span>
                            )}
                            {meshStatus?.state === 'error' && !isHidden && (
                              <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[9px] font-extrabold">
                                Ошибка 3D
                              </span>
                            )}
                            {hasSlotCap && !isHidden && (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold tabular-nums">
                                лимит {formatNumber(slotCap)}
                              </span>
                            )}
                          </div>

                          {isHidden ? (
                            <p className="text-xs font-semibold text-slate-400 mt-0.5">Слот скрыт</p>
                          ) : item ? (
                            <div className="mt-0.5">
                              <a
                                href={getRobloxCatalogUrl(item)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-slate-900 hover:text-blue-600 inline-flex items-center gap-1 max-w-full"
                              >
                                <span className="truncate">{item.name}</span>
                                <span className="text-slate-400 shrink-0">
                                  <Icons.External />
                                </span>
                              </a>
                              <div className="mt-0.5">
                                <RobuxPrice
                                  amount={item.price}
                                  className="text-xs font-extrabold text-slate-800"
                                  iconClass="w-3.5 h-3.5"
                                />
                              </div>
                              {meshStatus?.state === 'error' && meshStatus.error && (
                                <p className="text-[10px] font-semibold text-red-600 mt-1 break-words leading-snug">
                                  {meshStatus.error}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-slate-400 mt-0.5">
                              Не выбрано — нажмите «Сгенерировать»
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <label
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                            title="Загрузить локальный .mesh / .rbxm (+ .png)"
                          >
                            <Icons.Upload />
                            <input
                              type="file"
                              multiple
                              accept=".mesh,.rbxm,.rbxmx,.png"
                              className="hidden"
                              onChange={(e) => {
                                handleLocalAccessoryUpload(sk, e.target.files);
                                e.target.value = '';
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => openSearchForSlot(sk)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center"
                            title="Найти предмет для этого слота"
                          >
                            <Icons.Search />
                          </button>

                          <button
                            type="button"
                            disabled={isHidden || !item}
                            onClick={() => setLockedSlots((prev) => ({ ...prev, [sk]: !prev[sk] }))}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-35 ${
                              isLocked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title={isLocked ? 'Открепить предмет' : 'Закрепить предмет'}
                          >
                            {isLocked ? <Icons.Lock /> : <Icons.Unlock />}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setHiddenSlots((prev) => ({ ...prev, [sk]: !prev[sk] }))
                            }
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                              isHidden
                                ? 'bg-slate-800 border-slate-800 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title={isHidden ? 'Показать слот' : 'Скрыть слот'}
                          >
                            {isHidden ? <Icons.EyeOff /> : <Icons.Eye />}
                          </button>

                          <button
                            type="button"
                            disabled={isHidden}
                            onClick={() => setExpandedSlot(isExpanded ? null : sk)}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-transform disabled:opacity-35 ${
                              isExpanded
                                ? 'bg-blue-50 border-blue-300 text-blue-700 rotate-180'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Бюджет для этого слота"
                          >
                            <Icons.ChevronDown />
                          </button>
                        </div>
                      </div>

                      {isExpanded && !isHidden && (
                        <div className="px-3 pb-3 pt-2 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-600">
                              Бюджет на «{SLOT_LABELS[sk]}»
                            </span>
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                                <RobuxIcon className="w-3 h-3" />
                                <input
                                  type="number"
                                  min={0}
                                  max={MAX_BUDGET}
                                  value={hasSlotCap ? slotCap : ''}
                                  placeholder="Авто"
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      setSlotBudgets((prev) => ({ ...prev, [sk]: null }));
                                    } else {
                                      const num = Math.max(0, Math.min(MAX_BUDGET, Number(raw) || 0));
                                      setSlotBudgets((prev) => ({ ...prev, [sk]: num }));
                                    }
                                  }}
                                  className="w-16 text-right text-[11px] font-bold text-slate-900 tabular-nums focus:outline-none"
                                />
                              </div>
                              {hasSlotCap && (
                                <button
                                  type="button"
                                  onClick={() => setSlotBudgets((prev) => ({ ...prev, [sk]: null }))}
                                  className="text-[10px] font-bold text-blue-600 hover:underline"
                                >
                                  Авто
                                </button>
                              )}
                            </div>
                          </div>

                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.5}
                            value={budgetToSlider(hasSlotCap ? slotCap : Math.min(totalBudget, 100))}
                            onChange={(e) => {
                              const val = sliderToBudget(e.target.value);
                              setSlotBudgets((prev) => ({ ...prev, [sk]: val }));
                            }}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Центр наград
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Награды</h1>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                      01 Ежедневный кейс
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Ежедневный RBX-кейс
                    </h2>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <RobuxIcon className="w-6 h-6" />
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Крути рулетку каждые 24 часа и забирай от 2 до 50 Robux прямо на баланс.
                </p>

                <button
                  type="button"
                  onClick={openCaseModal}
                  className={`w-full py-3 rounded-2xl font-extrabold text-xs uppercase tracking-wide border-b-4 transition-all ${
                    isCaseOnCooldown
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-800 shadow-sm'
                  }`}
                >
                  {isCaseOnCooldown
                    ? `Доступен через ${formatCooldown(caseRemainingMs)}`
                    : 'Открыть рулетку кейса'}
                </button>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-extrabold text-slate-800">
                    <RobuxPrice amount={10} iconClass="w-3.5 h-3.5" />
                    <span className="text-slate-500 font-semibold">/ друг</span>
                  </span>
                  <span className="text-xs font-extrabold text-blue-600 tabular-nums">
                    {referralCount} / 3 засчитано
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Пригласи 3 друзей — получи 30
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Друг засчитывается после подписки на каналы и первого собранного образа.
                  </p>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (referralCount / 3) * 100)}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => requireOpThen(() => setShowRefModal(true))}
                  className="w-full py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors"
                >
                  Получить персональную ссылку
                </button>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                    02 Кошелёк
                  </p>
                  <div className="mt-0.5">
                    <RobuxPrice amount={balance} className="text-lg font-extrabold text-slate-900" iconClass="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Вывод от 30, шаг 10</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold text-xs border-b-2 border-amber-600 transition-colors"
                >
                  Вывести
                </button>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    03 Задания
                  </span>
                  <span className="text-xs font-bold text-slate-500 tabular-nums">
                    {tasks.filter((t) => t.completed).length} / {tasks.length}
                  </span>
                </div>

                {tasks.map((task, idx) => (
                  <a
                    key={task.id}
                    href={`https://t.me/${task.handle.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      setTasks((prev) =>
                        prev.map((t) => (t.id === task.id ? { ...t, visited: true } : t))
                      )
                    }
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                      task.completed
                        ? 'bg-slate-50 border-slate-200/70 opacity-60'
                        : 'bg-slate-50/70 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        0{idx + 1}. {task.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{task.handle}</p>
                    </div>
                    {task.completed ? (
                      <span className="text-xs font-bold text-emerald-600 shrink-0">Выполнено</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-slate-900 shrink-0">
                        <span>+</span>
                        <RobuxPrice amount={task.reward} iconClass="w-3.5 h-3.5" />
                      </span>
                    )}
                  </a>
                ))}

                <button
                  type="button"
                  disabled={checkingTasks}
                  onClick={handleCheckTasks}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
                >
                  {checkingTasks ? 'Проверяем задания...' : 'Проверить задания'}
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReviewsModal(true)}
                    className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                  >
                    Отзывы
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFaqModal(true)}
                    className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                  >
                    Как это работает?
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Аксессуары игрока
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Инвентарь</h1>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Привязка профиля Roblox</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Загрузите аксессуары (шапки, волосы, очки, крылья) с вашего аккаунта Roblox по никнейму.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={robloxUserInput}
                    onChange={(e) => setRobloxUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSyncInventory()}
                    placeholder="Ник в Roblox (напр. Builderman)"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={syncingInventory}
                    onClick={handleSyncInventory}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 transition-colors disabled:opacity-60"
                  >
                    {syncingInventory ? 'Загрузка...' : linkedRobloxUser ? 'Обновить' : 'Привязать'}
                  </button>
                </div>

                {inventoryError && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                    <p className="font-extrabold">Ошибка загрузки аксессуаров из Roblox</p>
                    <p className="text-[11px] text-red-600">{inventoryError}</p>
                  </div>
                )}

                {linkedRobloxUser && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-emerald-700 truncate">
                      {linkedRobloxUser} ({inventoryItems.length} шт.)
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      {inventoryItems.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRandomFromInventory}
                          className="text-xs font-extrabold text-blue-600 hover:underline"
                        >
                          Надеть набор
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setLinkedRobloxUser('');
                          setRobloxUserInput('');
                          setInventoryItems([]);
                          setInventoryError('');
                          showToast('Профиль Roblox отвязан');
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-red-600"
                      >
                        Отвязать
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {inventoryItems.length > 0 && (
                <>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {[{ id: 'all', label: 'Все' }, ...SLOT_ORDER.map((sk) => ({ id: sk, label: SLOT_LABELS[sk] }))].map(
                      (pill) => (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setInventoryFilterSlot(pill.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 transition-colors ${
                            inventoryFilterSlot === pill.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {pill.label}
                        </button>
                      )
                    )}
                  </div>

                  <div className="space-y-2">
                    {inventoryItems
                      .filter((it) => inventoryFilterSlot === 'all' || it.slotKey === inventoryFilterSlot)
                      .map((item) => {
                        const isEquipped =
                          equippedOutfit[item.slotKey]?.assetId === item.assetId && !hiddenSlots[item.slotKey];
                        const idStr = String(item.assetId);
                        return (
                          <div
                            key={`inv_${item.slotKey}_${item.assetId}`}
                            className={`p-3 rounded-2xl bg-white border flex items-center gap-2.5 transition-colors ${
                              isEquipped ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200/90'
                            }`}
                          >
                            <OfficialRobloxThumbnail
                              item={item}
                              thumbnailUrl={thumbnailMap[idStr] || ''}
                              loading={loadingThumbs}
                              error={thumbnailErrors[idStr]}
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                {SLOT_LABELS[item.slotKey]}
                              </span>
                              <a
                                href={getRobloxCatalogUrl(item)}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs font-bold text-slate-900 hover:text-blue-600 truncate"
                              >
                                {item.name}
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleInventoryItem(item)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                                isEquipped
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {isEquipped ? 'Снять' : 'Надеть'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Профиль игрока
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Личный кабинет</h1>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                  {tgUser?.first_name ? tgUser.first_name.slice(0, 2).toUpperCase() : 'RBX'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900 truncate">
                    {tgUser
                      ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()
                      : 'Участник RBX STUDIO'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium truncate">
                    {linkedRobloxUser
                      ? `Roblox: ${linkedRobloxUser}`
                      : tgUser?.username
                      ? `@${tgUser.username}`
                      : 'Telegram Mini App'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-[10px] font-mono font-bold text-slate-600">
                  ID {tgUser?.id || '101648'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-2xl p-3 border border-slate-200/90 text-center">
                  <p className="text-[11px] font-semibold text-slate-400">Доступно</p>
                  <div className="mt-1 flex justify-center">
                    <RobuxPrice amount={balance} className="text-sm font-extrabold text-slate-900" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-slate-200/90 text-center">
                  <p className="text-[11px] font-semibold text-slate-400">Заморожено</p>
                  <div className="mt-1 flex justify-center">
                    <RobuxPrice amount={frozenBalance} className="text-sm font-extrabold text-slate-700" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-slate-200/90 text-center">
                  <p className="text-[11px] font-semibold text-slate-400">В архиве</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">
                    {savedOutfits.length}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(true)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Архив образов</p>
                    <p className="text-[11px] text-slate-500">Сохранённые наборы аксессуаров</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-extrabold tabular-nums">
                      {savedOutfits.length}
                    </span>
                    <Icons.ChevronRight />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPromoModal(true)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Ввести промокод</p>
                    <p className="text-[11px] text-slate-500">Бонусные Robux на баланс</p>
                  </div>
                  <Icons.ChevronRight />
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">История выводов</p>
                    <p className="text-[11px] text-slate-500">Статусы заявок через Gamepass</p>
                  </div>
                  <Icons.ChevronRight />
                </button>

                <a
                  href="https://t.me/rbxstudio_news"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">RBX NEWS</p>
                    <p className="text-[11px] text-slate-500">Официальный канал новостей</p>
                  </div>
                  <Icons.External />
                </a>

                <button
                  type="button"
                  onClick={() => setShowNotifModal(true)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Уведомления</p>
                    <p className="text-[11px] text-slate-500">Оповещения о кейсах и выводах</p>
                  </div>
                  <Icons.ChevronRight />
                </button>

                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Безопасность</p>
                    <p className="text-[11px] text-slate-500">Правила сервиса и защита аккаунта</p>
                  </div>
                  <Icons.ChevronRight />
                </button>

                <button
                  type="button"
                  onClick={() => setOnboardingStep(1)}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Показать обучение</p>
                    <p className="text-[11px] text-slate-500">Краткий гид по возможностям (3 шага)</p>
                  </div>
                  <Icons.ChevronRight />
                </button>
              </div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-200/90 grid grid-cols-4 z-30">
          {[
            { id: 'studio', label: 'Студия', icon: Icons.Cube },
            { id: 'rewards', label: 'Награды', icon: Icons.Gift },
            { id: 'inventory', label: 'Инвентарь', icon: Icons.Briefcase },
            { id: 'profile', label: 'Профиль', icon: Icons.User }
          ].map((tab) => {
            const IconComp = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 flex flex-col items-center justify-center gap-1 relative transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {active && <span className="absolute top-0 w-10 h-0.5 bg-blue-600 rounded-b" />}
                <IconComp />
                <span className="text-[11px] font-bold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {searchOpen && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3">
            <div className="bg-white rounded-3xl w-full max-w-[400px] h-[86vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                    Каталог Roblox
                  </p>
                  <h3 className="text-sm font-extrabold text-slate-900">Поиск аксессуаров</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="p-3 border-b border-slate-100 space-y-2.5 bg-slate-50/60">
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 focus-within:border-blue-600 rounded-xl px-3 py-2">
                    <span className="text-slate-400">
                      <Icons.Search />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runLiveRobloxSearch()}
                      placeholder="Название, ID или ссылка..."
                      className="w-full text-xs font-semibold text-slate-900 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <Icons.X />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSearchFilterOpen((prev) => !prev)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                      searchFilterOpen || activeSearchFilterCount > 0
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icons.Filter />
                    <span>Фильтр</span>
                    {activeSearchFilterCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-white text-blue-700 text-[10px] font-extrabold">
                        {activeSearchFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {searchFilterOpen && (
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Категория
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[{ id: 'all', label: 'Все' }, ...SLOT_ORDER.map((sk) => ({ id: sk, label: SLOT_LABELS[sk] }))].map(
                          (cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setSearchSlot(cat.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                searchSlot === cat.id
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              {cat.label}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Цена (Robux)
                        </span>
                        <div className="flex gap-1.5 text-[10px] font-bold text-blue-600">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchMinPrice('0');
                              setSearchMaxPrice('0');
                            }}
                          >
                            Бесплатно
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchMinPrice('0');
                              setSearchMaxPrice(String(totalBudget));
                            }}
                          >
                            В бюджет ({formatNumber(totalBudget)})
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          max={MAX_BUDGET}
                          value={searchMinPrice}
                          onChange={(e) => setSearchMinPrice(e.target.value)}
                          placeholder="От 0"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                        <input
                          type="number"
                          min={0}
                          max={MAX_BUDGET}
                          value={searchMaxPrice}
                          onChange={(e) => setSearchMaxPrice(e.target.value)}
                          placeholder="До 999 999"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={searchSort}
                        onChange={(e) => setSearchSort(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="popular">По популярности</option>
                        <option value="price_asc">Сначала дешёвые</option>
                        <option value="price_desc">Сначала дорогие</option>
                        <option value="alpha">По алфавиту</option>
                      </select>

                      {activeSearchFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchSlot('all');
                            setSearchMinPrice('');
                            setSearchMaxPrice('');
                            setSearchSort('popular');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-600"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={liveSearching}
                  onClick={runLiveRobloxSearch}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors disabled:opacity-60"
                >
                  {liveSearching ? 'Ищем в каталоге Roblox...' : 'Найти в каталоге Roblox'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {liveSearchError && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
                    <p className="font-extrabold">Ошибка запроса к каталогу Roblox</p>
                    <p className="text-[11px] text-red-600 mt-0.5">{liveSearchError}</p>
                  </div>
                )}

                {filteredSearchItems.length === 0 ? (
                  <p className="py-10 text-center text-xs font-semibold text-slate-400">
                    Ничего не найдено по заданным параметрам.
                  </p>
                ) : (
                  filteredSearchItems.map((item) => {
                    const idStr = String(item.assetId);
                    return (
                      <div
                        key={`srch_${item.slotKey}_${item.assetId}`}
                        className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center gap-2.5"
                      >
                        <OfficialRobloxThumbnail
                          item={item}
                          thumbnailUrl={thumbnailMap[idStr] || ''}
                          loading={loadingThumbs}
                          error={thumbnailErrors[idStr]}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            {SLOT_LABELS[item.slotKey]} · ID {item.assetId}
                          </span>
                          <a
                            href={getRobloxCatalogUrl(item)}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs font-bold text-slate-900 hover:text-blue-600 truncate"
                          >
                            {item.name}
                          </a>
                          <div className="mt-0.5">
                            <RobuxPrice amount={item.price} className="text-xs font-extrabold text-slate-800" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEquipFromSearch(item)}
                          className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0"
                        >
                          Надеть
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {showBodyLoaderModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[400px] p-5 space-y-3.5 border border-slate-200 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Загрузка тела R15</h3>
                  <p className="text-[11px] text-slate-500">
                    Реальные assetId из Roblox Bundles + статические .mesh
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBodyLoaderModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">
                      Бандл Roblox «Man» (#238)
                    </p>
                    <a
                      href="https://www.roblox.com/bundles/238/Man"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>roblox.com/bundles/238/Man</span>
                      <Icons.External />
                    </a>
                  </div>
                  <button
                    type="button"
                    disabled={loadingR15FromProxy}
                    onClick={() => {
                      const manIds = R15_MAN_BUNDLE_SOURCES.reduce(
                        (acc, row) => ({ ...acc, [row.key]: row.assetId }),
                        {}
                      );
                      setR15BundleInputIds(manIds);
                      handleLoadR15BundleByAssetIds(manIds);
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold shrink-0 disabled:opacity-60"
                  >
                    {loadingR15FromProxy ? 'Загрузка...' : 'Загрузить Man R15'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {R15_MAN_BUNDLE_SOURCES.map((row) => (
                  <div
                    key={row.key}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{row.label}</p>
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-1 truncate max-w-full"
                      >
                        <span className="truncate">{row.sourceUrl.replace('https://www.', '')}</span>
                        <Icons.External />
                      </a>
                    </div>
                    <input
                      type="text"
                      value={r15BundleInputIds[row.key] || ''}
                      onChange={(e) =>
                        setR15BundleInputIds((prev) => ({ ...prev, [row.key]: e.target.value }))
                      }
                      placeholder="assetId"
                      className="w-28 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-blue-600 shrink-0"
                    />
                  </div>
                ))}
              </div>

              {r15LoadError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700 break-words">
                  {r15LoadError}
                </div>
              )}

              <button
                type="button"
                disabled={loadingR15FromProxy}
                onClick={() => handleLoadR15BundleByAssetIds()}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase disabled:opacity-60"
              >
                {loadingR15FromProxy ? 'Загружаем части тела R15...' : 'Загрузить указанные ID через /asset'}
              </button>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-[10px] text-slate-500 leading-snug">
                  <strong>Статические файлы проекта:</strong> выберите 15 файлов <code className="font-mono">.mesh</code> (<code className="font-mono">Head.mesh</code>, <code className="font-mono">UpperTorso.mesh</code> и т.д.) с диска:
                </p>
                <label className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
                  <Icons.Upload />
                  <span>Выбрать статические файлы .mesh (R15)</span>
                  <input
                    type="file"
                    multiple
                    accept=".mesh,.rbxm,.rbxmx"
                    className="hidden"
                    onChange={(e) => {
                      handleLocalR15FilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {caseModalOpen && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[390px] p-5 space-y-4 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                    Ежедневный кейс
                  </p>
                  <h3 className="text-base font-extrabold text-slate-900">Рулетка Robux</h3>
                </div>
                <button
                  type="button"
                  disabled={roulettePhase === 'spinning'}
                  onClick={() => setCaseModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-40"
                >
                  <Icons.X />
                </button>
              </div>

              <div
                ref={rouletteViewportRef}
                className="relative w-full h-32 rounded-2xl bg-slate-900 border-2 border-slate-800 overflow-hidden flex items-center"
              >
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-amber-400 z-20 -translate-x-1/2 shadow-[0_0_10px_#facc15]" />
                <div className="absolute left-1/2 top-0 -translate-x-1/2 z-20 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-amber-400" />
                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 z-20 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[9px] border-l-transparent border-r-transparent border-b-amber-400" />

                <div
                  className="flex items-center gap-2 px-0 will-change-transform"
                  style={{
                    transform: `translate3d(-${rouletteOffset}px, 0, 0)`,
                    transition:
                      roulettePhase === 'spinning'
                        ? 'transform 4.5s cubic-bezier(0.08, 0.85, 0.14, 1)'
                        : 'none'
                  }}
                >
                  {rouletteStrip.map((card) => (
                    <div
                      key={card.id}
                      style={{ backgroundColor: card.bg, borderColor: card.color }}
                      className="w-[92px] h-[96px] shrink-0 rounded-xl border-2 flex flex-col items-center justify-center p-2 text-center shadow-sm"
                    >
                      <RobuxIcon className="w-7 h-7 mb-1" />
                      <span className="text-base font-black text-slate-900 tabular-nums leading-none">
                        +{card.amount}
                      </span>
                      <span
                        style={{ color: card.color }}
                        className="text-[9px] font-extrabold uppercase mt-1 tracking-wider"
                      >
                        {card.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {roulettePhase === 'won' && wonPrize && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1">
                  <p className="text-xs font-bold text-amber-800">Выигрыш зачислен на баланс</p>
                  <div className="flex justify-center">
                    <RobuxPrice amount={wonPrize.amount} className="text-xl font-black text-slate-900" iconClass="w-5 h-5" />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={roulettePhase === 'spinning' || (isCaseOnCooldown && roulettePhase !== 'won')}
                onClick={() => {
                  if (roulettePhase === 'won') setCaseModalOpen(false);
                  else startRouletteSpin();
                }}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm border-b-4 border-blue-800 disabled:opacity-50 transition-all"
              >
                {roulettePhase === 'spinning'
                  ? 'Крутим рулетку...'
                  : roulettePhase === 'won'
                  ? 'Забрать и закрыть'
                  : isCaseOnCooldown
                  ? `Доступен через ${formatCooldown(caseRemainingMs)}`
                  : 'Крутить кейс'}
              </button>
            </div>
          </div>
        )}

        {opModalOpen && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[380px] p-5 space-y-4 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                    Проверка подписки
                  </p>
                  <h3 className="text-sm font-extrabold text-slate-900">Подпишитесь на каналы</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Для доступа к генерации образов и реферальной программе подпишитесь на спонсоров:
              </p>

              <div className="space-y-2">
                {opChannels.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">{ch.title}</p>
                      <p className="text-[11px] text-slate-500">{ch.handle}</p>
                    </div>
                    <a
                      href={`https://t.me/${ch.handle.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        setOpChannels((prev) =>
                          prev.map((item) =>
                            item.id === ch.id ? { ...item, subscribed: true } : item
                          )
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${
                        ch.subscribed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {ch.subscribed ? 'Подписан' : 'Подписаться'}
                    </a>
                  </div>
                ))}
              </div>

              {opErrorMsg && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5">
                  {opErrorMsg}
                </p>
              )}

              <button
                type="button"
                disabled={checkingOp}
                onClick={handleVerifyOp}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase disabled:opacity-60"
              >
                {checkingOp ? 'Проверяем...' : 'Проверить подписку'}
              </button>
            </div>
          </div>
        )}

        {showArchiveModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[390px] max-h-[82vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Архив образов</h3>
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                {savedOutfits.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-500 font-semibold">
                    У вас пока нет сохранённых образов. Нажмите «Сохранить» в Студии.
                  </p>
                ) : (
                  savedOutfits.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <RobuxPrice amount={entry.totalCost} className="text-sm font-extrabold text-slate-900" />
                          <p className="text-[10px] text-slate-400 mt-0.5">Сохранено {entry.savedAt}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEquippedOutfit(entry.items);
                              setCurrentOutfitId(entry.id);
                              setHiddenSlots({});
                              setShowArchiveModal(false);
                              setActiveTab('studio');
                              showToast('Образ загружен', 'success');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedOutfit(entry.id)}
                            className="p-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50"
                            title="Удалить из архива"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {SLOT_ORDER.filter((sk) => entry.items[sk]).map((sk) => (
                          <span
                            key={sk}
                            className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 truncate max-w-[140px]"
                          >
                            {entry.items[sk].name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showWithdrawModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[380px] p-5 space-y-4 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Вывод Robux</h3>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Доступно</span>
                <RobuxPrice amount={balance} className="text-sm font-extrabold text-slate-900" />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[30, 50, 100, 200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setWithdrawAmount(amt)}
                    className={`py-2 rounded-xl border text-xs font-extrabold tabular-nums ${
                      withdrawAmount === amt
                        ? 'bg-amber-400 border-amber-500 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-slate-500">
                  Ссылка на Gamepass
                </label>
                <input
                  type="url"
                  value={withdrawGamepass}
                  onChange={(e) => setWithdrawGamepass(e.target.value)}
                  placeholder="https://www.roblox.com/game-pass/..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={handleWithdrawSubmit}
                className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold text-xs uppercase border-b-2 border-amber-600"
              >
                Создать заявку на {withdrawAmount}
              </button>
            </div>
          </div>
        )}

        {showPromoModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[360px] p-5 space-y-4 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Ввести промокод</h3>
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder="Например: START10"
                className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-sm font-extrabold text-slate-900 uppercase focus:outline-none focus:border-blue-600"
              />

              <p className="text-[11px] text-slate-500 text-center">
                Тестовые коды: START10, ROBLOX20, RBX30
              </p>

              <button
                type="button"
                onClick={handleRedeemPromo}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase"
              >
                Активировать
              </button>
            </div>
          </div>
        )}

        {showHistoryModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[380px] max-h-[80vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">История выводов</h3>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                {withdrawals.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-500 font-semibold">
                    Заявок на вывод пока нет.
                  </p>
                ) : (
                  withdrawals.map((w) => (
                    <div key={w.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <RobuxPrice amount={w.amount} className="text-sm font-extrabold text-slate-900" />
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                            w.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : w.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {w.status === 'approved'
                            ? 'Выплачено'
                            : w.status === 'rejected'
                            ? 'Отклонено'
                            : 'На проверке'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{w.gamepass}</p>
                      {w.reason && <p className="text-[11px] font-semibold text-red-600">Причина: {w.reason}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showRefModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[360px] p-5 space-y-4 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Персональная ссылка</h3>
                <button
                  type="button"
                  onClick={() => setShowRefModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>
              <p className="text-xs text-slate-600">
                Отправьте ссылку другу — после его первого собранного образа вам начислят 10 Robux.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 break-all">
                https://t.me/rbxstudio_bot?startapp=ref_10164812
              </div>
              <button
                type="button"
                onClick={() =>
                  copyTextSafe(
                    'https://t.me/rbxstudio_bot?startapp=ref_10164812',
                    'Реферальная ссылка скопирована'
                  )
                }
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase"
              >
                Скопировать ссылку
              </button>
            </div>
          </div>
        )}

        {showReviewsModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[380px] p-5 space-y-3 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Отзывы игроков</h3>
                <button
                  type="button"
                  onClick={() => setShowReviewsModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>
              {[
                { u: '@maxim_rbx', text: 'Вывели 50 через Gamepass за 20 минут, всё чётко.', amt: 50 },
                { u: '@alina_play', text: 'Удобно примерять реальные 3D-аксессуары Roblox прямо в браузере.', amt: 30 }
              ].map((r, i) => (
                <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">{r.u}</span>
                    <RobuxPrice amount={r.amt} className="text-xs font-extrabold text-slate-800" />
                  </div>
                  <p className="text-xs text-slate-600">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showFaqModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[380px] p-5 space-y-3 border border-slate-200 shadow-2xl text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Как это работает?</h3>
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>
              <p>1. Рендер работает полностью в вашем браузере на Three.js без куки и без нагрузки на сервер.</p>
              <p>2. Парсер читает настоящие бинарные файлы Roblox (.rbxm и .mesh v1–v5), находит точки крепления Attachment и крепит аксессуары на скелет R15 с точным масштабом и углом.</p>
              <p>3. Скачанные меши и текстуры кэшируются в оперативной памяти браузера.</p>
            </div>
          </div>
        )}

        {showNotifModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[360px] p-5 space-y-3 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Уведомления</h3>
                <button
                  type="button"
                  onClick={() => setShowNotifModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>
              {[
                { key: 'dailyCase', label: 'Напоминание об открытии кейса' },
                { key: 'referrals', label: 'Начисления за друзей' },
                { key: 'withdrawals', label: 'Статус заявок на вывод' }
              ].map((row) => (
                <label
                  key={row.key}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <span>{row.label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[row.key]}
                    onChange={(e) =>
                      setNotifications((prev) => ({ ...prev, [row.key]: e.target.checked }))
                    }
                    className="accent-blue-600 w-4 h-4"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {showRulesModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[360px] p-5 space-y-3 border border-slate-200 shadow-2xl text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Правила безопасности</h3>
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>
              <p>1. Запрещена накрутка рефералов и использование мультиаккаунтов.</p>
              <p>2. При создании заявки на вывод убедитесь, что цена Gamepass точно совпадает с суммой вывода.</p>
              <p>3. Приложение работает без куки и без доступа к аккаунту Roblox.</p>
            </div>
          </div>
        )}

        {onboardingStep > 0 && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[380px] p-5 space-y-4 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-extrabold">
                  Шаг {onboardingStep} из 3
                </span>
                <button
                  type="button"
                  onClick={() => setOnboardingStep(0)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  Пропустить
                </button>
              </div>

              {onboardingStep === 1 && (
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900">Клиентский 3D-рендер R15</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Персонаж и аксессуары рендерятся прямо в вашем браузере на Three.js из настоящих файлов Roblox (.rbxm и .mesh v1–v5) с привязкой к точкам Attachment.
                  </p>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Загрузка мешей без куки
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Загружайте официальные части тела R15 и аксессуары из каталога Roblox или со своего устройства.
                  </p>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900">Цвет кожи и кэш в памяти</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Меняйте цвет кожи тела R15 в один клик, вращайте камеру пальцем и мгновенно переключайте уже загруженные из кэша аксессуары.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {onboardingStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep((s) => s - 1)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                  >
                    Назад
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOnboardingStep((s) => (s >= 3 ? 0 : s + 1))}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs"
                >
                  {onboardingStep >= 3 ? 'Готово' : 'Далее'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAdminModal && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-[390px] p-5 space-y-4 border border-slate-200 shadow-2xl max-h-[86vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Панель тестирования (Админка)</h3>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Icons.X />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpChannels((prev) =>
                      prev.map((c) => ({ ...c, subscribed: !allOpSubscribed }))
                    );
                    showToast(allOpSubscribed ? 'Подписки ОП сброшены' : 'Подписки ОП включены');
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
                >
                  {allOpSubscribed ? 'Сбросить ОП' : 'Зачесть ОП'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRemainingGens(MAX_DAILY_LIMIT);
                    showToast('Лимит образов сброшен до 10/10', 'success');
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
                >
                  Сбросить лимит (10)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBalance((b) => b + 50);
                    showToast('Начислено +50 Robux', 'success');
                  }}
                  className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-slate-900"
                >
                  +50 на баланс
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLastCaseClaim(0);
                    showToast('Таймер кейса сброшен', 'success');
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
                >
                  Сбросить кейс
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setShowBodyLoaderModal(true);
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 col-span-2"
                >
                  Меши тела R15
                </button>
              </div>

              {withdrawals.filter((w) => w.status === 'pending').length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] font-extrabold uppercase text-slate-500">
                    Заявки на проверке
                  </p>
                  {withdrawals
                    .filter((w) => w.status === 'pending')
                    .map((w) => (
                      <div
                        key={w.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <RobuxPrice amount={w.amount} className="text-xs font-extrabold text-slate-900" />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setWithdrawals((prev) =>
                                prev.map((x) => (x.id === w.id ? { ...x, status: 'approved' } : x))
                              );
                              setFrozenBalance((f) => Math.max(0, f - w.amount));
                              showToast('Заявка одобрена', 'success');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                          >
                            Одобрить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWithdrawals((prev) =>
                                prev.map((x) =>
                                  x.id === w.id
                                    ? { ...x, status: 'rejected', reason: 'Неверная цена Gamepass' }
                                    : x
                                )
                              );
                              setFrozenBalance((f) => Math.max(0, f - w.amount));
                              setBalance((b) => b + w.amount);
                              showToast('Заявка отклонена, баланс возвращён');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold"
                          >
                            Отклонить
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[390px] z-50 pointer-events-none">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold text-center ${
                toast.type === 'error'
                  ? 'bg-red-600 border-red-700 text-white'
                  : toast.type === 'success'
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}