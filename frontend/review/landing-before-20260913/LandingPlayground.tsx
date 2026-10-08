import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
    Brush,
    CircleDot,
    GripVertical,
    Minus,
    Pause,
    Play,
    Plus,
    RotateCcw,
    RotateCw,
    Target,
    X
} from 'lucide-react';

type GoalType = 'GOAL' | 'BLACK_HOLE';
type MaterialKey = 'yellow' | 'pink' | 'cyan' | 'violet' | 'orange';
type StickColorKey = 'slate' | 'green' | 'blue' | 'pink' | 'gold';

interface LandingPlaygroundProps {
    active: boolean;
    onActiveChange: (active: boolean) => void;
}

type BlackHoleSize = 'small' | 'medium' | 'large';

interface Point {
    x: number;
    y: number;
}

interface Ball extends Point {
    id: number;
    radius: number;
    vx: number;
    vy: number;
    locked: boolean;
    capturedUntil: number;
}

interface Goal extends Point {
    id: number;
    type: GoalType;
    size: number;
}

interface Stick {
    id: number;
    start: Point;
    end: Point;
    thickness: number;
    color: StickColorKey;
}

interface PaintStroke {
    id: number;
    material: MaterialKey;
    radius: number;
    points: Point[];
}

interface Surface {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface MaterialDefinition {
    label: string;
    color: string;
    softColor: string;
    friction: number;
    restitution: number;
    damping: number;
    airMultiplier: number;
}

const MATERIALS: Record<MaterialKey, MaterialDefinition> = {
    yellow: {
        label: 'Yellow · sticky',
        color: '#facc15',
        softColor: 'rgba(250, 204, 21, 0.28)',
        friction: 0.8,
        restitution: 0.12,
        damping: 0.78,
        airMultiplier: 0.82
    },
    pink: {
        label: 'Pink · bouncy',
        color: '#f472b6',
        softColor: 'rgba(244, 114, 182, 0.28)',
        friction: 0.98,
        restitution: 0.92,
        damping: 0.98,
        airMultiplier: 1.02
    },
    cyan: {
        label: 'Cyan · speed',
        color: '#22d3ee',
        softColor: 'rgba(34, 211, 238, 0.26)',
        friction: 0.94,
        restitution: 0.5,
        damping: 0.98,
        airMultiplier: 1.16
    },
    violet: {
        label: 'Violet · slide',
        color: '#a78bfa',
        softColor: 'rgba(167, 139, 250, 0.27)',
        friction: 0.995,
        restitution: 0.35,
        damping: 0.995,
        airMultiplier: 1.01
    },
    orange: {
        label: 'Orange · soft brake',
        color: '#fb923c',
        softColor: 'rgba(251, 146, 60, 0.26)',
        friction: 0.9,
        restitution: 0.25,
        damping: 0.86,
        airMultiplier: 0.9
    }
};

const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];
const DEFAULT_MATERIAL: MaterialDefinition = {
    label: 'Unpainted surface',
    color: '#94a3b8',
    softColor: 'rgba(148, 163, 184, 0.2)',
    friction: 0.94,
    restitution: 0.52,
    damping: 0.98,
    airMultiplier: 1
};
const BLACK_HOLE_SIZES: Record<BlackHoleSize, number> = { small: 28, medium: 42, large: 60 };
const STICK_COLORS: Record<StickColorKey, { label: string; color: string }> = {
    slate: { label: 'Slate', color: '#94a3b8' },
    green: { label: 'Green', color: '#4ade80' },
    blue: { label: 'Blue', color: '#60a5fa' },
    pink: { label: 'Pink', color: '#f472b6' },
    gold: { label: 'Gold', color: '#facc15' }
};
const STICK_COLOR_KEYS = Object.keys(STICK_COLORS) as StickColorKey[];
const MAX_BALLS = 8;
const MAX_GOALS = 3;
const MAX_STICKS = 8;
const MAX_STROKES = 160;
const GRAVITY = 560;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);

const getPageScroll = () => ({
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0
});

const getWorldSize = () => ({
    width: Math.max(window.innerWidth, document.documentElement.scrollWidth || 0),
    height: Math.max(window.innerHeight, document.documentElement.scrollHeight || 0)
});

const distanceSquared = (a: Point, b: Point) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

const distanceToSegmentSquared = (point: Point, start: Point, end: Point) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
        return distanceSquared(point, start);
    }
    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
    return distanceSquared(point, { x: start.x + t * dx, y: start.y + t * dy });
};

const isProtectedTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(target.closest('button, a, input, textarea, select, [data-playground-control], .maplibregl-canvas, .mapboxgl-canvas, [data-map-interaction]'));
};

const isBlockingControlTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(target.closest('button, a, input, textarea, select, [data-playground-control]'));
};

const isPanelControlTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(target.closest('button, a, input, textarea, select'));
};

export const LandingPlayground = ({ active, onActiveChange }: LandingPlaygroundProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ballImageRef = useRef<HTMLImageElement | null>(null);
    const ballsRef = useRef<Ball[]>([]);
    const goalsRef = useRef<Goal[]>([]);
    const sticksRef = useRef<Stick[]>([]);
    const strokesRef = useRef<PaintStroke[]>([]);
    const surfacesRef = useRef<Surface[]>([]);
    const nextIdRef = useRef(1);
    const selectedMaterialRef = useRef<MaterialKey>('yellow');
    const blackHoleSizeRef = useRef<BlackHoleSize>('medium');
    const brushRadiusRef = useRef(18);
    const pausedRef = useRef(false);
    const aimRef = useRef<{ ballId: number; current: Point; moved: boolean } | null>(null);
    const goalDragRef = useRef<{ goalId: number; offset: Point } | null>(null);
    const stickDragRef = useRef<{ stickId: number; offset: Point } | null>(null);
    const surfaceDragRef = useRef<{ element: HTMLElement; start: Point; origin: Point; moved: boolean } | null>(null);
    const paintStrokeRef = useRef<PaintStroke | null>(null);
    const waterfallRef = useRef<{ x: number; y: number; lastEmit: number } | null>(null);
    const sprayModeRef = useRef<'brush' | 'waterfall'>('brush');
    const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 });
    const [hasPlaygroundContent, setHasPlaygroundContent] = useState(false);
    const [selectedStickId, setSelectedStickId] = useState<number | null>(null);
    const [selectedStickColor, setSelectedStickColor] = useState<StickColorKey>('slate');
    const selectedStickIdRef = useRef<number | null>(null);
    const [panelPosition, setPanelPosition] = useState({ x: 16, y: 80 });
    const panelDragRef = useRef<{ start: Point; origin: Point; moved: boolean } | null>(null);
    const [paintMode, setPaintMode] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialKey>('yellow');
    const [sprayMode, setSprayMode] = useState<'brush' | 'waterfall'>('brush');
    const [blackHoleSize, setBlackHoleSize] = useState<BlackHoleSize>('medium');
    const [brushSize, setBrushSize] = useState<'small' | 'large'>('small');
    const [paused, setPaused] = useState(false);
    const [status, setStatus] = useState('Add a ball, then click it to freeze and drag to aim a shot.');
    const isPlaygroundRunning = active || hasPlaygroundContent;

    const startPanelDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0 || isPanelControlTarget(event.target)) {
            return;
        }
        panelDragRef.current = {
            start: { x: event.clientX, y: event.clientY },
            origin: panelPosition,
            moved: false
        };
        event.preventDefault();
    }, [panelPosition]);

    useEffect(() => {
        const handlePanelMove = (event: PointerEvent) => {
            const drag = panelDragRef.current;
            if (!drag) {
                return;
            }
            const delta = { x: event.clientX - drag.start.x, y: event.clientY - drag.start.y };
            drag.moved = drag.moved || Math.abs(delta.x) + Math.abs(delta.y) > 4;
            const panelWidth = active ? 340 : 190;
            const panelHeight = active ? 720 : 56;
            setPanelPosition({
                x: clamp(drag.origin.x + delta.x, 4, Math.max(4, window.innerWidth - panelWidth - 4)),
                y: clamp(drag.origin.y + delta.y, 4, Math.max(4, window.innerHeight - panelHeight - 4))
            });
            event.preventDefault();
        };
        const handlePanelUp = () => {
            if (panelDragRef.current?.moved) {
                setStatus('Playground panel moved. Drag the grip again whenever you want to reposition it.');
            }
            panelDragRef.current = null;
        };
        window.addEventListener('pointermove', handlePanelMove, { passive: false });
        window.addEventListener('pointerup', handlePanelUp);
        window.addEventListener('pointercancel', handlePanelUp);
        return () => {
            window.removeEventListener('pointermove', handlePanelMove);
            window.removeEventListener('pointerup', handlePanelUp);
            window.removeEventListener('pointercancel', handlePanelUp);
        };
    }, [active]);

    useEffect(() => {
        selectedMaterialRef.current = selectedMaterial;
    }, [selectedMaterial]);

    useEffect(() => {
        sprayModeRef.current = sprayMode;
    }, [sprayMode]);

    useEffect(() => {
        selectedStickIdRef.current = selectedStickId;
    }, [selectedStickId]);

    useEffect(() => {
        blackHoleSizeRef.current = blackHoleSize;
    }, [blackHoleSize]);

    useEffect(() => {
        brushRadiusRef.current = brushSize === 'small' ? 18 : 36;
    }, [brushSize]);

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    const addBall = useCallback((position?: Point, announce = true) => {
        if (ballsRef.current.length >= MAX_BALLS) {
            if (announce) {
                setStatus(`The playground is limited to ${MAX_BALLS} balls. Reset to start over.`);
            }
            return;
        }

        const id = nextIdRef.current++;
        const { width, height } = getWorldSize();
        const scroll = getPageScroll();
        const index = ballsRef.current.length;
        ballsRef.current.push({
            id,
            x: position?.x ?? clamp(scroll.x + window.innerWidth * (0.24 + (index % 4) * 0.12), 40, width - 40),
            y: position?.y ?? clamp(scroll.y + 112 + Math.floor(index / 4) * 44, 84, height - 100),
            radius: 15,
            vx: 0,
            vy: 30,
            locked: false,
            capturedUntil: 0
        });
        setHasPlaygroundContent(true);
        if (announce) {
            setStatus('Ball added. Click it to freeze and drag to aim a shot.');
        }
    }, []);

    const openPlayground = useCallback(() => {
        if (ballsRef.current.length === 0 && goalsRef.current.length === 0 && sticksRef.current.length === 0) {
            addBall();
        }
        onActiveChange(true);
    }, [addBall, onActiveChange]);

    const closePlayground = useCallback(() => {
        setPaintMode(false);
        setPaused(false);
        waterfallRef.current = null;
        paintStrokeRef.current = null;
        onActiveChange(false);
    }, [onActiveChange]);

    const addGoal = useCallback((type: GoalType) => {
        if (goalsRef.current.length >= MAX_GOALS) {
            setStatus(`The playground is limited to ${MAX_GOALS} targets. Reset to place new ones.`);
            return;
        }

        const index = goalsRef.current.length;
        const { width, height } = getWorldSize();
        const scroll = getPageScroll();
        const size = type === 'BLACK_HOLE' ? BLACK_HOLE_SIZES[blackHoleSizeRef.current] : 62;
        goalsRef.current.push({
            id: nextIdRef.current++,
            type,
            size,
            x: clamp(scroll.x + window.innerWidth * 0.7 + index * 36, size + 24, width - size - 24),
            y: clamp(scroll.y + window.innerHeight * 0.34 + index * 54, 8, height - size - 40)
        });
        setHasPlaygroundContent(true);
        setStatus(type === 'BLACK_HOLE' ? 'Black hole placed. Drag it to line up a shot.' : 'Goal placed. Drag it to a new position if you like.');
    }, []);

    const addStick = useCallback(() => {
        if (sticksRef.current.length >= MAX_STICKS) {
            setStatus(`The playground is limited to ${MAX_STICKS} obstacles. Reset to start over.`);
            return;
        }

        const index = sticksRef.current.length;
        const { width, height } = getWorldSize();
        const scroll = getPageScroll();
        const halfLength = clamp(width * 0.09, 58, 130);
        const centerX = clamp(scroll.x + window.innerWidth * (0.32 + (index % 3) * 0.2), halfLength + 24, width - halfLength - 24);
        const centerY = clamp(scroll.y + window.innerHeight * (0.42 + Math.floor(index / 3) * 0.12), 116, height - 80);
        sticksRef.current.push({
            id: nextIdRef.current++,
            start: { x: centerX - halfLength, y: centerY },
            end: { x: centerX + halfLength, y: centerY + (index % 2 === 0 ? 0 : 18) },
            thickness: 7,
            color: STICK_COLOR_KEYS[index % STICK_COLOR_KEYS.length]
        });
        setSelectedStickId(sticksRef.current[sticksRef.current.length - 1].id);
        setSelectedStickColor(sticksRef.current[sticksRef.current.length - 1].color);
        setHasPlaygroundContent(true);
        setStatus('Obstacle added. Drag it to shape the route, then paint it if you like.');
    }, []);

    const rotateSelectedStick = useCallback((direction: -1 | 1) => {
        const stick = sticksRef.current.find((entry) => entry.id === selectedStickId);
        if (!stick) {
            setStatus('Select an obstacle first, then rotate it here.');
            return;
        }
        const angle = direction * (Math.PI / 12);
        const center = { x: (stick.start.x + stick.end.x) / 2, y: (stick.start.y + stick.end.y) / 2 };
        const rotate = (point: Point): Point => {
            const x = point.x - center.x;
            const y = point.y - center.y;
            return {
                x: center.x + x * Math.cos(angle) - y * Math.sin(angle),
                y: center.y + x * Math.sin(angle) + y * Math.cos(angle)
            };
        };
        const nextStart = rotate(stick.start);
        const nextEnd = rotate(stick.end);
        stick.start = nextStart;
        stick.end = nextEnd;
        setStatus(`Obstacle rotated ${direction > 0 ? 'clockwise' : 'counter-clockwise'}.`);
    }, [selectedStickId]);

    const colorSelectedStick = useCallback((color: StickColorKey) => {
        const stick = sticksRef.current.find((entry) => entry.id === selectedStickId);
        if (!stick) {
            setStatus('Select an obstacle first, then choose its color here.');
            return;
        }
        stick.color = color;
        setSelectedStickColor(color);
        setStatus(`${STICK_COLORS[color].label} obstacle selected.`);
    }, [selectedStickId]);

    useEffect(() => {
        if (!active) {
            return;
        }
        const handleStickRotationKey = (event: KeyboardEvent) => {
            if (isBlockingControlTarget(event.target)) {
                return;
            }
            if (event.key === 'ArrowLeft' && selectedStickId !== null) {
                event.preventDefault();
                rotateSelectedStick(-1);
            } else if (event.key === 'ArrowRight' && selectedStickId !== null) {
                event.preventDefault();
                rotateSelectedStick(1);
            }
        };
        window.addEventListener('keydown', handleStickRotationKey);
        return () => window.removeEventListener('keydown', handleStickRotationKey);
    }, [active, rotateSelectedStick, selectedStickId]);

    const resetPlayground = useCallback(() => {
        ballsRef.current = [];
        goalsRef.current = [];
        sticksRef.current = [];
        strokesRef.current = [];
        aimRef.current = null;
        goalDragRef.current = null;
        stickDragRef.current = null;
        paintStrokeRef.current = null;
        waterfallRef.current = null;
        document.querySelectorAll<HTMLElement>('[data-bounce-surface]').forEach((element) => {
            const surfaceId = element.dataset.bounceSurface;
            if (surfaceId !== 'map-card' && surfaceId !== 'login-card') {
                element.style.removeProperty('translate');
                delete element.dataset.playgroundX;
                delete element.dataset.playgroundY;
            }
        });
        setSelectedStickId(null);
        setSelectedStickColor('slate');
        setHasPlaygroundContent(false);
        setStatus('Playground reset. Add a ball, a target, or a painted surface.');
    }, []);

    const undoPaint = useCallback(() => {
        if (strokesRef.current.length === 0) {
            setStatus('There is no paint stroke to undo yet.');
            return;
        }
        strokesRef.current = strokesRef.current.slice(0, -1);
        setStatus('Last paint stroke removed.');
    }, []);

    const sampleMaterial = useCallback((point: Point): MaterialDefinition | null => {
        for (let strokeIndex = strokesRef.current.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
            const stroke = strokesRef.current[strokeIndex];
            const points = stroke.points;
            const hitDistance = points.length < 2
                ? distanceSquared(point, points[0])
                : points.slice(1).reduce((closest, end, index) => Math.min(closest, distanceToSegmentSquared(point, points[index], end)), Number.POSITIVE_INFINITY);
            if (hitDistance <= stroke.radius * stroke.radius) {
                return MATERIALS[stroke.material];
            }
        }
        return null;
    }, []);

    const sampleMaterialAlongPath = useCallback((start: Point, end: Point): MaterialDefinition | null => {
        const distance = Math.sqrt(distanceSquared(start, end));
        const steps = clamp(Math.ceil(distance / 12), 1, 32);
        for (let step = steps; step >= 0; step -= 1) {
            const progress = step / steps;
            const material = sampleMaterial({
                x: start.x + (end.x - start.x) * progress,
                y: start.y + (end.y - start.y) * progress
            });
            if (material) {
                return material;
            }
        }
        return null;
    }, [sampleMaterial]);

    const measureSurfaces = useCallback(() => {
        const scroll = getPageScroll();
        surfacesRef.current = Array.from(document.querySelectorAll<HTMLElement>('[data-bounce-surface]'))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    id: element.dataset.bounceSurface ?? 'surface',
                    left: rect.left + scroll.x,
                    top: rect.top + scroll.y,
                    right: rect.right + scroll.x,
                    bottom: rect.bottom + scroll.y
                };
            })
            .filter((surface) => surface.right - surface.left > 4 && surface.bottom - surface.top > 4);
    }, []);

    useEffect(() => {
        if (!isPlaygroundRunning) {
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }

        const ballImage = new Image();
        ballImage.src = '/assets/playground-ball.png';
        ballImageRef.current = ballImage;

        let frame = 0;
        let lastTime = performance.now();

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvasSizeRef.current = { width: window.innerWidth, height: window.innerHeight, dpr };
            canvas.width = Math.round(window.innerWidth * dpr);
            canvas.height = Math.round(window.innerHeight * dpr);
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            measureSurfaces();
        };

        const draw = (now: number) => {
            const { width, height, dpr } = canvasSizeRef.current;
            const scroll = getPageScroll();
            const toViewport = (point: Point): Point => ({ x: point.x - scroll.x, y: point.y - scroll.y });
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            context.clearRect(0, 0, width, height);

            strokesRef.current.forEach((stroke) => {
                const material = MATERIALS[stroke.material];
                context.save();
                context.strokeStyle = material.color;
                context.globalAlpha = 0.3;
                context.lineWidth = stroke.radius * 2;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.beginPath();
                stroke.points.forEach((point, index) => {
                    const viewportPoint = toViewport(point);
                    if (index === 0) context.moveTo(viewportPoint.x, viewportPoint.y);
                    else context.lineTo(viewportPoint.x, viewportPoint.y);
                });
                context.stroke();
                if (stroke.points.length === 1) {
                    const viewportPoint = toViewport(stroke.points[0]);
                    context.fillStyle = material.softColor;
                    context.beginPath();
                    context.arc(viewportPoint.x, viewportPoint.y, stroke.radius, 0, Math.PI * 2);
                    context.fill();
                }
                context.restore();
            });

            sticksRef.current.forEach((stick) => {
                const viewportStart = toViewport(stick.start);
                const viewportEnd = toViewport(stick.end);
                context.save();
                context.lineCap = 'round';
                context.lineWidth = stick.thickness * 2;
                context.strokeStyle = '#0f172a';
                context.shadowColor = 'rgba(0, 0, 0, 0.45)';
                context.shadowBlur = 8;
                context.beginPath();
                context.moveTo(viewportStart.x, viewportStart.y);
                context.lineTo(viewportEnd.x, viewportEnd.y);
                context.stroke();
                context.shadowBlur = 0;
                context.strokeStyle = STICK_COLORS[stick.color].color;
                context.lineWidth = selectedStickIdRef.current === stick.id ? 4 : 2;
                context.beginPath();
                context.moveTo(viewportStart.x, viewportStart.y);
                context.lineTo(viewportEnd.x, viewportEnd.y);
                context.stroke();
                context.restore();
            });

            goalsRef.current.forEach((goal) => {
                const viewportPoint = toViewport(goal);
                context.save();
                if (goal.type === 'BLACK_HOLE') {
                    const gradient = context.createRadialGradient(viewportPoint.x, viewportPoint.y, 2, viewportPoint.x, viewportPoint.y, goal.size);
                    gradient.addColorStop(0, '#000000');
                    gradient.addColorStop(0.72, '#111827');
                    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.05)');
                    context.fillStyle = gradient;
                    context.beginPath();
                    context.arc(viewportPoint.x, viewportPoint.y, goal.size, 0, Math.PI * 2);
                    context.fill();
                    context.strokeStyle = 'rgba(196, 181, 253, 0.75)';
                    context.lineWidth = 2;
                    context.stroke();
                } else {
                    const width = goal.size * 1.45;
                    const height = goal.size;
                    context.strokeStyle = '#f4f4f5';
                    context.lineWidth = 3;
                    context.strokeRect(viewportPoint.x - width / 2, viewportPoint.y - height / 2, width, height);
                    context.strokeStyle = '#16a34a';
                    context.lineWidth = 2;
                    context.beginPath();
                    context.moveTo(viewportPoint.x - width / 2, viewportPoint.y - height / 2);
                    context.lineTo(viewportPoint.x - width / 2, viewportPoint.y + height / 2);
                    context.moveTo(viewportPoint.x + width / 2, viewportPoint.y - height / 2);
                    context.lineTo(viewportPoint.x + width / 2, viewportPoint.y + height / 2);
                    context.stroke();
                }
                context.restore();
            });

            const aim = aimRef.current;
            if (aim) {
                const ball = ballsRef.current.find((entry) => entry.id === aim.ballId);
                if (ball) {
                    const viewportBall = toViewport(ball);
                    const viewportAim = toViewport(aim.current);
                    context.save();
                    context.strokeStyle = '#f4f4f5';
                    context.globalAlpha = 0.82;
                    context.setLineDash([6, 6]);
                    context.lineWidth = 2;
                    context.beginPath();
                    context.moveTo(viewportBall.x, viewportBall.y);
                    context.lineTo(viewportAim.x, viewportAim.y);
                    context.stroke();
                    context.restore();
                }
            }

            ballsRef.current.forEach((ball) => {
                const viewportPoint = toViewport(ball);
                const isCaptured = ball.capturedUntil > now;
                context.save();
                context.shadowColor = isCaptured ? '#f4f4f5' : 'rgba(0, 0, 0, 0.45)';
                context.shadowBlur = isCaptured ? 18 : 8;
                const hasBallArtwork = ballImage.complete && ballImage.naturalWidth > 0;
                if (hasBallArtwork) {
                    context.drawImage(ballImage, viewportPoint.x - ball.radius, viewportPoint.y - ball.radius, ball.radius * 2, ball.radius * 2);
                } else {
                    context.fillStyle = isCaptured ? '#f4f4f5' : '#ffffff';
                    context.beginPath();
                    context.arc(viewportPoint.x, viewportPoint.y, ball.radius, 0, Math.PI * 2);
                    context.fill();
                    context.fillStyle = '#111827';
                    context.beginPath();
                    context.arc(viewportPoint.x - 4, viewportPoint.y - 3, 2.2, 0, Math.PI * 2);
                    context.arc(viewportPoint.x + 4, viewportPoint.y + 3, 2.2, 0, Math.PI * 2);
                    context.fill();
                }
                context.shadowBlur = 0;
                context.strokeStyle = '#1e293b';
                context.lineWidth = 2;
                context.beginPath();
                context.arc(viewportPoint.x, viewportPoint.y, ball.radius, 0, Math.PI * 2);
                context.stroke();
                if (ball.locked) {
                    context.strokeStyle = '#16a34a';
                    context.lineWidth = 2;
                    context.beginPath();
                    context.arc(viewportPoint.x, viewportPoint.y, ball.radius + 5, 0, Math.PI * 2);
                    context.stroke();
                }
                context.restore();
            });
        };

        const captureBall = (ball: Ball, goal: Goal, now: number) => {
            ball.locked = true;
            ball.vx = 0;
            ball.vy = 0;
            ball.capturedUntil = now + 500;
            setStatus(goal.type === 'BLACK_HOLE' ? 'Black hole captured the ball.' : 'Goal! Nice shot.');
        };

            const resolveBallAgainstSurface = (ball: Ball, surface: Surface) => {
            const closestX = clamp(ball.x, surface.left, surface.right);
            const closestY = clamp(ball.y, surface.top, surface.bottom);
            let normalX = ball.x - closestX;
            let normalY = ball.y - closestY;
            let distance = Math.sqrt(normalX * normalX + normalY * normalY);

            if (distance < 0.001) {
                const distances = [
                    { distance: Math.abs(ball.x - surface.left), x: -1, y: 0 },
                    { distance: Math.abs(surface.right - ball.x), x: 1, y: 0 },
                    { distance: Math.abs(ball.y - surface.top), x: 0, y: -1 },
                    { distance: Math.abs(surface.bottom - ball.y), x: 0, y: 1 }
                ].sort((a, b) => a.distance - b.distance);
                normalX = distances[0].x;
                normalY = distances[0].y;
                distance = distances[0].distance;
            }

            if (distance > ball.radius) {
                return;
            }

            const length = Math.sqrt(normalX * normalX + normalY * normalY) || 1;
            normalX /= length;
            normalY /= length;
            const penetration = ball.radius - distance + 0.4;
            ball.x += normalX * penetration;
            ball.y += normalY * penetration;

            const material = sampleMaterial({ x: closestX, y: closestY }) ?? DEFAULT_MATERIAL;
            const normalVelocity = ball.vx * normalX + ball.vy * normalY;
            if (normalVelocity < 0) {
                ball.vx -= (1 + material.restitution) * normalVelocity * normalX;
                ball.vy -= (1 + material.restitution) * normalVelocity * normalY;
            }
            const tangentX = -normalY;
            const tangentY = normalX;
            const tangentVelocity = ball.vx * tangentX + ball.vy * tangentY;
            ball.vx -= tangentVelocity * (1 - material.friction) * tangentX;
            ball.vy -= tangentVelocity * (1 - material.friction) * tangentY;
            ball.vx *= material.damping;
                ball.vy *= material.damping;
            };

        const resolveBallAgainstStick = (ball: Ball, stick: Stick) => {
            const dx = stick.end.x - stick.start.x;
            const dy = stick.end.y - stick.start.y;
            const lengthSquared = dx * dx + dy * dy || 1;
            const t = clamp(((ball.x - stick.start.x) * dx + (ball.y - stick.start.y) * dy) / lengthSquared, 0, 1);
            const closest = { x: stick.start.x + t * dx, y: stick.start.y + t * dy };
            let normalX = ball.x - closest.x;
            let normalY = ball.y - closest.y;
            let distance = Math.sqrt(normalX * normalX + normalY * normalY);
            if (distance < 0.001) {
                const length = Math.sqrt(lengthSquared);
                normalX = -dy / length;
                normalY = dx / length;
                distance = 0;
            }

            const collisionRadius = ball.radius + stick.thickness;
            if (distance > collisionRadius) {
                return;
            }

            const length = Math.sqrt(normalX * normalX + normalY * normalY) || 1;
            normalX /= length;
            normalY /= length;
            const penetration = collisionRadius - distance + 0.4;
            ball.x += normalX * penetration;
            ball.y += normalY * penetration;

            const material = sampleMaterial(closest) ?? DEFAULT_MATERIAL;
            const normalVelocity = ball.vx * normalX + ball.vy * normalY;
            if (normalVelocity < 0) {
                ball.vx -= (1 + material.restitution) * normalVelocity * normalX;
                ball.vy -= (1 + material.restitution) * normalVelocity * normalY;
            }
            const tangentX = -normalY;
            const tangentY = normalX;
            const tangentVelocity = ball.vx * tangentX + ball.vy * tangentY;
            ball.vx -= tangentVelocity * (1 - material.friction) * tangentX;
            ball.vy -= tangentVelocity * (1 - material.friction) * tangentY;
            ball.vx *= material.damping;
            ball.vy *= material.damping;
        };

        const step = (now: number) => {
            const delta = Math.min(Math.max((now - lastTime) / 1000, 0), 0.035);
            lastTime = now;
            emitWaterfallPaint(now);
            if (!pausedRef.current) {
                const { width, height } = getWorldSize();
                ballsRef.current.forEach((ball) => {
                    if (ball.capturedUntil > 0) {
                        return;
                    }
                    if (ball.locked) {
                        return;
                    }

                    const projectedPosition = {
                        x: ball.x + ball.vx * delta,
                        y: ball.y + ball.vy * delta
                    };
                    const material = sampleMaterialAlongPath(ball, projectedPosition) ?? sampleMaterial(ball);
                    const airMultiplier = material?.airMultiplier ?? 1;
                    const airScale = Math.pow(airMultiplier, delta * 2.4);
                    ball.vx *= airScale;
                    ball.vy = ball.vy * airScale + GRAVITY * delta;
                    ball.x += ball.vx * delta;
                    ball.y += ball.vy * delta;

                    const edgeMaterial = material ?? DEFAULT_MATERIAL;
                    if (ball.x - ball.radius < 0) {
                        ball.x = ball.radius;
                        ball.vx = Math.abs(ball.vx) * edgeMaterial.restitution;
                    } else if (ball.x + ball.radius > width) {
                        ball.x = width - ball.radius;
                        ball.vx = -Math.abs(ball.vx) * edgeMaterial.restitution;
                    }
                    if (ball.y - ball.radius < 0) {
                        ball.y = ball.radius;
                        ball.vy = Math.abs(ball.vy) * edgeMaterial.restitution;
                    } else if (ball.y + ball.radius > height) {
                        ball.y = height - ball.radius;
                        ball.vy = -Math.abs(ball.vy) * edgeMaterial.restitution;
                    }

                    surfacesRef.current.forEach((surface) => resolveBallAgainstSurface(ball, surface));
                    sticksRef.current.forEach((stick) => resolveBallAgainstStick(ball, stick));

                    goalsRef.current.forEach((goal) => {
                        const radius = goal.type === 'BLACK_HOLE' ? goal.size : goal.size * 0.34;
                        const target = { x: goal.x, y: goal.y };
                        if (distanceSquared(ball, target) <= (ball.radius + radius) ** 2) {
                            captureBall(ball, goal, now);
                        }
                    });

                    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                    if (speed > 1100) {
                        const scale = 1100 / speed;
                        ball.vx *= scale;
                        ball.vy *= scale;
                    }
                });
                ballsRef.current = ballsRef.current.filter((ball) => ball.capturedUntil === 0 || ball.capturedUntil > now);
            }

            draw(now);
            frame = window.requestAnimationFrame(step);
        };

        const pointFromEvent = (event: PointerEvent): Point => {
            const scroll = getPageScroll();
            return { x: event.clientX + scroll.x, y: event.clientY + scroll.y };
        };
        const findBall = (point: Point) => ballsRef.current.find((ball) => distanceSquared(ball, point) <= (ball.radius + 10) ** 2);
        const findGoal = (point: Point) => goalsRef.current.find((goal) => distanceSquared(goal, point) <= (goal.size + 16) ** 2);
        const findStick = (point: Point) => sticksRef.current.find((stick) => distanceToSegmentSquared(point, stick.start, stick.end) <= (stick.thickness + 14) ** 2);
        const moveGoal = (goal: Goal, point: Point) => {
            const { width, height } = getWorldSize();
            const padding = goal.type === 'BLACK_HOLE' ? goal.size : goal.size * 0.8;
            goal.x = clamp(point.x + (goalDragRef.current?.offset.x ?? 0), padding, width - padding);
            goal.y = clamp(point.y + (goalDragRef.current?.offset.y ?? 0), 8, height - padding);
        };
        const emitWaterfallPaint = (now: number) => {
            const emitter = waterfallRef.current;
            const stroke = paintStrokeRef.current;
            if (!emitter || !stroke || now - emitter.lastEmit < 45) {
                return;
            }
            const { height } = getWorldSize();
            const elapsed = Math.min(now - emitter.lastEmit, 180);
            emitter.lastEmit = now;
            emitter.y = Math.min(height + brushRadiusRef.current, emitter.y + elapsed * 0.16);
            const drift = Math.sin(now / 180) * 2;
            stroke.points.push({ x: emitter.x + drift, y: emitter.y });
            if (stroke.points.length > 260) {
                stroke.points.shift();
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            const point = pointFromEvent(event);
            const blockingControl = isBlockingControlTarget(event.target);
            const ball = findBall(point);
            if (ball && !blockingControl) {
                ball.locked = true;
                aimRef.current = { ballId: ball.id, current: point, moved: false };
                event.preventDefault();
                setStatus('Ball frozen. Drag away from it to aim, then release.');
                return;
            }

            const goal = findGoal(point);
            if (goal && !blockingControl) {
                goalDragRef.current = { goalId: goal.id, offset: { x: goal.x - point.x, y: goal.y - point.y } };
                event.preventDefault();
                setStatus('Target selected. Drag it to a new position.');
                return;
            }

            const stick = findStick(point);
            if (stick && !blockingControl) {
                setSelectedStickId(stick.id);
                setSelectedStickColor(stick.color);
                const center = { x: (stick.start.x + stick.end.x) / 2, y: (stick.start.y + stick.end.y) / 2 };
                stickDragRef.current = { stickId: stick.id, offset: { x: center.x - point.x, y: center.y - point.y } };
                event.preventDefault();
                setStatus('Obstacle selected. Drag it to shape the route.');
                return;
            }

            const movableSurface = event.target instanceof Element
                ? event.target.closest<HTMLElement>('[data-bounce-surface]')
                : null;
            const surfaceId = movableSurface?.dataset.bounceSurface;
            if (active && movableSurface && surfaceId !== 'map-card' && surfaceId !== 'login-card' && !blockingControl) {
                const origin = {
                    x: Number(movableSurface.dataset.playgroundX ?? 0),
                    y: Number(movableSurface.dataset.playgroundY ?? 0)
                };
                surfaceDragRef.current = { element: movableSurface, start: point, origin, moved: false };
                event.preventDefault();
                setStatus('Page card selected. Drag it to reposition the surface.');
                return;
            }

            if (isProtectedTarget(event.target)) {
                return;
            }

            if (paintMode) {
                const stroke: PaintStroke = {
                    id: nextIdRef.current++,
                    material: selectedMaterialRef.current,
                    radius: brushRadiusRef.current,
                    points: [point]
                };
                strokesRef.current = [...strokesRef.current.slice(-(MAX_STROKES - 1)), stroke];
                paintStrokeRef.current = stroke;
                setHasPlaygroundContent(true);
                event.preventDefault();
                if (sprayModeRef.current === 'waterfall') {
                    waterfallRef.current = { x: point.x, y: point.y, lastEmit: performance.now() - 60 };
                    setStatus(`Waterfall spraying ${MATERIALS[stroke.material].label.toLocaleLowerCase()}.`);
                } else {
                    waterfallRef.current = null;
                    setStatus(`Spraying ${MATERIALS[stroke.material].label.toLocaleLowerCase()}.`);
                }
            }
        };

        const handlePointerMove = (event: PointerEvent) => {
            const point = pointFromEvent(event);
            if (aimRef.current) {
                const aim = aimRef.current;
                const ball = ballsRef.current.find((entry) => entry.id === aim.ballId);
                if (ball) {
                    aim.moved = aim.moved || distanceSquared(ball, point) > 16;
                    aim.current = point;
                    event.preventDefault();
                }
                return;
            }

            if (goalDragRef.current) {
                const goal = goalsRef.current.find((entry) => entry.id === goalDragRef.current?.goalId);
                if (goal) {
                    moveGoal(goal, point);
                    event.preventDefault();
                }
                return;
            }

            if (stickDragRef.current) {
                const stick = sticksRef.current.find((entry) => entry.id === stickDragRef.current?.stickId);
                if (stick) {
                    const center = { x: (stick.start.x + stick.end.x) / 2, y: (stick.start.y + stick.end.y) / 2 };
                    const nextCenter = { x: point.x + stickDragRef.current.offset.x, y: point.y + stickDragRef.current.offset.y };
                    const delta = { x: nextCenter.x - center.x, y: nextCenter.y - center.y };
                    stick.start.x += delta.x;
                    stick.start.y += delta.y;
                    stick.end.x += delta.x;
                    stick.end.y += delta.y;
                    event.preventDefault();
                }
                return;
            }

            if (surfaceDragRef.current) {
                const drag = surfaceDragRef.current;
                const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
                drag.moved = drag.moved || Math.abs(delta.x) + Math.abs(delta.y) > 4;
                const nextX = drag.origin.x + delta.x;
                const nextY = drag.origin.y + delta.y;
                drag.element.dataset.playgroundX = `${nextX}`;
                drag.element.dataset.playgroundY = `${nextY}`;
                drag.element.style.setProperty('translate', `${nextX}px ${nextY}px`);
                measureSurfaces();
                event.preventDefault();
                return;
            }

            if (waterfallRef.current) {
                waterfallRef.current.x = point.x;
                event.preventDefault();
                return;
            }

            const stroke = paintStrokeRef.current;
            if (sprayModeRef.current === 'brush' && stroke && distanceSquared(stroke.points[stroke.points.length - 1], point) > 16) {
                stroke.points.push(point);
                event.preventDefault();
            }
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (aimRef.current) {
                const aim = aimRef.current;
                const ball = ballsRef.current.find((entry) => entry.id === aim.ballId);
                if (ball && aim.moved) {
                    const impulseX = clamp((ball.x - aim.current.x) * 3.4, -850, 850);
                    const impulseY = clamp((ball.y - aim.current.y) * 3.4, -850, 850);
                    ball.vx = impulseX;
                    ball.vy = impulseY;
                    ball.locked = false;
                    setStatus('Shot launched. Add paint or a target to try another route.');
                } else if (ball) {
                    setStatus('Ball is frozen. Drag away from it to aim a shot.');
                }
                aimRef.current = null;
                event.preventDefault();
            }
            goalDragRef.current = null;
            stickDragRef.current = null;
            if (surfaceDragRef.current?.moved) {
                setStatus('Page card moved. Reset all restores its original position.');
            }
            surfaceDragRef.current = null;
            waterfallRef.current = null;
            paintStrokeRef.current = null;
        };

        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('scroll', measureSurfaces, { passive: true });
        window.addEventListener('pointerdown', handlePointerDown, { passive: false });
        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp, { passive: false });
        window.addEventListener('pointercancel', handlePointerUp, { passive: false });
        frame = window.requestAnimationFrame(step);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', measureSurfaces);
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            window.cancelAnimationFrame(frame);
            aimRef.current = null;
            goalDragRef.current = null;
            stickDragRef.current = null;
            surfaceDragRef.current = null;
            waterfallRef.current = null;
            paintStrokeRef.current = null;
        };
    }, [active, isPlaygroundRunning, measureSurfaces, paintMode, sampleMaterial, sampleMaterialAlongPath]);

    return (
        <>
            <div className="fixed left-0 top-0 z-[1400]" style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }} data-playground-control onPointerDown={startPanelDrag}>
                {!active ? (
                    <div className="flex items-center gap-1 rounded-full border border-[#ffffff1a] bg-[#16181d]/95 p-1 shadow-lg backdrop-blur-md">
                        <span role="button" tabIndex={0} data-playground-panel-handle onPointerDown={startPanelDrag} className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-full text-[#71717a] hover:bg-[#ffffff0d] hover:text-[#f4f4f5]" aria-label="Move playground panel">
                            <GripVertical className="h-4 w-4" />
                        </span>
                        <button
                            type="button"
                            onClick={openPlayground}
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-[#f4f4f5] transition-colors hover:text-[#86efac]"
                            aria-label="Open football playground"
                        >
                            <CircleDot className="h-4 w-4 text-[#86efac]" />
                            Playground
                        </button>
                    </div>
                ) : (
                    <div className="w-[min(92vw,330px)] rounded-2xl border border-[#ffffff1a] bg-[#111318]/95 p-3 text-[#f4f4f5] shadow-2xl backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <span role="button" tabIndex={0} data-playground-panel-handle onPointerDown={startPanelDrag} className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-[#71717a] hover:bg-[#ffffff0d] hover:text-[#f4f4f5]" aria-label="Move playground panel">
                                    <GripVertical className="h-4 w-4" />
                                </span>
                                <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#86efac]">Landing playground</p>
                                <p className="mt-1 text-sm font-semibold">Page edges are the pitch.</p>
                                </div>
                            </div>
                            <button type="button" data-playground-control onClick={closePlayground} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#a1a1aa] transition-colors hover:bg-[#ffffff0d] hover:text-[#f4f4f5]" aria-label="Close football playground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-[#a1a1aa]" role="status" aria-live="polite">{status}</p>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button type="button" data-playground-control onClick={() => addBall()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-xs font-semibold text-[#f4f4f5] hover:border-[#86efac]/50">
                                <Plus className="h-3.5 w-3.5 text-[#86efac]" /> Drop ball
                            </button>
                            <button type="button" data-playground-control onClick={() => addGoal('GOAL')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-xs font-semibold text-[#f4f4f5] hover:border-[#86efac]/50">
                                <Target className="h-3.5 w-3.5 text-[#86efac]" /> Add goal
                            </button>
                            <button type="button" data-playground-control onClick={() => addGoal('BLACK_HOLE')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-xs font-semibold text-[#f4f4f5] hover:border-violet-300/50">
                                <CircleDot className="h-3.5 w-3.5 text-violet-300" /> Black hole
                            </button>
                            <button type="button" data-playground-control onClick={addStick} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-xs font-semibold text-[#f4f4f5] hover:border-sky-300/50">
                                <Minus className="h-3.5 w-3.5 text-sky-300" /> Add stick
                            </button>
                            <button type="button" data-playground-control onClick={() => setPaused((current) => !current)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-xs font-semibold text-[#f4f4f5] hover:border-[#ffffff2b]">
                                {paused ? <Play className="h-3.5 w-3.5 text-[#86efac]" /> : <Pause className="h-3.5 w-3.5 text-[#facc15]" />}
                                {paused ? 'Resume' : 'Pause'}
                            </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ffffff0d] pt-3" data-playground-control>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Black-hole size</p>
                            <div className="flex gap-1 rounded-lg bg-[#16181d] p-1">
                                {(['small', 'medium', 'large'] as const).map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        data-playground-control
                                        onClick={() => setBlackHoleSize(size)}
                                        className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize ${blackHoleSize === size ? 'bg-violet-300/20 text-violet-200' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
                                        aria-pressed={blackHoleSize === size}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedStickId !== null && (
                            <div className="mt-3 space-y-2 border-t border-[#ffffff0d] pt-3" data-playground-control>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Selected obstacle</p>
                                    <div className="flex gap-1">
                                        <button type="button" data-playground-control onClick={() => rotateSelectedStick(-1)} className="inline-flex items-center gap-1 rounded-md border border-[#ffffff0d] px-2 py-1 text-[10px] font-semibold text-[#a1a1aa] hover:border-[#ffffff2b] hover:text-[#f4f4f5]" aria-label="Rotate obstacle counter-clockwise">
                                            <RotateCcw className="h-3 w-3" /> -15°
                                        </button>
                                        <button type="button" data-playground-control onClick={() => rotateSelectedStick(1)} className="inline-flex items-center gap-1 rounded-md border border-[#ffffff0d] px-2 py-1 text-[10px] font-semibold text-[#a1a1aa] hover:border-[#ffffff2b] hover:text-[#f4f4f5]" aria-label="Rotate obstacle clockwise">
                                            <RotateCw className="h-3 w-3" /> +15°
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[#71717a]">Color</span>
                                    <div className="flex gap-1.5">
                                        {STICK_COLOR_KEYS.map((key) => (
                                        <button key={key} type="button" data-playground-control onClick={() => colorSelectedStick(key)} className={`h-5 w-5 rounded-full border-2 ${selectedStickColor === key ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: STICK_COLORS[key].color }} aria-label={`Set obstacle color to ${STICK_COLORS[key].label}`} aria-pressed={selectedStickColor === key} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" data-playground-control onClick={() => setPaintMode((current) => !current)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${paintMode ? 'border-[#facc15]/70 bg-[#facc15]/10 text-[#fef08a]' : 'border-[#ffffff0d] bg-[#16181d] text-[#f4f4f5] hover:border-[#facc15]/50'}`}>
                                <Brush className="h-3.5 w-3.5" /> {paintMode ? 'Painting on' : 'Paint'}
                            </button>
                            <button type="button" data-playground-control onClick={resetPlayground} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-xs font-semibold text-[#a1a1aa] hover:border-[#ffffff2b] hover:text-[#f4f4f5]">
                                <RotateCcw className="h-3.5 w-3.5" /> Reset all
                            </button>
                        </div>

                        {paintMode && (
                            <div className="mt-3 border-t border-[#ffffff0d] pt-3" data-playground-control>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Spray material</p>
                                    <div className="flex gap-1">
                                        {(['small', 'large'] as const).map((size) => (
                                            <button key={size} type="button" data-playground-control onClick={() => setBrushSize(size)} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${brushSize === size ? 'bg-[#ffffff1a] text-[#f4f4f5]' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}>
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                    {(['brush', 'waterfall'] as const).map((mode) => (
                                        <button key={mode} type="button" data-playground-control onClick={() => setSprayMode(mode)} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold capitalize ${sprayMode === mode ? 'border-[#ffffff66] bg-[#ffffff0d] text-[#f4f4f5]' : 'border-[#ffffff0d] text-[#a1a1aa] hover:border-[#ffffff2b] hover:text-[#f4f4f5]'}`} aria-pressed={sprayMode === mode}>
                                            {mode === 'waterfall' ? 'Waterfall spray' : 'Brush spray'}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                    {MATERIAL_KEYS.map((key) => {
                                        const material = MATERIALS[key];
                                        return (
                                            <button key={key} type="button" data-playground-control onClick={() => setSelectedMaterial(key)} className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-[10px] font-semibold transition-colors ${selectedMaterial === key ? 'border-[#ffffff66] bg-[#ffffff0d] text-[#f4f4f5]' : 'border-[#ffffff0d] text-[#a1a1aa] hover:border-[#ffffff2b] hover:text-[#f4f4f5]'}`}>
                                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: material.color }} />
                                                {material.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button type="button" data-playground-control onClick={undoPaint} className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[#ffffff0d] bg-[#16181d] px-2.5 py-2 text-[10px] font-semibold text-[#a1a1aa] hover:border-[#ffffff2b] hover:text-[#f4f4f5]">
                                    Undo last stroke
                                </button>
                                <p className="mt-2 text-[10px] leading-4 text-[#71717a]">Spray walls, obstacles, or small background strips. Paint changes physics only.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {isPlaygroundRunning && <canvas ref={canvasRef} aria-hidden="true" className="landing-playground-canvas fixed inset-0 z-[1350] pointer-events-none" />}
        </>
    );
};
