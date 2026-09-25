# Code Style: Types & Function Size

Repo-wide rules for every TypeScript and Python package. Enforced by `eslint.config.base.mjs` (TS) and `ruff.toml` + basedpyright (Python). Package guides link here instead of restating the rules.

## TypeScript — zod is the only source of types
- Every type is derived from a zod schema: `const XSchema = z.object({...})` then `export type X = z.infer<typeof XSchema>`. Reference: `deedlit.dev.comfyhelper/lib/library/schemas.ts`.
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

## Python — pydantic models or dataclasses only
- Data crossing I/O (HTTP bodies, queue messages, DB rows, JSON files, external APIs) is a `pydantic.BaseModel`; validate with `Model.model_validate(...)`.
- Internal value objects are `@dataclass(frozen=True, slots=True)`.
- Never use `typing.Any`, `TypedDict`, `NamedTuple`, or `dict[str, Any]` as a record type.
- Genuinely opaque JSON (e.g. a ComfyUI prompt graph) is typed `pydantic.JsonValue`; parse the parts you need into models.
- Replace `Any` parameters with a `Protocol`, a union, or a `TypeVar`.
- Every function has full parameter and return annotations.

## Functions stay small
- Target at most ~40 lines / 25 statements and cyclomatic complexity 10; one responsibility per function.
- React components: at most ~60 lines — split into subcomponents or custom hooks.
- Prefer extracting a named helper over nesting; early-return instead of deep `if` pyramids.

## Enforcement
- TS: `@typescript-eslint/no-explicit-any`, `no-restricted-syntax` (bans `TSInterfaceDeclaration` / `TSTypeLiteral`), `max-lines-per-function`, `complexity`. Relaxed to warnings in stories, tests, e2e, and `*.d.ts`.
- Python: ruff `ANN`, `TID251` (bans `typing.Any` / `TypedDict` / `NamedTuple`), `C90`, `PLR0915`; basedpyright `strict` with `reportAny` / `reportExplicitAny`. Tests relax annotation and size rules.
- Run: `npm run lint` (all TS workspaces + `lint:py`).
