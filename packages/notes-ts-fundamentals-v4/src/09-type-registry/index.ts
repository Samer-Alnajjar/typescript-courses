import { fetchRecord } from './lib/registry'

const book = fetchRecord('book', 'bk_123')
const magazine = fetchRecord('magazine', 'bk_123')

/*
This folder is a small, self-contained example of the **type registry pattern** — a way to build a central, type-safe catalog of “kinds” of data (here, `book` and `magazine`) that **grows as you add new modules**, without editing the core registry file every time.

It sits at the end of the type-queries lesson (`09-type-queries.ts`), which introduces the building blocks this pattern relies on: `keyof`, `typeof`, and indexed access types.

---

## How the pieces fit together

```mermaid
flowchart TB
    subgraph core ["lib/registry.ts (core)"]
        DTR["DataTypeRegistry interface (empty)"]
        FR["fetchRecord(key, id)"]
    end

    subgraph plugins ["data/*.ts (plugins)"]
        B["book.ts augments registry with book: Book"]
        M["magazine.ts augments registry with magazine: Magazine"]
    end

    B -->|"declare module merge"| DTR
    M -->|"declare module merge"| DTR
    DTR --> FR
    FR --> IDX["index.ts: fetchRecord('book', ...)"]
```

### 1. The empty registry (`lib/registry.ts`)

```1:9:packages/notes-ts-fundamentals-v4/src/09-type-registry/lib/registry.ts
export interface DataTypeRegistry {
  // empty by design
}
// the "& string" is just a trick to get
// a nicer tooltip to show you in the next step
export function fetchRecord(
  arg: keyof DataTypeRegistry & string,
  id: string,
) {}
```

This defines two things:

- **`DataTypeRegistry`** — an intentionally empty interface that acts as a **central type map**. Keys are record kinds (`"book"`, `"magazine"`, …); values are the TypeScript types for each kind.
- **`fetchRecord`** — a function whose first argument must be a **valid key** of that map.

The `& string` trick filters out `number` and `symbol` keys from `keyof`, so autocomplete and tooltips show clean string literals like `"book" | "magazine"` instead of a noisy union.

---

### 2. Module augmentation (`data/book.ts`, `data/magazine.ts`)

Each data module defines its own class **and** extends the registry via **declaration merging**:

```7:11:packages/notes-ts-fundamentals-v4/src/09-type-registry/data/book.ts
declare module '../lib/registry' {
  export interface DataTypeRegistry {
    book: Book
  }
}
```

```7:11:packages/notes-ts-fundamentals-v4/src/09-type-registry/data/magazine.ts
declare module '../lib/registry' {
  export interface DataTypeRegistry {
    magazine: Magazine
  }
}
```

TypeScript **merges** all declarations of the same interface name. After processing both files, the compiler sees:

```typescript
interface DataTypeRegistry {
  book: Book
  magazine: Magazine
}
```

Important properties of this approach:

- **No central edit** — adding `data/article.ts` with its own augmentation is enough; you don’t touch `registry.ts`.
- **Compile-time only** — `declare module` adds types; it doesn’t emit runtime code.
- **Project-wide** — because all files under `src/` are included in the project, augmentations apply even if `index.ts` never imports `book.ts` or `magazine.ts`. (At runtime you’d still import those modules if you need the actual classes.)

---

### 3. Usage (`index.ts`)

```1:4:packages/notes-ts-fundamentals-v4/src/09-type-registry/index.ts
import { fetchRecord } from './lib/registry'

const book = fetchRecord('book', 'bk_123')
const magazine = fetchRecord('magazine', 'bk_123')
```

From a typing perspective:

- `'book'` and `'magazine'` are valid because they’re keys of the merged `DataTypeRegistry`.
- `fetchRecord('bok', 'bk_123')` would error — the key isn’t in the registry.
- A fully fleshed-out version would also use **indexed access** on the return type, e.g. `DataTypeRegistry[K]`, so `fetchRecord('book', id)` returns `Book` and `fetchRecord('magazine', id)` returns `Magazine`.

---

## Concepts this pattern teaches

| Concept | Role here |
|---|---|
| **`keyof`** | Restricts the first argument to known registry keys (`"book" \| "magazine"`) |
| **Indexed access** (`DataTypeRegistry["book"]`) | Maps each key to its value type (`Book`, `Magazine`) |
| **Interface merging** | Lets many files contribute entries to one shared map |
| **`declare module`** | Augments types in another module without changing its source |
| **`& string`** | Keeps `keyof` results readable in tooltips |

Together, these are the same primitives from `09-type-queries.ts` (`keyof Date`, `typeof contact`, `Car["color"]`), applied to a real architectural pattern instead of isolated syntax.

---

## Real-world use cases

### 1. ORM / data layer (most common)

Think Prisma-style or custom repositories:

```typescript
fetchRecord('book', 'bk_123')    // → Book
fetchRecord('magazine', 'mg_456') // → Magazine
fetchRecord('user', 'u_789')     // → User
```

Each entity module registers itself. The data layer stays generic; entity modules stay decoupled.

### 2. Plugin / extension systems

A CMS, CLI, or app framework might expose:

```typescript
registerHandler(kind: keyof HandlerRegistry, ...)
```

Each plugin augments `HandlerRegistry` with its handler types. Core code never lists every plugin explicitly.

### 3. API resource routing

A typed API client where resource names map to response shapes:

```typescript
type ApiRegistry = {
  users: UserResponse
  posts: PostResponse
}
get<'users'>('/users/1') // returns UserResponse
```

New endpoints add augmentations instead of widening one giant union by hand.

### 4. Event bus / message types

```typescript
interface EventRegistry {
  'user:login': { userId: string }
  'cart:updated': { itemCount: number }
}
emit(event: keyof EventRegistry, payload: EventRegistry[typeof event])
```

Each feature module registers its events via augmentation.

---

## Why this is better than alternatives

**vs. one big union type**

```typescript
type RecordKind = 'book' | 'magazine' | 'article' | ...
```

That central file becomes a merge conflict magnet. The registry pattern distributes ownership to each module.

**vs. generics everywhere**

```typescript
function fetchRecord<T extends 'book' | 'magazine'>(kind: T, id: string): ...
```

Works, but you still maintain the union in one place. Augmentation keeps the union **derived automatically** from registrations.

**vs. runtime plugin maps**

Runtime registries are flexible but lose static typing unless paired with something like this pattern.

---

## What a complete implementation would add

The example stops at the type-level skeleton (`fetchRecord` has an empty body). A production version would typically:

1. **Return the right type** using a generic + indexed access:

   ```typescript
   function fetchRecord<K extends keyof DataTypeRegistry & string>(
     kind: K,
     id: string,
   ): DataTypeRegistry[K] { ... }
   ```

2. **Wire runtime behavior** — a map from kind → fetch implementation, often populated when modules load.

3. **Side-effect imports** in an entry file so runtime code and types stay in sync:

   ```typescript
   import './data/book'
   import './data/magazine'
   ```

---

## Summary

The `09-type-registry` folder demonstrates **extensible, type-safe registration**: a core defines an empty `DataTypeRegistry` and a `fetchRecord` function keyed by `keyof DataTypeRegistry`; each data module uses **`declare module` + interface merging** to add its entry. TypeScript combines them into one map, giving you autocomplete, invalid-key errors, and (when fully implemented) per-key return types — the same idea used in ORMs, plugin systems, typed APIs, and event buses where new types are added in isolation without touching shared infrastructure.
*/
