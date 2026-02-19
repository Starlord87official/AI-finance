/**
 * Worker script: polls the `jobs` table for queued tasks and dispatches them.
 * Run with: deno run --allow-net --allow-env scripts/worker.ts
 *
 * Research/education only — not financial advice.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const POLL_INTERVAL_MS = parseInt(Deno.env.get("WORKER_POLL_INTERVAL_MS") ?? "5000", 10);
const BATCH_SIZE = parseInt(Deno.env.get("WORKER_BATCH_SIZE") ?? "5", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

type JobHandler = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

const handlers: Record<string, JobHandler> = {
    run_backtest: async (payload) => {
        console.log("[worker] run_backtest:", payload);
        // TODO: Implement backtest execution engine
        return { status: "completed", note: "Skeleton — execution engine pending" };
    },

    paper_eval: async (payload) => {
        console.log("[worker] paper_eval:", payload);
        // TODO: Implement paper trading evaluation
        return { status: "completed", note: "Skeleton — evaluation loop pending" };
    },

    refresh_prices: async (payload) => {
        console.log("[worker] refresh_prices");
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/prices-refresh`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        return await resp.json();
    },

    evaluate_alerts: async (payload) => {
        console.log("[worker] evaluate_alerts");
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/finance-evaluate-alerts`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        return await resp.json();
    },

    generate_digest: async (payload) => {
        console.log("[worker] generate_digest");
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/finance-generate-digest`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        return await resp.json();
    },

    parse_statement: async (payload) => {
        console.log("[worker] parse_statement");
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/finance-parse-statement`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        return await resp.json();
    },
};

async function processJob(job: Record<string, unknown>): Promise<void> {
    const jobId = job.id as string;
    const jobType = job.type as string;
    const payload = (job.payload as Record<string, unknown>) ?? {};

    console.log(`[worker] Processing job ${jobId} (${jobType})`);

    // Mark as running
    await supabase.from("jobs").update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: ((job.attempts as number) ?? 0) + 1,
    }).eq("id", jobId);

    try {
        const handler = handlers[jobType];
        if (!handler) {
            throw new Error(`Unknown job type: ${jobType}`);
        }

        const result = await handler(payload);

        await supabase.from("jobs").update({
            status: "done",
            finished_at: new Date().toISOString(),
            result,
        }).eq("id", jobId);

        console.log(`[worker] Job ${jobId} completed`);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const attempts = ((job.attempts as number) ?? 0) + 1;
        const maxRetries = 3;

        await supabase.from("jobs").update({
            status: attempts >= maxRetries ? "failed" : "queued",
            last_error: errMsg,
            finished_at: attempts >= maxRetries ? new Date().toISOString() : null,
        }).eq("id", jobId);

        console.error(`[worker] Job ${jobId} failed (attempt ${attempts}): ${errMsg}`);
    }
}

async function pollOnce(): Promise<number> {
    const { data: jobs, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "queued")
        .lte("run_after", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

    if (error) {
        console.error("[worker] Poll error:", error.message);
        return 0;
    }

    if (!jobs || jobs.length === 0) return 0;

    for (const job of jobs) {
        await processJob(job as Record<string, unknown>);
    }

    return jobs.length;
}

// Main loop
console.log(`[worker] Starting (poll interval: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE})`);

while (true) {
    try {
        const processed = await pollOnce();
        if (processed > 0) {
            console.log(`[worker] Processed ${processed} jobs`);
        }
    } catch (e) {
        console.error("[worker] Unexpected error:", e);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
}
