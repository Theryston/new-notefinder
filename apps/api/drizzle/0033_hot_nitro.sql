CREATE TYPE "public"."benefit_status" AS ENUM('available', 'coming-soon', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."plan_currency" AS ENUM('BRL', 'USD');--> statement-breakpoint
CREATE TYPE "public"."plan_kind" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" text PRIMARY KEY NOT NULL,
	"copy" jsonb NOT NULL,
	"status" "benefit_status" DEFAULT 'coming-soon' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_benefits" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"benefit_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_benefits_planId_benefitId_unique" UNIQUE("plan_id","benefit_id"),
	CONSTRAINT "plan_benefits_planId_position_unique" UNIQUE("plan_id","position")
);
--> statement-breakpoint
CREATE TABLE "plan_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"cycle" "billing_cycle" NOT NULL,
	"currency" "plan_currency" NOT NULL,
	"amount" integer NOT NULL,
	"current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "plan_kind" NOT NULL,
	"copy" jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"enabled_cycles" "billing_cycle"[] DEFAULT '{}' NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_benefits" ADD CONSTRAINT "plan_benefits_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_benefits" ADD CONSTRAINT "plan_benefits_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_benefits_benefit_id_index" ON "plan_benefits" USING btree ("benefit_id");--> statement-breakpoint
CREATE INDEX "plan_prices_plan_id_current_index" ON "plan_prices" USING btree ("plan_id","current");--> statement-breakpoint
CREATE INDEX "plans_published_display_order_index" ON "plans" USING btree ("published","display_order");
--> statement-breakpoint
-- Initial public plan catalog. Localized content is persisted, never a client constant.
INSERT INTO plans (id,kind,copy,display_order,published,enabled_cycles,trial_days) VALUES
('free','free','{"en": {"name": "Free", "description": "Everything you need to start singing."}, "pt-BR": {"name": "Grátis", "description": "Tudo o que você precisa para começar a cantar."}}',0,true,ARRAY[]::billing_cycle[],0),
('pro','paid','{"en": {"name": "Pro", "description": "Everything in Free, plus future tools for your singing."}, "pt-BR": {"name": "Pro", "description": "Tudo do Grátis, além de futuras ferramentas para o seu canto."}}',1,true,ARRAY['monthly','annual']::billing_cycle[],0);
--> statement-breakpoint
INSERT INTO benefits (id,copy,status) VALUES
('track-search','{"en": {"name": "Track search", "description": "Find Tracks to sing along with."}, "pt-BR": {"name": "Busca de faixas", "description": "Encontre faixas para cantar junto."}}','available'),
('track-requests','{"en": {"name": "Track requests", "description": "Request new Tracks for Processing."}, "pt-BR": {"name": "Pedidos de faixas", "description": "Peça novas faixas para processamento."}}','available'),
('unlimited-singing','{"en": {"name": "Unlimited singing", "description": "Practice singing without paid membership or practice limits."}, "pt-BR": {"name": "Canto sem limites", "description": "Pratique canto sem assinatura paga nem limites de prática."}}','available'),
('vocal-notes','{"en": {"name": "Vocal notes", "description": "See the vocal notes on the playback timeline."}, "pt-BR": {"name": "Notas vocais", "description": "Veja as notas vocais na linha do tempo da reprodução."}}','available'),
('basic-pitch-feedback','{"en": {"name": "Live basic pitch feedback", "description": "Follow your pitch in real time with your microphone."}, "pt-BR": {"name": "Feedback básico de afinação ao vivo", "description": "Acompanhe sua afinação em tempo real com o microfone."}}','available'),
('advanced-scoring','{"en": {"name": "Advanced singing-performance scoring", "description": "Planned: singing-performance feedback beyond counting correct vocal notes."}, "pt-BR": {"name": "Avaliação avançada de canto", "description": "Planejado: feedback sobre o desempenho no canto além da contagem de notas vocais corretas."}}','coming-soon'),
('ad-free','{"en": {"name": "Ad-free experience", "description": "Planned: sing and explore without advertising."}, "pt-BR": {"name": "Experiência sem anúncios", "description": "Planejado: cante e explore sem publicidade."}}','coming-soon'),
('attempt-comparison','{"en": {"name": "Attempt comparison", "description": "Planned: compare your practice Attempts."}, "pt-BR": {"name": "Comparação de tentativas", "description": "Planejado: compare suas tentativas de prática."}}','coming-soon'),
('difficulty-map','{"en": {"name": "Difficulty map", "description": "Planned: explore the challenging parts of a Track."}, "pt-BR": {"name": "Mapa de dificuldade", "description": "Planejado: explore os trechos desafiadores de uma faixa."}}','coming-soon'),
('progress','{"en": {"name": "Progress over time", "description": "Planned: follow your singing progress over time."}, "pt-BR": {"name": "Evolução ao longo do tempo", "description": "Planejado: acompanhe sua evolução no canto ao longo do tempo."}}','coming-soon'),
('targeted-practice','{"en": {"name": "Targeted practice", "description": "Planned: focus practice on the parts you want to improve."}, "pt-BR": {"name": "Prática direcionada", "description": "Planejado: concentre a prática nos trechos que deseja melhorar."}}','coming-soon'),
('cloud-recordings','{"en": {"name": "Cloud recordings", "description": "Planned: keep your singing recordings in the cloud."}, "pt-BR": {"name": "Gravações na nuvem", "description": "Planejado: guarde suas gravações de canto na nuvem."}}','coming-soon');
--> statement-breakpoint
INSERT INTO plan_benefits (id,plan_id,benefit_id,position) VALUES
('free-track-search','free','track-search',0),
('free-track-requests','free','track-requests',1),
('free-unlimited-singing','free','unlimited-singing',2),
('free-vocal-notes','free','vocal-notes',3),
('free-basic-pitch-feedback','free','basic-pitch-feedback',4),
('pro-advanced-scoring','pro','advanced-scoring',0),
('pro-ad-free','pro','ad-free',1),
('pro-attempt-comparison','pro','attempt-comparison',2),
('pro-difficulty-map','pro','difficulty-map',3),
('pro-progress','pro','progress',4),
('pro-targeted-practice','pro','targeted-practice',5),
('pro-cloud-recordings','pro','cloud-recordings',6);
--> statement-breakpoint
INSERT INTO plan_prices (id,plan_id,cycle,currency,amount) VALUES
('pro-monthly-brl','pro','monthly','BRL',1990),
('pro-annual-brl','pro','annual','BRL',19900),
('pro-monthly-usd','pro','monthly','USD',350),
('pro-annual-usd','pro','annual','USD',3500);
