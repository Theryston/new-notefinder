# Price-change notice recovery

A plan price edit creates a separate notice for each matching subscription. The
admin plan panel shows pending, failed and uncertain work. Retry a failed notice
or schedule from that panel; the worker also retries safe provider operations.
The subscription retains its existing price until the provider has a confirmed
schedule that respects the notice window.

An uncertain notice means that the provider's response was lost and the
idempotency window has expired. The worker does not send the same notice again
or schedule a price change on that assumption. It searches sent-email records
and checks the notice tag, recipient, subject and content. It uses the time of
verification as the earliest known dispatch time. If that makes the original
renewal too early, it sends a corrected notice for a later qualifying renewal.

Resend's sending-only API keys cannot list or retrieve sent emails. Ordinary
successful dispatch works with a sending-only key, but automatic reconciliation
of uncertain notices requires `RESEND_API_KEY` to have sent-email read access.
Resend currently offers full access rather than a separate read-only permission;
choose credentials and their scope deliberately. Without read access, uncertain
notices remain visible and unscheduled while reconciliation retries; no price
is charged on an unconfirmed notice.
