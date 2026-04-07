# BIGSPACE UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign BIGSPACE from generic GIS tool to polished Felt.com-style SaaS — light theme default, dark toggle, 150-layer sidebar, calm teal accent.

**Architecture:** Design tokens first (CSS variables → Tailwind), then sidebar decomposition (800-line monolith → focused components), then map controls, login page, and feedback states. Each task produces a visually verifiable result.

**Tech Stack:** Tailwind CSS variables, Pretendard font, react-window (virtual scroll), @dnd-kit (drag), shadcn/ui (existing), Lucide icons (existing)

**Design Spec:** `docs/superpowers/specs/2026-04-06-ui-redesign-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `client/src/components/sidebar/SidebarHeader.tsx` | Logo + collapse button |
| `client/src/components/sidebar/LayerSearch.tsx` | Search/filter input |
| `client/src/components/sidebar/LayerGroup.tsx` | Collapsible group with batch toggle |
| `client/src/components/sidebar/LayerRow.tsx` | Compact 32px layer row |
| `client/src/components/sidebar/LayerList.tsx` | Virtual scroll container + drag context |
| `client/src/components/sidebar/SidebarFooter.tsx` | User info + theme toggle + logout |
| `client/src/components/map/MapLoadingIndicator.tsx` | WFS/MVT loading spinner overlay |

### Modified files
| File | Changes |
|------|---------|
| `client/src/index.css` | Replace all CSS variables with new design tokens |
| `tailwind.config.ts` | Update font families, add custom spacing/radius tokens |
| `client/src/components/app-sidebar.tsx` | Rewrite to compose new sub-components |
| `client/src/components/map-viewer.tsx` | Update control styling, add loading indicator |
| `client/src/components/map/MapSearchBox.tsx` | Light theme glass style |
| `client/src/components/map/ZoomControl.tsx` | Integrated zoom+level display |
| `client/src/components/map/BasemapPicker.tsx` | Thumbnail dropdown picker |
| `client/src/pages/auth-page.tsx` | Centered card layout |
| `client/src/components/theme-provider.tsx` | Add system preference detection |
| `client/index.html` | Add Pretendard + JetBrains Mono font links |

---

## Task 1: Design Tokens — CSS Variables + Fonts

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/index.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add font links to index.html**

Add Pretendard (CDN) and JetBrains Mono (Google Fonts) to `<head>`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Replace CSS variables in index.css**

Replace the entire `:root` block with the new design tokens. Key changes:
- Font: `Open Sans` → `"Pretendard Variable", Pretendard`
- Font mono: `Menlo` → `"JetBrains Mono"`
- Primary color: `190 85% 38%` → `170 76% 31%` (teal `#0D9488`)
- Background: `210 20% 98%` → `0 0% 100%` (pure white)
- Sidebar: `210 16% 94%` → `0 0% 100%` (white, not gray)
- Enable real shadows (currently all 0.00 alpha)

```css
:root {
  --button-outline: rgba(0,0,0, .08);
  --badge-outline: rgba(0,0,0, .05);
  --opaque-button-border-intensity: -6;
  --elevate-1: rgba(0,0,0, .03);
  --elevate-2: rgba(0,0,0, .06);
  --background: 210 17% 98%;
  --foreground: 220 15% 11%;
  --border: 220 13% 91%;
  --card: 220 14% 97%;
  --card-foreground: 220 15% 11%;
  --card-border: 220 13% 93%;
  --sidebar: 0 0% 100%;
  --sidebar-foreground: 220 15% 11%;
  --sidebar-border: 220 13% 91%;
  --sidebar-primary: 170 76% 31%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 220 14% 96%;
  --sidebar-accent-foreground: 220 15% 15%;
  --sidebar-ring: 170 76% 31%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 15% 11%;
  --popover-border: 220 13% 91%;
  --primary: 170 76% 31%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 220 9% 46%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --accent: 220 14% 96%;
  --accent-foreground: 220 15% 15%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --input: 220 13% 91%;
  --ring: 170 76% 31%;
  --chart-1: 170 76% 31%;
  --chart-2: 160 65% 38%;
  --chart-3: 180 55% 42%;
  --chart-4: 175 60% 35%;
  --chart-5: 168 58% 40%;
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius: .5rem;
  --shadow-2xs: 0 1px 2px 0 rgb(0 0 0 / 0.03);
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.05);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.2);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

Keep all the `--*-border` fallback blocks unchanged.

- [ ] **Step 3: Replace dark mode variables**

Replace the `.dark` block:

```css
.dark {
  --button-outline: rgba(255,255,255, .10);
  --badge-outline: rgba(255,255,255, .05);
  --opaque-button-border-intensity: 9;
  --elevate-1: rgba(255,255,255, .04);
  --elevate-2: rgba(255,255,255, .09);
  --background: 224 14% 10%;
  --foreground: 210 17% 95%;
  --border: 220 10% 18%;
  --card: 224 14% 13%;
  --card-foreground: 210 14% 93%;
  --card-border: 220 10% 16%;
  --sidebar: 224 14% 10%;
  --sidebar-foreground: 210 12% 90%;
  --sidebar-border: 220 10% 18%;
  --sidebar-primary: 170 70% 45%;
  --sidebar-primary-foreground: 210 15% 95%;
  --sidebar-accent: 220 10% 16%;
  --sidebar-accent-foreground: 210 12% 88%;
  --sidebar-ring: 170 70% 45%;
  --popover: 224 14% 13%;
  --popover-foreground: 210 12% 90%;
  --popover-border: 220 10% 16%;
  --primary: 170 70% 45%;
  --primary-foreground: 224 14% 8%;
  --secondary: 220 10% 16%;
  --secondary-foreground: 210 12% 78%;
  --muted: 220 10% 16%;
  --muted-foreground: 210 10% 55%;
  --accent: 220 10% 16%;
  --accent-foreground: 210 12% 85%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --input: 220 10% 22%;
  --ring: 170 70% 45%;
  --chart-1: 170 76% 50%;
  --chart-2: 160 65% 55%;
  --chart-3: 180 55% 58%;
  --chart-4: 175 60% 52%;
  --chart-5: 168 58% 48%;
  --shadow-2xs: 0 1px 2px 0 rgb(0 0 0 / 0.15);
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.2);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.25), 0 1px 2px -1px rgb(0 0 0 / 0.25);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.25), 0 1px 2px -1px rgb(0 0 0 / 0.25);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.2);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.2);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.5);
}
```

- [ ] **Step 4: Verify fonts load**

Run: `npm run dev`

Open browser → DevTools → Elements → `<body>` → Computed → `font-family`. Should show `Pretendard Variable`. Check any `font-mono` element shows `JetBrains Mono`.

- [ ] **Step 5: Commit**

```bash
git add client/index.html client/src/index.css tailwind.config.ts
git commit -m "design: replace design tokens — Pretendard font, teal accent, light-first theme"
```

---

## Task 2: Theme Provider Enhancement

**Files:**
- Modify: `client/src/components/theme-provider.tsx`

- [ ] **Step 1: Add system preference detection**

Replace `client/src/components/theme-provider.tsx` with:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("theme") as Theme) || "light";
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(typeof window === "undefined" ? "light" : (localStorage.getItem("theme") as Theme) || "light")
  );

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const r = resolveTheme("system");
        setResolvedTheme(r);
        document.documentElement.classList.toggle("dark", r === "dark");
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Verify theme toggle**

Open browser → DevTools Console → Run:
```js
document.querySelector('[data-testid]') // find any themed element
```
Check that toggling theme between "light" / "dark" / "system" adds/removes `.dark` class on `<html>`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/theme-provider.tsx
git commit -m "design: enhance theme provider — system preference detection, three-mode toggle"
```

---

## Task 3: Install New Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-window and dnd-kit**

```bash
cd /c/Users/admin/Desktop/빅마음/03_Dev/02_Web/BIGSPACE-public
npm install react-window @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D @types/react-window
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('react-window'); require('@dnd-kit/core'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add react-window and dnd-kit for virtual scroll and drag-sort"
```

---

## Task 4: Sidebar Decomposition — Extract Sub-components

This task extracts focused components from the 818-line `app-sidebar.tsx`. No visual changes yet — just reorganization.

**Files:**
- Create: `client/src/components/sidebar/LayerRow.tsx`
- Create: `client/src/components/sidebar/LayerGroup.tsx`
- Create: `client/src/components/sidebar/LayerSearch.tsx`
- Create: `client/src/components/sidebar/SidebarFooter.tsx`
- Modify: `client/src/components/app-sidebar.tsx`

- [ ] **Step 1: Create LayerRow.tsx — compact 32px layer item**

```tsx
import { useState } from "react";
import { Eye, EyeOff, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Layer } from "@shared/schema";

interface LayerRowProps {
  layer: Layer;
  onToggle: (id: string, visible: boolean) => void;
  onSelect: (id: string) => void;
  onEdit: (layer: Layer) => void;
  onDelete: (id: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function LayerRow({ layer, onToggle, onSelect, onEdit, onDelete }: LayerRowProps) {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const isVisible = layer.visible;
  const fillColor = layer.fillColor || "#6B7280";
  const typeLabel = layer.wmsUrl ? "WMS" : layer.wfsUrl ? "WFS" : null;
  const count = layer.featureCount ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center h-8 px-2 gap-1.5 cursor-pointer select-none transition-colors
        ${isVisible ? "text-foreground" : "text-muted-foreground opacity-50"}
        hover:bg-accent`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(layer.id)}
    >
      {/* Color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
        style={{ backgroundColor: fillColor }}
      />

      {/* Drag handle */}
      <button
        className={`flex-shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground transition-opacity
          ${hovered ? "opacity-100" : "opacity-0"}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      {/* Color dot */}
      <div
        className="flex-shrink-0 w-3 h-3 rounded-full border border-black/10"
        style={{ backgroundColor: fillColor }}
      />

      {/* Name */}
      <span className="flex-1 truncate text-[13px] leading-none">
        {layer.name}
      </span>

      {/* Type badge or count */}
      {!hovered && (
        <span className="flex-shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {typeLabel || (count > 0 ? formatCount(count) : "")}
        </span>
      )}

      {/* Hover actions */}
      {hovered && (
        <div className="flex items-center gap-0.5">
          <button
            className="p-0.5 rounded hover:bg-accent"
            onClick={(e) => { e.stopPropagation(); onEdit(layer); }}
          >
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            className="p-0.5 rounded hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Visibility toggle */}
      <button
        className="flex-shrink-0 p-0.5 rounded hover:bg-accent"
        onClick={(e) => { e.stopPropagation(); onToggle(layer.id, !isVisible); }}
      >
        {isVisible
          ? <Eye className="w-3.5 h-3.5 text-primary" />
          : <EyeOff className="w-3.5 h-3.5 text-muted-foreground/40" />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create LayerGroup.tsx — collapsible group with batch toggle**

```tsx
import { useState } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import type { Layer } from "@shared/schema";
import { LayerRow } from "./LayerRow";

interface LayerGroupProps {
  name: string;
  layers: Layer[];
  defaultOpen?: boolean;
  onToggleLayer: (id: string, visible: boolean) => void;
  onSelectLayer: (id: string) => void;
  onEditLayer: (layer: Layer) => void;
  onDeleteLayer: (id: string) => void;
}

export function LayerGroup({
  name, layers, defaultOpen = false,
  onToggleLayer, onSelectLayer, onEditLayer, onDeleteLayer,
}: LayerGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const allVisible = layers.length > 0 && layers.every(l => l.visible);
  const someVisible = layers.some(l => l.visible);

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !allVisible;
    layers.forEach(l => onToggleLayer(l.id, newState));
  };

  return (
    <div>
      {/* Group header */}
      <button
        className="flex items-center w-full h-7 px-2 gap-1.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wider hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="flex-1 text-left truncate">{name}</span>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">{layers.length}</span>
        <button
          className="p-0.5 rounded hover:bg-accent"
          onClick={toggleAll}
        >
          {allVisible
            ? <Eye className="w-3 h-3 text-primary" />
            : someVisible
              ? <Eye className="w-3 h-3 text-muted-foreground/60" />
              : <EyeOff className="w-3 h-3 text-muted-foreground/40" />}
        </button>
      </button>

      {/* Layer rows */}
      {open && (
        <div className="pl-1">
          {layers.map(layer => (
            <LayerRow
              key={layer.id}
              layer={layer}
              onToggle={onToggleLayer}
              onSelect={onSelectLayer}
              onEdit={onEditLayer}
              onDelete={onDeleteLayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create LayerSearch.tsx — search and filter**

```tsx
import { Search, X } from "lucide-react";

interface LayerSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function LayerSearch({ value, onChange }: LayerSearchProps) {
  return (
    <div className="relative px-2 py-1.5">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="레이어 검색..."
        className="w-full h-7 pl-7 pr-7 text-[13px] bg-accent/50 border border-border rounded-md
          placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30
          transition-colors"
      />
      {value && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent"
          onClick={() => onChange("")}
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create SidebarFooter.tsx — user info, theme, logout**

```tsx
import { LogOut, Settings, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface SidebarFooterProps {
  userEmail: string;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function SidebarFooter({ userEmail, onOpenSettings, onLogout }: SidebarFooterProps) {
  const { theme, setTheme } = useTheme();

  const nextTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(theme as any);
    setTheme(order[(idx + 1) % order.length]);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

  return (
    <div className="border-t border-border px-2 py-2 flex items-center gap-1">
      <span className="flex-1 text-[11px] text-muted-foreground truncate pl-1">
        {userEmail}
      </span>
      <button
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        onClick={nextTheme}
        title={`테마: ${theme}`}
      >
        <ThemeIcon className="w-3.5 h-3.5" />
      </button>
      <button
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        onClick={onOpenSettings}
        title="설정"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
      <button
        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        onClick={onLogout}
        title="로그아웃"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Verify each component renders in isolation**

Import each component into `app-sidebar.tsx` temporarily and verify it renders without errors. Check DevTools console for warnings.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/sidebar/
git commit -m "design: extract sidebar sub-components — LayerRow, LayerGroup, LayerSearch, SidebarFooter"
```

---

## Task 5: Rewrite app-sidebar.tsx — Compose New Components

**Files:**
- Modify: `client/src/components/app-sidebar.tsx`

- [ ] **Step 1: Rewrite app-sidebar to use extracted components**

The new `app-sidebar.tsx` should:
1. Keep the existing `LayerEditSheet` sub-component (it handles layer editing and is complex — extract later if needed)
2. Replace the layer list rendering with `LayerGroup` + `LayerRow`
3. Add `LayerSearch` at the top
4. Replace footer with `SidebarFooter`
5. Group layers by `category` field from the DB
6. Filter layers by search query

Key structure:

```tsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import type { Layer } from "@shared/schema";
import { LayerSearch } from "./sidebar/LayerSearch";
import { LayerGroup } from "./sidebar/LayerGroup";
import { SidebarFooter } from "./sidebar/SidebarFooter";
// ... keep existing LayerEditSheet, apiRequest, etc.

// Inside the component:
const [searchQuery, setSearchQuery] = useState("");
const [collapsed, setCollapsed] = useState(false);

// Group layers by category
const groupedLayers = useMemo(() => {
  const filtered = (layers || []).filter(l =>
    !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groups = new Map<string, Layer[]>();
  for (const layer of filtered) {
    const cat = layer.category || "기타";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(layer);
  }
  return groups;
}, [layers, searchQuery]);
```

The sidebar header becomes:

```tsx
<div className="flex items-center h-12 px-3 border-b border-border">
  <Heart className="w-5 h-5 text-red-400 flex-shrink-0" />
  {!collapsed && (
    <>
      <span className="ml-2 text-sm font-semibold text-foreground">BIGSPACE</span>
      <span className="ml-1.5 text-[10px] text-muted-foreground">v1.3</span>
    </>
  )}
  <div className="flex-1" />
  <button
    className="p-1 rounded hover:bg-accent text-muted-foreground"
    onClick={() => setCollapsed(!collapsed)}
  >
    {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
  </button>
</div>
```

Layer list section:

```tsx
{!collapsed && <LayerSearch value={searchQuery} onChange={setSearchQuery} />}

<div className="flex-1 overflow-y-auto scrollbar-none">
  {searchQuery && groupedLayers.size === 0 && (
    <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
      일치하는 레이어가 없습니다
    </p>
  )}
  {Array.from(groupedLayers.entries()).map(([cat, catLayers]) => (
    <LayerGroup
      key={cat}
      name={cat}
      layers={catLayers}
      defaultOpen={catLayers.some(l => l.visible)}
      onToggleLayer={handleToggle}
      onSelectLayer={handleSelect}
      onEditLayer={handleEdit}
      onDeleteLayer={handleDelete}
    />
  ))}
</div>
```

- [ ] **Step 2: Wire up existing mutation logic**

Reuse the existing `toggleMutation`, `deleteMutation`, and edit sheet logic from the current sidebar. The handlers (`handleToggle`, `handleSelect`, `handleEdit`, `handleDelete`) call the same API mutations.

- [ ] **Step 3: Verify sidebar renders with all layers**

Open browser. Check:
- Groups appear with correct names
- Layer rows are 32px height
- Search filters layers
- Toggle visibility works
- Edit sheet opens
- No console errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/app-sidebar.tsx
git commit -m "design: rewrite sidebar — grouped layers, search, compact rows, collapsible"
```

---

## Task 6: Virtual Scroll for 150+ Layers

**Files:**
- Create: `client/src/components/sidebar/LayerList.tsx`
- Modify: `client/src/components/app-sidebar.tsx`

- [ ] **Step 1: Create LayerList.tsx with react-window**

Only use virtual scroll when total layer count exceeds a threshold (e.g., 50). Below that, use regular DOM rendering (simpler, no layout issues).

```tsx
import { FixedSizeList as List } from "react-window";
import type { Layer } from "@shared/schema";
import { LayerRow } from "./LayerRow";

interface LayerListProps {
  layers: Layer[];
  height: number;
  onToggle: (id: string, visible: boolean) => void;
  onSelect: (id: string) => void;
  onEdit: (layer: Layer) => void;
  onDelete: (id: string) => void;
}

const ROW_HEIGHT = 32;

export function LayerList({ layers, height, onToggle, onSelect, onEdit, onDelete }: LayerListProps) {
  if (layers.length <= 50) {
    return (
      <div>
        {layers.map(layer => (
          <LayerRow key={layer.id} layer={layer} onToggle={onToggle} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={layers.length}
      itemSize={ROW_HEIGHT}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <LayerRow
            layer={layers[index]}
            onToggle={onToggle}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      )}
    </List>
  );
}
```

- [ ] **Step 2: Integrate into app-sidebar.tsx**

Replace the `LayerGroup` inline layer list with `LayerList` when a group has many layers. Use a `ref` + `ResizeObserver` to get available height for the virtual list.

- [ ] **Step 3: Test with current data (6 layers)**

Should render normally (below threshold, no virtual scroll). No visual change.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/sidebar/LayerList.tsx client/src/components/app-sidebar.tsx
git commit -m "design: add virtual scroll support for 150+ layers"
```

---

## Task 7: Map Controls Redesign

**Files:**
- Modify: `client/src/components/map/MapSearchBox.tsx`
- Modify: `client/src/components/map/ZoomControl.tsx`
- Modify: `client/src/components/map/BasemapPicker.tsx`
- Modify: `client/src/components/map-viewer.tsx`

- [ ] **Step 1: Redesign MapSearchBox — light glass style**

Replace the dark `bg-black/60` styling with light glass:

```tsx
// Container div className:
"absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-[400px] px-3 md:px-0"

// Search form className:
"flex items-center h-9 px-3 gap-2 bg-background/90 backdrop-blur-md border border-border rounded-lg shadow-md"

// Input className:
"flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"

// Icon colors:
"text-muted-foreground" // (not text-white)

// Results dropdown:
"bg-background border border-border rounded-lg shadow-lg mt-1"
```

- [ ] **Step 2: Redesign ZoomControl — integrated zoom+level**

Combine +/- buttons with zoom level display into one vertical control:

```tsx
export function ZoomControl({ zoom, cursorCoord, onZoomIn, onZoomOut }: ZoomControlProps) {
  return (
    <>
      {/* Zoom buttons — right side */}
      <div className="absolute right-3 bottom-24 z-10 flex flex-col bg-background border border-border rounded-lg shadow-md overflow-hidden">
        <button
          className="p-2 hover:bg-accent transition-colors border-b border-border"
          onClick={onZoomIn}
        >
          <Plus className="w-4 h-4 text-foreground" />
        </button>
        <div className="px-2 py-1 text-center text-[11px] font-mono text-muted-foreground tabular-nums bg-accent/30">
          Z{Math.round(zoom)}
        </div>
        <button
          className="p-2 hover:bg-accent transition-colors border-t border-border"
          onClick={onZoomOut}
        >
          <Minus className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Coordinates + scale — bottom left */}
      <div className="absolute left-3 bottom-3 z-10 flex items-center gap-2 px-2.5 py-1 bg-background/80 backdrop-blur-sm border border-border rounded-md text-[10px] font-mono text-muted-foreground">
        <span>1:{getApproxScale(zoom).toLocaleString()}</span>
        {cursorCoord && (
          <>
            <span className="text-border">|</span>
            <span>{cursorCoord[1].toFixed(5)}°N, {cursorCoord[0].toFixed(5)}°E</span>
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Redesign BasemapPicker — thumbnail dropup**

Replace text-only list with thumbnail previews:

```tsx
// Trigger button:
"flex items-center gap-2 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border rounded-lg shadow-md text-[12px] text-foreground hover:bg-accent transition-colors"

// Dropdown (opens upward):
"absolute bottom-full mb-2 right-0 bg-background border border-border rounded-lg shadow-lg p-2 flex gap-2"

// Each thumbnail:
<button className={`flex flex-col items-center gap-1 p-1 rounded-md transition-colors
  ${isActive ? "ring-2 ring-primary bg-accent" : "hover:bg-accent"}`}>
  <div className="w-16 h-16 rounded bg-muted overflow-hidden">
    {/* Placeholder or actual tile preview */}
    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
      {basemap.name.slice(0, 3)}
    </div>
  </div>
  <span className="text-[10px] text-muted-foreground">{basemap.name}</span>
</button>
```

- [ ] **Step 4: Update map-viewer.tsx tool buttons**

Change tool buttons from dark glass to light:

```tsx
// Tool button className:
`p-2 rounded-lg border transition-colors shadow-sm
  ${isActive
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-background text-foreground border-border hover:bg-accent"}`
```

Update the WFS/WMS zoom warning to match new theme:

```tsx
<div className="bg-background/90 backdrop-blur-sm text-muted-foreground rounded-md px-3 py-1.5 shadow-md border border-border flex items-center gap-1.5 text-[11px]">
```

- [ ] **Step 5: Verify all map controls**

Open browser. Check:
- Search bar: white glass, centered, shadow
- Zoom: +/Z14/- vertical stack, light theme
- Coordinates: bottom-left, mono font
- Tool buttons: light with accent highlight
- Basemap picker: thumbnail dropup
- All controls work functionally (click, type, zoom)

- [ ] **Step 6: Commit**

```bash
git add client/src/components/map/ client/src/components/map-viewer.tsx
git commit -m "design: redesign map controls — light glass theme, integrated zoom, thumbnail basemap"
```

---

## Task 8: Login Page Redesign

**Files:**
- Modify: `client/src/pages/auth-page.tsx`

- [ ] **Step 1: Replace split layout with centered card**

Remove the left/right split. Replace with:

```tsx
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/10">
  <div className="w-full max-w-[380px] mx-4">
    {/* Logo */}
    <div className="text-center mb-8">
      <Heart className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <h1 className="text-xl font-bold text-foreground">BIGSPACE</h1>
      <p className="text-sm text-muted-foreground mt-1">공간정보 통합 플랫폼</p>
    </div>

    {/* Card */}
    <div className="bg-background border border-border rounded-xl shadow-lg p-6">
      {isLogin ? <LoginForm /> : <RegisterForm />}
    </div>

    {/* Footer */}
    <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
      &copy; 2026 BIGMAUM. All rights reserved.
    </p>
  </div>
</div>
```

- [ ] **Step 2: Restyle form inputs**

Replace bottom-border inputs with proper bordered inputs:

```tsx
// Input className:
"w-full h-10 px-3 text-sm bg-background border border-border rounded-md
  placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
  transition-colors"

// Login button:
"w-full h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium
  hover:bg-primary/90 transition-colors"

// Google button:
"w-full h-10 bg-background border border-border rounded-md text-sm font-medium text-foreground
  hover:bg-accent transition-colors flex items-center justify-center gap-2"

// Switch link:
"text-sm text-primary hover:underline"
```

- [ ] **Step 3: Verify login page**

Open `/auth` route. Check:
- Centered card layout
- Proper spacing
- Login form works
- Google OAuth works
- Register form works
- Theme-aware (test dark mode)

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/auth-page.tsx
git commit -m "design: redesign login page — centered card, clean inputs, gradient background"
```

---

## Task 9: Loading & Feedback States

**Files:**
- Create: `client/src/components/map/MapLoadingIndicator.tsx`
- Modify: `client/src/components/map-viewer.tsx`
- Modify: `client/src/components/sidebar/LayerRow.tsx`

- [ ] **Step 1: Create MapLoadingIndicator**

```tsx
import { Loader2 } from "lucide-react";

interface MapLoadingIndicatorProps {
  loading: boolean;
  message?: string;
}

export function MapLoadingIndicator({ loading, message = "불러오는 중..." }: MapLoadingIndicatorProps) {
  if (!loading) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/90 backdrop-blur-sm border border-border rounded-md shadow-md text-[12px] text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        {message}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add zoom warning per-layer in LayerRow**

In `LayerRow.tsx`, when a WFS/WMS layer has `minZoomForFeatures` and current zoom is below it, show inline text:

```tsx
// Add mapZoom prop to LayerRowProps
// Below layer name, conditionally show:
{!isVisible && layer.minZoomForFeatures && mapZoom < layer.minZoomForFeatures && (
  <span className="text-[10px] text-muted-foreground/50 ml-auto">확대 필요</span>
)}
```

- [ ] **Step 3: Integrate MapLoadingIndicator into map-viewer**

Add loading state tracking in `useLayerRenderer` — set a `loading` ref when WFS/MVT tiles are being fetched, clear when done. Pass to `MapLoadingIndicator`.

- [ ] **Step 4: Verify states**

- Toggle a WFS layer → see loading indicator
- Check zoom warning on WFS/WMS layers
- Check skeleton loading in sidebar on initial load

- [ ] **Step 5: Commit**

```bash
git add client/src/components/map/MapLoadingIndicator.tsx client/src/components/map-viewer.tsx client/src/components/sidebar/LayerRow.tsx
git commit -m "design: add loading indicators and feedback states"
```

---

## Task 10: Final Polish

**Files:**
- Various — cleanup pass

- [ ] **Step 1: Remove unused dark glass styles from map-viewer**

Search for any remaining `bg-black/60`, `text-white`, `border-white/10` patterns in map components and replace with theme-aware equivalents.

- [ ] **Step 2: Sidebar collapse mode**

Add collapsed state to sidebar: when `collapsed=true`, render 48px-wide sidebar with only logo icon and layer visibility dots. Store collapsed state in localStorage.

- [ ] **Step 3: Add 150ms transition to theme toggle**

In `index.css`, add:

```css
html {
  transition: background-color 150ms ease, color 150ms ease;
}

html * {
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
}
```

Scope carefully — don't transition `transform`, `opacity`, or `width` globally as it will break animations.

- [ ] **Step 4: Full visual QA**

Walk through every screen:
1. Login page — both themes
2. Map view — sidebar expanded/collapsed, both themes
3. Layer toggle — visibility icons
4. Search — filter and clear
5. Group — expand/collapse, batch toggle
6. Map controls — search, zoom, tools, basemap picker
7. Loading states — WFS toggle

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "design: final polish — collapse mode, theme transition, cleanup"
```

---

## Summary

| Task | Description | Commits |
|------|-------------|---------|
| 1 | Design tokens + fonts | 1 |
| 2 | Theme provider enhancement | 1 |
| 3 | Install dependencies | 1 |
| 4 | Extract sidebar sub-components | 1 |
| 5 | Rewrite app-sidebar composition | 1 |
| 6 | Virtual scroll for 150+ layers | 1 |
| 7 | Map controls redesign | 1 |
| 8 | Login page redesign | 1 |
| 9 | Loading & feedback states | 1 |
| 10 | Final polish | 1 |
| **Total** | | **10 commits** |
