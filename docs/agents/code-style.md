# Code Style: Types & Function Size

Repo-wide TypeScript rules. Enforced by `biome.jsonc`. Package guides link here instead of restating the rules.

## TypeScript — zod is the only source of types
- Every type is derived from a zod schema: `const XSchema = z.object({...})` then `export type X = z.infer<typeof XSchema>`. Reference: any component in `deedlit.dev.ui/src/`.
- This includes component props:
  ```ts
  export const ButtonPropsSchema = z.object({
    label: z.string(),
    variant: z.enum(["primary", "ghost"]).optional(),
    icon: z.custom<ReactNode>().optional(),
    onClick: z.custom<(event: MouseEvent<HTMLButtonElement>) => void>().optional(),
  });
  export type ButtonProps = z.infer<typeof ButtonPropsSchema>;
  ```
  In zod 4 `z.function()` is not a schema — use `z.custom<Fn>()` for callbacks and `z.custom<ReactNode>()` for children.
- Never hand-write `interface`, `type X = { ... }`, or inline object annotations (`(x: { a: string }) => ...`).
- Never use `any` (`: any`, `as any`, `any[]`). Use `unknown` and narrow it with `Schema.parse` / `safeParse`.
- Parse at trust boundaries only: fetch responses, JSON files, env vars, URL/search params, `localStorage`. Inside the app, `z.infer` types are enough.
- Allowed: generics and utility types over inferred types (`Pick<X, "a">`, `Partial<X>`, `React.ComponentProps<typeof Foo>`), unions of inferred types, and third-party `*.d.ts` augmentation.

## Functions stay small
- Target at most ~40 lines / 25 statements and cyclomatic complexity 10; one responsibility per function.
- React components: at most ~60 lines — split into subcomponents or custom hooks.
- Prefer extracting a named helper over nesting; early-return instead of deep `if` pyramids.

## Enforcement
- TS (Biome): `suspicious/noExplicitAny`; the GritQL plugin `biome-plugins/no-hand-written-types.grit` (bans `TsInterfaceDeclaration` / `TsObjectType`); `complexity/noExcessiveLinesPerFunction` (40 lines, 60 in `*.tsx`); `complexity/noExcessiveCognitiveComplexity` (15, warning only — Biome has no cyclomatic rule). Size rules are off in tests, stories and e2e; the plugin skips those plus `*.d.ts`. A justified exception uses `// biome-ignore lint/plugin: <reason>`.
- Run: `pnpm lint` (Biome, whole repo).
