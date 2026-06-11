# edmingle-mcp-remote

Remote MCP server for the Taivas Edmingle LMS/CRM. Hosted on Vercel, connects to
Claude Desktop via Streamable HTTP transport.

Exposes all 223 Edmingle API endpoints (4 gateway tools + 19 named convenience tools).

## For Teammates — Setup

1. Open Claude Desktop settings -> Developer -> Edit Config
   (or edit `~/Library/Application Support/Claude/claude_desktop_config.json` directly)

2. Add this inside the `"mcpServers"` object:

```json
"edmingle": {
  "url": "https://edmingle-mcp.vercel.app/api/mcp",
  "headers": {
    "Authorization": "Bearer ASK_TATSAM_FOR_THE_TOKEN"
  }
}
```

3. Get the token from Tatsam and replace `ASK_TATSAM_FOR_THE_TOKEN`.

4. Restart Claude Desktop.

5. You should now see Edmingle tools available. Try: "List all Edmingle students".

## For Admin (Tatsam)

### Rotate the auth token

```bash
NEW_TOKEN=$(openssl rand -hex 32)
cd "/Users/tatsam/Desktop/Dev Projects/edmingle-mcp-remote"
echo "$NEW_TOKEN" | vercel env add MCP_AUTH_TOKEN production --force
vercel --prod
```

Then share the new token with teammates.

### Update after Edmingle API changes

1. Re-export the Postman collection in the local edmingle-mcp project
2. Run `npm run gen:catalog` there
3. Copy updated files here:
   ```bash
   cp ../edmingle-mcp/catalog.json .
   cp ../edmingle-mcp/src/core/*.ts lib/core/
   cp ../edmingle-mcp/src/tools/*.ts lib/tools/
   ```
4. `npm test` to verify
5. `git add -A && git commit -m "sync core from edmingle-mcp" && git push`
6. Vercel auto-deploys from GitHub push

### Environment variables (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| EDMINGLE_API_URL | `https://taivasdebateclub-api.edmingle.com/nuSource/api/v1` | yes |
| EDMINGLE_APIKEY | (secret) | yes |
| EDMINGLE_ORGID | `12314` | yes |
| EDMINGLE_INSTITUTION_ID | `9939` | yes |
| EDMINGLE_ORGANIZATION_ID | `12314` | no |
| EDMINGLE_HOST_NAME | `www.taivas.co.in` | no |
| MCP_AUTH_TOKEN | (secret) | yes |

## Safety

- Destructive endpoints require `confirm:true` (Claude Desktop prompts users)
- `EDMINGLE_READ_ONLY=true` disables all write tools
- Bearer token auth on every request
- Teammates never see the Edmingle API key
