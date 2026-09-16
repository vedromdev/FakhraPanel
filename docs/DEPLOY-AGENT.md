// Deploy an Azadi Panel agent on Railway as a separate service:
// 1. From the project root: railway init --name azadi-agent-<region>
// 2. Set: AZADI_PANEL=https://<your-panel>.up.railway.app
// 3. Set: AZADI_SECRET=<the panel's AGENT_SHARED_SECRET>
// 4. Set: NODE_NAME=<Label>, FLAG=🇩🇪, COUNTRY=Germany
// 5. Use Dockerfile.agent (backend/Dockerfile.agent)
// 6. The agent connects OUTBOUND → no port configuration needed.
// 7. On Railway, the agent exposes xray ws-only (edge limitation); on VPS, full ports.
// Deploy a second service for a second region, or deploy agent.js to a VPS for all protocols.
