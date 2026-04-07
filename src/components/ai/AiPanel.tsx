/**
 * AiPanel — Embedded AI assistance chat
 *
 * Appears at operational decision points to encourage engineers,
 * specialists and commanders to ask questions and get guided solutions.
 *
 * Design principles:
 * - Looks and feels like a real chat — users should want to interact
 * - Role-scoped suggested questions surface immediately
 * - "Coming soon" communicates what will happen, not a dead end
 * - All AI output is clearly labeled as requiring engineer review
 * - Connects to: telemetry data, maintenance procedures, safety docs
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Brain, ChevronDown, ChevronUp, Send, Sparkles,
  BookOpen, FileWarning, Layers, AlertCircle, MessageSquare,
  ExternalLink, FileSearch,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type AiSlot =
  | 'finding_explanation'
  | 'dossier_summary'
  | 'investigation_assist'
  | 'fleet_summary';

interface AiPanelProps {
  slot: AiSlot;
  context?: {
    findingId?:    string;
    findingTitle?: string;
    ruleId?:       string;
    tailNumber?:   string;
    sortieId?:     string;
    dossierId?:    string;
  };
  roleScope?: 'technician' | 'specialist' | 'engineer' | 'commander';
  compact?:     boolean;
  defaultOpen?: boolean;
}

// =============================================================================
// SLOT CONFIG
// =============================================================================

const SLOT_CONFIG: Record<AiSlot, {
  labelHe:       string;
  descriptionHe: string;
  icon:          React.ReactNode;
  availableToRoles: string[];
  suggestedByRole: Record<string, string[]>;
}> = {
  finding_explanation: {
    labelHe:       'הסבר AI לממצא',
    descriptionHe: 'ניתוח טקסטואלי של הממצא על בסיס נתוני טלמטריה וכללים',
    icon: <MessageSquare className="h-4 w-4" />,
    availableToRoles: ['engineer', 'specialist'],
    suggestedByRole: {
      engineer:   [
        'מה הגורם הסביר לחריגה זו?',
        'האם קיים תקדים לממצא זה בצי?',
        'אלו בדיקות מומלצות לפי נוהל התחזוקה?',
        'מה סף הסיכון לטיסה הבאה?',
      ],
      specialist: [
        'האם יש ממצאים דומים על מטוסים אחרים?',
        'מה הפעולה המומלצת לצוות הטכנאים?',
        'האם נדרש דיווח לגף טכני?',
      ],
    },
  },
  dossier_summary: {
    labelHe:       'סיכום AI לתיק',
    descriptionHe: 'סיכום ממצאי התיק לפי חומרה ומגמות',
    icon: <FileSearch className="h-4 w-4" />,
    availableToRoles: ['engineer', 'commander'],
    suggestedByRole: {
      engineer:  [
        'מה ה-root cause הסביר ביותר?',
        'אלו ממצאים קשורים זה לזה?',
        'מה רצף הטיפול המומלץ?',
      ],
      commander: [
        'מה מצב הכשירות הצבאית של הצי?',
        'מה הסיכון הכולל לתכנית הטיסות?',
        'אלו מטוסים דורשים תשומת לב מיידית?',
      ],
    },
  },
  investigation_assist: {
    labelHe:       'עוזר תחקיר AI',
    descriptionHe: 'שאל שאלות על נתוני הטיסה, נהלים ומסמכי בטיחות',
    icon: <Layers className="h-4 w-4" />,
    availableToRoles: ['engineer', 'specialist', 'commander', 'technician'],
    suggestedByRole: {
      engineer:   [
        'אלו פרמטרים כדאי לבחון בהמשך?',
        'מה הנוהל הסטנדרטי לחריגת לחץ הידראולי?',
        'האם יש מגמה בנתוני EGT לאורך זמן?',
        'מה הקשר בין brake temp ל-landing weight?',
      ],
      specialist: [
        'מה אומרים נתוני הצי על המטוס הזה?',
        'האם יש מגמות חוזרות בטיסות הבוקר?',
        'אלו ממצאים מצריכים מיון עדיפויות עכשיו?',
      ],
      commander:  [
        'מה הסטטוס הכולל של הצי לטיסות מחר?',
        'אלו ממצאים S1 פתוחים כרגע?',
        'מה הסיכון התפעולי מהמגמות הנוכחיות?',
      ],
      technician: [
        'מה הצעד הבא בנוהל הטיפול?',
        'אלו כלים נדרשים לבדיקה זו?',
        'מה לעשות אם הערך עדיין גבוה לאחר הטיפול?',
      ],
    },
  },
  fleet_summary: {
    labelHe:       'סיכום כשירות צי (AI)',
    descriptionHe: 'תמצית סיכונים ומגמות לפי ממצאים פתוחים',
    icon: <Brain className="h-4 w-4" />,
    availableToRoles: ['commander', 'specialist'],
    suggestedByRole: {
      commander: [
        'מה המצב הכולל לפני יום הטיסות?',
        'אלו מטוסים בסיכון גבוה?',
        'האם יש מגמת שחיקה בצי?',
        'מה המלצות ה-AI לתכנון הטיסות?',
      ],
      specialist: [
        'מה הממצאים שדורשים מיון עדיפויות היום?',
        'אלו מטוסים יש להם ממצאים חוזרים?',
        'מה מצב קטגוריית ה-S2 בצי?',
      ],
    },
  },
};

// =============================================================================
// DATA SOURCES — shown to user so they know what AI will access
// =============================================================================

const DATA_SOURCES = [
  { icon: <Layers    className="h-3 w-3" />, label: 'נתוני טלמטריה שהועלו' },
  { icon: <BookOpen  className="h-3 w-3" />, label: 'נהלי תחזוקה (TM)' },
  { icon: <FileWarning className="h-3 w-3" />, label: 'מסמכי בטיחות ו-Airworthiness' },
  { icon: <AlertCircle className="h-3 w-3" />, label: 'היסטוריית ממצאים בצי' },
];

// =============================================================================
// COMPACT VERSION
// =============================================================================

const AiPanelCompact: React.FC<{ slot: AiSlot; roleScope?: string }> = ({ slot, roleScope }) => {
  const config = SLOT_CONFIG[slot];
  return (
    <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5">
      <div className="text-primary/60">{config.icon}</div>
      <span className="text-xs text-muted-foreground flex-1">{config.labelHe}</span>
      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary/60">
        <Sparkles className="h-2.5 w-2.5 ml-1" />
        בקרוב
      </Badge>
    </div>
  );
};

// =============================================================================
// FULL VERSION
// =============================================================================

export const AiPanel: React.FC<AiPanelProps> = ({
  slot,
  context,
  roleScope,
  compact = false,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [draft, setDraft]   = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const config = SLOT_CONFIG[slot];

  // Role gate
  if (roleScope && !config.availableToRoles.includes(roleScope)) return null;

  if (compact) return <AiPanelCompact slot={slot} roleScope={roleScope} />;

  const suggestions = (roleScope && config.suggestedByRole[roleScope])
    || config.suggestedByRole[config.availableToRoles[0]]
    || [];

  const handleSuggestionClick = (q: string) => {
    setDraft(q);
    textareaRef.current?.focus();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-xl overflow-hidden shadow-sm">

        {/* ── Header ── */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 bg-gradient-to-l from-primary/5 to-transparent hover:from-primary/10 transition-colors text-right">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight">{config.labelHe}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{config.descriptionHe}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mr-2">
              <Badge className="text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                <Sparkles className="h-2.5 w-2.5 ml-1" />
                בקרוב
              </Badge>
              {isOpen
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* ── Content ── */}
        <CollapsibleContent>
          <Separator />

          <div className="p-4 space-y-4">
            {/* What AI will access */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">AI יחובר למקורות הבאים:</p>
              <div className="grid grid-cols-2 gap-1">
                {DATA_SOURCES.map(src => (
                  <div key={src.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="text-primary/60">{src.icon}</span>
                    {src.label}
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-1" />

            {/* Suggested questions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary/60" />
                  שאלות מוצעות עבור תפקידך
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSuggestionClick(q)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5
                                 hover:bg-primary/15 hover:border-primary/40 text-primary/80
                                 transition-all cursor-pointer text-right leading-tight"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat input */}
            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="הקלד שאלה על הנתונים, הנוהל, או הממצא…"
                className="text-sm resize-none text-right min-h-[72px] bg-muted/30 border-muted-foreground/20 focus:border-primary/50"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  disabled
                  title="AI יהיה זמין עם הגדרת AI_PROVIDER בשרת"
                >
                  <Send className="h-3.5 w-3.5" />
                  שלח שאלה
                </Button>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  ממתין לחיבור AI
                </span>
              </div>
            </div>

            {/* Setup note */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-dashed text-[11px] text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              <div className="space-y-0.5">
                <p>הגדרה: <code className="font-mono bg-muted px-1 rounded">AI_PROVIDER=anthropic</code> בשרת</p>
                <p>כל פלט AI מסומן ודורש אישור מהנדס לפני פעולה.</p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default AiPanel;
