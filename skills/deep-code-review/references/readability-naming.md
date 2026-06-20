# Readability & Naming
Review names introduced or changed by the diff. Read surrounding code before flagging; consistency with the project beats textbook naming.

Apply this lens for review only: flag and recommend; do not edit, and leave delivery of the findings to the caller. Use the findings schema in [report-format.md](report-format.md) and the **Blocker / Major / Minor / Nit** scale from `SKILL.md`.

## Diff review focus
- New or renamed variables, constants, functions, methods, classes, types, files, API fields, and database fields.
- Changed functions whose old name no longer matches the new behavior.
- Convention drift from the surrounding file or module.
- Magic numbers, timeouts, limits, status values, and thresholds added by the PR.
- Boolean names that obscure truth semantics or force double negatives.

## Severity guidance
- Misleading names that contradict behavior are usually **Major**; escalate when they hide security, data-loss, public-contract, or destructive side effects.
- Vague names and unclear abbreviations are usually **Minor** unless they obscure risky control flow.
- Pure casing or local convention drift is usually **Nit**; group these and do not flood the review.
- Magic numbers on a risk surface can be **Major**. Harmless local constants are usually **Minor** or **Nit**.

## Language conventions
Prefer the project's existing convention when it conflicts with these defaults.

- JavaScript / TypeScript: variables/functions `camelCase`; classes/components/interfaces/types `PascalCase`; module constants `UPPER_SNAKE_CASE`; private fields `#privateField` or the project's `_prefixUnderscore`; booleans `is`/`has`/`can`/`should`.
- Python: variables/functions `snake_case`; classes `PascalCase`; constants `UPPER_SNAKE_CASE`; private names `_prefix_underscore`; booleans `is_`/`has_`/`can_`/`should_`.
- Java: variables/methods `camelCase`; classes/interfaces `PascalCase`; constants `UPPER_SNAKE_CASE`; packages lowercase; booleans `is`/`has`/`can`/`should` where idiomatic.
- Go: exported names `PascalCase`; unexported names `camelCase`; acronyms all caps when conventional, such as `HTTPServer`, not `HttpServer`; short names are fine in tiny scopes.

## Common issue patterns

### Too vague
```javascript
// Bad: generic names hide the domain.
function process(data) {}
const info = getData();
let temp = x;

// Good: names say what changes and why.
function processPayment(transaction) {}
const userProfile = getUserProfile();
let previousValue = x;
```
Flag `data`, `info`, `temp`, `value`, `item`, or `result` when context cannot rescue them.

### Misleading names
```javascript
// Bad: name implies read-only, but the function mutates and persists.
function getUser(id) {
  const user = fetchUser(id);
  user.lastLogin = Date.now();
  saveUser(user);
  return user;
}

// Good: name reflects the side effect.
function fetchAndUpdateUserLogin(id) {
  const user = fetchUser(id);
  user.lastLogin = Date.now();
  saveUser(user);
  return user;
}
```
Push hard when a changed function name no longer matches behavior. Hidden side effects, retries, persistence, network calls, cache invalidation, permission checks, and destructive work belong in the name or in a clearer API shape.

### Unclear abbreviations
```javascript
// Bad: abbreviations save characters and spend reader time.
const usrCfg = loadConfig();
function calcTtl(arr) {}

// Good: spell out domain terms.
const userConfig = loadConfig();
function calculateTotal(amounts) {}

// Acceptable: common abbreviations in the project and ecosystem.
const htmlElement = document.getElementById('main');
const apiUrl = process.env.API_URL;
```
Accept common abbreviations: `id`, `url`, `uri`, `api`, `http`, `html`, `json`, `db`, `ui`, `ttl`, `ctx`, when the project uses them clearly. Flag author-only shorthand.

### Boolean naming
```javascript
// Bad: unclear state.
const login = user.authenticated;
const status = checkUser();

// Good: question-form names carry truth semantics.
const isLoggedIn = user.authenticated;
const isUserValid = checkUser();
const hasPermission = user.roles.includes('admin');
const canEditPost = isOwner || isAdmin;
const shouldShowNotification = isEnabled && hasUnread;
```
Prefer affirmative booleans. `isEnabled` reads better than `isDisabled`; callers avoid double negatives.

### Magic numbers
```javascript
// Bad: meaning and units are missing.
if (age > 18) {}
setTimeout(callback, 3600000);

// Good: constants name the rule and unit.
const LEGAL_AGE = 18;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

if (age > LEGAL_AGE) {}
setTimeout(callback, ONE_HOUR_IN_MS);
```
Flag numbers that encode policy, limits, durations, money, retries, permissions, statuses, or protocol values. Include units: `_MS`, `_SECONDS`, `_MB`, `_BYTES`, `_PERCENT`, `_CENTS`.

## Naming decision tree
```text
Is it a boolean?
├─ Yes → Use is/has/can/should and keep it affirmative.
└─ No → Is it a function or method?
    ├─ Yes → Use a verb phrase that matches behavior and side effects.
    └─ No → Is it a class/type/interface?
        ├─ Yes → Use a noun or noun phrase in the language convention.
        └─ No → Is it a constant?
            ├─ Yes → Name the rule, include units, use the project convention.
            └─ No → Use a descriptive noun or noun phrase.
```

## Patterns to follow
- Functions and methods: verb phrases, such as `sendEmail`, `parseJson`, `formatCurrency`, `reserveInventory`.
- Classes, types, and interfaces: nouns, such as `UserService`, `PaymentProcessor`, `EmailValidator`, `RetryPolicy`.
- Variables: nouns or noun phrases, such as `emailAddress`, `totalAmount`, `activeUsers`.
- Constants: `UPPER_SNAKE_CASE` when fixed and shared; include units, such as `CACHE_DURATION_MS`, `MAX_FILE_SIZE_MB`.
- Booleans: question form and affirmative, such as `isValid`, `hasPermission`, `canEdit`, `shouldRetry`.

## DO / DON'T
DO:
- Preserve established project conventions.
- Prefer specific full words over private abbreviations.
- Make side effects visible in names or recommend an API split.
- Name constants after the rule, not just the value, and include units.
- Allow short names in tiny scopes: `i`, `j`, `k`, `x`, `y` can be fine in loops or math-heavy local code.

DON'T:
- Enforce textbook casing against a consistent local convention.
- Bury real findings under cosmetic nits.
- Accept names that hide mutation, persistence, authorization, network work, or destructive actions.
- Use Hungarian notation unless the project already requires it.
- Recommend names so long they become comments in disguise.
