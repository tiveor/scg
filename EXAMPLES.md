# SCG Examples

All runnable examples live in the `example/` directory. Build the project first:

```bash
npm run build
```

---

## Basic Examples

```bash
node example/index.js           # Template rendering with EJS, Handlebars, Pug
node example/pipeline-demo.js   # Pipeline API (chained transforms)
node example/scaffold-demo.js   # Scaffold engine (bulk file generation)
node example/plugin-demo.js     # Plugin system (custom template engines)
```

---

## Full Demo — CRUD API Generator

The `example/full-demo/` directory contains a comprehensive example that uses **every SCG feature** in a single script. It generates a complete, runnable Express + TypeScript + Zod REST API from an entity name and its fields.

### Usage

```bash
node example/full-demo/generate.js --entity=Product --fields=name:string,price:number,active:boolean
```

Then install, test, and launch (opens the admin UI in the browser):

```bash
./generated/product/run.sh
```

Or step by step:

```bash
cd generated/product
pnpm install
pnpm test
pnpm run dev                   # in-memory storage (default)
STORAGE=file pnpm run dev      # file-based storage (persists across restarts)
```

Open the admin UI at [http://localhost:3000/admin](http://localhost:3000/admin) to manage entities from the browser (create, edit, delete).

Test the API via curl:

```bash
curl http://localhost:3000/products
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99,"active":true}'
```

### What it generates (18 files)

```
generated/product/
├── server.ts              # Express entry point + admin route
├── product.store.ts       # Storage abstraction (memory/file)
├── product.model.ts       # TypeScript interfaces
├── product.repository.ts  # Data access layer
├── product.service.ts     # Business logic
├── product.controller.ts  # HTTP handlers
├── product.routes.ts      # Express router
├── product.validation.ts  # Zod schemas
├── product.test.ts        # Unit tests (Vitest)
├── product.migration.sql  # SQL migration
├── product.admin.html     # Interactive admin UI
├── product.api.md         # API reference
├── README.md              # Quickstart guide
├── index.ts               # Barrel exports
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript config
├── vitest.config.ts       # Test config
└── run.sh                 # Install, test & launch script
```

### SCG features demonstrated

| Step | Feature | What it does |
|------|---------|--------------|
| 1 | **ParamHelper** | Parses `--entity` and `--fields` from CLI args |
| 2 | **StringHelper** | Transforms entity name: `Product` → `product`, `products`, `PRODUCT` |
| 3 | **Plugin System** | Registers a custom `sql` engine with `<<var>>` syntax |
| 4 | **Scaffold** | Generates 9 TypeScript files from EJS templates in one call |
| 5 | **Pipeline** | Renders Handlebars (README, docs) and Pug (admin UI) with chained transforms |
| 6 | **TemplateBuilder** | Uses the custom `sql` engine to render the migration file |
| 7 | **FileHelper** | Creates `package.json`, `tsconfig.json`, `vitest.config.ts`, barrel `index.ts`, and `run.sh` |
| 8 | **CommandHelper** | Lists the generated files via shell command |
| 9 | **Watcher** | With `--watch`, re-generates on template changes |

Four template engines are used: **EJS** (9 files), **Handlebars** (2 files), **Pug** (1 file), and a **custom SQL engine** (1 file).

Works with any entity:

```bash
node example/full-demo/generate.js --entity=Order --fields=total:number,status:string,paid:boolean
node example/full-demo/generate.js --entity=User --fields=email:string,age:number,active:boolean --watch
```

---

## Landing Page Demo — Vite + React + TypeScript + Vercel

The `example/landing-page-demo/` directory generates a complete, deploy-ready **Vite + React + TypeScript** landing page project with one command.

### Usage

```bash
node example/landing-page-demo/generate.js --name=MyStartup --title="Launch Your Idea" --description="The fastest way to ship"
```

Then run the project:

```bash
cd generated/mystartup-landing
pnpm install
pnpm dev
```

Deploy to Vercel:

```bash
pnpm deploy          # preview deployment
pnpm deploy:prod     # production deployment
# or use the deploy script:
./deploy.sh [--prod]
```

### What it generates (16 files)

```
generated/mystartup-landing/
├── index.html            # Vite entry HTML
├── src/
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Landing page component
│   ├── App.css           # Landing page styles
│   ├── index.css         # Global styles
│   └── vite-env.d.ts     # TypeScript reference
├── public/
│   └── vite.svg          # Vite favicon
├── package.json          # Dependencies & scripts (incl. deploy)
├── tsconfig.json         # TypeScript project references
├── tsconfig.app.json     # App TypeScript config
├── tsconfig.node.json    # Node TypeScript config
├── vite.config.ts        # Vite configuration
├── vercel.json           # Vercel deployment config
├── .gitignore            # Git ignore rules
├── deploy.sh             # One-click deploy script
└── README.md             # Quickstart & deploy guide
```

### SCG features demonstrated

| Step | Feature | What it does |
|------|---------|--------------|
| 1 | **ParamHelper** | Parses `--name`, `--title`, `--description` from CLI args |
| 2 | **StringHelper** | Transforms name: `MyStartup` → `mystartup`, `mystartup-landing` |
| 3 | **Scaffold** | Generates 7 files from EJS templates (HTML, TSX, CSS) |
| 4 | **Pipeline** | Renders README with Handlebars + footer transform |
| 5 | **FileHelper** | Creates 8 config files (package.json, tsconfigs, vite, vercel, gitignore, deploy.sh) |
| 6 | **CommandHelper** | Lists generated files via shell command |
| 7 | **Watcher** | With `--watch`, re-generates on template changes |
