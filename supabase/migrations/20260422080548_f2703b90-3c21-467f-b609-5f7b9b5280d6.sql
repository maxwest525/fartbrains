create schema if not exists extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;