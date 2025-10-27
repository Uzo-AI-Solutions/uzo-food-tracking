# Custom GPT + Supabase Integration - Lessons Learned

## Overview
This document summarizes the challenges encountered when attempting to integrate Custom GPT with Supabase, covering both OAuth 2.0 authentication attempts and OpenAPI 3.1 authentication limitations.

## Table of Contents
1. [OAuth Flow Incompatibility](#architecture-attempted)
2. [OpenAPI 3.1 Multiple Headers Problem](#the-openapi-31-multiple-headers-problem)
3. [Production-Grade Solutions](#production-grade-solutions-for-multiple-headers-problem)
4. [Recommendations](#recommendation-for-production)

## Summary

**Two Critical Limitations:**
1. **OAuth:** Supabase uses implicit flow, Custom GPT requires authorization code flow → No OAuth solution
2. **Headers:** Custom GPT Actions can only send ONE authentication header, Supabase needs TWO (apikey + Authorization)

**Working Solutions:**
- **Prototype/Personal:** Use ANON key only with RLS disabled (current implementation)
- **Production:** Deploy Supabase Edge Function proxy to add the second header server-side

## Original Goal
Enable Custom GPT to authenticate users via Google OAuth through Supabase, allowing the GPT to make authenticated API calls to the Uzo Food Tracking application.

## Architecture Attempted

### Approach 1: Direct Supabase OAuth Integration
**Initial Plan:**
- Custom GPT → Supabase Google OAuth → Custom GPT receives tokens
- Use Supabase's built-in Google OAuth provider
- Custom GPT would receive JWT tokens for authenticated API calls

**Why It Failed:**
- Custom GPT requires standard OAuth 2.0 authorization code flow
- Needed custom OAuth endpoints (authorize, token) to proxy between Custom GPT and Supabase
- Supabase's native OAuth endpoints don't match Custom GPT's expected OAuth flow

### Approach 2: Edge Function OAuth Proxy
**Architecture:**
```
Custom GPT → oauth-authorize Edge Function → Supabase Google Auth
          ← oauth-token Edge Function ← Supabase callback
```

**Implementation:**
- Created `oauth-authorize`: Redirects Custom GPT to Supabase Google OAuth
- Created `oauth-token`: Exchanges Supabase auth codes for JWT tokens
- Configured Custom GPT to use these endpoints

**Critical Issues Encountered:**

#### Issue 1: Supabase Implicit Flow vs Authorization Code Flow
**Problem:** Supabase consistently returned tokens in URL fragment (`#access_token=...`) instead of authorization code in query string (`?code=...`)

**Root Cause:**
- Supabase's `/auth/v1/authorize` endpoint uses implicit/PKCE flow by default
- Even with same-domain redirects, Supabase treats external OAuth flows with implicit flow
- The redirect URL allowlist controls whether redirects are allowed, NOT which OAuth flow is used

**Evidence:**
```
Expected: ...oauth-callback-handler?code=AUTH_CODE&state=...
Actual:   ...oauth-callback-handler?...#access_token=JWT&expires_at=...
```

**Attempted Solutions:**
1. ✗ Added callback handler to redirect allowlist (no effect on flow type)
2. ✗ Used wildcard patterns in allowlist (still implicit flow)
3. ✗ Created intermediate oauth-callback-handler function (still received implicit flow tokens)
4. ✗ Configured both GPT callback URLs in allowlist (no change)

#### Issue 2: Edge Function Authentication Requirements
**Problem:** Edge functions returned 401 "Missing authorization header" even for OAuth endpoints

**Solution Found:**
- Deploy functions with `--no-verify-jwt` flag
- Add `verify_jwt = false` to `functions/config.toml`
- OAuth endpoints must be publicly accessible (no authentication required)

**Status:** ✓ Resolved

#### Issue 3: Multiple GPT IDs Confusion
**Problem:** Testing with wrong GPT ID in redirect URLs

**Evidence:**
- Redirect allowlist had: `g-a63fd800d0e78437fca2b2af084b4683bef239c3`
- Actual GPT editor URL: `g-68e6c7b5553c81918c175e6007fba503`
- OAuth requests used the wrong GPT ID

**Solution:** Identified both GPT IDs and added correct URLs to allowlist

**Status:** ✓ Resolved (but didn't fix implicit flow issue)

#### Issue 4: Environment Variable Naming
**Problem:** Initial code used `SUPABASE_URL` but Edge Functions reserve `SUPABASE_` prefix

**Solution:** Used custom prefixes:
- `SUPA_UZO_FOOD_URL`
- `SUPA_UZO_FOOD_ANON_KEY`
- `UZO_FOOD_GPT_OAUTH_CLIENT_ID`
- `UZO_FOOD_GPT_OAUTH_CLIENT_SECRET`

**Status:** ✓ Resolved

## Why The Integration Failed

### Fundamental Incompatibility
**Supabase's OAuth Behavior:**
- Supabase's Google OAuth is designed for browser-based applications
- Uses implicit/PKCE flow for security (tokens in URL fragment)
- Not designed to be proxied through custom OAuth servers
- No documented way to force authorization code flow for external OAuth providers

**Custom GPT's Requirements:**
- Requires standard OAuth 2.0 authorization code flow
- Expects `?code=...` in query string (not `#access_token=...` in fragment)
- Cannot access URL fragments (server-side only)
- Token exchange must happen via `/token` endpoint

**The Mismatch:**
- Edge Functions cannot access URL fragments (browser-only via JavaScript)
- Supabase won't send authorization codes for external OAuth providers
- No configuration option to force authorization code flow
- Creating intermediate handlers doesn't change Supabase's flow selection

## Attempted Workarounds Considered (Not Implemented)

### Option 1: HTML/JavaScript Fragment Extraction
- Serve HTML page from oauth-callback-handler
- Use JavaScript to extract tokens from `window.location.hash`
- Send tokens to server endpoint to generate custom code
- Redirect to Custom GPT with custom code

**Drawbacks:** Complex, requires state management, non-standard

### Option 2: Custom Code Mapping System
- Store mapping of generated codes to access tokens
- Generate UUID codes when receiving implicit flow tokens
- Store in database/cache with short TTL
- Look up tokens during exchange

**Drawbacks:** Requires database storage, state management, complex

### Option 3: Accept Implicit Flow Tokens Directly
- Try passing access_token directly to Custom GPT
- Skip code exchange entirely

**Drawbacks:** Violates OAuth 2.0 spec, Custom GPT likely rejects it

## Lessons Learned

### Technical Lessons
1. **Supabase OAuth is designed for direct browser integration**, not for proxying through custom OAuth servers
2. **URL fragments are browser-only** - server-side proxies cannot access `#` content
3. **Redirect allowlists control authorization, not OAuth flow type** in Supabase
4. **Edge Functions must explicitly disable JWT verification** for public endpoints
5. **Testing OAuth flows requires understanding exact GPT IDs** and callback URLs

### Architectural Lessons
1. **OAuth proxying is complex** when upstream provider uses non-standard flows
2. **Implicit flow and authorization code flow are fundamentally incompatible** without client-side JavaScript
3. **Custom GPT OAuth integration requires** providers that natively support authorization code flow
4. **Supabase's OAuth is optimized for first-party apps**, not third-party integrations

### Process Lessons
1. **Validate OAuth flow compatibility early** before building proxy infrastructure
2. **Test with actual provider behavior** rather than assuming configuration controls flow
3. **Document all GPT IDs and callback URLs** to avoid confusion
4. **Check provider documentation** for OAuth flow configuration options

## The OpenAPI 3.1 Multiple Headers Problem

After abandoning OAuth integration, a second critical limitation emerged when attempting to use OpenAPI 3.1 for Custom GPT Actions with Supabase.

### The Problem

**Supabase's API requires two headers for authenticated requests:**
1. `apikey`: The Supabase ANON key (identifies the project)
2. `Authorization`: The JWT bearer token (identifies the user for RLS)

**Custom GPT Actions limitation:**
- OpenAPI 3.1 specification in Custom GPT only allows a **single authentication header**
- You can configure either an API key OR a bearer token, but **not both**
- No workaround exists within the OpenAPI 3.1 schema to pass multiple authentication headers

### What Was Attempted

**Approach 1: Configure Both Headers in OpenAPI Schema**
```yaml
components:
  securitySchemes:
    apiKey:
      type: apiKey
      in: header
      name: apikey
    bearerAuth:
      type: http
      scheme: bearer
security:
  - apiKey: []
    bearerAuth: []
```

**Result:** ✗ Custom GPT Actions only prompts for one authentication value, ignoring the second scheme.

**Approach 2: Use Additional Header Parameters**
Attempted to add `apikey` as a header parameter in the path definitions:
```yaml
parameters:
  - name: apikey
    in: header
    required: true
```

**Result:** ✗ Custom GPT Actions throws an error when you define an `in: "header"` parameter value. If you change to `in: "query"`, it ignores the parameter.

### Current Workaround: ANON Key Only (Prototype Solution)

**Implementation:**
- Disable Row Level Security (RLS) on all tables
- Use only the `apikey` header with Supabase ANON key
- No user authentication or JWT tokens required
- Migration: `20251013_001_disable_rls_for_public_access.sql`

**Configuration in Custom GPT:**
```yaml
components:
  securitySchemes:
    apiKey:
      type: apiKey
      in: header
      name: apikey
security:
  - apiKey: []
```

**How It Works:**
1. Custom GPT sends requests with only `apikey: YOUR_SUPABASE_ANON_KEY` header
2. Supabase accepts the request because RLS is disabled
3. All data is accessible without user authentication
4. Security relies solely on keeping the ANON key private

**Pros:**
- ✓ Simple implementation - no complex proxy infrastructure
- ✓ Works immediately with Custom GPT Actions
- ✓ No OAuth complexity
- ✓ No token expiration issues
- ✓ Suitable for personal/single-user applications

**Cons:**
- ✗ No data isolation between users (all data is effectively public)
- ✗ "Security through obscurity" - ANON key is the only protection
- ✗ Not suitable for multi-user applications
- ✗ Cannot use Supabase RLS policies for authorization
- ✗ If ANON key is exposed, entire database is accessible

**When This Solution Is Acceptable:**
- Personal single-user applications
- Prototype/development phases
- Applications where all data is effectively public anyway
- Trust-based environments where users won't share the ANON key

**When This Solution Is NOT Acceptable:**
- Multi-user applications requiring data isolation
- Production applications with sensitive user data
- Applications subject to compliance requirements (HIPAA, GDPR, etc.)
- Public-facing applications where the ANON key might be exposed

## Alternative Approaches for Custom GPT Integration

### Option 1: API Key Authentication (Simplest)
- Custom GPT uses API key authentication instead of OAuth
- User provides their Supabase JWT token directly to GPT
- No OAuth flow needed

**Pros:** Simple, works immediately
**Cons:** User must manually obtain and provide JWT token, less secure

### Option 2: Custom OAuth Server (Not Using Supabase)
- Build separate OAuth server using Auth0, Firebase Auth, or custom solution
- This OAuth server handles Google login independently
- Issues tokens that Custom GPT can use with Supabase RLS

**Pros:** Full control over OAuth flow
**Cons:** Additional infrastructure, complexity, cost

### Option 3: Supabase Auth + Manual Token Sharing
- User authenticates to Uzo Food Tracking web app via Supabase
- App displays JWT token for user to copy
- User provides token to Custom GPT as API key

**Pros:** Uses existing Supabase auth, simple for users
**Cons:** Manual token copying, tokens expire

### Option 4: No Authentication (Public API)
- Make Custom GPT API calls use anonymous access
- RLS policies allow limited public read access
- Users must be logged into web app for full features

**Pros:** No OAuth complexity
**Cons:** Limited functionality, potential security concerns

## Production-Grade Solutions for Multiple Headers Problem

For multi-user applications requiring proper authentication and RLS, you need a proxy/middleware layer to handle the header translation.

### Solution 1: Supabase Edge Function Proxy (Recommended for Supabase)

Create an Edge Function that acts as a middleware between Custom GPT and Supabase REST API.

**Architecture:**
```
Custom GPT → Edge Function Proxy → Supabase REST API
(sends JWT)   (adds apikey header)   (receives both headers)
```

**Implementation:**
```typescript
// supabase/functions/gpt-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Extract JWT from Custom GPT's Authorization header
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get the target endpoint from the request
  const url = new URL(req.url)
  const targetPath = url.searchParams.get('path') || ''

  // Forward to Supabase REST API with BOTH headers
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  const response = await fetch(`${supabaseUrl}/rest/v1/${targetPath}${url.search}`, {
    method: req.method,
    headers: {
      'Authorization': authHeader,  // User's JWT from Custom GPT
      'apikey': anonKey,            // Add ANON key
      'Content-Type': 'application/json',
      'Prefer': req.headers.get('Prefer') || ''
    },
    body: req.method !== 'GET' ? await req.text() : undefined
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**Custom GPT Configuration:**
```yaml
servers:
  - url: https://your-project.supabase.co/functions/v1/gpt-proxy
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
security:
  - bearerAuth: []
paths:
  /items:
    get:
      operationId: getItems
      parameters:
        - name: path
          in: query
          schema:
            type: string
            default: items
```

**Pros:**
- ✓ Enables RLS and proper authentication
- ✓ User isolation with JWT tokens
- ✓ No infrastructure beyond Supabase
- ✓ Edge functions scale automatically
- ✓ Keeps ANON key secret server-side

**Cons:**
- ✗ Additional Edge Function complexity
- ✗ Extra latency from proxy layer
- ✗ Need to map REST API endpoints
- ✗ Requires deploying and maintaining Edge Function

### Solution 2: Next.js/Express API Route Proxy

If you already have a web application backend, create API routes that proxy requests.

**Next.js Example:**
```typescript
// app/api/gpt-proxy/[...path]/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create Supabase client with user's JWT
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    }
  )

  // Forward the request to Supabase
  const path = params.path.join('/')
  const { data, error } = await supabase.from(path).select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
```

**Pros:**
- ✓ Full control over proxy logic
- ✓ Can add custom business logic
- ✓ Integrates with existing application
- ✓ Easy to test and debug locally

**Cons:**
- ✗ Requires separate infrastructure
- ✗ Need to handle scaling
- ✗ More code to maintain
- ✗ Additional deployment complexity

### Solution 3: API Gateway with Header Transformation

Use services like AWS API Gateway, Kong, or Cloudflare Workers to add headers.

**Cloudflare Worker Example:**
```typescript
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const supabaseUrl = 'https://your-project.supabase.co/rest/v1'

    // Clone request and add apikey header
    const modifiedRequest = new Request(`${supabaseUrl}${url.pathname}${url.search}`, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'apikey': env.SUPABASE_ANON_KEY,
      },
      body: request.body,
    })

    return await fetch(modifiedRequest)
  },
}
```

**Pros:**
- ✓ Managed infrastructure
- ✓ High performance/low latency
- ✓ Built-in scaling
- ✓ Can add rate limiting, caching, etc.

**Cons:**
- ✗ Additional service costs
- ✗ Vendor lock-in
- ✗ Learning curve for gateway configuration
- ✗ More complex deployment pipeline

### Solution Comparison

| Solution | Best For | Complexity | Cost | Performance |
|----------|----------|------------|------|-------------|
| ANON Key Only | Prototypes, single-user apps | Low | Free | Excellent |
| Edge Function Proxy | Supabase-native apps | Medium | Free tier available | Good |
| Next.js/Express Proxy | Apps with existing backend | Medium | Depends on hosting | Good |
| API Gateway | Enterprise applications | High | $$ | Excellent |

## Recommendation for Production

**For Multi-User Applications:**

Use **Supabase Edge Function Proxy** as the production solution:
1. Deploy an Edge Function that proxies requests from Custom GPT to Supabase
2. Edge Function receives JWT from Custom GPT's Authorization header
3. Edge Function adds the ANON key header before forwarding to Supabase
4. RLS policies enforce user isolation based on the JWT
5. Users authenticate via the web app and copy their JWT token to Custom GPT

**Why This Works:**
- ✓ Enables proper authentication and RLS
- ✓ No custom OAuth infrastructure needed
- ✓ Leverages existing Supabase authentication
- ✓ Users maintain full control over access
- ✓ Can revoke access by changing password
- ✓ No infrastructure beyond Supabase
- ✓ Keeps ANON key secure server-side

**Implementation Steps:**
1. Create Edge Function proxy (see code example above)
2. Deploy with `supabase functions deploy gpt-proxy --no-verify-jwt`
3. Add "Copy API Token" button to web app settings
4. Configure Custom GPT Actions with Edge Function URL
5. Enable RLS policies for authenticated users
6. Test with user JWT tokens

**For Personal/Prototype Applications:**

Use **ANON Key Only** approach (current implementation):
- Simple, immediate functionality
- No complex infrastructure
- Suitable for single-user scenarios
- Understand the security limitations
- Plan migration to Edge Function proxy for production

## Conclusion

Custom GPT integration with Supabase faces **two fundamental challenges**:

1. **OAuth Flow Incompatibility:** Supabase's implicit OAuth flow is incompatible with Custom GPT's authorization code flow requirements
2. **OpenAPI 3.1 Multiple Headers Limitation:** Custom GPT Actions cannot send both the `apikey` and `Authorization` headers required by Supabase

**For Prototypes:** The ANON key-only approach (with RLS disabled) provides a simple, working solution acceptable for personal and single-user applications.

**For Production:** A Supabase Edge Function proxy solves the multiple headers problem while enabling proper authentication, RLS, and user isolation. Users authenticate via the web app and provide their JWT token to the Custom GPT.

**Key Takeaway:** OAuth integration is not viable, but JWT-based authentication through an Edge Function proxy provides a production-grade solution for Custom GPT + Supabase integration.
