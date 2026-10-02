ALTER TABLE "saas_subscriptions" ADD COLUMN "billing_currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD COLUMN "billing_cycle" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD COLUMN "cycle_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD COLUMN "estimated_exchange_rate" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD COLUMN "exchange_rate_date" date;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD COLUMN "exchange_rate_source" text;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_billing_currency_check" CHECK ("saas_subscriptions"."billing_currency" in ('BRL','USD','EUR'));--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_billing_cycle_check" CHECK ("saas_subscriptions"."billing_cycle" in ('monthly','annual'));--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_billing_amount_check" CHECK ("saas_subscriptions"."cycle_amount" is null or "saas_subscriptions"."cycle_amount" > 0);--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_billing_rate_check" CHECK ("saas_subscriptions"."estimated_exchange_rate" is null or ("saas_subscriptions"."estimated_exchange_rate" > 0 and "saas_subscriptions"."exchange_rate_date" is not null and "saas_subscriptions"."exchange_rate_source" is not null and length(trim("saas_subscriptions"."exchange_rate_source")) > 0));