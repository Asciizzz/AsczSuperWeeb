import { Texture } from "../texture.js";

/**
 * Mathematical color palette interpolator returning RGBA bytes [0..255].
 */
export type ColorPaletteFn = (t: number) => [number, number, number, number];

// Default Electric Cosmic Palette
export const ELECTRIC_PALETTE: ColorPaletteFn = (t: number) => {
    // Cosine-based procedural palette: a + b * cos(2*PI*(c*t + d))
    const r = Math.round((0.5 + 0.5 * Math.cos(6.28318 * (1.0 * t + 0.00))) * 255);
    const g = Math.round((0.5 + 0.5 * Math.cos(6.28318 * (1.0 * t + 0.33))) * 255);
    const b = Math.round((0.5 + 0.5 * Math.cos(6.28318 * (1.0 * t + 0.67))) * 255);
    return [r, g, b, 255];
};

// Fire & Ember Palette
export const FIRE_PALETTE: ColorPaletteFn = (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    const r = Math.round(Math.min(1, clamped * 2.5) * 255);
    const g = Math.round(Math.max(0, Math.min(1, (clamped - 0.25) * 2.0)) * 255);
    const b = Math.round(Math.max(0, Math.min(1, (clamped - 0.65) * 3.0)) * 255);
    return [r, g, b, 255];
};

// Ocean Deep Caustic Palette
export const OCEAN_PALETTE: ColorPaletteFn = (t: number) => {
    const r = Math.round((0.1 + 0.3 * Math.cos(6.28318 * (1.0 * t + 0.1))) * 255);
    const g = Math.round((0.6 + 0.4 * Math.cos(6.28318 * (1.0 * t + 0.3))) * 255);
    const b = Math.round((0.85 + 0.15 * Math.cos(6.28318 * (1.0 * t + 0.5))) * 255);
    return [r, g, b, 255];
};

// Monochrome Grayscale Palette
export const GRAYSCALE_PALETTE: ColorPaletteFn = (t: number) => {
    const v = Math.round(Math.max(0, Math.min(1, t)) * 255);
    return [v, v, v, 255];
};

export const PROCEDURAL_PALETTES = {
    ocean: OCEAN_PALETTE,
    electric: ELECTRIC_PALETTE,
    fire: FIRE_PALETTE,
    grayscale: GRAYSCALE_PALETTE,
} as const;

export type ProceduralPaletteName = keyof typeof PROCEDURAL_PALETTES;

function resolveBuffer(width: number, height: number, target?: Texture): Uint8Array {
    const needed = width * height * 4;
    if (target && target.data && target.data.length === needed) {
        return target.data;
    }
    return new Uint8Array(needed);
}

function finishTexture(name: string, width: number, height: number, data: Uint8Array, target?: Texture): Texture {
    if (target) {
        target.width = width;
        target.height = height;
        target.data = data;
        return target;
    }
    return new Texture(name, width, height, data);
}

/**
 * Procedural Mandelbrot Fractal Texture.
 * Evaluates the complex plane quadratic recurrence z_{n+1} = z_n^2 + c.
 */
export function createMandelbrotTexture(options: {
    width?: number;
    height?: number;
    maxIter?: number;
    zoom?: number;
    centerX?: number;
    centerY?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const maxIter = options.maxIter ?? 64;
    const zoom = options.zoom ?? 1.0;
    const centerX = options.centerX ?? -0.7;
    const centerY = options.centerY ?? 0.0;
    const palette = options.palette ?? ELECTRIC_PALETTE;
    const name = options.name ?? "MandelbrotTexture";

    const data = resolveBuffer(width, height, options.target);
    const scale = 2.8 / (zoom * Math.min(width, height));

    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const cRe = centerX + (px - width / 2) * scale;
            const cIm = centerY + (py - height / 2) * scale;

            let zRe = 0;
            let zIm = 0;
            let iter = 0;

            while (zRe * zRe + zIm * zIm <= 4.0 && iter < maxIter) {
                const nextRe = zRe * zRe - zIm * zIm + cRe;
                const nextIm = 2.0 * zRe * zIm + cIm;
                zRe = nextRe;
                zIm = nextIm;
                iter++;
            }

            let t = 0;
            if (iter < maxIter) {
                // Smooth continuous potential coloring
                const magSq = zRe * zRe + zIm * zIm;
                const nu = Math.log(Math.log(magSq) / 2) / Math.LN2;
                t = (iter + 1 - nu) / maxIter;
            }

            const color = palette(t);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

/**
 * Procedural Julia Set Fractal Texture.
 * Evaluates z_{n+1} = z_n^2 + c with a fixed complex constant c.
 */
export function createJuliaTexture(options: {
    width?: number;
    height?: number;
    cRe?: number;
    cIm?: number;
    maxIter?: number;
    zoom?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const cRe = options.cRe ?? -0.7;
    const cIm = options.cIm ?? 0.27015;
    const maxIter = options.maxIter ?? 64;
    const zoom = options.zoom ?? 1.1;
    const palette = options.palette ?? ELECTRIC_PALETTE;
    const name = options.name ?? "JuliaTexture";

    const data = resolveBuffer(width, height, options.target);
    const scale = 2.6 / (zoom * Math.min(width, height));

    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            let zRe = (px - width / 2) * scale;
            let zIm = (py - height / 2) * scale;
            let iter = 0;

            while (zRe * zRe + zIm * zIm <= 4.0 && iter < maxIter) {
                const nextRe = zRe * zRe - zIm * zIm + cRe;
                const nextIm = 2.0 * zRe * zIm + cIm;
                zRe = nextRe;
                zIm = nextIm;
                iter++;
            }

            let t = 0;
            if (iter < maxIter) {
                const magSq = zRe * zRe + zIm * zIm;
                const nu = Math.log(Math.log(magSq) / 2) / Math.LN2;
                t = (iter + 1 - nu) / maxIter;
            }

            const color = palette(t);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

/**
 * Procedural Voronoi / Worley Cellular Noise Texture.
 * Calculates shortest Euclidean distance to feature points for biological cells or cobblestones.
 */
export function createVoronoiTexture(options: {
    width?: number;
    height?: number;
    cellsX?: number;
    cellsY?: number;
    mode?: "distance" | "borders" | "cells";
    time?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const cellsX = options.cellsX ?? 8;
    const cellsY = options.cellsY ?? 8;
    const mode = options.mode ?? "distance";
    const time = options.time ?? 0;
    const palette = options.palette ?? OCEAN_PALETTE;
    const name = options.name ?? "VoronoiTexture";

    const points: Array<{ x: number; y: number; id: number }> = [];
    let idCounter = 0;
    for (let cy = 0; cy < cellsY; cy++) {
        for (let cx = 0; cx < cellsX; cx++) {
            const hash1 = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
            const hash2 = Math.cos(cx * 39.346 + cy * 11.135) * 23421.6312;
            const baseJx = hash1 - Math.floor(hash1);
            const baseJy = hash2 - Math.floor(hash2);
            const jx = (cx + (time === 0 ? baseJx : 0.5 + 0.35 * Math.sin(time * 1.5 + cx * 2.1 + cy * 1.3))) / cellsX;
            const jy = (cy + (time === 0 ? baseJy : 0.5 + 0.35 * Math.cos(time * 1.5 + cy * 2.1 + cx * 1.3))) / cellsY;
            points.push({ x: jx, y: jy, id: ++idCounter });
        }
    }

    const data = resolveBuffer(width, height, options.target);

    for (let py = 0; py < height; py++) {
        const ny = py / height;
        for (let px = 0; px < width; px++) {
            const nx = px / width;

            let d1 = Infinity;
            let d2 = Infinity;
            let closestId = 0;

            for (const pt of points) {
                let dx = Math.abs(nx - pt.x);
                let dy = Math.abs(ny - pt.y);
                if (dx > 0.5) dx = 1.0 - dx;
                if (dy > 0.5) dy = 1.0 - dy;

                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < d1) {
                    d2 = d1;
                    d1 = dist;
                    closestId = pt.id;
                } else if (dist < d2) {
                    d2 = dist;
                }
            }

            let t = 0;
            if (mode === "distance") {
                t = Math.min(1.0, d1 * (cellsX * 0.7));
            } else if (mode === "borders") {
                t = Math.max(0.0, Math.min(1.0, (d2 - d1) * cellsX * 1.5));
            } else if (mode === "cells") {
                t = (closestId % 17) / 17;
            }

            const color = palette(t);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

/**
 * 2D Gradient Noise helper for smooth continuous procedural patterns.
 */
function valueNoise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Smooth cubic Hermite curve
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const hash = (u: number, v: number) => {
        const h = Math.sin(u * 127.1 + v * 311.7) * 43758.5453123;
        return h - Math.floor(h);
    };

    const v00 = hash(ix, iy);
    const v10 = hash(ix + 1, iy);
    const v01 = hash(ix, iy + 1);
    const v11 = hash(ix + 1, iy + 1);

    const bot = v00 + sx * (v10 - v00);
    const top = v01 + sx * (v11 - v01);
    return bot + sy * (top - bot);
}

/**
 * Procedural Fractal Brownian Motion (fBm / Turbulence) Texture.
 * Generates natural marble veins, clouds, or rocky landscape textures.
 */
export function createFbmNoiseTexture(options: {
    width?: number;
    height?: number;
    octaves?: number;
    frequency?: number;
    persistence?: number;
    mode?: "clouds" | "marble" | "turbulence";
    time?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const octaves = options.octaves ?? 5;
    const frequency = options.frequency ?? 4.0;
    const persistence = options.persistence ?? 0.5;
    const mode = options.mode ?? "marble";
    const time = options.time ?? 0;
    const palette = options.palette ?? FIRE_PALETTE;
    const name = options.name ?? "FbmNoiseTexture";

    const data = resolveBuffer(width, height, options.target);

    for (let py = 0; py < height; py++) {
        const ny = py / height;
        for (let px = 0; px < width; px++) {
            const nx = px / width;

            let total = 0;
            let amp = 1.0;
            let freq = frequency;
            let maxVal = 0;

            for (let o = 0; o < octaves; o++) {
                const n = valueNoise(nx * freq + time * 0.15, ny * freq + time * 0.1);
                if (mode === "turbulence") {
                    total += Math.abs(n * 2.0 - 1.0) * amp;
                } else {
                    total += n * amp;
                }
                maxVal += amp;
                amp *= persistence;
                freq *= 2.0;
            }

            let t = total / maxVal;

            if (mode === "marble") {
                t = 0.5 + 0.5 * Math.sin((nx * 4.0 + total * 2.5 + time * 0.5) * Math.PI);
            }

            const color = palette(t);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

/**
 * Procedural Wave Ripple Interference Texture.
 * Multiplies radial wave functions with linear ripples for water pool caustics.
 */
export function createWaveRippleTexture(options: {
    width?: number;
    height?: number;
    ripples?: number;
    rings?: number;
    phase?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const ripples = options.ripples ?? 6.0;
    const rings = options.rings ?? 14.0;
    const phase = options.phase ?? 0;
    const palette = options.palette ?? OCEAN_PALETTE;
    const name = options.name ?? "WaveRippleTexture";

    const data = resolveBuffer(width, height, options.target);

    for (let py = 0; py < height; py++) {
        const ny = (py / height) - 0.5;
        for (let px = 0; px < width; px++) {
            const nx = (px / width) - 0.5;

            const dist1 = Math.sqrt(nx * nx + ny * ny);
            const dist2 = Math.sqrt((nx - 0.2) * (nx - 0.2) + (ny - 0.2) * (ny - 0.2));
            const dist3 = Math.sqrt((nx + 0.25) * (nx + 0.25) + (ny + 0.15) * (ny + 0.15));

            const wave1 = Math.sin(dist1 * rings * Math.PI * 2.0 - phase * 3.0);
            const wave2 = Math.sin(dist2 * rings * 0.8 * Math.PI * 2.0 - phase * 2.4);
            const wave3 = Math.cos((nx + ny) * ripples * Math.PI * 2.0 + phase * 1.8);

            const combined = (wave1 + wave2 + wave3) / 3.0;
            const t = 0.5 + 0.5 * combined;

            const color = palette(t);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

/**
 * Procedural Logarithmic Spiral Galaxy Texture.
 * Evaluates polar space coordinates (r, theta) for cosmic vortex patterns.
 */
export function createPolarSpiralTexture(options: {
    width?: number;
    height?: number;
    arms?: number;
    twist?: number;
    rotation?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const arms = options.arms ?? 4;
    const twist = options.twist ?? 5.0;
    const rotation = options.rotation ?? 0;
    const palette = options.palette ?? ELECTRIC_PALETTE;
    const name = options.name ?? "PolarSpiralTexture";

    const data = resolveBuffer(width, height, options.target);

    for (let py = 0; py < height; py++) {
        const ny = (py / height) - 0.5;
        for (let px = 0; px < width; px++) {
            const nx = (px / width) - 0.5;

            const r = Math.sqrt(nx * nx + ny * ny);
            const theta = Math.atan2(ny, nx) + rotation;

            // Logarithmic spiral angle
            const spiral = Math.sin(theta * arms + Math.log(r + 0.001) * twist);
            const falloff = Math.max(0, 1.0 - r * 2.0);
            const t = (0.5 + 0.5 * spiral) * falloff;

            const color = palette(t);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

/**
 * Procedural Checker Matrix Texture with customizable palette.
 */
export function createProceduralCheckerTexture(options: {
    width?: number;
    height?: number;
    divisions?: number;
    palette?: ColorPaletteFn;
    name?: string;
    target?: Texture;
} = {}): Texture {
    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const divisions = options.divisions ?? 8;
    const palette = options.palette ?? ELECTRIC_PALETTE;
    const name = options.name ?? "ProceduralCheckerTexture";

    const data = resolveBuffer(width, height, options.target);
    const blockSize = Math.max(1, Math.floor(width / divisions));

    for (let py = 0; py < height; py++) {
        const by = Math.floor(py / blockSize);
        for (let px = 0; px < width; px++) {
            const bx = Math.floor(px / blockSize);
            const isCheck = (bx + by) % 2 === 0;
            const color = isCheck ? palette(0.9) : palette(0.1);
            const idx = (py * width + px) * 4;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }

    return finishTexture(name, width, height, data, options.target);
}

export type ProceduralPatternType =
    | "wave_ripple"
    | "mandelbrot"
    | "julia"
    | "voronoi_cells"
    | "voronoi_scales"
    | "fbm_marble"
    | "spiral"
    | "checker";

export interface ProceduralTextureOptions {
    pattern: ProceduralPatternType | string;
    palette?: ColorPaletteFn | ProceduralPaletteName;
    freq?: number;
    detail?: number;
    time?: number;
    width?: number;
    height?: number;
    target?: Texture;
    name?: string;
}

/**
 * Unified generator dispatcher for procedural mathematical textures.
 */
export function createProceduralTexture(options: ProceduralTextureOptions): Texture {
    const paletteFn = typeof options.palette === "string"
        ? (PROCEDURAL_PALETTES[options.palette as ProceduralPaletteName] ?? OCEAN_PALETTE)
        : (options.palette ?? OCEAN_PALETTE);

    const width = options.width ?? 256;
    const height = options.height ?? 256;
    const freq = options.freq ?? 8;
    const detail = options.detail ?? 5;
    const time = options.time ?? 0;
    const target = options.target;
    const name = options.name ?? `Procedural_${options.pattern}`;

    switch (options.pattern) {
        case "wave_ripple":
            return createWaveRippleTexture({
                width,
                height,
                ripples: freq * 0.8,
                rings: freq * 1.6,
                phase: time,
                palette: paletteFn,
                name,
                target,
            });
        case "mandelbrot":
            return createMandelbrotTexture({
                width,
                height,
                maxIter: Math.min(128, Math.round(detail * 16)),
                zoom: (freq / 4.0) * (1.0 + Math.sin(time * 0.3) * 0.15),
                palette: paletteFn,
                name,
                target,
            });
        case "julia":
            return createJuliaTexture({
                width,
                height,
                cRe: -0.7 + 0.08 * Math.cos(time * 0.6),
                cIm: 0.27015 + 0.06 * Math.sin(time * 0.6),
                maxIter: Math.min(128, Math.round(detail * 16)),
                zoom: freq / 4.0,
                palette: paletteFn,
                name,
                target,
            });
        case "voronoi_cells":
            return createVoronoiTexture({
                width,
                height,
                cellsX: Math.max(3, Math.round(freq)),
                cellsY: Math.max(3, Math.round(freq)),
                mode: "cells",
                time,
                palette: paletteFn,
                name,
                target,
            });
        case "voronoi_scales":
            return createVoronoiTexture({
                width,
                height,
                cellsX: Math.max(3, Math.round(freq)),
                cellsY: Math.max(3, Math.round(freq)),
                mode: "borders",
                time,
                palette: paletteFn,
                name,
                target,
            });
        case "fbm_marble":
            return createFbmNoiseTexture({
                width,
                height,
                octaves: Math.max(1, Math.min(8, Math.round(detail))),
                frequency: freq * 0.6,
                mode: "marble",
                time,
                palette: paletteFn,
                name,
                target,
            });
        case "spiral":
            return createPolarSpiralTexture({
                width,
                height,
                arms: Math.max(2, Math.round(freq * 0.5)),
                twist: detail * 1.5,
                rotation: time,
                palette: paletteFn,
                name,
                target,
            });
        case "checker":
            return createProceduralCheckerTexture({
                width,
                height,
                divisions: Math.max(2, Math.round(freq)),
                palette: paletteFn,
                name,
                target,
            });
        default:
            return createWaveRippleTexture({ width, height, palette: paletteFn, name, target });
    }
}
