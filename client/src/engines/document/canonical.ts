// ── Marks ────────────────────────────────────────────────

export interface BoldMark { type: 'bold' }
export interface ItalicMark { type: 'italic' }
export interface UnderlineMark { type: 'underline' }
export interface StrikethroughMark { type: 'strikethrough' }
export interface SuperscriptMark { type: 'superscript' }
export interface SubscriptMark { type: 'subscript' }
export interface ColorMark { type: 'color'; colorRef: string }
export interface HighlightMark { type: 'highlight'; colorRef: string }
export interface LinkMark { type: 'link'; href: string }
export interface VariableMark { type: 'variable'; key: string }

export type Mark =
    | BoldMark
    | ItalicMark
    | UnderlineMark
    | StrikethroughMark
    | SuperscriptMark
    | SubscriptMark
    | ColorMark
    | HighlightMark
    | LinkMark
    | VariableMark;

// ── Inline Runs ──────────────────────────────────────────

export interface InlineRun {
    text: string;
    marks: Mark[];
    typographyRef?: string;
}

// ── Transform ────────────────────────────────────────────

export interface Transform {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

// ── Block Base ───────────────────────────────────────────

export interface BlockBase {
    id: string;
    type: string;
    label?: string;
    transform: Transform;
    opacity: number;
    visible: boolean;
    locked: boolean;
    typographyRef?: string;
    colorRef?: string;
    effectRef?: string;
}

// ── Text Block ───────────────────────────────────────────

export type TextAlign = 'start' | 'center' | 'end' | 'justify';
export type VerticalAlign = 'top' | 'center' | 'bottom';
export type Overflow = 'wrap' | 'clip' | 'grow';
export type TrackingStep = 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest';
export type SpacingScaleStep = 'none' | 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl';

export interface TextBlockLayout {
    align: TextAlign;
    verticalAlign: VerticalAlign;
    lineHeightRatio: number;
    trackingStep: TrackingStep;
    paragraphSpacingStep: SpacingScaleStep;
    overflow: Overflow;
    fontSize?: number;
}

export interface LineBreakStrategy {
    mode: 'latin' | 'thai' | 'cjk' | 'mixed' | 'none';
    primaryScript?: 'thai' | 'latin' | 'cjk';
}

export interface TextLocale {
    languageHint: string;
    lineBreakStrategy: LineBreakStrategy;
    textDirection: 'ltr' | 'rtl';
}

export interface TextBlock extends BlockBase {
    type: 'text';
    content: InlineRun[];
    layout: TextBlockLayout;
    locale: TextLocale;
}

// ── Image Block ──────────────────────────────────────────

export interface ImageBlock extends BlockBase {
    type: 'image';
    src: string;
    width: number;
    height: number;
}

// ── Vector Block ─────────────────────────────────────────

export interface VectorStroke {
    colorRef: string;
    widthStep: SpacingScaleStep;
    dashPattern: 'solid' | 'dashed' | 'dotted';
    cap: 'flat' | 'round' | 'square';
    join: 'miter' | 'round' | 'bevel';
}

export interface VectorBlock extends BlockBase {
    type: 'vector';
    pathData: string;
    fillRef: string | null;
    stroke: VectorStroke | null;
}

// ── Group Block ──────────────────────────────────────────

export interface GroupBlock extends BlockBase {
    type: 'group';
    children: CanonicalBlock[];
    clipContent: boolean;
}

// ── Union ────────────────────────────────────────────────

export type CanonicalBlock = TextBlock | ImageBlock | VectorBlock | GroupBlock;
