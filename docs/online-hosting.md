# Online room hosting

The Vercel site is the frontend. The Node server owns the authoritative 60 Hz
fight simulation, private room codes, reconnect tokens, and rematch votes.
It must run as one persistent process because rooms live in memory.

## Deploy the room server

[Deploy the prepared server on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Faryankhotay-ops%2Fneonrival_cx)

Sign in and review the Blueprint from `render.yaml`. It selects one Free web
service, with `/health` checks and the production website in its allowed origins.
The frontend stays on Vercel. No accounts or database are added to the game.

After the deploy reports Live, copy its assigned HTTPS URL. Use the actual URL
from Render; the requested service name does not guarantee its hostname.

Free services sleep when idle and need time to wake up. Active room data is lost
when a server restarts or redeploys. Use an always-running paid instance only if
you choose to remove the free tier's idle sleep; this Blueprint does not select
or authorize a paid plan. Keep one instance until rooms use shared storage.
Automatic deploys are off to avoid interrupting active matches on every push.

## Connect the Vercel game

1. Verify `https://YOUR-ASSIGNED-HOST/health` returns status `ok`.
2. Set the Vercel project's `VITE_WS_URL` to `wss://YOUR-ASSIGNED-HOST/ws` for
   Production and redeploy the frontend. The URL is public configuration.
3. If the game uses another domain, add that exact HTTPS origin to the server's
   comma-separated `ALLOWED_ORIGINS` and redeploy the server.
4. Test the public connection with:

   ```sh
   node scripts/check-online.mjs wss://YOUR-ASSIGNED-HOST/ws https://neonrival-cx.vercel.app
   ```

The check opens two real clients, creates and joins a room, verifies shared match
state and acknowledged input, disconnects and recovers one player, then leaves
and verifies the other client receives the room closure. It never prints room
recovery tokens. A full accelerated match/rematch regression is also included in
`apps/server/test/rooms.test.ts`.

For a manual check, open the game on two devices, choose Online Rooms, select a
fighter on each device, create on one, then enter its room code on the other.
Both devices should show the same fighters and synchronized round state.
