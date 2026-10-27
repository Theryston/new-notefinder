# Synchronize existing Track associations

The Music catalog owns the `trackId` search projection. Run synchronization
when deploying the direct catalog search path for the first time or when
recovering a lost catalog projection:

1. Keep the API version that enriches search from its database serving traffic.
2. Deploy the API image containing the sync command and migration, then apply
   the migration with the normal database migration step.
3. Run `node dist/main.js --sync-track-associations` in that API image with
   its normal production environment. It reads every Track in bounded keyset
   pages, including Tracks without a completed Processing, and delivers each
   exact Recording MBID and Track ID through the authenticated durable outbox.
4. Wait for the command to exit successfully. It waits for catalog
   acknowledgments for each page and drains concurrent pending events before
   returning. An error exits nonzero; fix the underlying outage and rerun the
   same command from the beginning.
5. Roll out the API version that returns catalog search results directly.

The command is safe to rerun. A unique outbox row per Track is reset to pending
with the current Track/Recording pair, so acknowledged links are restored if
the catalog projection is lost. Track creation continues writing durable
events while synchronization runs; those events are included in the final
drain and the normal worker keeps delivering new events after cutover. This is
an explicit operation, not a scheduled daily scan.
