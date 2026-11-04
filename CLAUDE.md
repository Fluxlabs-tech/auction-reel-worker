# Auction Reel Server: Architecture & Coding Standards

When developing on `auction-reel-server`, strictly adhere to the following architecture rules defined in `.agents/skills/express-service-architecture/SKILL.md` and the design in `auction-reel-pipeline-pseudocode.md`:

## Architecture & File Structure
1. **1 Function Per File Law**:
   - Every service function, controller, external HTTP call, and step handler MUST have its own dedicated file.
   - 1 File = 1 Function = 1 Distinct Responsibility.
   - Controllers: `src/controller/<action>.controller.ts`
   - Services: `src/services/<domain>/<action>.service.ts`
   - Barrel `index.ts` files solely re-export single-function files.
2. **Top-of-Function Variable Definition Rule**:
   - Every variable (`let`, `const`) used within a function MUST be defined at the very top of the function body.
   - Zero mid-function declarations. All intermediate values and accumulators must be scoped at the top so that context is available in `catch` blocks.
3. **Suffix Conventions**:
   - Controllers: function and file name must end with `...Controller` (e.g. `getHealthController`).
   - Services: function and file name must end with `...Service` (e.g. `buildTimelineService`).
4. **Mandatory Try-Catch in Every Function**:
   - Every single function must wrap its body in `try { ... } catch (error: any) { console.error("[<functionName>] Error:", error?.response?.data || error?.message || error); ... }`.
   - Security/eligibility/readiness checks must fail-closed (return safe value: false, not ready, or skip).
5. **Database / Firestore Isolation in Models**:
   - ALL database operations and Firestore queries/transactions MUST live exclusively inside `src/models/*.model.ts`.
   - Zero inline Firestore calls in services or controllers.
6. **External HTTP / Cloud Calls Isolated**:
   - All outbound HTTP calls (share-leaderboard, livestream-service), S3 calls, and GCS calls must have dedicated service files in `src/services/external/`.
7. **ffmpeg Pure Child-Process Rendering**:
   - No native canvas or Node frame rendering. TypeScript only writes ASS subtitle scripts and `-filter_complex` graphs.
   - Rendering runs via an external ffmpeg child process.

## Verification Commands
- Unit tests: `npm test`
- Type checking: `npm run typecheck`
- Linter: `npm run lint`
- Formatter: `npm run format:check`
